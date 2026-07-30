use crate::git_helpers;
use crate::terminal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub has_uncommitted: bool,
    pub is_repo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStashEntry {
    pub index: usize,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitChangedFile {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffResult {
    pub hunks: Vec<GitDiffHunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffLine {
    pub kind: String,
    pub content: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn check_is_repo(path: &str) -> bool {
    let dir = PathBuf::from(path);
    let mut current = Some(dir.as_path());
    while let Some(p) = current {
        if p.join(".git").exists() {
            return true;
        }
        current = p.parent();
    }
    false
}

fn friendly_git_error(stderr: &str, path: &str) -> String {
    let lower = stderr.to_lowercase();

    if lower.contains("host key verification failed") {
        return format!(
            concat!(
                "SSH host key not verified.\n\n",
                "This happens when connecting to a server for the first time.\n",
                "To fix it, open a terminal and run:\n",
                "  ssh -T git@github.com\n",
                "(or your hosting provider). Type 'yes' to accept the key.\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("permission denied")
        || (lower.contains("publickey") && lower.contains("authentication"))
    {
        return format!(
            concat!(
                "SSH authentication failed.\n\n",
                "Your SSH key isn't set up correctly. To fix it:\n",
                "  1. Generate a key: ssh-keygen -t ed25519\n",
                "  2. Add it to your SSH agent: ssh-add ~/.ssh/id_ed25519\n",
                "  3. Add the public key to your Git hosting account\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("could not read from remote")
        || lower.contains("repository not found")
    {
        return format!(
            concat!(
                "Remote repository not found.\n\n",
                "The remote URL may be wrong or you don't have access.\n",
                "Check the URL with: git remote -v\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("authentication failed") {
        return format!(
            concat!(
                "Authentication failed.\n\n",
                "If you're using HTTPS, your credentials may be wrong or expired.\n",
                "To switch to SSH, run:\n",
                "  git remote set-url origin git@github.com:user/repo.git\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("connection refused") {
        return format!(
            concat!(
                "Connection refused.\n\n",
                "The remote server is not reachable.\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("could not resolve host") {
        return format!(
            concat!(
                "Could not resolve hostname.\n\n",
                "The remote server address couldn't be found.\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("timed out") || lower.contains("timeout") {
        return format!(
            concat!(
                "Connection timed out.\n\n",
                "The server took too long to respond.\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("merge conflict")
        || (lower.contains("conflict") && lower.contains("merge"))
        || lower.contains("automatic merge failed")
    {
        let conflicted = get_merge_conflict_files_for_path_internal(path).unwrap_or_default();
        if !conflicted.is_empty() {
            let files_list = conflicted.join("\n  · ");
            return format!(
                concat!(
                    "Merge conflicts detected.\n\n",
                    "The following files have conflicts:\n",
                    "  · {}\n\n",
                    "You can resolve them using the conflict resolver below,\n",
                    "or by opening a terminal and editing each file manually.\n",
                    "After resolving, stage and commit the changes.\n\n",
                    "Raw error:\n{}",
                ),
                files_list,
                stderr.trim()
            );
        }
        return format!(
            concat!(
                "Merge conflicts detected.\n\n",
                "There are conflicts that need to be resolved before the merge can complete.\n",
                "Open a terminal in the project folder and use 'git status' to see them.\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    if lower.contains("non-fast-forward") || lower.contains("[rejected]")
        || (lower.contains("failed to push") && lower.contains("fetch first"))
    {
        return format!(
            concat!(
                "Push rejected, your local branch is behind the remote.\n\n",
                "Use the Pull button first to get the latest changes, then try pushing again.\n\n",
                "Raw error:\n{}",
            ),
            stderr.trim()
        );
    }
    format!(
        concat!(
            "Git operation failed.\n\n",
            "Raw error:\n{}",
        ),
        stderr.trim()
    )
}

/// Run a git command that needs `friendly_git_error` parsing on failure.
fn friendly_cmd(path: &str, args: &[&str]) -> Result<String, String> {
    let output = git_helpers::git_raw(path, args).map_err(|e| e.to_string())?;
    if !output.status.success() {
        let stderr = git_helpers::output_stderr(&output);
        return Err(friendly_git_error(&stderr, path));
    }
    Ok(git_helpers::output_stdout(&output).trim().to_string())
}

fn get_merge_conflict_files_for_path_internal(path: &str) -> Result<Vec<String>, String> {
    if !check_is_repo(path) {
        return Err("Not a git repository".into());
    }
    let stdout = git_helpers::git_cmd(path, ["diff", "--name-only", "--diff-filter=U"])
        .map_err(|e| e.to_string())?;
    Ok(stdout.lines().filter(|l| !l.trim().is_empty()).map(|l| l.trim().to_string()).collect())
}

// ---------------------------------------------------------------------------
// Status (custom parsing)
// ---------------------------------------------------------------------------

fn get_git_status_for_path(path: &str) -> GitStatus {
    if !check_is_repo(path) {
        return GitStatus { branch: None, has_uncommitted: false, is_repo: false };
    }

    let output = git_helpers::git_raw(path, ["status", "--porcelain", "--branch"]).ok();

    match output {
        Some(out) => {
            let stdout = git_helpers::output_stdout(&out);
            let mut branch: Option<String> = None;
            let mut has_uncommitted = false;

            for (i, line) in stdout.lines().enumerate() {
                let trimmed = line.trim();
                if trimmed.is_empty() { continue; }
                if i == 0 && trimmed.starts_with("## ") {
                    let branch_info = &trimmed[3..];
                    if !branch_info.starts_with("HEAD (no branch)") && !branch_info.is_empty() {
                        let name = branch_info
                            .split("...").next()
                            .unwrap_or(branch_info)
                            .split('[').next()
                            .unwrap_or(branch_info)
                            .trim();
                        if !name.is_empty() {
                            branch = Some(name.to_string());
                        }
                    }
                } else {
                    has_uncommitted = true;
                }
            }
            GitStatus { branch, has_uncommitted, is_repo: true }
        }
        None => GitStatus { branch: None, has_uncommitted: false, is_repo: true },
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_git_status(path: String) -> GitStatus {
    get_git_status_for_path(&path)
}

#[tauri::command]
pub async fn batch_git_status(paths: Vec<String>) -> HashMap<String, GitStatus> {
    const MAX_CONCURRENT: usize = 10;
    tokio::task::spawn_blocking(move || {
        let results = std::sync::Mutex::new(HashMap::with_capacity(paths.len()));
        for chunk in paths.chunks(MAX_CONCURRENT) {
            std::thread::scope(|s| {
                for p in chunk {
                    s.spawn(|| {
                        results.lock().unwrap().insert(p.clone(), get_git_status_for_path(p));
                    });
                }
            });
        }
        results.into_inner().unwrap()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    friendly_cmd(&path, &["pull"])
}

#[tauri::command]
pub fn git_push(path: String, force: Option<bool>) -> Result<String, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    let mut args = vec!["push"];
    if force.unwrap_or(false) {
        args.push("--force-with-lease");
    }
    friendly_cmd(&path, &args)
}

#[tauri::command]
pub fn git_log_entries(path: String) -> Result<Vec<GitLogEntry>, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    let stdout = git_helpers::git_cmd(
        &path,
        ["log", "--oneline", "--max-count=25", "--format=%h|||%an|||%ar|||%s", "--all"],
    )
    .map_err(|e| e.to_string())?;

    let entries: Vec<GitLogEntry> = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(4, "|||").collect();
            if parts.len() < 4 { return None; }
            Some(GitLogEntry {
                hash: parts[0].to_string(),
                author: parts[1].to_string(),
                date: parts[2].to_string(),
                message: parts[3].to_string(),
            })
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub fn git_remote_url(path: String) -> Result<String, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }

    let raw = git_helpers::git_cmd(&path, ["remote", "get-url", "origin"])
        .map_err(|_| "No remote 'origin' configured".to_string())?;

    if raw.is_empty() {
        return Err("No remote 'origin' configured".into());
    }

    fn to_web_url(url: &str) -> String {
        let url = url.trim_end_matches(".git").trim_end_matches('/');
        if let Some(rest) = url.strip_prefix("git@") {
            if let Some((host, path)) = rest.split_once(':') {
                return format!("https://{}/{}", host, path.trim_start_matches('/'));
            }
        }
        if url.starts_with("https://") || url.starts_with("http://") {
            return url.to_string();
        }
        if let Some(rest) = url.strip_prefix("git://") {
            return format!("https://{}", rest);
        }
        url.to_string()
    }

    Ok(to_web_url(&raw))
}

#[tauri::command]
pub fn git_fetch(path: String) -> Result<String, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["fetch"]).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_list_branches(path: String) -> Result<Vec<GitBranchInfo>, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    let stdout = git_helpers::git_cmd(&path, ["branch", "--format=%(refname:short)|||%(HEAD)"])
        .map_err(|e| e.to_string())?;

    let branches: Vec<GitBranchInfo> = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(2, "|||").collect();
            if parts.len() < 2 { return None; }
            Some(GitBranchInfo {
                name: parts[0].to_string(),
                is_current: parts[1].trim() == "*",
            })
        })
        .collect();

    Ok(branches)
}

#[tauri::command]
pub fn git_switch_branch(path: String, name: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["switch", &name]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_create_branch(path: String, name: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["branch", &name]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_delete_branch(path: String, name: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["branch", "-d", &name]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_stash_push(path: String) -> Result<String, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["stash", "push", "--include-untracked"])
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_stash_list(path: String) -> Result<Vec<GitStashEntry>, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    let stdout = git_helpers::git_cmd(&path, ["stash", "list"])
        .map_err(|e| e.to_string())?;

    let stashes: Vec<GitStashEntry> = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| {
            if let Some(rest) = line.strip_prefix("stash@{") {
                let parts: Vec<&str> = rest.splitn(2, '}').collect();
                if parts.len() == 2 {
                    let index = parts[0].parse::<usize>().ok()?;
                    let message = parts[1].trim_start_matches(": ").to_string();
                    return Some(GitStashEntry { index, message });
                }
            }
            None
        })
        .collect();

    Ok(stashes)
}

#[tauri::command]
pub fn git_stash_apply(path: String, index: usize) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["stash", "apply", &format!("stash@{{{}}}", index)])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_stash_drop(path: String, index: usize) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["stash", "drop", &format!("stash@{{{}}}", index)])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_changed_files(path: String) -> Result<Vec<GitChangedFile>, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    let stdout = git_helpers::git_cmd(&path, ["status", "--porcelain"])
        .map_err(|e| e.to_string())?;

    let files: Vec<GitChangedFile> = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| {
            let status = line.get(..2)?.trim().to_string();
            let file_path = line.get(3..)?.to_string();
            if status.is_empty() && file_path.is_empty() { None }
            else { Some(GitChangedFile { path: file_path, status }) }
        })
        .collect();

    Ok(files)
}

#[tauri::command]
pub fn git_discard_changes(path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["restore", "."]).map_err(|e| e.to_string())?;
    let _ = git_helpers::git_cmd(&path, ["clean", "-fd"]);
    Ok(())
}

#[tauri::command]
pub fn git_init(path: String) -> Result<String, String> {
    let dir = PathBuf::from(&path);
    if !dir.exists() {
        return Err("Path does not exist".into());
    }
    if check_is_repo(&path) {
        return Err("Already a git repository".into());
    }

    let stdout = git_helpers::git_command()
        .args(["init", &path])
        .output()
        .map_err(|e| format!("Failed to init git: {e}"))
        .and_then(|out| {
            if !out.status.success() {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                return Err(format!("Git init failed: {stderr}"));
            }
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        })?;
    Ok(stdout)
}

#[tauri::command]
pub fn git_stage_file(path: String, file_path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["add", &file_path]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage_file(path: String, file_path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["restore", "--staged", &file_path]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(path: String, message: String, amend: bool) -> Result<String, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }

    let mut args = vec!["commit", "-m", &message];
    if amend {
        args.push("--amend");
    }

    let output = git_helpers::git_raw(&path, &args).map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = git_helpers::output_stderr(&output).trim().to_string();
        let stdout = git_helpers::output_stdout(&output).trim().to_string();
        let detail = if !stderr.is_empty() { stderr }
                    else if !stdout.is_empty() { stdout }
                    else { "Unknown error, run 'git commit' in a terminal for more details.".to_string() };
        return Err(format!("Commit failed: {detail}"));
    }

    Ok(git_helpers::output_stdout(&output).trim().to_string())
}

#[tauri::command]
pub fn git_set_remote(path: String, url: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }

    let remotes = git_helpers::git_cmd(&path, ["remote"]).unwrap_or_default();
    let has_origin = remotes.lines().any(|l| l.trim() == "origin");

    let verb = if has_origin { "set-url" } else { "add" };
    git_helpers::git_cmd(&path, ["remote", verb, "origin", &url]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_remove_remote(path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["remote", "remove", "origin"]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_undo_commit(path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["reset", "--soft", "HEAD~1"]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_undo_pull(path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["reset", "--keep", "ORIG_HEAD"]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_abort_merge(path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["merge", "--abort"]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_is_merging(path: String) -> Result<bool, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }

    let git_dir = git_helpers::git_cmd(&path, ["rev-parse", "--git-dir"])
        .map_err(|e| e.to_string())?;
    let base = std::path::PathBuf::from(&path).join(&git_dir);

    Ok(base.join("MERGE_HEAD").exists()
        || base.join("rebase-merge").exists()
        || base.join("rebase-apply").exists())
}

#[tauri::command]
pub fn git_merge_conflict_files(path: String) -> Result<Vec<String>, String> {
    get_merge_conflict_files_for_path_internal(&path)
}

#[tauri::command]
pub fn git_resolve_conflict_ours(path: String, file_path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["checkout", "--ours", &file_path]).map_err(|e| e.to_string())?;
    git_helpers::git_cmd(&path, ["add", &file_path]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_resolve_conflict_theirs(path: String, file_path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["checkout", "--theirs", &file_path]).map_err(|e| e.to_string())?;
    git_helpers::git_cmd(&path, ["add", &file_path]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_resolve_conflict_manual(path: String, file_path: String) -> Result<(), String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }
    git_helpers::git_cmd(&path, ["add", &file_path]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clone_repo(url: String, dest: String) -> Result<String, String> {
    if !url.contains("://") && !url.contains('@') {
        return Err("Not a valid git URL".into());
    }

    let dest_path = PathBuf::from(&dest);
    let folder_name = url
        .trim_end_matches(".git")
        .split('/')
        .next_back()
        .unwrap_or("repo");

    let clone_target = dest_path.join(folder_name);
    if clone_target.exists() {
        return Err(format!("Folder '{folder_name}' already exists at this location"));
    }

    let output = git_helpers::git_command()
        .arg("clone")
        .arg(&url)
        .arg(&clone_target)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("Git clone failed: {stderr}"));
    }

    Ok(clone_target.to_string_lossy().to_string())
}

// ---------------------------------------------------------------------------
// Terminal / log opening (not git commands per se)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn open_terminal(path: String) -> Result<(), String> {
    let dir = PathBuf::from(&path);
    if !dir.exists() {
        return Err("Path does not exist".into());
    }

    #[cfg(target_os = "windows")]
    {
        let result = Command::new("wt").arg("-d").arg(&path).spawn();
        if result.is_err() {
            Command::new("cmd")
                .args(["/C", "start", "", "cmd"])
                .current_dir(&dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Terminal", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let mut spawned = false;

        if let Ok(term) = std::env::var("TERMINAL") {
            if !term.is_empty() {
                spawned = Command::new(&term)
                    .arg("--working-directory")
                    .arg(&path)
                    .spawn()
                    .is_ok();
            }
        }

        let terminals: [(&str, &[&str]); 6] = [
            ("gnome-terminal", &["--working-directory", ""]),
            ("kgx", &["--working-directory", ""]),
            ("ptyxis", &["--working-directory", ""]),
            ("konsole", &["--workdir", ""]),
            ("xfce4-terminal", &["--working-directory", ""]),
            ("x-terminal-emulator", &["--working-directory", ""]),
        ];

        for &(term, args) in &terminals {
            if args.len() == 2 && !spawned {
                let replaced: Vec<&str> = vec![args[0], &path];
                if Command::new(term).args(&replaced).spawn().is_ok() {
                    spawned = true;
                }
            }
        }

        if !spawned {
            spawned = Command::new("xterm")
                .args(["-e", &format!("cd '{}' && exec bash", path.replace('\'', "'\\''"))])
                .spawn()
                .is_ok();
        }

        if !spawned {
            Command::new("xdg-open").arg(&path).spawn().ok();
        }

        if !spawned {
            return Err("Could not find a terminal emulator".into());
        }
    }

    Ok(())
}

#[tauri::command]
pub fn git_log(_app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = PathBuf::from(&path);
    if !dir.exists() {
        return Err("Path does not exist".into());
    }
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "Git Log", "cmd", "/K", "git log --oneline --graph -25 --all"])
            .current_dir(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"tell application "Terminal"
                activate
                do script "cd \"{}\" && git log --oneline --graph -25 --all"
            end tell"#,
            path.replace('"', "\\\"")
        );
        Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let script = format!(
            "#!/bin/sh\ncd '{}' && git log --oneline --graph -25 --all\nexec sh\n",
            path.replace('\'', "'\\''")
        );
        crate::terminal::spawn_shell_script_in_terminal(&_app, &script)?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Diff (complex parsing)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn git_file_diff(path: String, file_path: String) -> Result<GitDiffResult, String> {
    if !check_is_repo(&path) {
        return Err("Not a git repository".into());
    }

    let output = git_helpers::git_raw(&path, ["diff", "--no-color", "--", &file_path])
        .map_err(|e| e.to_string())?;
    let stdout = git_helpers::output_stdout(&output);

    let diff_text = if stdout.trim().is_empty() {
        let cached = git_helpers::git_raw(&path, ["diff", "--cached", "--no-color", "--", &file_path])
            .ok();
        match cached {
            Some(c) => git_helpers::output_stdout(&c),
            None => stdout,
        }
    } else {
        stdout
    };

    if diff_text.trim().is_empty() {
        return Err(format!("No diff available for '{}'", file_path));
    }

    let mut result = GitDiffResult { hunks: Vec::new() };
    let mut current_hunk: Option<GitDiffHunk> = None;

    for line in diff_text.lines() {
        if let Some(hunk_header) = line.strip_prefix("@@ ") {
            if let Some(range_part) = hunk_header.split(" @@").next() {
                if let Some(range) = range_part.split(' ').nth(1) {
                    if let Some((old, new)) = range.split_once(' ') {
                        let old_parts: Vec<&str> = old.split(',').collect();
                        let new_parts: Vec<&str> = new.split(',').collect();
                        let old_start = old_parts[0].trim_start_matches('-').parse::<u32>().unwrap_or(1);
                        let old_lines = old_parts.get(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
                        let new_start = new_parts[0].trim_start_matches('+').parse::<u32>().unwrap_or(1);
                        let new_lines = new_parts.get(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);

                        if let Some(hunk) = current_hunk.take() { result.hunks.push(hunk); }
                        current_hunk = Some(GitDiffHunk {
                            old_start, old_lines, new_start, new_lines, lines: Vec::new(),
                        });
                    }
                }
            }
        } else if let Some(hunk) = &mut current_hunk {
            if line.starts_with('+') {
                hunk.lines.push(GitDiffLine { kind: "add".into(), content: line.strip_prefix('+').unwrap().to_string() });
            } else if line.starts_with('-') {
                hunk.lines.push(GitDiffLine { kind: "delete".into(), content: line.strip_prefix('-').unwrap().to_string() });
            } else if line.starts_with(' ') {
                hunk.lines.push(GitDiffLine { kind: "context".into(), content: line.strip_prefix(' ').unwrap().to_string() });
            }
        }
    }

    if let Some(hunk) = current_hunk.take() { result.hunks.push(hunk); }
    Ok(result)
}
