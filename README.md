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

## Using extension with Developer container and ORFS Docker image

To use the extension with the `ghcr.io/antmicro/openroad-flow-scripts/ubuntu22.04` OpenROAD developer image, you can use [Visual Studio Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers).
To do so, follow the below steps:

* Install [Dev Containers extension in VSCode](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
* Provide the following `.devcontainer/devcontainer.json` file in your project (options provided in `runArgs` are necessary for OpenROAD GUI, also requires e.g. `xhost +local:` to allow running GUI from the container):
  ```json
  {
      "name": "orfs-tinyRocket",
      "image": "ghcr.io/antmicro/openroad-flow-scripts/ubuntu22.04",
      "runArgs": [
          "-e", "DISPLAY",
          "-e", "XAUTHORITY",
          "-e", "XDG_RUNTIME_DIR",
          "-v", "/tmp/.X11-unix/:/tmp/.X11-unix/"
      ]
  }
  ```
* Allow VSCode to set up the development container
* Follow steps from [Building and running the extension](building-and-running-the-extension) to install the plugin for the Dev Container
* In the extension settings, set `OpenROAD-flow-scripts: Path` to `/OpenROAD-flow-scripts/flow`, which is a path inside a container to OpenROAD-flow-scripts tools.

You can also provide the direct path to the `vscode-orfs.vsix` extension in the `devcontainer.json` file. Once built, you can provide it as follows (assuming it is placed in `/plugins/vscode-orfs.vsix`):

```json
{
    ...
    "customizations": {
        "vscode": {
            "extensions": [
                "/plugins/vscode-orfs.vsix"
            ]
        }
    },
    ...
}
```

From this point, you should be able to use OpenROAD tools present in the container.
