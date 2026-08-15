use crate::persist;
use chrono::{Datelike, Duration};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub start_ms: u64,
    pub seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TimeStatsStore {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub projects: HashMap<String, Vec<SessionRecord>>,
    #[serde(default)]
    pub daily: HashMap<String, BTreeMap<String, u64>>,
}

fn stats_file(app: &AppHandle) -> PathBuf {
    crate::workspace::active_workspace_dir(app).join("time_tracking.json")
}

pub fn read_stats(app: &AppHandle) -> TimeStatsStore {
    persist::read_json(&stats_file(app))
}

pub fn write_stats(app: &AppHandle, store: &TimeStatsStore) {
    let _ = persist::write_json(&stats_file(app), store);
}

pub fn record_session(app: &AppHandle, project_id: &str, start_ms: u64, seconds: u64) {
    if seconds == 0 {
        return;
    }
    let mut store = read_stats(app);
    let sessions = store.projects.entry(project_id.to_string()).or_default();
    sessions.push(SessionRecord { start_ms, seconds });
    let cutoff = crate::projects::epoch_ms().saturating_sub(30 * 24 * 60 * 60 * 1000);
    sessions.retain(|s| s.start_ms >= cutoff);
    if sessions.len() > 200 {
        sessions.drain(0..sessions.len() - 200);
    }
    if let Some(start) =
        chrono::DateTime::<chrono::Utc>::from_timestamp_millis(start_ms as i64)
            .map(|t| t.with_timezone(&chrono::Local))
    {
        let date = start.format("%Y-%m-%d").to_string();
        *store
            .daily
            .entry(project_id.to_string())
            .or_default()
            .entry(date)
            .or_insert(0) += seconds;
    }
    write_stats(app, &store);
}

#[tauri::command]
pub fn get_weekly_activity(app: AppHandle) -> Vec<(String, u64)> {
    let store = read_stats(&app);
    let now = chrono::Local::now();
    let mut out: Vec<(String, u64)> = Vec::new();
    for offset in (0..7).rev() {
        let day = now - Duration::days(offset);
        let date = day.format("%Y-%m-%d").to_string();
        let mut total = 0u64;
        for by_project in store.daily.values() {
            total += by_project.get(&date).copied().unwrap_or(0);
        }
        out.push((date, total));
    }
    out
}

pub fn breakdown(
    store: &TimeStatsStore,
    project_id: &str,
    now: chrono::DateTime<chrono::Local>,
) -> (u64, u64) {
    let Some(sessions) = store.projects.get(project_id) else {
        return (0, 0);
    };
    let mut today = 0u64;
    let mut week = 0u64;
    for s in sessions {
        let Some(start) =
            chrono::DateTime::<chrono::Utc>::from_timestamp_millis(s.start_ms as i64)
                .map(|t| t.with_timezone(&chrono::Local))
        else {
            continue;
        };
        if start.date_naive() == now.date_naive() {
            today += s.seconds;
        }
        if start.iso_week() == now.iso_week() {
            week += s.seconds;
        }
    }
    (today, week)
}
