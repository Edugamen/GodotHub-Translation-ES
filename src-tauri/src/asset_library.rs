use crate::godot_versions::meets_min_version;
use crate::models::ProjectTemplate;
use futures_util::StreamExt;
use serde::Deserialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

const ASSET_LIB_API: &str = "https://godotengine.org/asset-library/api";
const ALLOWED_TYPES: &[&str] = &["project"];
const MAX_PAGE_SKIP: u32 = 8;

#[derive(Debug, Clone, Deserialize)]
struct AssetSearchResult {
    #[serde(rename = "asset_id")]
    asset_id: String,
}

#[derive(Debug, Clone, Deserialize)]
struct AssetSearchResponse {
    result: Vec<AssetSearchResult>,
    pages: u32,
    #[serde(rename = "total_items")]
    total_items: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct AssetDetail {
    #[serde(rename = "asset_id")]
    asset_id: String,
    #[serde(default, rename = "type")]
    asset_type: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    category: String,
    #[serde(default, rename = "godot_version")]
    godot_version: String,
    #[serde(default)]
    cost: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default, rename = "support_level")]
    support_level: String,
    #[serde(default, rename = "download_url")]
    download_url: Option<String>,
    #[serde(default, rename = "browse_url")]
    browse_url: Option<String>,
    #[serde(default, rename = "icon_url")]
    icon_url: Option<String>,
    #[serde(default, rename = "modify_date")]
    modify_date: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AssetLibraryAsset {
    pub asset_id: String,
    pub title: String,
    pub author: String,
    pub category: String,
    pub godot_version: String,
    pub cost: String,
    pub support_level: String,
    pub asset_type: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub download_url: Option<String>,
    pub browse_url: Option<String>,
    pub modify_date: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AssetLibraryResponse {
    pub assets: Vec<AssetLibraryAsset>,
    pub page: u32,
    pub pages: u32,
    pub total: u32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub(crate) struct AssetDownloadProgress {
    pub asset_id: String,
    pub title: String,
    pub downloaded: u64,
    pub total: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub(crate) struct AssetDownloadError {
    pub asset_id: String,
    pub title: String,
    pub message: String,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("godot-hub")
        .build()
        .map_err(|e| e.to_string())
}

async fn fetch_detail(http: &reqwest::Client, asset_id: &str) -> Option<AssetDetail> {
    http.get(format!("{ASSET_LIB_API}/asset/{asset_id}"))
        .send()
        .await
        .ok()?
        .json::<AssetDetail>()
        .await
        .ok()
}

#[tauri::command]
pub async fn search_asset_library(
    filter: Option<String>,
    godot_version: Option<String>,
    page: Option<u32>,
    max_results: Option<u32>,
) -> Result<AssetLibraryResponse, String> {
    let http = client()?;
    let max_results = max_results.unwrap_or(20);
    let start_page = page.unwrap_or(0);

    let mut current_page = start_page;
    let mut pages = start_page + 1;
    let mut total = 0u32;
    let mut assets: Vec<AssetLibraryAsset> = Vec::new();

    let mut skipped = 0u32;
    while assets.is_empty() && skipped <= MAX_PAGE_SKIP {
        let mut params = vec![
            ("max_results".to_string(), max_results.to_string()),
            ("page".to_string(), current_page.to_string()),
            ("type".to_string(), "project".to_string()),
        ];
        if let Some(f) = filter.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            params.push(("filter".to_string(), f.to_string()));
        }
        if let Some(v) = godot_version
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            params.push(("godot_version".to_string(), v.to_string()));
        }

        let url = reqwest::Url::parse_with_params(&format!("{ASSET_LIB_API}/asset"), &params)
            .map_err(|e| e.to_string())?;
        let resp = http
            .get(url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!(
                "Godot Asset Library returned HTTP {}",
                resp.status()
            ));
        }
        let search: AssetSearchResponse = resp.json().await.map_err(|e| e.to_string())?;
        pages = search.pages;
        total = search.total_items;

        let ids: Vec<String> = search.result.iter().map(|r| r.asset_id.clone()).collect();
        let futures = ids.into_iter().map(|id| {
            let http = http.clone();
            async move { fetch_detail(&http, &id).await }
        });
        let details: Vec<Option<AssetDetail>> =
            futures_util::stream::iter(futures)
                .buffer_unordered(8)
                .collect()
                .await;
        let failures = details.iter().filter(|d| d.is_none()).count();
        if failures > 0 {
            eprintln!("Asset Library: {failures} detail fetch(es) failed");
        }

        assets = details
            .into_iter()
            .flatten()
            .filter(|d| ALLOWED_TYPES.contains(&d.asset_type.as_str()))
            .filter(|d| meets_min_version(&d.godot_version))
            .map(|d| AssetLibraryAsset {
                asset_id: d.asset_id,
                title: d.title,
                author: d.author,
                category: d.category,
                godot_version: d.godot_version,
                cost: d.cost,
                support_level: d.support_level,
                asset_type: d.asset_type,
                description: d.description,
                icon_url: d.icon_url,
                download_url: d.download_url,
                browse_url: d.browse_url,
                modify_date: d.modify_date,
            })
            .collect();

        if assets.is_empty() {
            skipped += 1;
            current_page += 1;
            if current_page >= pages {
                break;
            }
        }
    }

    Ok(AssetLibraryResponse {
        assets,
        page: current_page,
        pages,
        total,
    })
}

