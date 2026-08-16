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

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

/// Aggregates time tracked into buckets for the given range:
/// `daily`   -> current calendar day from 12 AM to 12 AM, one bucket per hour (key `YYYY-MM-DD:HH`)
/// `weekly`  -> last 7 days, one bucket per day (key `YYYY-MM-DD`)
/// `monthly` -> current calendar month from the 1st to the last day (key `YYYY-MM-DD`)
/// `yearly`  -> current calendar year from January to December, one bucket per month (key `YYYY-MM`)
#[tauri::command]
pub fn get_activity(app: AppHandle, range: String) -> Vec<(String, u64)> {
    let store = read_stats(&app);
    let now = chrono::Local::now();
    match range.as_str() {
        "daily" => {
            let mut out: Vec<(String, u64)> = Vec::new();
            let today = now.date_naive();
            for hour in 0..24 {
                let key = format!("{}:{:02}", today.format("%Y-%m-%d"), hour);
                let mut total = 0u64;
                for sessions in store.projects.values() {
                    for s in sessions {
                        let Some(start) = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(
                            s.start_ms as i64,
                        )
                        .map(|t| t.with_timezone(&chrono::Local))
                        else {
                            continue;
                        };
                        if start.format("%Y-%m-%d:%H").to_string() == key {
                            total += s.seconds;
                        }
                    }
                }
                out.push((key, total));
            }
            out
        }
        "monthly" => {
            let mut out: Vec<(String, u64)> = Vec::new();
            let year = now.year();
            let month = now.month();
            let count = days_in_month(year, month);
            for day in 1..=count {
                let date = format!("{:04}-{:02}-{:02}", year, month, day);
                let mut total = 0u64;
                for by_project in store.daily.values() {
                    total += by_project.get(&date).copied().unwrap_or(0);
                }
                out.push((date, total));
            }
            out
        }
        "yearly" => {
            let mut out: Vec<(String, u64)> = Vec::new();
            let year = now.year();
            for month in 1..=12 {
                let key = format!("{:04}-{:02}", year, month);
                let mut total = 0u64;
                for by_project in store.daily.values() {
                    for (date, secs) in by_project {
                        if date.starts_with(&key) {
                            total += secs;
                        }
                    }
                }
                out.push((key, total));
            }
            out
        }
        _ => {
            // weekly
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
    }
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
