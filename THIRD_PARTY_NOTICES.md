# Third-party notices

Runfjord's own source code, artwork (the app icon, in-app logo and the wallpapers, which are drawn in code) and translations are
© 2026 Jonas Olsen-Sund (LastJaegerVA) and released under the [MIT License](LICENSE).

The app is built on the open-source projects below. Their licences allow redistribution;
the notices they require are listed here and shipped with every build.

## Shipped inside the app

| Component | Licence | Notes |
|---|---|---|
| [Electron](https://github.com/electron/electron) | MIT | The desktop runtime. Its licence is included in every build as `LICENSE.electron.txt`. |
| [Chromium](https://www.chromium.org/) and its bundled libraries | BSD-3-Clause and others | Included with Electron. The full list of Chromium's components and their licences ships with every build as `LICENSES.chromium.html`. |
| [Node.js](https://github.com/nodejs/node) | MIT | Included with Electron. |
| [xterm.js](https://github.com/xtermjs/xterm.js) (`@xterm/xterm`, `@xterm/addon-fit`) | MIT | Draws the built-in terminal. © The xterm.js authors, SourceLair Private Company, Christopher Jeffrey. Licence shipped in `node_modules/@xterm/*/LICENSE`. |
| [node-pty](https://github.com/microsoft/node-pty) | MIT | Connects the built-in terminal to a real shell. © Christopher Jeffrey and Microsoft Corporation. On Windows it includes Microsoft's ConPTY files (`conpty.dll`, `OpenConsole.exe`, MIT) and [winpty](https://github.com/rprichard/winpty) (MIT). Licences shipped in `node_modules/node-pty/`. |

## Used only to build the app (not shipped as code)

| Component | Licence | Notes |
|---|---|---|
| [electron-builder](https://github.com/electron-userland/electron-builder) | MIT | Packages the Linux AppImage and the Windows app folder. |
| [NSIS](https://nsis.sourceforge.io/) (Nullsoft Scriptable Install System) | zlib/libpng | Builds the Windows installer. Installers made with NSIS may be distributed freely; its language files provide the installer's built-in texts. |

## Fonts

Runfjord does not bundle any fonts. It uses the fonts already installed on the computer
(for example Segoe UI on Windows, or Inter / Noto Sans on Linux if present).

## Translations

All 35 translations were written for this project and are covered by the MIT License.
They have not all been reviewed by native speakers yet — corrections are very welcome
(see [CONTRIBUTING.md](CONTRIBUTING.md)).
