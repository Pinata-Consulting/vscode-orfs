import * as vscode from 'vscode';
import * as path from 'path';
import { fileExists, runCommand } from './common'

interface ORFSTaskDefinition extends vscode.TaskDefinition {
    task: string;
    cwd: string | undefined;
}

export class ORFSTaskProvider implements vscode.TaskProvider {
    private logchannel: vscode.OutputChannel;
    private config: vscode.WorkspaceConfiguration;
    private orfshome: string | undefined;
    private configMkPath: string;
    private designconf: string | undefined;
    private orfsmakefilepath: string | undefined;
    private resultPromise: Thenable<vscode.Task[]> | undefined = undefined;
    public platform: string | undefined = undefined;
    public nickname: string | undefined = undefined;

    constructor(logChannel: vscode.OutputChannel) {
        this.config = vscode.workspace.getConfiguration("openroad-flow-scripts");
        this.logchannel = logChannel;
        this.orfshome = this.config.get<string>("path");
        this.designconf = this.config.get<string>("design config"); 
        this.configMkPath = "";
        vscode.workspace.onDidChangeConfiguration(() => {
            const newOrfs = vscode.workspace.getConfiguration().get("openroad-flow-scripts.path")
            const newDesignConf = vscode.workspace.getConfiguration().get("openroad-flow-scripts.design config")
            if(this.orfshome !== newOrfs || this.designconf !== newDesignConf) {
                this.orfshome = <string>newOrfs;
                this.designconf = <string>newDesignConf;

                // The data is outdated now - setting it to undefined will ensure that the next call
                // to provideTasks will re-generate them. It will trigger the rechecking of existence of config.mk
                this.resultPromise = undefined;
                vscode.commands.executeCommand("orfsTasks.refreshEntry");
            }
        });
    }

    private async updateORFSMakefilePath(): Promise<boolean> {
        this.orfshome = vscode.workspace.getConfiguration().get("openroad-flow-scripts.path");
        this.designconf = vscode.workspace.getConfiguration().get("openroad-flow-scripts.design config");
        if (!this.orfshome) {
            this.logchannel.appendLine(`OpenROAD-flow-scripts directory is not provided in the configuration.`);
            this.logchannel.appendLine(`Please configure the flow-scripts-home variable to path with https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts.`);
            return false;
        }
        if (!this.designconf) {
            this.logchannel.appendLine(`Design config path has not been set in settings`);
            this.logchannel.appendLine(`This will search for config.mk file in workspace root`);
            this.logchannel.appendLine(`If this approach fails, all started flows will process the default ORFS target`);
            this.logchannel.appendLine(`Additionally, log printing tasks will not get generated`);
        }
        this.orfsmakefilepath = path.join(this.orfshome, 'flow');
        if (!fileExists(this.orfsmakefilepath)) {
            this.logchannel.appendLine(`${this.orfsmakefilepath} does not exist. Please provide correct flow-scripts-home`);
            return false;
        }
        return true;
    }

    private async runMakeCommandForWorkspace(cmd: string, workspace: vscode.WorkspaceFolder): Promise<string | undefined> {
        if (!this.updateORFSMakefilePath()) return undefined;
        var fullcommand;
        const workspacedir = workspace.uri.fsPath;
        if (!workspacedir) return undefined;
        this.configMkPath = path.join(workspacedir, this.designconf ?? "", 'config.mk');
        if (!fileExists(this.configMkPath)) {
            this.logchannel.appendLine(`WARNING config.mk not found, all processing will use default targets in ORFS!`);
            fullcommand = `make -C ${this.orfsmakefilepath} ${cmd}`;
        }
        else {
            fullcommand = `make -C ${this.orfsmakefilepath} DESIGN_CONFIG=${this.configMkPath} ${cmd}`;
        }

        try {
            const {stdout, stderr} = await runCommand(fullcommand, {cwd: workspacedir});
            if (stderr && stderr.length > 0) {
                this.logchannel.appendLine(stderr);
                this.logchannel.show(true);
            }
            if (stdout) {
                return stdout;
            }
        } catch (err: any) {
            if (err.stderr) {
                this.logchannel.appendLine(err.stderr);
            }
            if (err.stdout) {
                this.logchannel.appendLine(err.stdout);
            }
        }
        return undefined;
    }

