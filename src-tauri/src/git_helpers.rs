use std::ffi::OsStr;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
use crate::terminal::CREATE_NO_WINDOW;

use crate::error::{AppError, AppResult};

/// Create a `git` `Command` with platform-specific flags (e.g.
/// `CREATE_NO_WINDOW` on Windows).
pub fn git_command() -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new("git");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Execute a `git` command in the given working directory and return stdout
/// on success, or stderr on failure.
pub fn git_cmd<I, S>(working_dir: &str, args: I) -> AppResult<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = git_command()
        .args(args)
        .current_dir(working_dir)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::Message(stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Like `git_cmd` but returns raw `std::process::Output` (useful when stdout
/// needs special parsing or when you need both stdout and stderr).
pub fn git_raw<I, S>(working_dir: &str, args: I) -> AppResult<std::process::Output>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    git_command()
        .args(args)
        .current_dir(working_dir)
        .output()
        .map_err(AppError::from)
}

/// Output to String helper, used by commands that parse their own stdout.
pub fn output_stdout(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stdout).to_string()
}

pub fn output_stderr(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stderr).to_string()
}

/// Parse lines from a git command's stdout, skipping empty lines.
#[allow(dead_code)]
pub fn git_lines(working_dir: &str, args: &[&str]) -> AppResult<Vec<String>> {
    let out = git_cmd(working_dir, args)?;
    Ok(out.lines().filter(|l| !l.is_empty()).map(String::from).collect())
}

/// Shell out to open a file/folder with the OS default application.
#[allow(dead_code)]
pub fn open_in_os(path: &Path) -> AppResult<()> {
    let path_str = path.to_string_lossy();
    let _path_s: &str = &path_str;

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(path).spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(path).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open")
        .arg(path)
        .spawn()
        .or_else(|_| Command::new("gio").args(["open", _path_s]).spawn())
        .or_else(|_| Command::new("nautilus").arg(_path_s).spawn())
        .or_else(|_| Command::new("dolphin").arg(_path_s).spawn())
        .or_else(|_| Command::new("thunar").arg(_path_s).spawn());

    result.map(|_| ()).map_err(|e| format!("Failed to open: {e}").into())
}
