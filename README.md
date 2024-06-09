# OpenROAD flow scripts plugin for Visual Studio Code

This extension provides support for design building steps in [OpenROAD flow scripts](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts).

## Building and running the extension

The extension requires `npm` and Visual Studio Code (at least 1.89.0).
To install all extension dependencies, run the following command in project's root directory:

```
npm i
```

The `package.json` provides the following scripts:

* `npm run compile` - compiles the extension for development to `out/extension.js`
* `npm run watch` - runs automatic compilation upon changes in the repository
* `npm run pretest` - compiles the code and performs linting
* `npm run lint` - runs linting on code
* `npm run build-extension` - builds the `vscode-orfs.vsix` extension that can be installed in Visual Studio Code.

## Installing the extension in Visual Studio Code

To install the extension in Visual Studio Code:

* Run compilation and extension build with:
  ```
  npm i
  npm run compile
  npm run build-extension
  ```
* Install the extension via the extensions tab (`Ctrl-Shift-X`) - use the top context menu option `Install from VSIX`, selecting the built extension file (`vscode-orfs.vsix`)

## Usage

First, configure the extension's OpenROAD path via VSCode's settings panel.
Open it via the sidebar, or with the shortcut `Ctrl+,`.
Next, go to the `Extensions` tab and select the `OpenROAD flow scripts` extension.
Then, set the `OpenROAD-flow-scripts: Path` to the root directory of your `OpenROAD-flow-scripts` repository.

The additional configuration setting can be left blank.
It provides the ability to change the subdirectory in a workspace, where a design configuration file (`config.mk`) will be located, and it is meant to be set on a per-workspace level.

Open any design as a workspace in VSCode after configuration and open the explorer tab (`Ctrl-Shift-E`).
Located at the bottom is a folded Tree View that, when expanded, will show a hierarchical view of all the available tasks.

![Explorer panel with Tree View](./vscode-explorer-tree-view.png?raw=true)

The list of tasks allows to:

* Run the specified step - either click on the task or open the context menu (with mouse right click) and run `Run Task`
* Clean the specified step - right click to open the context menu and select `Clean ...`
* Open GUI for a specified step - right click to open the context menu and select `Run OpenROAD GUI`.

Additionally, each task can be launched from the task list.
To access it, use the Command Palette (`Ctrl-Shift-P`), then select the option `Tasks: Run Task`, then `orfs`, and finally the task you wish to run.