    public async getORFSMakefileTasks(): Promise<vscode.Task[]> {
        const result: vscode.Task[] = [];
        if (!this.updateORFSMakefilePath()) return result;
        const workspaces = vscode.workspace.workspaceFolders;
        if (!workspaces) return result;
        const taskcollect = "-np | grep -E '^[a-zA-Z0-9_-]+:.*?($|:| )' | cut -d ':' -f 1 | sort | uniq | grep -E '^(do-[0-9])'";
        const cleancollect = "-np | grep -E '^[a-zA-Z0-9_-]+:.*?($|:| )' | cut -d ':' -f 1 | sort | uniq | grep -E '^clean'";
        const getnickname = "print-DESIGN_NICKNAME 2>/dev/null | grep DESIGN_NICKNAME | tr ' ' '\n' | tail -n 1"
        const getplatform = "print-PLATFORM 2>/dev/null | grep PLATFORM | tr ' ' '\n' | tail -n 1"
        for (const workspace of workspaces) {
            const tasksstring = await this.runMakeCommandForWorkspace(taskcollect, workspace);
            const cleanstring = await this.runMakeCommandForWorkspace(cleancollect, workspace);
            this.platform = (await this.runMakeCommandForWorkspace(getplatform, workspace))!.trim();
            this.nickname = (await this.runMakeCommandForWorkspace(getnickname, workspace))!.trim();
            this.logchannel.appendLine(`PLATFORM: ${this.platform}`);
            this.logchannel.appendLine(`NICNAME: ${this.nickname}`);
            const workspacedir = workspace.uri.fsPath;
            if (!workspacedir) return [];
            for (const taskname of tasksstring ? tasksstring.split("\n") : []) {
                const definition: ORFSTaskDefinition = {
                    type: 'orfs',
                    task: taskname,
                    cwd: workspace.uri.fsPath
                }

                // Filter out tasks based on granularity - major steps launch as
                // `make foo`, while smaller as `make do-x_y_foo_bar`
                let tasklaunch: string = "";

                // A flag to later possibly append a "print logs" task -
                // this is only valid for minor steps (do-x_y_foo_bar)
                let logflag: boolean = false;
                if (taskname === "do-2_floorplan_debug_macros") {
                    tasklaunch = "2_floorplan_debug_macros";
                    logflag = true;
                } else if (taskname.match(/^do-[0-9]_[a-zA_Z]/))
                    tasklaunch = taskname.split('-')[1].split("_").filter((el)=>isNaN(Number(el))).join("_")
                else if (taskname.match(/^do-[0-9]_[0-9]/)) {
                    tasklaunch = taskname;
                    logflag = true;
                }

                const task = new vscode.Task(
                    definition,
                    workspace,
                    taskname.split("-")[1],
                    "orfs",
                    new vscode.ShellExecution(
                        `make -C ${this.orfsmakefilepath} ${
                            fileExists(this.configMkPath) ?
                            "DESIGN_CONFIG=" + this.configMkPath :
                            ""
                        } ${tasklaunch}`
                    )
                );
                result.push(task);
                task.group = vscode.TaskGroup.Build;
                if(logflag) {
                    const logPath = path.join(
                        this.orfsmakefilepath!,
                        "logs",
                        this.platform,
                        this.nickname,
                        "base",
                        taskname.split("-")[1] + ".log"
                    )
                    const logefinition: ORFSTaskDefinition = {
                        type: 'orfs',
                        task: "log" + taskname,
                        cwd: workspace.uri.fsPath
                    }
                    const logtask = new vscode.Task(
                        logefinition,
                        workspace,
                        "log " + taskname.split("-")[1],
                        "orfs",
                        // TODO (jbylicki): `code -r` is a temporary workaround around running a Task that opens an editor with log files
                        // new vscode.CustomExecution(
                        //     async (): Promise<vscode.Pseudoterminal> => {
                        //         if(await fileExists(logPath))
                        //             return vscode.workspace.openTextDocument(logPath).then((doc: vscode.TextDocument) => {
                        //                 vscode.window.showTextDocument(doc);
                        //             })
                        //
                        //     }
                        // )
                        new vscode.ShellExecution(`if [ -f '${logPath}' ]; then "code -r '${logPath}'"; else echo "Log file not found: ${logPath}"; fi`)
                    );
                    result.push(logtask)
                    logtask.group = vscode.TaskGroup.Build;
                }
            }
            for (const taskname of cleanstring ? cleanstring.split("\n") : []) {
                const definition: ORFSTaskDefinition = {
                    type: 'orfs',
                    task: taskname,
                    cwd: workspace.uri.fsPath
                }
                const task = new vscode.Task(
                    definition,
                    workspace,
                    taskname,
                    "orfs",
                    new vscode.ShellExecution(
                        `make -C ${this.orfsmakefilepath} ${
                            fileExists(this.configMkPath) ?
                            "DESIGN_CONFIG=" + this.configMkPath :
                            ""
                        } ${taskname}`
                    )
                );
                result.push(task);
                task.group = vscode.TaskGroup.Build;
            }
        }
        return result;
    }

    public provideTasks(): Thenable<vscode.Task[]> | undefined {
        if (!this.resultPromise) {
            if (!this.updateORFSMakefilePath()) return;
            this.logchannel.appendLine(`OpenROAD-flow-scripts path: ${this.orfshome}`);
            this.logchannel.show(true);
            this.resultPromise = this.getORFSMakefileTasks();
        }
        return this.resultPromise;
    }
    public resolveTask(_: vscode.Task): vscode.Task | undefined {
        // TODO
        return undefined;
    }
}
