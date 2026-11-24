# Changelog

All notable changes to Runfjord. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/).

## [1.7.0] - 2026-11-24

### Added
- **8 new themes with matching wallpapers**: Fjord Night, Dawn, Deep Sea, Nebula, Dunes, Glacier, Blossom and Moss. The wallpapers are original artwork drawn in code (no image files).
- **Settings → Wallpaper**: match the theme, none, or pick any wallpaper for any theme. The sidebar and list turn softly see-through so the wallpaper shows.

## [1.6.0] - 2026-11-24

### Added
- **Select several scripts and remove them at once**: the new select button above the list (or Ctrl+click on a card, or *Select* in the right-click menu) shows tick boxes, with *Select all*, *Select none* and *Remove*. <kbd>Ctrl</kbd>+<kbd>A</kbd> selects all, <kbd>Delete</kbd> removes, <kbd>Esc</kbd> stops selecting.
- **Settings → Clean up → Remove all scripts** empties the library after asking first. Categories and settings are kept.
- Removing only takes scripts out of the library — the files on your disk are never deleted.

### Changed
- App ID is now `io.github.lastjaegerva.runfjord`.

## [1.5.2] - 2026-11-24

### Changed
- Copyright is held as "Jonas Olsen-Sund (LastJaegerVA)"; author, publisher and maintainer stay LastJaegerVA.

## [1.5.1] - 2026-11-24

### Changed
- The author, publisher and maintainer name is now LastJaegerVA (installer, app details, Linux packages).

## [1.5.0] - 2026-11-24

### Added
- **Find scripts on this computer** (magnifier button in the sidebar): searches `~/bin`, `~/.local/bin`, `~/scripts`, Documents, Desktop, Downloads and any folders you add, recognises scripts by file type or by their `#!` line, skips program, system, hidden and Python-environment folders, fills in descriptions from each script's top comment, and sorts them into categories by language or folder name. Nothing is added until you choose. Translated into all 35 languages.

## [1.4.4] - 2026-11-24

### Changed
- Arch / CachyOS install command now downloads the package first, then runs `sudo pacman -U` on it (pacman refuses unsigned packages given as a web link).

## [1.4.3] - 2026-11-24

### Fixed
- Windows installer now builds on GitHub: installer languages missing from the NSIS version in use (e.g. Swahili) are skipped instead of stopping the build.

## [1.4.2] — 2026-11-24

### Added
- Arch package: `sudo pacman -U https://github.com/LastJaegerVA/runfjord/releases/latest/download/runfjord-x86_64.pkg.tar.xz`

### Fixed
- Windows installer build: installer scripts are now read as UTF-8 on Windows.

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

[1.7.0]: https://github.com/LastJaegerVA/runfjord/releases/tag/v1.7.0
[1.6.0]: https://github.com/LastJaegerVA/runfjord/releases/tag/v1.6.0
[1.5.2]: https://github.com/LastJaegerVA/runfjord/releases/tag/v1.5.2
[1.5.1]: https://github.com/LastJaegerVA/runfjord/releases/tag/v1.5.1
[1.5.0]: https://github.com/LastJaegerVA/runfjord/releases/tag/v1.5.0
[1.4.4]: https://github.com/LastJaegerVA/runfjord/releases/tag/v1.4.4
[1.4.3]: https://github.com/LastJaegerVA/runfjord/releases/tag/v1.4.3
[1.4.2]: ../../releases/tag/v1.4.2
[1.4.1]: ../../releases/tag/v1.4.1
[1.4.0]: ../../releases/tag/v1.4.0
[1.3.0]: ../../releases/tag/v1.3.0
[1.2.0]: ../../releases/tag/v1.2.0
[1.1.0]: ../../releases/tag/v1.1.0
[1.0.0]: ../../releases/tag/v1.0.0
