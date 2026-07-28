#!/usr/bin/env bash
# Wayland compatibility hook for GodotHub AppImage
#
# This script is sourced by the AppImage's AppRun before the application
# launches. It probes for the host system's libwayland-client.so and preloads
# it to prevent the "Could not create default EGL display: EGL_BAD_PARAMETER"
# crash on Wayland compositors.
#
# The linuxdeploy-plugin-gtk shipped with Tauri forces GDK_BACKEND=x11, which
# breaks on native Wayland. This hook also strips that forced X11 override so
# GodotHub can connect through Wayland directly.

export DESKTOPINTEGRATION=1

if [ -z "${LD_PRELOAD:-}" ]; then
  for lib in \
    /usr/lib/libwayland-client.so \
    /usr/lib64/libwayland-client.so \
    /usr/lib/x86_64-linux-gnu/libwayland-client.so \
    /usr/lib/aarch64-linux-gnu/libwayland-client.so \
    /usr/lib/arm-linux-gnueabihf/libwayland-client.so; do
    if [ -f "$lib" ]; then
      export LD_PRELOAD="$lib"
      break
    fi
  done
fi
