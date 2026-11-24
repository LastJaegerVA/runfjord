# Third-party notices

Runfjord's own source code, artwork (the app icon and in-app logo) and translations are
© 2026 LastJaegerVA and released under the [MIT License](LICENSE).

The app is built on the open-source projects below. Their licences allow redistribution;
the notices they require are listed here and shipped with every build.

## Shipped inside the app

| Component | Licence | Notes |
|---|---|---|
| [Electron](https://github.com/electron/electron) | MIT | The desktop runtime. Its licence is included in every build as `LICENSE.electron.txt`. |
| [Chromium](https://www.chromium.org/) and its bundled libraries | BSD-3-Clause and others | Included with Electron. The full list of Chromium's components and their licences ships with every build as `LICENSES.chromium.html`. |
| [Node.js](https://github.com/nodejs/node) | MIT | Included with Electron. |

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
