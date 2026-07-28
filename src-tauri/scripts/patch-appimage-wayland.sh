#!/usr/bin/env bash
# -------------------------------------------------------------------
# patch-appimage-wayland.sh
# Post-build script for GodotHub Tauri AppImage.
#
# Unpacks the generated AppImage, injects a Wayland compatibility
# hook into apprun-hooks/, then repacks it.
#
# Must be run AFTER `tauri build`.
#
# If appimagetool is unavailable or repacking fails, the original
# (unpatched) AppImage is preserved — the Rust-level GDK_BACKEND
# env-var fix already resolves the crash for most users.
# -------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK_SRC="$SCRIPT_DIR/apprun-wayland-compat.sh"

APPIMAGE_DIR="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage"
APPIMAGE=$(ls "$APPIMAGE_DIR"/*.AppImage 2>/dev/null | head -1)

if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "ℹNo .AppImage found in $APPIMAGE_DIR — skipping Wayland patch"
  exit 0
fi

if [ ! -f "$HOOK_SRC" ]; then
  echo "Hook script not found: $HOOK_SRC"
  exit 1
fi

echo "Found AppImage: $(basename "$APPIMAGE")"

WORKDIR=$(mktemp -d)
EXTRACT_DIR="$WORKDIR/squashfs-root"

cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "Extracting AppImage..."
cd "$WORKDIR"
"$APPIMAGE" --appimage-extract >/dev/null 2>&1

if [ ! -d "$EXTRACT_DIR" ]; then
  echo "Failed to extract AppImage into $EXTRACT_DIR"
  exit 1
fi

echo "🔧 Injecting Wayland compatibility hook..."
mkdir -p "$EXTRACT_DIR/apprun-hooks"
cp "$HOOK_SRC" "$EXTRACT_DIR/apprun-hooks/wayland-compat.sh"
chmod +x "$EXTRACT_DIR/apprun-hooks/wayland-compat.sh"

ARCH=$(uname -m)
APPIMAGETOOL=""
CANDIDATES=(
  "$HOME/.cache/tauri/appimagetool"
  "$HOME/.cache/tauri/appimagetool-$ARCH"
  "/usr/local/bin/appimagetool"
  "/usr/bin/appimagetool"
)
for c in "${CANDIDATES[@]}"; do
  if [ -f "$c" ]; then
    APPIMAGETOOL="$c"
    break
  fi
done

if [ -z "$APPIMAGETOOL" ] && command -v appimagetool &>/dev/null; then
  APPIMAGETOOL="appimagetool"
fi

if [ -z "$APPIMAGETOOL" ]; then
  echo "appimagetool not found — leaving patched AppDir at: $EXTRACT_DIR"
  echo "   The original (unpatched) AppImage is preserved."
  echo "   To repack manually: appimagetool $EXTRACT_DIR"
  exit 0
fi

echo "Repacking AppImage with Wayland fix..."
ORIG_APPIMAGE="$APPIMAGE_DIR/$(basename "$APPIMAGE")"
BACKUP_APPIMAGE="${ORIG_APPIMAGE%.AppImage}.unpatched.AppImage"

mv "$ORIG_APPIMAGE" "$BACKUP_APPIMAGE"

cd "$WORKDIR"
if ! "$APPIMAGETOOL" "$EXTRACT_DIR" >/dev/null 2>&1; then
  echo "appimagetool failed — restoring original AppImage"
  mv "$BACKUP_APPIMAGE" "$ORIG_APPIMAGE"
  exit 0
fi

NEW_APPIMAGE=$(ls "$WORKDIR"/*.AppImage 2>/dev/null | head -1)

if [ -z "$NEW_APPIMAGE" ] || [ ! -f "$NEW_APPIMAGE" ]; then
  echo "Repacked AppImage not found — restoring original"
  mv "$BACKUP_APPIMAGE" "$ORIG_APPIMAGE"
  exit 0
fi

mv "$NEW_APPIMAGE" "$ORIG_APPIMAGE"
rm -f "$BACKUP_APPIMAGE"

APPIMAGE_SIZE=$(du -h "$ORIG_APPIMAGE" | cut -f1)
echo "Patched AppImage: $ORIG_APPIMAGE ($APPIMAGE_SIZE)"
echo "Done; AppImage now has Wayland compatibility built-in"
