import * as vscode from 'vscode';
import { ORFSTaskProvider } from './ORFSTaskProvider';
import { TaskTreeProvider as TaskTreeProvider } from './ORFSTreeViewProvider';

let orfsTaskProvider: vscode.Disposable | undefined;

// entrypoint for configuring VSCode extension
export function activate(_: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel("orfs");
    const taskProvider = new ORFSTaskProvider(output)

    // registerTaskProvider only returns a Disposable, TreeView requires a TaskProvider
    orfsTaskProvider = vscode.tasks.registerTaskProvider("orfs", taskProvider);
    const treeDataProvider = new TaskTreeProvider(taskProvider);
    vscode.window.createTreeView('orfsTasks', {
        treeDataProvider: treeDataProvider
    });
    vscode.commands.registerCommand('orfsTasks.refreshEntry', () =>
        treeDataProvider.refresh()
    );
}

// entrypoint for tearing down VSCode extension
export function deactivate() {}
