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
