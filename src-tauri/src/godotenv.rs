//! GodotEnv-compatible project version binding.
//!
//! Mirrors the version-specifier handling of
//! [Chickensoft's GodotEnv](https://github.com/chickensoft-games/GodotEnv):
//!
//! * **Detection** walks up the directory tree from the project folder and
//!   inspects, in order of precedence, `global.json`
//!   (`msbuild-sdks` → `Godot.NET.Sdk`), `*.csproj` files
//!   (`Sdk="Godot.NET.Sdk/<version>"`), then `.godotrc` files (first line,
//!   with an optional ` no-dotnet` / ` non-dotnet` / ` not-dotnet` suffix).
//!   The first file that yields a valid version wins.
//! * **Pinning** writes `global.json` for .NET-enabled versions and
//!   `.godotrc` for standard versions, exactly like `godotenv pin`.

use crate::models::InstalledGodotVersion;
use std::fs;
use std::path::{Path, PathBuf};

/// Canonical Godot version number (mirrors GodotEnv's `GodotVersionNumber`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GodotVersionNumber {
    pub major: u32,
    pub minor: u32,
    /// 0 when the release number has no patch component.
    pub patch: u32,
    /// "stable", "rc", "beta", ... (lowercase, no trailing digits).
    pub label: String,
    /// Numeric identifier for prerelease labels; -1 for stable.
    pub label_num: i32,
}

/// A version inferred from a version-specifier file, with .NET status.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedVersion {
    pub number: GodotVersionNumber,
    /// True when the specifier requests a .NET-enabled (mono) build.
    pub is_dotnet: bool,
}

fn parse_uint(s: &str) -> Option<u32> {
    if s.is_empty() || !s.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    s.parse().ok()
}

/// Release-style version, e.g. `4.3-stable`, `4.2.2-stable`, `4.3-rc1`.
/// Mirrors GodotEnv's `ReleaseVersionDeserializer` regex:
/// `^(\d+)\.(\d+)(\.[1-9]\d*)?-(stable|([a-z]+)(\d+))$`
pub fn parse_release_version(s: &str) -> Option<GodotVersionNumber> {
    let (num_part, label_part) = s.split_once('-')?;
    let mut num_parts = num_part.split('.');
    let major = parse_uint(num_parts.next()?)?;
    let minor = parse_uint(num_parts.next()?)?;
    let patch = match num_parts.next() {
        Some(p) => {
            // A patch of 0 is never written in release style.
            if p.starts_with('0') {
                return None;
            }
            parse_uint(p)?
        }
        None => 0,
    };
    if num_parts.next().is_some() {
        return None;
    }
    let (label, label_num) = parse_release_label(label_part)?;
    Some(GodotVersionNumber {
        major,
        minor,
        patch,
        label,
        label_num,
    })
}

fn parse_release_label(label: &str) -> Option<(String, i32)> {
    if label == "stable" {
        return Some(("stable".to_string(), -1));
    }
    let digit_start = label.find(|c: char| c.is_ascii_digit())?;
    let (letters, digits) = label.split_at(digit_start);
    if letters.is_empty() || !letters.bytes().all(|b| b.is_ascii_lowercase()) {
        return None;
    }
    let num = parse_uint(digits)?;
    Some((letters.to_string(), num as i32))
}

/// GodotSharp/NuGet-style version, e.g. `4.3.0`, `4.3.0-rc.1`.
/// Mirrors GodotEnv's `SharpVersionDeserializer` regex:
/// `^(\d+)\.(\d+)\.(\d+)(-([a-z]+)\.(\d+))?$`
pub fn parse_sharp_version(s: &str) -> Option<GodotVersionNumber> {
    let (num_part, label_part) = match s.split_once('-') {
        Some((n, l)) => (n, Some(l)),
        None => (s, None),
    };
    let mut num_parts = num_part.split('.');
    let major = parse_uint(num_parts.next()?)?;
    let minor = parse_uint(num_parts.next()?)?;
    let patch = parse_uint(num_parts.next()?)?;
    if num_parts.next().is_some() {
        return None;
    }
    let (label, label_num) = match label_part {
        None => ("stable".to_string(), -1),
        Some(l) => {
            let (letters, digits) = l.split_once('.')?;
            if letters.is_empty() || !letters.bytes().all(|b| b.is_ascii_lowercase()) {
                return None;
            }
            let num = parse_uint(digits)?;
            (letters.to_string(), num as i32)
        }
    };
    Some(GodotVersionNumber {
        major,
        minor,
        patch,
        label,
        label_num,
    })
}

