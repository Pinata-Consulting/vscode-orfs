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
    public flowHome: string | undefined;
    private configMkPath: string;
    private designconf: string | undefined;
    private resultPromise: Thenable<vscode.Task[]> | undefined = undefined;
    public platform: string | undefined = undefined;
    public nickname: string | undefined = undefined;

    constructor(logChannel: vscode.OutputChannel) {
        this.config = vscode.workspace.getConfiguration("openroad-flow-scripts");
        this.logchannel = logChannel;
        this.flowHome = this.config.get<string>("openroad-flow-scripts.path");
        this.designconf = this.config.get<string>("openroad-flow-scripts.design config");
        this.configMkPath = "";
        vscode.workspace.onDidChangeConfiguration(() => {
            const newFlowHome = vscode.workspace.getConfiguration().get("openroad-flow-scripts.path")
            const newDesignConf = vscode.workspace.getConfiguration().get("openroad-flow-scripts.design config")
            if(this.flowHome !== newFlowHome || this.designconf !== newDesignConf) {
                this.flowHome = <string>newFlowHome;
                this.designconf = <string>newDesignConf;

                // The data is outdated now - setting it to undefined will ensure that the next call
                // to provideTasks will re-generate them. It will trigger the rechecking of existence of config.mk
                this.resultPromise = undefined;
                vscode.commands.executeCommand("orfsTasks.refreshEntry");
            }
        });
    }

    private async updateORFSMakefilePath(): Promise<boolean> {
        this.flowHome = vscode.workspace.getConfiguration().get("openroad-flow-scripts.path");
        this.designconf = vscode.workspace.getConfiguration().get("openroad-flow-scripts.design config");
        if (!this.flowHome) {
            this.logchannel.appendLine(`OpenROAD-flow-scripts directory is not provided in the configuration.`);
            this.logchannel.appendLine(`Please configure the flow-scripts-home variable to path with https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts.`);
            return false;
        }
        if (!fileExists(this.flowHome)) {
            this.logchannel.appendLine(`${this.flowHome} does not exist. Please provide correct flow-scripts-home`);
            return false;
        }
        if (!fileExists(path.join(this.flowHome, "Makefile"))) {
            this.logchannel.appendLine(`${this.flowHome} does not have Makefile. Please provide correct flow-scripts-home`);
            return false;
        }
        if (!this.designconf) {
            this.logchannel.appendLine(`Design config path has not been set in settings`);
            this.logchannel.appendLine(`This will search for config.mk file in workspace root`);
            this.logchannel.appendLine(`If this approach fails, all started flows will process the default ORFS target`);
            this.logchannel.appendLine(`Additionally, log printing tasks will not get generated`);
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
            fullcommand = `make -C ${this.flowHome} ${cmd}`;
        }
        else {
            fullcommand = `make -C ${this.flowHome} DESIGN_CONFIG=${this.configMkPath} ${cmd}`;
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

    private static manageCustomStages = new Map<string, {launch: string, name: string, logs: string | undefined}>([
        ["do-synth", {
            launch: 'synth',
            name: 'do-1_synth',
            logs: '1_1_yosys.log',
        }],
        ['do-2_floorplan_debug_macros', {
            launch: '2_floorplan_debug_macros',
            name: 'do-2_floorplan_debug_macros',
            logs: '2_floorplan_debug_macros.log',
        }],
        ['do-6_1_fill', {
            launch: 'do-6_1_fill do-6_1_fill.sdc',
            name: 'do-6_1_fill',
            logs: undefined,
        }],
        ['do-6_report', {
            launch: 'do-6_report',
            name: 'do-6_report',
            logs: '6_report.log',
        }],
        ['do-final', {
            launch: 'do-6_final.sdc',
            name: 'do-6_final',
            logs: undefined,
        }],
        ['do-gds', {
            launch: 'do-gds',
            name: 'do-6_gds',
            logs: '6_1_merge.log',
        }],
        ['do-finish', {
            launch: 'finish',
            name: 'do-6_finish',
            logs: undefined,
        }],
        ['gui_final', {
            launch: 'gui_final',
            name: 'gui_finish',
            logs: undefined,
        }],
    ]);

    public async getORFSMakefileTasks(): Promise<vscode.Task[]> {
        const result: vscode.Task[] = [];
        if (!this.updateORFSMakefilePath()) return result;
        const workspaces = vscode.workspace.workspaceFolders;
        if (!workspaces) return result;
        const taskcollect = "-np | grep -E '^[a-zA-Z0-9_-]+:.*?($|:| )' | cut -d ':' -f 1 | sort | uniq | grep -E '^(do-)'";
        const guicollect = "-np | grep -E '^[a-zA-Z0-9_-]+:.*?($|:| )' | cut -d ':' -f 1 | sort | uniq | grep -E '^(gui_)'";
        const cleancollect = "-np | grep -E '^[a-zA-Z0-9_-]+:.*?($|:| )' | cut -d ':' -f 1 | sort | uniq | grep -E '^clean'";
        const getnickname = "print-DESIGN_NICKNAME 2>/dev/null | grep DESIGN_NICKNAME | tr ' ' '\n' | tail -n 1"
        const getplatform = "print-PLATFORM 2>/dev/null | grep PLATFORM | tr ' ' '\n' | tail -n 1"
        for (const workspace of workspaces) {
            const tasksstring = await this.runMakeCommandForWorkspace(taskcollect, workspace);
            const guistring = await this.runMakeCommandForWorkspace(guicollect, workspace);
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
                let tasknameCustom: string = taskname;

                // Filter out tasks based on granularity - major steps launch as
                // `make foo`, while smaller as `make do-x_y_foo_bar`
                let tasklaunch: string = "";

                // A flag to later possibly append a "print logs" task -
                // this is only valid for minor steps (do-x_y_foo_bar)
                let logflag: boolean = false;
                let taskLogfile: string | undefined = undefined;
                if (ORFSTaskProvider.manageCustomStages.has(taskname)) {
                    const taskConfig = ORFSTaskProvider.manageCustomStages.get(taskname)!;
                    tasknameCustom = taskConfig.name;
                    tasklaunch = taskConfig.launch;
                    logflag = Boolean(taskConfig.logs);
                    taskLogfile = taskConfig.logs;
                } else if (taskname.match(/^do-[0-9]_[a-zA_Z]/))
                    tasklaunch = taskname.split('-')[1].split("_").filter((el)=>isNaN(Number(el))).join("_");
                else if (taskname.match(/^do-[0-9]_[0-9]/)) {
                    tasklaunch = taskname;
                    logflag = true;
                }
                else {
                    continue;
                }

                const task = new vscode.Task(
                    definition,
                    workspace,
                    tasknameCustom.split("-")[1],
                    "orfs",
                    new vscode.ShellExecution(
                        `make -C ${this.flowHome} ${
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
                        this.flowHome!,
                        "logs",
                        this.platform,
                        this.nickname,
                        "base",
                        (taskLogfile ?? taskname.split("-")[1] + ".log")
                    )
                    const logefinition: ORFSTaskDefinition = {
                        type: 'orfs',
                        task: "log" + taskname,
                        cwd: workspace.uri.fsPath
                    }
                    const logtask = new vscode.Task(
                        logefinition,
                        workspace,
                        "log " + tasknameCustom.split("-")[1],
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
                        new vscode.ShellExecution(`if [ -f '${logPath}' ]; then code -r '${logPath}'; else echo "Log file not found: ${logPath}"; fi`)
                    );
                    result.push(logtask)
                    logtask.group = vscode.TaskGroup.Build;
                }
            }
            for (let taskname of ((cleanstring ? cleanstring.split("\n") : []).concat(guistring ? guistring.split("\n") : []))) {
                let launch: string | undefined = undefined;
                if (ORFSTaskProvider.manageCustomStages.has(taskname)) {
                    const config = ORFSTaskProvider.manageCustomStages.get(taskname)!;
                    taskname = config.name;
                    launch = config.launch;
                }
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
                        `make -C ${this.flowHome} ${
                            fileExists(this.configMkPath) ?
                            "DESIGN_CONFIG=" + this.configMkPath :
                            ""
                        } ${launch ?? taskname}`
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
            this.logchannel.appendLine(`OpenROAD-flow-scripts path: ${this.flowHome}`);
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
