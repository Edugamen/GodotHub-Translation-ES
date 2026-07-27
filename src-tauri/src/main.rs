#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux workarounds for known GTK/WebKit rendering issues that cause
    // blank windows or crashes on certain GPU/driver/Wayland combinations.
    // These env vars are harmless on unaffected systems.
    #[cfg(target_os = "linux")]
    {
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
    }

    godothub_lib::run()
}