/// Parse a version string in either release or GodotSharp style. Like
/// GodotEnv's `IoVersionDeserializer`, release style is tried first, then
/// sharp style, and a leading `v` is ignored.
pub fn parse_version(s: &str) -> Option<GodotVersionNumber> {
    let trimmed = s.trim().trim_start_matches('v');
    parse_release_version(trimmed).or_else(|| parse_sharp_version(trimmed))
}

/// Parse a GodotHub installed-version tag (release style with an optional
/// `-mono` suffix) into a canonical number.
pub fn parse_installed_tag(tag: &str) -> Option<GodotVersionNumber> {
    let base = tag.trim().trim_end_matches("-mono");
    parse_version(base)
}

pub fn numbers_equal(a: &GodotVersionNumber, b: &GodotVersionNumber) -> bool {
    a.major == b.major
        && a.minor == b.minor
        && a.patch == b.patch
        && a.label == b.label
        && a.label_num == b.label_num
}

/// True when an installed version's tag matches a detected spec (version
/// number equality; the .NET flavor is a preference handled by callers).
pub fn matches_detected(spec: &DetectedVersion, tag: &str) -> bool {
    parse_installed_tag(tag)
        .map(|n| numbers_equal(&spec.number, &n))
        .unwrap_or(false)
}

/// Best installed version for a detected spec: among versions with a matching
/// number, prefer the one whose .NET flavor agrees with the specifier.
pub fn best_match<'a>(
    spec: &DetectedVersion,
    versions: &'a [InstalledGodotVersion],
) -> Option<&'a InstalledGodotVersion> {
    versions
        .iter()
        .filter(|v| matches_detected(spec, &v.tag))
        .min_by_key(|v| if v.is_mono == spec.is_dotnet { 0 } else { 1 })
}

/// Every directory from `start` (inclusive) up to the filesystem root,
/// closest first.
fn ancestor_dirs(start: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut current = Some(start.to_path_buf());
    while let Some(dir) = current {
        dirs.push(dir.clone());
        current = dir.parent().map(|p| p.to_path_buf());
    }
    dirs
}

/// Detects the Godot version a project requires by walking up the directory
/// tree and inspecting, in order of precedence: `global.json`, `*.csproj`,
/// then `.godotrc` — exactly like GodotEnv.
pub fn detect_version(project_path: &str) -> Option<DetectedVersion> {
    let mut globals: Vec<PathBuf> = Vec::new();
    let mut csprojs: Vec<PathBuf> = Vec::new();
    let mut godotrcs: Vec<PathBuf> = Vec::new();

    for dir in ancestor_dirs(Path::new(project_path)) {
        let global = dir.join("global.json");
        if global.is_file() {
            globals.push(global);
        }

        if let Ok(entries) = fs::read_dir(&dir) {
            let mut files: Vec<PathBuf> = entries
                .flatten()
                .filter_map(|e| {
                    let p = e.path();
                    p.extension()
                        .map(|ext| ext == "csproj")
                        .unwrap_or(false)
                        .then_some(p)
                })
                .collect();
            files.sort();
            csprojs.extend(files);
        }

        let godotrc = dir.join(".godotrc");
        if godotrc.is_file() {
            godotrcs.push(godotrc);
        }
    }

    for path in globals.into_iter().chain(csprojs).chain(godotrcs) {
        if let Some(version) = parse_version_file(&path) {
            return Some(version);
        }
    }
    None
}

fn parse_version_file(path: &Path) -> Option<DetectedVersion> {
    let name = path.file_name()?.to_str()?;
    match name {
        "global.json" => parse_global_json(path),
        ".godotrc" => parse_godotrc(path),
        _ => parse_csproj(path),
    }
}

/// `msbuild-sdks` → `Godot.NET.Sdk` → version. Always a .NET build.
fn parse_global_json(path: &Path) -> Option<DetectedVersion> {
    let content = fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let version = json.get("msbuild-sdks")?.get("Godot.NET.Sdk")?;
    let version_str = match version {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        _ => return None,
    };
    let number = parse_version(&version_str)?;
    Some(DetectedVersion {
        number,
        is_dotnet: true,
    })
}

