use crate::persist;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const GIST_DESCRIPTION: &str = "GodotHub workspace backup";
const BACKUP_FILE_NAME: &str = "godothub-workspace-backup.json";

#[derive(Serialize, Deserialize)]
struct SyncState {
    gist_id: String,
    gist_url: String,
    pushed_at: String,
}

fn sync_state_file(app: &AppHandle) -> PathBuf {
    let base = app.path().app_data_dir().expect("no app data dir");
    if !base.exists() {
        let _ = fs::create_dir_all(&base);
    }
    base.join("gist-sync.json")
}

fn read_sync_state(app: &AppHandle) -> Option<SyncState> {
    persist::read_json_opt(&sync_state_file(app))
}

fn write_sync_state(app: &AppHandle, state: &SyncState) {
    let _ = persist::write_json(&sync_state_file(app), state);
}

fn github_token(app: &AppHandle) -> Option<String> {
    crate::git_auth::github_oauth_token(app).or_else(|| {
        crate::settings::read_settings(app)
            .github_token
            .filter(|t| !t.trim().is_empty())
    })
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("godot-hub")
        .build()
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct GistSyncResult {
    pub gist_url: String,
    pub gist_id: String,
    pub pushed_at: String,
}

#[derive(Deserialize)]
struct GistResponse {
    id: String,
    html_url: String,
}

#[derive(Deserialize)]
struct GistDetail {
    files: HashMap<String, GistFile>,
}

#[derive(Deserialize)]
struct GistFile {
    content: String,
}

async fn create_gist(
    client: &reqwest::Client,
    token: &str,
    content: &str,
) -> Result<(String, String), String> {
    let body = serde_json::json!({
        "description": GIST_DESCRIPTION,
        "public": false,
        "files": { BACKUP_FILE_NAME: { "content": content } }
    });
    let resp = client
        .post("https://api.github.com/gists")
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned HTTP {}", resp.status()));
    }
    let g: GistResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok((g.id, g.html_url))
}

async fn update_gist(
    client: &reqwest::Client,
    token: &str,
    id: &str,
    content: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "description": GIST_DESCRIPTION,
        "files": { BACKUP_FILE_NAME: { "content": content } }
    });
    let resp = client
        .patch(format!("https://api.github.com/gists/{id}"))
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned HTTP {}", resp.status()));
    }
    let g: GistResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(g.html_url)
}

#[tauri::command]
pub async fn gist_sync_push(app: AppHandle) -> Result<GistSyncResult, String> {
    let token = github_token(&app)
        .ok_or("No GitHub token found. Add one in Settings → Integrations or sign in with Git auth.")?;
    let backup = crate::backup::build_workspace_backup(&app)?;
    let content = serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?;
    let client = client()?;

    let (id, url) = match read_sync_state(&app) {
        Some(state) => {
            match update_gist(&client, &token, &state.gist_id, &content).await {
                Ok(url) => (state.gist_id.clone(), url),
                Err(_) => create_gist(&client, &token, &content).await?,
            }
        }
        None => create_gist(&client, &token, &content).await?,
    };
    let pushed_at = chrono::Utc::now().to_rfc3339();
    write_sync_state(
        &app,
        &SyncState {
            gist_id: id.clone(),
            gist_url: url.clone(),
            pushed_at: pushed_at.clone(),
        },
    );
    Ok(GistSyncResult {
        gist_url: url,
        gist_id: id,
        pushed_at,
    })
}

#[tauri::command]
pub async fn gist_sync_pull(app: AppHandle) -> Result<crate::models::AppSettings, String> {
    let token = github_token(&app)
        .ok_or("No GitHub token found. Add one in Settings → Integrations or sign in with Git auth.")?;
    let state = read_sync_state(&app)
        .ok_or("No cloud backup found yet. Push one first from Settings.")?;
    let client = client()?;
    let resp = client
        .get(format!("https://api.github.com/gists/{}", state.gist_id))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned HTTP {}", resp.status()));
    }
    let detail: GistDetail = resp.json().await.map_err(|e| e.to_string())?;
    let file = detail
        .files
        .get(BACKUP_FILE_NAME)
        .ok_or("Backup file not found in the synced gist")?;
    let backup: crate::backup::WorkspaceBackup =
        serde_json::from_str(&file.content).map_err(|e| e.to_string())?;
    crate::backup::apply_workspace_backup(&app, backup)
}
