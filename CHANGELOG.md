# Changelog

All notable changes to Runfjord. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/).

## [1.4.1] — 2026-11-24

### Added
- One-command Linux installer: `curl -fsSL https://raw.githubusercontent.com/LastJaegerVA/runfjord/main/install.sh | bash`
  (no admin rights, adds an app-menu entry and a `runfjord` command, also updates and uninstalls).

### Fixed
- Release builds: the Windows build now installs NSIS itself, and the Linux download is published even if the Windows build fails.

## [1.4.0] — 2026-11-24

### Added
- 35 interface languages, picked automatically from the computer's language: Arabic, Bengali, Bulgarian,
  Chinese (Simplified and Traditional), Croatian, Czech, Danish, Dutch, English, Finnish, French, German, Greek,
  Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Malay, Norwegian, Persian, Polish, Portuguese,
  Romanian, Russian, Spanish, Swahili, Swedish, Thai, Turkish, Ukrainian and Vietnamese.
- Full right-to-left layout for Arabic, Hebrew and Persian. Code, paths and terminal output stay left-to-right.
- Correct plural forms for every language (for example Russian, Polish, Arabic).
- The Windows installer speaks 34 of these languages and shows the licence.
- GitHub release workflow that builds the Windows installer and Linux AppImage.

### Changed
- Translations moved to one file per language in `renderer/locales/`.

## [1.3.0] — 2026-11-23

### Added
- Windows installer: per-user install, Start menu and desktop shortcuts, entry in *Apps & features*, uninstaller.
- First 7 interface languages and a language setting.
- Toolbar buttons collapse to icons when a translation doesn't fit.

## [1.2.0] — 2026-11-23

### Changed
- Renamed from *Scriptorium* to **Runfjord**, with a new original icon. Existing libraries are migrated automatically.

## [1.1.0] — 2026-11-23

### Added
- 10 themes, an *Auto* theme that follows the system, custom accent colours, and <kbd>Ctrl</kbd>+<kbd>T</kbd> to switch theme.

## [1.0.0] — 2026-11-23

### Added
- First release: script library with descriptions, categories, tags and favourites; one-click running with live
  output; run in terminal; built-in code editor; new-script templates; search and sorting; export/import.

[1.4.1]: ../../releases/tag/v1.4.1
[1.4.0]: ../../releases/tag/v1.4.0
[1.3.0]: ../../releases/tag/v1.3.0
[1.2.0]: ../../releases/tag/v1.2.0
[1.1.0]: ../../releases/tag/v1.1.0
[1.0.0]: ../../releases/tag/v1.0.0