/// Root `<Project Sdk="Godot.NET.Sdk/<version>">` element. Always .NET.
fn parse_csproj(path: &Path) -> Option<DetectedVersion> {
    let content = fs::read_to_string(path).ok()?;
    let open = content.find("<Project")?;
    let after = &content[open..];
    let close = after.find('>')?;
    let tag = &after[..close];
    let sdk = extract_attr(tag, "Sdk")?;
    let version = sdk.strip_prefix("Godot.NET.Sdk/")?;
    if version.is_empty() {
        return None;
    }
    let number = parse_version(version)?;
    Some(DetectedVersion {
        number,
        is_dotnet: true,
    })
}

/// Extract `name="value"` (or `name='value'`) from an XML tag fragment.
fn extract_attr(tag: &str, name: &str) -> Option<String> {
    let bytes = tag.as_bytes();
    let name_bytes = name.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i..].starts_with(name_bytes) {
            let after = i + name_bytes.len();
            if bytes.get(after) == Some(&b'=') {
                if let Some(&q) = bytes.get(after + 1) {
                    if q == b'"' || q == b'\'' {
                        let value = &bytes[after + 2..];
                        if let Some(end) = value.iter().position(|&b| b == q) {
                            return std::str::from_utf8(&value[..end])
                                .ok()
                                .map(String::from);
                        }
                    }
                }
            }
        }
        i += 1;
    }
    None
}

/// `.godotrc`: the first line is the version string; a trailing
/// ` no-dotnet` / ` non-dotnet` / ` not-dotnet` suffix marks a standard
/// (non-.NET) build. Without a marker the version is treated as .NET.
fn parse_godotrc(path: &Path) -> Option<DetectedVersion> {
    let content = fs::read_to_string(path).ok()?;
    let line = content.lines().next()?.trim();
    if line.is_empty() {
        return None;
    }
    const NO_DOTNET: [&str; 3] = [" no-dotnet", " non-dotnet", " not-dotnet"];
    let mut is_dotnet = true;
    let mut version = line;
    for suffix in NO_DOTNET {
        if version.ends_with(suffix) {
            is_dotnet = false;
            version = &version[..version.len() - suffix.len()];
            break;
        }
    }
    let number = parse_version(version)?;
    Some(DetectedVersion { number, is_dotnet })
}

/// Release-style string, e.g. `4.3-stable`, `4.2.2-stable`, `4.3-rc1`.
pub fn release_string(n: &GodotVersionNumber) -> String {
    let mut s = format!("{}.{}", n.major, n.minor);
    if n.patch != 0 {
        s.push_str(&format!(".{}", n.patch));
    }
    if n.label == "stable" {
        s.push_str("-stable");
    } else {
        s.push_str(&format!("-{}{}", n.label, n.label_num));
    }
    s
}

/// GodotSharp-style string, e.g. `4.3.0`, `4.3.0-rc.1`.
pub fn sharp_string(n: &GodotVersionNumber) -> String {
    let mut s = format!("{}.{}.{}", n.major, n.minor, n.patch);
    if n.label != "stable" {
        s.push_str(&format!("-{}.{}", n.label, n.label_num));
    }
    s
}

/// Write a version-specifier file into the project directory, like
/// `godotenv pin`: `global.json` for .NET versions, `.godotrc` for standard
/// versions. A no-op when the tag cannot be parsed as a Godot version.
pub fn pin_version(project_dir: &str, tag: &str) -> Result<(), String> {
    let number = match parse_installed_tag(tag) {
        Some(n) => n,
        None => return Ok(()), // unrecognized tag: leave the project untouched
    };
    let is_mono = tag.trim().ends_with("-mono");
    let root = Path::new(project_dir);
    if is_mono {
        write_global_json_pin(root, &number)
    } else {
        write_godotrc_pin(root, &number)
    }
}

fn write_godotrc_pin(root: &Path, number: &GodotVersionNumber) -> Result<(), String> {
    let content = format!("{} no-dotnet\n", release_string(number));
    fs::write(root.join(".godotrc"), content).map_err(|e| e.to_string())
}

