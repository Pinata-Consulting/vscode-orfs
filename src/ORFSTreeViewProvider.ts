import * as vscode from 'vscode';
import { ORFSTaskProvider } from './ORFSTaskProvider';
import * as path from 'path';

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private commands: Promise<vscode.Task[]>;
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private orfsTaskProvider: ORFSTaskProvider) {
        vscode.commands.registerCommand('orfsTasks.item_clicked', item => this.clicked(item));
        vscode.commands.registerCommand('orfsTasks.item_log', item => this.showLog(item));
        vscode.commands.registerCommand('orfsTasks.item_clean', item => this.runClean(item));
        this.commands = Promise.resolve(this.orfsTaskProvider.provideTasks()!.then((tasklist)=>{
            return tasklist;
        }))
    }

    refresh(): void {
        this.commands = Promise.resolve(this.orfsTaskProvider.provideTasks()!.then((tasklist)=>{
            return tasklist;
        }))
        this._onDidChangeTreeData.fire();
    }

    public clicked(item: TaskTreeItem) {
      return item.run()
    }
    public showLog(item: TaskTreeItem) {
      return item.showLogs()
    }
    public runClean(item: TaskTreeItem) {
      return item.runClean()
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        element.command = {command: 'orfsTasks.item_clicked', title: element.label, arguments: [element]}
        return element;
    }

    getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
        return Promise.resolve(this.commands.then((tasks)=>{
            const items : TaskTreeItem[] = []
            if (element && element.label === `${this.orfsTaskProvider.platform}/${this.orfsTaskProvider.nickname}`) {
                tasks.filter((el)=> el.name.match(/^[0-9]_[a-zA-Z].*/)).forEach((el)=>{
                    const stage = el.name.split('_')[1];
                    const clean_stage = tasks.find((t) => t.name === `clean_${stage}`);
                    items.push(new TaskTreeItem(
                            el.name,
                            vscode.workspace.name!,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            el,
                            undefined,
                            clean_stage,
                            "stage",
                    ))
                });
            } else if (element) {
                const prefix = element.label.slice(0, 2);  // prefix like [0-9]_
                tasks.filter((el) => el.name !== element.label && el.name.startsWith(prefix)).forEach((el)=> {
                    const logTask = tasks.find((t) => t.name.startsWith(`log ${el.name}`));
                    items.push(new TaskTreeItem(
                        el.name,
                        vscode.workspace.name!,
                        vscode.TreeItemCollapsibleState.None,
                        el,
                        logTask,
                        undefined,
                        "substage",
                    ))
                });
            } else {
                const clean_stage = tasks.find((t) => t.name === "clean_all");
                items.push(new TaskTreeItem(
                        `${this.orfsTaskProvider.platform}/${this.orfsTaskProvider.nickname}`,
                        vscode.workspace.name!,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        undefined,
                        undefined,
                        clean_stage,
                        "design",
                ))
            }
            return items.sort((a, b)=>a.label > b.label ? 1 : -1)
        }))
    }
}

class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private task: vscode.Task | undefined,
        private logTask: vscode.Task | undefined,
        private cleanTask: vscode.Task | undefined,
        context: string | undefined,
    ) {
        super(label, collapsibleState);
        this.contextValue = context;
        this.tooltip = `${this.label}-${this.version}`;
        this.description = this.version;
    }
    public run() {
        if(this.task)
            return vscode.tasks.executeTask(this.task)
        return undefined
    }
    public showLogs() {
        if(this.logTask)
            return vscode.tasks.executeTask(this.logTask)
        return undefined
    }
    public runClean() {
        if(this.cleanTask)
            return vscode.tasks.executeTask(this.cleanTask)
        return undefined
    }

    //TODO(jbylicki): This was in the manual, but we'll need it at some point
    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
    };
}
