#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux workarounds for known GTK/WebKit rendering issues that cause
    // blank windows or crashes on certain GPU/driver/Wayland combinations.
    // These env vars are harmless on unaffected systems.
    #[cfg(target_os = "linux")]
    {
        // The AppImage's linuxdeploy-plugin-gtk forces GDK_BACKEND=x11 in its
        // AppRun hook, which causes "Could not create default EGL display:
        // EGL_BAD_PARAMETER" on native Wayland compositors. Override it
        // unconditionally to prefer Wayland with X11 as fallback. This is safe
        // everywhere — if Wayland is unavailable, GTK automatically falls
        // back to X11.
        std::env::set_var("GDK_BACKEND", "wayland,x11");

        // WebKitGTK's DMA-BUF hardware path can fail on Nvidia proprietary
        // and some Mesa/AMD drivers, producing a blank screen or
        // "EGL_BAD_PARAMETER". Fall back to a safe rendering path.
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }

        // GTK 4.16+ defaults to a Vulkan renderer which can trigger
        // "Error 71 (Protocol error) dispatching to Wayland display" on
        // some configurations. Force OpenGL (NGL) which is universally
        // compatible.
        if std::env::var("GSK_RENDERER").is_err() {
            std::env::set_var("GSK_RENDERER", "ngl");
        }

        // Note: the libayatana-appindicator deprecation warning shown at startup
        // ("libayatana-appindicator is deprecated. Please use
        //  libayatana-appindicator-glib...") is a non-fatal stderr warning from the
        // C library itself. There is no env var to suppress it; it is harmless.
    }

    godothub_lib::run()
}