fn write_global_json_pin(root: &Path, number: &GodotVersionNumber) -> Result<(), String> {
    let path = root.join("global.json");
    let version = sharp_string(number);
    let existing = fs::read_to_string(&path).unwrap_or_default();

    if existing.trim().is_empty() {
        let fresh = format!(
            "{{\n  \"msbuild-sdks\": {{\n    \"Godot.NET.Sdk\": \"{}\"\n  }}\n}}\n",
            version
        );
        return fs::write(&path, fresh).map_err(|e| e.to_string());
    }

    // Preserve any existing global.json content and only set our SDK entry.
    if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&existing) {
        let obj = json
            .as_object_mut()
            .ok_or_else(|| "global.json is not a JSON object".to_string())?;
        let msbuild = obj
            .entry("msbuild-sdks")
            .or_insert_with(|| serde_json::json!({}));
        let msbuild_obj = msbuild
            .as_object_mut()
            .ok_or_else(|| "global.json msbuild-sdks is not an object".to_string())?;
        msbuild_obj.insert(
            "Godot.NET.Sdk".to_string(),
            serde_json::Value::String(version.clone()),
        );
        let out = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
        return fs::write(&path, out + "\n").map_err(|e| e.to_string());
    }

    // Unparseable (e.g. contains comments): best-effort textual merge that
    // never deletes existing content.
    let mut lines: Vec<String> = existing.lines().map(str::to_string).collect();
    if let Some(line) = lines.iter_mut().find(|l| l.contains("Godot.NET.Sdk")) {
        *line = replace_sdk_value(line, &version);
        return fs::write(&path, lines.join("\n")).map_err(|e| e.to_string());
    }
    if let Some(idx) = lines.iter().position(|l| l.trim().contains("msbuild-sdks")) {
        lines.insert(idx + 1, format!("    \"Godot.NET.Sdk\": \"{}\",", version));
        return fs::write(&path, lines.join("\n")).map_err(|e| e.to_string());
    }
    Ok(())
}

