use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs;
use std::path::Path;

use crate::error::AppResult;

/// Read a JSON file into a struct. Returns `Default::default()` if the file
/// doesn't exist or is unparseable (silent fallback).
pub fn read_json<T: DeserializeOwned + Default>(path: &Path) -> T {
    if !path.exists() {
        return T::default();
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Read a JSON file into a struct. Returns `None` if the file doesn't exist
/// or can't be parsed.
pub fn read_json_opt<T: DeserializeOwned>(path: &Path) -> Option<T> {
    if !path.exists() {
        return None;
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

/// Write a struct as pretty-printed JSON to a file.
pub fn write_json<T: Serialize>(path: &Path, data: &T) -> AppResult<()> {
    let json = serde_json::to_string_pretty(data)?;
    fs::write(path, json)?;
    Ok(())
}

/// Ensure a directory exists, creating it (and parents) if needed.
pub fn ensure_dir(dir: &Path) -> AppResult<()> {
    if !dir.exists() {
        fs::create_dir_all(dir)?;
    }
    Ok(())
}
