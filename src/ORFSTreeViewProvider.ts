import * as vscode from 'vscode';
import { ORFSTaskProvider } from './ORFSTaskProvider';
import * as path from 'path';
import { addAbortListener } from 'events';

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private commands: Promise<vscode.Task[]>;
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private highlighted_tasks: string[] = [];
    private static leafItemNames = ["2_floorplan_debug_macros", "6_report", "6_gds", "6_final"];
    //TODO(jbylicki): Make highlight a command
    private logWatchPath: string = "";
    private lastUri: string = "";

    constructor(private orfsTaskProvider: ORFSTaskProvider) {
        vscode.commands.registerCommand('orfsTasks.item_clicked', item => this.clicked(item));
        vscode.commands.registerCommand('orfsTasks.item_log', item => this.showLog(item));
        vscode.commands.registerCommand('orfsTasks.item_clean', item => this.runClean(item));
        vscode.commands.registerCommand('orfsTasks.item_gui', item => this.runGUI(item));
        vscode.commands.registerCommand('orfsTasks.clearHighlights', () =>
            this.clearHighlights()
        );
        vscode.tasks.onDidEndTask(()=>vscode.commands.executeCommand("orfsTasks.clearHighlights"));
        this.commands = Promise.resolve(this.orfsTaskProvider.provideTasks()!.then((tasklist)=>{
            this.logWatchPath = path.join(
                this.orfsTaskProvider.flowHome!,
                "logs",
                this.orfsTaskProvider.platform!,
                this.orfsTaskProvider.nickname!,
                "base"
            );

            let watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.logWatchPath, "**/*.log"));
            watcher.onDidChange(uri => this.addHighlight(uri.toString()));
            watcher.onDidCreate(uri => this.addHighlight(uri.toString()));
            return tasklist;
        }))
    }
    addHighlight(uri: string) {
        if (uri === this.lastUri) return;
        this.clearHighlights();
        if(!this.highlighted_tasks.includes(path.basename(uri).at(0)!)) {
            this.highlighted_tasks.push(path.basename(uri).at(0)!);
            this._onDidChangeTreeData.fire();
            this.lastUri = uri;
        }
    }
    clearHighlights() {
          this.highlighted_tasks = [];
          this.lastUri = "";
          this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        this.commands = Promise.resolve(this.orfsTaskProvider.provideTasks()!.then((tasklist)=>{
            return tasklist;
        }))
        this._onDidChangeTreeData.fire();
    }

    public clicked(item: TaskTreeItem) {
      return item.run();
    }
    public showLog(item: TaskTreeItem) {
      return item.showLogs();
    }
    public runClean(item: TaskTreeItem) {
      return item.runClean();
    }
    public runGUI(item: TaskTreeItem) {
      return item.runGUI();
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        element.command = {command: 'orfsTasks.item_clicked', title: element.label.label, arguments: [element]};
        return element;
    }

    createContextView(task: vscode.Task | undefined, logTask: vscode.Task | undefined, cleanTask: vscode.Task | undefined, guiTask: vscode.Task | undefined) {
        const tags: string[] = [];
        if (task) tags.push("run");
        if (logTask) tags.push("logs");
        if (cleanTask) tags.push("clean");
        if (guiTask) tags.push("gui");
        return tags.join("_");
    }

    getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
        return Promise.resolve(this.commands.then((tasks)=>{
            const items : TaskTreeItem[] = [];
            if (element && element.label.label === `${this.orfsTaskProvider.platform}/${this.orfsTaskProvider.nickname}`) {  // stages
                tasks.filter((el)=> el.name.match(/^[0-9]_[a-zA-Z].*/) && !TaskTreeProvider.leafItemNames.includes(el.name)).forEach((el)=>{
                    const stage = el.name.split('_')[1];
                    const clean_stage = tasks.find((t) => t.name === `clean_${stage}`);
                    const logTask = tasks.find((t) => t.name === `log ${el.name}`);
                    const guiTask = tasks.find((t) => t.name === `gui_${stage}`);
                    items.push(new TaskTreeItem(
                            {label: el.name, highlights: this.highlighted_tasks.some((e) => el.name.startsWith(e)) ? [[0, el.name.length]] : []},
                            vscode.workspace.name!,
                            (el.name === "1_synth") ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
                            el,
                            logTask,
                            guiTask,
                            clean_stage,
                            this.createContextView(el, logTask, clean_stage, guiTask),
                    ))
                });
            } else if (element) {  // leafs
                const prefix = element.label.label.slice(0, 2);  // prefix like [0-9]_
                tasks.filter((el) => el.name !== element.label.label && el.name.startsWith(prefix)).forEach((el)=> {
                    const logTask = tasks.find((t) => t.name.startsWith(`log ${el.name}`));
                    const guiTask = tasks.find((t) => t.name.startsWith(`gui_${el.name}`));
                    items.push(new TaskTreeItem(
                        {label: el.name, highlights: []},
                        vscode.workspace.name!,
                        vscode.TreeItemCollapsibleState.None,
                        el,
                        logTask,
                        guiTask,
                        undefined,
                        this.createContextView(el, logTask, undefined, guiTask),
                    ))
                });
            } else {  // root
                const clean_stage = tasks.find((t) => t.name === "clean_all");
                items.push(new TaskTreeItem(
                        {label: `${this.orfsTaskProvider.platform}/${this.orfsTaskProvider.nickname}`, highlights: []},
                        vscode.workspace.name!,
                        vscode.TreeItemCollapsibleState.Expanded,
                        undefined,
                        undefined,
                        undefined,
                        clean_stage,
                        this.createContextView(undefined, undefined, clean_stage, undefined),
                ))
            }
            return items.sort((a, b)=>a.label.label > b.label.label? 1 : -1)
        }))
    }
}

class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: vscode.TreeItemLabel,
        private version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private task: vscode.Task | undefined,
        private logTask: vscode.Task | undefined,
        private guiTask: vscode.Task | undefined,
        private cleanTask: vscode.Task | undefined,
        context: string | undefined,
    ) {
        super(label, collapsibleState);
        this.contextValue = context;
        this.tooltip = `${this.label}-${this.version}`;
        this.description = this.version;
    }
    public run() {
        if(this.task) {
            return Promise.resolve(vscode.tasks.executeTask(this.task))
        }
        return undefined;
    }
    public showLogs() {
        if(this.logTask)
            return vscode.tasks.executeTask(this.logTask)
        return undefined;
    }
    public runClean() {
        if(this.cleanTask)
            return vscode.tasks.executeTask(this.cleanTask)
        return undefined;
    }
    public runGUI() {
        if(this.guiTask)
            return vscode.tasks.executeTask(this.guiTask)
        return undefined;
    }

    //TODO(jbylicki): This was in the manual, but we'll need it at some point
    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
    };
}