/// Replace the value of `"Godot.NET.Sdk": "..."` on a single line.
fn replace_sdk_value(line: &str, version: &str) -> String {
    let Some(key_idx) = line.find("\"Godot.NET.Sdk\"") else {
        return line.to_string();
    };
    let Some(colon_rel) = line[key_idx..].find(':') else {
        return line.to_string();
    };
    let Some(qstart_rel) = line[key_idx + colon_rel + 1..].find('"') else {
        return line.to_string();
    };
    let qstart = key_idx + colon_rel + 1 + qstart_rel;
    let Some(qend_rel) = line[qstart + 1..].find('"') else {
        return line.to_string();
    };
    let qend = qstart + 1 + qend_rel;
    let mut out = String::with_capacity(line.len() + version.len());
    out.push_str(&line[..qstart + 1]);
    out.push_str(version);
    out.push_str(&line[qend..]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn num(major: u32, minor: u32, patch: u32, label: &str, label_num: i32) -> GodotVersionNumber {
        GodotVersionNumber {
            major,
            minor,
            patch,
            label: label.to_string(),
            label_num,
        }
    }

    #[test]
    fn parses_release_versions() {
        assert_eq!(parse_release_version("4.3-stable"), Some(num(4, 3, 0, "stable", -1)));
        assert_eq!(parse_release_version("4.2.2-stable"), Some(num(4, 2, 2, "stable", -1)));
        assert_eq!(parse_release_version("4.3-rc1"), Some(num(4, 3, 0, "rc", 1)));
        assert_eq!(parse_release_version("4.3-beta2"), Some(num(4, 3, 0, "beta", 2)));
        assert_eq!(parse_release_version("3.5.1-stable"), Some(num(3, 5, 1, "stable", -1)));
        // patch 0 is never written in release style
        assert_eq!(parse_release_version("4.3.0-stable"), None);
        // no label / malformed
        assert_eq!(parse_release_version("4.3"), None);
        assert_eq!(parse_release_version("4.3-"), None);
        assert_eq!(parse_release_version("4.3-RC1"), None);
        assert_eq!(parse_release_version("4.3.0-alpha17"), None);
    }

    #[test]
    fn parses_sharp_versions() {
        assert_eq!(parse_sharp_version("4.3.0"), Some(num(4, 3, 0, "stable", -1)));
        assert_eq!(parse_sharp_version("4.2.2"), Some(num(4, 2, 2, "stable", -1)));
        assert_eq!(parse_sharp_version("4.3.0-rc.1"), Some(num(4, 3, 0, "rc", 1)));
        assert_eq!(parse_sharp_version("4.3.0-beta.2"), Some(num(4, 3, 0, "beta", 2)));
        // sharp prereleases always use `<label>.<num>`
        assert_eq!(parse_sharp_version("4.3.0-alpha17"), None);
        assert_eq!(parse_sharp_version("4.3"), None);
    }

    #[test]
    fn parses_installed_tags() {
        assert_eq!(parse_installed_tag("4.3-stable"), Some(num(4, 3, 0, "stable", -1)));
        assert_eq!(parse_installed_tag("4.3-stable-mono"), Some(num(4, 3, 0, "stable", -1)));
        assert_eq!(parse_installed_tag("4.2.2-stable-mono"), Some(num(4, 2, 2, "stable", -1)));
        assert_eq!(parse_installed_tag("4.3-rc1-mono"), Some(num(4, 3, 0, "rc", 1)));
    }

    #[test]
    fn serializers_round_trip() {
        let cases = [
            ("4.3-stable", num(4, 3, 0, "stable", -1)),
            ("4.2.2-stable", num(4, 2, 2, "stable", -1)),
            ("4.3-rc1", num(4, 3, 0, "rc", 1)),
        ];
        for (expected, n) in cases {
            assert_eq!(release_string(&n), expected);
            assert_eq!(parse_version(expected), Some(n.clone()));
        }
        assert_eq!(sharp_string(&num(4, 3, 0, "stable", -1)), "4.3.0");
        assert_eq!(sharp_string(&num(4, 3, 0, "rc", 1)), "4.3.0-rc.1");
        assert_eq!(parse_version("4.3.0-rc.1"), Some(num(4, 3, 0, "rc", 1)));
    }

    fn temp_project() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "godothub_godotenv_test_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn parses_godotrc_file() {
        let dir = temp_project();
        let path = dir.join(".godotrc");
        fs::write(&path, "4.3-stable\n").unwrap();
        let v = parse_godotrc(&path).unwrap();
        assert_eq!(v.number, num(4, 3, 0, "stable", -1));
        assert!(v.is_dotnet);

        fs::write(&path, "4.2.2-stable no-dotnet\n").unwrap();
        let v = parse_godotrc(&path).unwrap();
        assert_eq!(v.number, num(4, 2, 2, "stable", -1));
        assert!(!v.is_dotnet);

        fs::write(&path, "4.3-rc1 non-dotnet\n").unwrap();
        let v = parse_godotrc(&path).unwrap();
        assert!(!v.is_dotnet);

        fs::write(&path, "4.3-rc1 not-dotnet\n").unwrap();
        let v = parse_godotrc(&path).unwrap();
        assert!(!v.is_dotnet);

        fs::write(&path, "bogus\n").unwrap();
        assert!(parse_godotrc(&path).is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn parses_global_json_file() {
        let dir = temp_project();
        let path = dir.join("global.json");
        fs::write(&path, "{\n  \"msbuild-sdks\": {\n    \"Godot.NET.Sdk\": \"4.3.0\"\n  }\n}\n").unwrap();
        let v = parse_global_json(&path).unwrap();
        assert_eq!(v.number, num(4, 3, 0, "stable", -1));
        assert!(v.is_dotnet);

        fs::write(&path, "{\n  \"msbuild-sdks\": {\n    \"Godot.NET.Sdk\": \"4.3.0-rc.1\"\n  }\n}\n").unwrap();
        let v = parse_global_json(&path).unwrap();
        assert_eq!(v.number, num(4, 3, 0, "rc", 1));

        fs::write(&path, "{\n  \"sdk\": {\n    \"version\": \"8.0.100\"\n  }\n}\n").unwrap();
        assert!(parse_global_json(&path).is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn parses_csproj_file() {
        let dir = temp_project();
        let path = dir.join("Game.csproj");
        fs::write(&path, "<Project Sdk=\"Godot.NET.Sdk/4.2.2\">\n  <PropertyGroup/>\n</Project>\n").unwrap();
        let v = parse_csproj(&path).unwrap();
        assert_eq!(v.number, num(4, 2, 2, "stable", -1));
        assert!(v.is_dotnet);

        fs::write(&path, "<Project Sdk=\"Microsoft.NET.Sdk\">\n</Project>\n").unwrap();
        assert!(parse_csproj(&path).is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detection_precedence_global_beats_godotrc() {
        let dir = temp_project();
        fs::write(dir.join("global.json"), "{\"msbuild-sdks\":{\"Godot.NET.Sdk\":\"4.3.0\"}}\n").unwrap();
        fs::write(dir.join(".godotrc"), "4.2.2-stable no-dotnet\n").unwrap();
        let v = detect_version(dir.to_str().unwrap()).unwrap();
        assert_eq!(v.number, num(4, 3, 0, "stable", -1));
        assert!(v.is_dotnet);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detection_precedence_csproj_beats_godotrc() {
        let dir = temp_project();
        fs::write(dir.join("Game.csproj"), "<Project Sdk=\"Godot.NET.Sdk/4.2.2\"></Project>\n").unwrap();
        fs::write(dir.join(".godotrc"), "4.3-stable no-dotnet\n").unwrap();
        let v = detect_version(dir.to_str().unwrap()).unwrap();
        assert_eq!(v.number, num(4, 2, 2, "stable", -1));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detection_finds_ancestor_files() {
        let root = temp_project();
        let project = root.join("src");
        fs::create_dir_all(&project).unwrap();
        fs::write(root.join(".godotrc"), "4.3-stable no-dotnet\n").unwrap();
        let v = detect_version(project.to_str().unwrap()).unwrap();
        assert_eq!(v.number, num(4, 3, 0, "stable", -1));
        assert!(!v.is_dotnet);
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn detection_none_when_no_files() {
        let dir = temp_project();
        assert!(detect_version(dir.to_str().unwrap()).is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn matching_respects_dotnet_preference() {
        let dir = temp_project();
        fs::write(dir.join(".godotrc"), "4.3-stable no-dotnet\n").unwrap();
        let spec = detect_version(dir.to_str().unwrap()).unwrap();
        let standard = InstalledGodotVersion {
            tag: "4.3-stable".into(),
            version: "4.3".into(),
            executable_path: String::new(),
            is_mono: false,
            installed_at: String::new(),
            custom_name: None,
            install_root: None,
            supports_console: true,
        };
        let mono = InstalledGodotVersion {
            tag: "4.3-stable-mono".into(),
            version: "4.3".into(),
            executable_path: String::new(),
            is_mono: true,
            installed_at: String::new(),
            custom_name: None,
            install_root: None,
            supports_console: true,
        };
        assert!(matches_detected(&spec, &standard.tag));
        assert!(matches_detected(&spec, &mono.tag));
        assert_eq!(best_match(&spec, &[mono.clone(), standard.clone()]).unwrap().tag, "4.3-stable");
        assert_eq!(best_match(&spec, std::slice::from_ref(&mono)).unwrap().tag, "4.3-stable-mono");

        fs::write(dir.join(".godotrc"), "4.3-stable\n").unwrap();
        let dotnet_spec = detect_version(dir.to_str().unwrap()).unwrap();
        assert!(dotnet_spec.is_dotnet);
        assert_eq!(best_match(&dotnet_spec, &[standard, mono]).unwrap().tag, "4.3-stable-mono");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn pins_standard_version_to_godotrc() {
        let dir = temp_project();
        pin_version(dir.to_str().unwrap(), "4.3-stable").unwrap();
        let content = fs::read_to_string(dir.join(".godotrc")).unwrap();
        assert_eq!(content, "4.3-stable no-dotnet\n");
        // round-trips through detection
        let v = detect_version(dir.to_str().unwrap()).unwrap();
        assert_eq!(v.number, num(4, 3, 0, "stable", -1));
        assert!(!v.is_dotnet);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn pins_dotnet_version_to_global_json() {
        let dir = temp_project();
        pin_version(dir.to_str().unwrap(), "4.3-stable-mono").unwrap();
        let content = fs::read_to_string(dir.join("global.json")).unwrap();
        assert!(content.contains("\"Godot.NET.Sdk\": \"4.3.0\""), "{content}");
        let v = detect_version(dir.to_str().unwrap()).unwrap();
        assert_eq!(v.number, num(4, 3, 0, "stable", -1));
        assert!(v.is_dotnet);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn pin_preserves_existing_global_json() {
        let dir = temp_project();
        fs::write(
            dir.join("global.json"),
            "{\n  \"sdk\": {\n    \"version\": \"8.0.100\"\n  },\n  \"msbuild-sdks\": {\n    \"Other.Sdk\": \"1.2.3\"\n  }\n}\n",
        )
        .unwrap();
        pin_version(dir.to_str().unwrap(), "4.2.2-stable-mono").unwrap();
        let content = fs::read_to_string(dir.join("global.json")).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(json["sdk"]["version"], "8.0.100");
        assert_eq!(json["msbuild-sdks"]["Other.Sdk"], "1.2.3");
        assert_eq!(json["msbuild-sdks"]["Godot.NET.Sdk"], "4.2.2");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn pin_ignores_unrecognized_tags() {
        let dir = temp_project();
        pin_version(dir.to_str().unwrap(), "my-custom-build").unwrap();
        assert!(!dir.join(".godotrc").exists());
        assert!(!dir.join("global.json").exists());
        fs::remove_dir_all(&dir).ok();
    }
}
