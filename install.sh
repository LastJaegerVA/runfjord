#!/usr/bin/env bash
# Runfjord installer for Linux — no download, no admin rights needed.
#
#   curl -fsSL https://raw.githubusercontent.com/LastJaegerVA/runfjord/main/install.sh | bash
#
# Fetches the newest release from GitHub, puts the AppImage in ~/.local/bin,
# and adds Runfjord to your app menu with its icon. Running it again updates Runfjord.
#
# Remove Runfjord with:
#   curl -fsSL https://raw.githubusercontent.com/LastJaegerVA/runfjord/main/install.sh | bash -s -- --uninstall
set -euo pipefail

REPO="LastJaegerVA/runfjord"
API="${RUNFJORD_API:-https://api.github.com/repos/$REPO/releases/latest}"
BIN_DIR="$HOME/.local/bin"
APPIMAGE="$BIN_DIR/Runfjord.AppImage"
LAUNCHER="$BIN_DIR/runfjord"
DESKTOP_FILE="$HOME/.local/share/applications/runfjord.desktop"
ICON_FILE="$HOME/.local/share/icons/hicolor/256x256/apps/runfjord.png"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

uninstall() {
  say "Removing Runfjord…"
  rm -f "$APPIMAGE" "$LAUNCHER" "$DESKTOP_FILE" "$ICON_FILE"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$(dirname "$DESKTOP_FILE")" >/dev/null 2>&1 || true
  say "Done. Your script library is still in ~/.config/Runfjord — delete that folder to remove it too."
  exit 0
}
[ "${1:-}" = "--uninstall" ] && uninstall

[ "$(uname -s)" = "Linux" ] || die "This installer is for Linux. On Windows, get the installer from https://github.com/$REPO/releases/latest"
[ "$(uname -m)" = "x86_64" ] || die "Runfjord is only built for 64-bit PCs (x86_64) so far."
command -v curl >/dev/null 2>&1 || die "curl is needed. Install it with your package manager, then run this again."

say "Looking up the newest Runfjord release…"
release=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API") \
  || die "Couldn't reach GitHub. Check your internet connection, or download the AppImage from https://github.com/$REPO/releases"
url=$(printf '%s' "$release" | grep -o '"browser_download_url": *"[^"]*\.AppImage"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/' || true)
[ -n "$url" ] || die "The newest release has no Linux file yet. Check https://github.com/$REPO/releases in a few minutes."
version=$(printf '%s' "$release" | grep -o '"tag_name": *"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
say "Downloading Runfjord ${version:-}…"
curl -fL --progress-bar -o "$tmp/Runfjord.AppImage" "$url" || die "Download failed: $url"

say "Installing…"
mkdir -p "$BIN_DIR" "$(dirname "$DESKTOP_FILE")" "$(dirname "$ICON_FILE")"
pkill -x runfjord >/dev/null 2>&1 || true
install -m 755 "$tmp/Runfjord.AppImage" "$APPIMAGE"
curl -fsSL -o "$ICON_FILE" "https://raw.githubusercontent.com/$REPO/main/docs/icon.png" || true

# AppImages need libfuse2; without it they can still run by unpacking themselves first.
extra_env=""
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; then extra_env="APPIMAGE_EXTRACT_AND_RUN=1"; fi

# `runfjord` command for the terminal
cat > "$LAUNCHER" <<EOF
#!/bin/sh
exec env $extra_env "$APPIMAGE" "\$@"
EOF
chmod 755 "$LAUNCHER"

# app menu entry
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Runfjord
GenericName=Script manager
Comment=Keep all your scripts in one place and run them with one click
Exec=$LAUNCHER %U
Icon=runfjord
Terminal=false
Categories=Utility;Development;
Keywords=scripts;bash;python;powershell;launcher;
StartupWMClass=Runfjord
EOF
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$(dirname "$DESKTOP_FILE")" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true

say "Runfjord ${version:-} is installed! Open it from your app menu, or type: runfjord"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) say "(To use the runfjord command, add $BIN_DIR to your PATH.)";; esac
