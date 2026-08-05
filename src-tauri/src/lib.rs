mod asset_library;
mod categories;
mod changelog;
mod error;
mod git;
mod git_helpers;
mod godot_versions;
mod godotenv;
mod models;
mod news;
mod persist;
mod projects;
mod scan;
mod settings;
mod templates;
mod terminal;
mod tray;
mod watcher;
mod workspace;

use tauri::{Manager, WindowEvent};

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder);
    });
    rx.recv().ok().flatten().map(|p| p.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_prevent_default::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .setup(|app| {
            app.manage(watcher::ActiveWatchers(std::sync::Mutex::new(Vec::new())));

            godot_versions::migrate_registry_to_global(app.handle());

            #[cfg(not(target_os = "macos"))]
            {
                let settings = settings::read_settings(app.handle());
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(settings.use_os_decorations);
                }
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                templates::consolidate_legacy_templates(&handle);

                let s = settings::read_settings(&handle);
                if s.template_scan_dir.is_some() {
                    let _ = templates::sync_templates_with_scan_dir(handle.clone());
                }

                if s.auto_watch_project_dirs && !s.project_scan_dirs.is_empty() {
                    let dirs: Vec<std::path::PathBuf> = s.project_scan_dirs.iter().map(std::path::PathBuf::from).collect();
                    watcher::start_project_watchers(handle.clone(), dirs, s.scan_depth, 2000);
                }
                if s.auto_watch_version_dirs && !s.version_scan_dirs.is_empty() {
                    let dirs: Vec<std::path::PathBuf> = s.version_scan_dirs.iter().map(std::path::PathBuf::from).collect();
                    watcher::start_version_watchers(handle.clone(), dirs, s.scan_depth, 2000);
                }
                if s.auto_watch_template_dir {
                    if let Some(ref tdir) = s.template_scan_dir {
                        let dir = std::path::PathBuf::from(tdir);
                        if dir.exists() {
                            watcher::start_template_watcher(handle.clone(), dir, 2000);
                        }
                    }
                }
            });

            app.manage(tray::TrayState(std::sync::Mutex::new(None)));
            app.manage(projects::ActiveProcesses(std::sync::Mutex::new(
                std::collections::HashMap::new(),
            )));

            tray::setup_tray(app.handle())?;
            tray::show_main_window(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }

                #[cfg(target_os = "macos")]
                let keep_alive = true;
                #[cfg(not(target_os = "macos"))]
                let keep_alive = settings::read_settings(window.app_handle()).minimize_to_tray;

                if keep_alive {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            godot_versions::fetch_available_godot_versions,
            godot_versions::download_godot_version,
            godot_versions::pause_download,
            godot_versions::resume_download,
            godot_versions::cancel_download,
            godot_versions::list_installed_godot_versions,
            godot_versions::rename_godot_version,
            godot_versions::delete_godot_version,
            godot_versions::open_godot_version,
            godot_versions::test_github_token,
            godot_versions::get_github_rate_limit,
            godot_versions::import_version_zip,
            projects::list_projects,
            projects::create_project,
            projects::import_project,
            projects::remove_project,
            projects::update_project,
            projects::reorder_projects,
            projects::open_project,
            projects::open_project_folder,
            projects::open_in_editor,
            projects::get_project_icon,
            projects::get_project_size,
            projects::get_project_name,
            projects::validate_godot_folder,
            projects::stop_project,
            projects::pick_file,
            projects::read_image_file,
            projects::write_project_tags,
            categories::list_categories,
            categories::create_category,
            categories::update_category,
            categories::rename_category,
            categories::delete_category,
            categories::reorder_categories,
            settings::get_settings,
            settings::update_settings,
            settings::reset_settings,
            settings::reset_app_data,
            workspace::list_workspaces,
            workspace::list_workspace_scan_dirs,
            workspace::create_workspace,
            workspace::switch_workspace,
            workspace::update_workspace,
            workspace::delete_workspace,
            scan::scan_for_projects,
            scan::scan_for_projects_with_info,
            scan::scan_for_versions,
            scan::import_version,
            projects::reintroduce_dismissed_projects,
            news::fetch_godot_news,
            templates::list_templates,
            templates::save_project_as_template,
            templates::delete_template,
            templates::sync_templates_with_scan_dir,
asset_library::search_asset_library,
asset_library::install_asset_as_template,
templates::get_template_preview,
            changelog::list_changelog_entries,
            changelog::add_changelog_entry,
            changelog::update_changelog_entry,
            changelog::delete_changelog_entry,
            git::clone_repo,
            git::get_git_status,
            git::batch_git_status,
            git::open_terminal,
            git::git_pull,
            git::git_fetch,
            git::git_push,
            git::git_log,
            git::git_log_entries,
            git::git_remote_url,
            git::git_list_branches,
            git::git_switch_branch,
            git::git_create_branch,
            git::git_delete_branch,
            git::git_stash_push,
            git::git_stash_list,
            git::git_stash_apply,
            git::git_stash_drop,
            git::git_changed_files,
            git::git_discard_changes,
            git::git_init,
            git::git_init_project,
            git::git_is_available,
            git::git_stage_file,
            git::git_unstage_file,
            git::git_commit,
            git::git_set_remote,
            git::git_remove_remote,
            git::git_file_diff,
            git::git_undo_commit,
            git::git_undo_pull,
            git::git_merge_conflict_files,
            git::git_resolve_conflict_ours,
            git::git_resolve_conflict_theirs,
            git::git_resolve_conflict_manual,
            git::git_abort_merge,
            git::git_is_merging,
            tray::refresh_tray_menu,
            pick_folder,
            watcher::restart_watchers,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                tray::show_main_window(_app);
            }
        });
}
