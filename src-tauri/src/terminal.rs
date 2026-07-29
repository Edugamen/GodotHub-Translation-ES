use std::path::Path;
use std::process::{Child, Command};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(unix)]
use std::path::PathBuf;

#[cfg(all(unix, not(target_os = "macos")))]
const TERMINALS: [(&str, &[&str]); 22] = [
    ("x-terminal-emulator", &["-e"]),
    ("gnome-terminal", &["--"]),
    ("konsole", &["-e"]),
    ("kgx", &["--"]),
    ("ptyxis", &["-x"]),
    ("xfce4-terminal", &["-x"]),
    ("tilix", &["-e"]),
    ("mate-terminal", &["-x"]),
    ("deepin-terminal", &["-e"]),
    ("cosmic-term", &["-e"]),
    ("qterminal", &["-e"]),
    ("lxterminal", &["-e"]),
    ("kitty", &[]),
    ("alacritty", &["-e"]),
    ("wezterm", &["start", "--"]),
    ("foot", &[]),
    ("ghostty", &["-e"]),
    ("terminator", &["-x"]),
    ("urxvt", &["-e"]),
    ("rxvt", &["-e"]),
    ("st", &["-e"]),
    ("xterm", &["-e"]),
];

#[cfg(unix)]
fn sh_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(unix)]
fn prune_stale_scripts(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let cutoff = std::time::Duration::from_secs(60 * 60 * 24);
    for entry in entries.flatten() {
        let stale = entry
            .metadata()
            .and_then(|m| m.modified())
            .map(|m| m.elapsed().map(|age| age > cutoff).unwrap_or(false))
            .unwrap_or(false);
        if stale {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[cfg(unix)]
fn write_launch_script(body: &str, extension: &str) -> Result<PathBuf, String> {
    use std::os::unix::fs::PermissionsExt;

    let dir = std::env::temp_dir().join("godothub-launch");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    prune_stale_scripts(&dir);

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let script = dir.join(format!("launch-{stamp}.{extension}"));

    std::fs::write(&script, body).map_err(|e| e.to_string())?;
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755))
        .map_err(|e| e.to_string())?;

    Ok(script)
}

#[cfg(unix)]
fn program_script_body(program: &Path, args: &[String]) -> String {
    let mut body = String::from("#!/bin/sh\nexec ");
    body.push_str(&sh_quote(&program.to_string_lossy()));
    for arg in args {
        body.push(' ');
        body.push_str(&sh_quote(arg));
    }
    body.push('\n');
    body
}

#[cfg(all(unix, not(target_os = "macos")))]
fn find_on_path(binary: &str) -> Option<PathBuf> {
    if binary.contains('/') {
        let direct = PathBuf::from(binary);
        return direct.is_file().then_some(direct);
    }
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|dir| dir.join(binary))
        .find(|candidate| candidate.is_file())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn spawn_script(script: &Path) -> Result<Child, String> {
    if let Some(preferred) = std::env::var("TERMINAL").ok().filter(|t| !t.is_empty()) {
        if let Some(binary) = find_on_path(&preferred) {
            if let Ok(child) = Command::new(binary).arg("-e").arg(script).spawn() {
                return Ok(child);
            }
        }
    }

    for (binary, flags) in TERMINALS {
        let Some(resolved) = find_on_path(binary) else {
            continue;
        };
        if let Ok(child) = Command::new(resolved).args(flags).arg(script).spawn() {
            return Ok(child);
        }
    }

    Err("Could not find a terminal emulator".into())
}

#[cfg(all(unix, not(target_os = "macos")))]
pub fn spawn_shell_script_in_terminal(body: &str) -> Result<Child, String> {
    let script = write_launch_script(body, "sh")?;
    spawn_script(&script)
}

#[cfg(target_os = "macos")]
fn spawn_script(script: &Path) -> Result<Child, String> {
    Command::new("open")
        .arg(script)
        .spawn()
        .or_else(|_| Command::new("open").args(["-a", "Terminal"]).arg(script).spawn())
        .map_err(|e| format!("Failed to open a terminal: {e}"))
}

#[cfg(unix)]
pub fn spawn_program_in_terminal(program: &Path, args: &[String]) -> Result<Child, String> {
    let extension = if cfg!(target_os = "macos") { "command" } else { "sh" };
    let script = write_launch_script(&program_script_body(program, args), extension)?;
    spawn_script(&script)
}

#[cfg(target_os = "windows")]
fn console_title(raw: &str) -> String {
    let cleaned: String = raw
        .lines()
        .next()
        .unwrap_or_default()
        .chars()
        .filter(|c| !c.is_control() && *c != '"' && *c != '%')
        .take(60)
        .collect();

    match cleaned.trim() {
        "" => "Godot".to_string(),
        trimmed => trimmed.to_string(),
    }
}

#[cfg(target_os = "windows")]
pub fn spawn_program_in_console(
    program: &Path,
    args: &[String],
    title: &str,
) -> Result<Child, String> {
    let mut line = format!(
        "/C start \"{}\" /WAIT \"{}\"",
        console_title(title),
        program.display()
    );
    for arg in args {
        line.push_str(&format!(" \"{}\"", arg.replace('"', "'")));
    }

    Command::new("cmd")
        .raw_arg(line)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to open a console window: {e}"))
}