#[tauri::command]
pub async fn install_asset_as_template(
    app: AppHandle,
    asset_id: String,
) -> Result<ProjectTemplate, String> {
    let http = client()?;

    let detail = match fetch_detail(&http, &asset_id).await {
        Some(d) => d,
        None => {
            let message = format!("Could not fetch asset {asset_id} from the Asset Library");
            emit_asset_error(&app, &asset_id, "", &message);
            return Err(message);
        }
    };

    if !ALLOWED_TYPES.contains(&detail.asset_type.as_str()) {
        let message = format!(
            "This asset ({}) can't be installed as a project template",
            detail.asset_type
        );
        emit_asset_error(&app, &asset_id, &detail.title, &message);
        return Err(message);
    }
    if !meets_min_version(&detail.godot_version) {
        let message = format!(
            "This asset targets Godot {} which is older than the supported minimum (4.1)",
            detail.godot_version
        );
        emit_asset_error(&app, &asset_id, &detail.title, &message);
        return Err(message);
    }
    let download_url = match detail.download_url.clone() {
        Some(url) => url,
        None => {
            let message = "This asset has no download URL".to_string();
            emit_asset_error(&app, &asset_id, &detail.title, &message);
            return Err(message);
        }
    };

    let _ = app.emit(
        "asset-download-queued",
        AssetDownloadProgress {
            asset_id: asset_id.clone(),
            title: detail.title.clone(),
            downloaded: 0,
            total: 0,
        },
    );

    let result = download_and_install(&app, &http, &detail, &asset_id, &download_url).await;

    match &result {
        Ok(_) => {
            let _ = app.emit(
                "asset-download-complete",
                AssetDownloadProgress {
                    asset_id: asset_id.clone(),
                    title: detail.title.clone(),
                    downloaded: 0,
                    total: 0,
                },
            );
        }
        Err(message) => {
            emit_asset_error(&app, &asset_id, &detail.title, message);
        }
    }

    result
}

fn emit_asset_error(app: &AppHandle, asset_id: &str, title: &str, message: &str) {
    let _ = app.emit(
        "asset-download-error",
        AssetDownloadError {
            asset_id: asset_id.to_string(),
            title: title.to_string(),
            message: message.to_string(),
        },
    );
}

async fn download_and_install(
    app: &AppHandle,
    http: &reqwest::Client,
    detail: &AssetDetail,
    asset_id: &str,
    download_url: &str,
) -> Result<ProjectTemplate, String> {
    let resp = http
        .get(download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Asset download returned HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);
    let mut bytes: Vec<u8> = Vec::new();
    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let _ = app.emit(
            "asset-download-progress",
            AssetDownloadProgress {
                asset_id: asset_id.to_string(),
                title: detail.title.clone(),
                downloaded,
                total,
            },
        );
        bytes.extend_from_slice(&chunk);
    }

    let temp_dir = std::env::temp_dir().join(format!("godothub-asset-{asset_id}"));
    let _ = crate::templates::remove_dir_force(&temp_dir);
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let extract_result = extract_zip(&bytes, &temp_dir)
        .and_then(|_| find_project_root(&temp_dir))
        .and_then(|src| {
            crate::templates::install_downloaded_asset(
                app,
                detail.title.clone(),
                detail.description.clone().unwrap_or_default(),
                detail.godot_version.clone(),
                &src,
            )
        });

    let _ = crate::templates::remove_dir_force(&temp_dir);
    extract_result
}

fn extract_zip(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        if name.contains("..")
            || name.starts_with('/')
            || name.starts_with('\\')
            || name.contains(":/")
            || name.contains(":\\")
        {
            continue;
        }
        let out_path = dest.join(&name);
        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn find_project_root(dir: &Path) -> Result<PathBuf, String> {
    if dir.join("project.godot").is_file() {
        return Ok(dir.to_path_buf());
    }
    let mut subdirs: Vec<PathBuf> = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            subdirs.push(entry.path());
        }
    }
    if subdirs.len() == 1 {
        let sub = subdirs.remove(0);
        if sub.join("project.godot").is_file() {
            return Ok(sub);
        }
        return find_project_root(&sub);
    }
    for sub in &subdirs {
        if sub.join("project.godot").is_file() {
            return Ok(sub.clone());
        }
    }
    Ok(dir.to_path_buf())
}
