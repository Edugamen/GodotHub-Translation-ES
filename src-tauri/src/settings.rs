use crate::error::AppResult;
use crate::persist;
use crate::models::AppSettings;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn settings_file(app: &AppHandle) -> PathBuf {
    crate::workspace::active_workspace_dir(app).join("settings.json")
}

pub fn read_settings(app: &AppHandle) -> AppSettings {
    persist::read_json(&settings_file(app))
}

pub fn write_settings(app: &AppHandle, settings: &AppSettings) -> AppResult<()> {
    persist::write_json(&settings_file(app), settings)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    read_settings(&app)
}

#[tauri::command]
pub fn update_settings(app: AppHandle, mut settings: AppSettings) -> Result<AppSettings, String> {
    settings.dismissed_project_paths = read_settings(&app).dismissed_project_paths;
    write_settings(&app, &settings).map_err(|e| e.to_string())?;
    Ok(settings)
}

#[tauri::command]
pub fn reset_app_data(app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn reset_settings(app: AppHandle) -> Result<AppSettings, String> {
    let current = read_settings(&app);
    let reset = AppSettings {
        download_dir: current.download_dir,
        default_project_location: current.default_project_location,
        project_scan_dirs: current.project_scan_dirs,
        version_scan_dirs: current.version_scan_dirs,
        scan_depth: current.scan_depth,
        icon_scan_depth: current.icon_scan_depth,
        setup_complete: current.setup_complete,
        language: current.language,
        dismissed_project_paths: current.dismissed_project_paths,
        ..AppSettings::default()
    };
    write_settings(&app, &reset).map_err(|e| e.to_string())?;
    Ok(reset)
}
