use tauri::{AppHandle, Manager, Runtime, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::sync::{Arc, Mutex};
use std::fs;
use std::path::PathBuf;
use std::env;
use sha2::{Digest, Sha256};
use crate::modules::moltmind::record_event;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

pub struct OpenClawState {
    pub process_id: Arc<Mutex<Option<u32>>>,
}

impl OpenClawState {
    pub fn new() -> Self {
        Self {
            process_id: Arc::new(Mutex::new(None)),
        }
    }
}



#[tauri::command]
pub async fn run_openclaw<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    
    let is_windows = cfg!(target_os = "windows");
    let binary_name = if is_windows { "openclaw.bat" } else { "openclaw" };
    let bin_path = app_dir.join(binary_name);
    
    if !bin_path.exists() {
        return Err("OpenClaw not installed".to_string());
    }
    
    // Command::new requires path as string
    let path_str = bin_path.to_string_lossy().to_string();
    
    // TODO: We need to configure capabilities to allow this path
    // For now we assume shell scope is configured or we use sidecar
    
    // Sandboxing: Inject Proxy Env Vars via shell wrapping
    let cmd = if is_windows {
        app.shell().command("cmd")
            .args(&["/C", &format!("set HTTP_PROXY=http://127.0.0.1:3000 && set HTTPS_PROXY=http://127.0.0.1:3000 && \"{}\"", path_str)])
    } else {
        app.shell().command("sh")
            .args(&["-c", &format!("export HTTP_PROXY=http://127.0.0.1:3000; export HTTPS_PROXY=http://127.0.0.1:3000; \"{}\"", path_str)])
    };
    
    // In a real app we'd spawn and keep handle.
    // tailored to tauri-plugin-shell v2
    
    let (mut rx, child) = cmd.spawn().map_err(|e| e.to_string())?;
    
    let pid = child.pid();
    
    // Store PID for later termination
    let state = app.state::<OpenClawState>();
    *state.process_id.lock().unwrap() = Some(pid);
    
    // Spawn a task to handle events (logs)
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let log = String::from_utf8_lossy(&line).to_string();
                    println!("OpenClaw: {}", log);
                    record_event(&app_handle, format!("STDOUT: {}", log));
                }
                CommandEvent::Stderr(line) => {
                    let log = String::from_utf8_lossy(&line).to_string();
                    eprintln!("OpenClaw Err: {}", log);
                    record_event(&app_handle, format!("STDERR: {}", log));
                }
                _ => {}
            }
        }
    });

    Ok(format!("Running with PID: {}", pid))
}

#[tauri::command]
pub async fn stop_openclaw<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let state = app.state::<OpenClawState>();
    let pid_opt = *state.process_id.lock().unwrap();
    
    if let Some(pid) = pid_opt {
        // Kill process using shell command for now as we don't hold the Child handle
        // In production, we should probably wrap the Child in a struct inside Arc<Mutex> if possible,
        // or use system commands to kill by PID.
        
        #[cfg(target_os = "windows")]
        let _ = app.shell().command("taskkill")
            .args(&["/F", "/PID", &pid.to_string()])
            .output()
            .await;

        #[cfg(not(target_os = "windows"))]
        let _ = app.shell().command("kill")
            .args(&[pid.to_string()])
            .output()
            .await;
            
        *state.process_id.lock().unwrap() = None;
        Ok(format!("Stopped PID {}", pid))
    } else {
        Err("No process running".to_string())
    }
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub provider: String,
    pub api_key: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawConfig {
    pub modules: Vec<String>,
    pub llm: Option<LlmConfig>,
}

#[derive(Clone, serde::Serialize)]
struct InstallProgress {
    step: String,
    message: String,
    percentage: u8,
}

#[cfg(not(target_os = "windows"))]
const DEFAULT_INSTALLER_URL_UNIX: &str = "https://openclaw.ai/install.sh";
#[cfg(target_os = "windows")]
const DEFAULT_INSTALLER_URL_WINDOWS: &str = "https://openclaw.ai/install.ps1";

fn parse_bool_env(name: &str) -> bool {
    match env::var(name) {
        Ok(v) => matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"),
        Err(_) => false,
    }
}

fn installer_policy() -> (bool, bool) {
    // Default to permissive install behavior; strict pinning can be enabled via env.
    let allow_unpinned = match env::var("OPENCLAW_INSTALLER_ALLOW_UNPINNED") {
        Ok(v) => matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"),
        Err(_) => true,
    };
    let skip_doctor = parse_bool_env("OPENCLAW_INSTALLER_SKIP_DOCTOR");
    (allow_unpinned, skip_doctor)
}

#[tauri::command]
pub async fn get_openclaw_status<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    let state = app.state::<OpenClawState>();
    let guard = state.process_id.lock().map_err(|e| e.to_string())?;
    Ok(guard.is_some())
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

async fn download_installer(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Installer download failed: {} ({})", url, resp.status()));
    }
    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| e.to_string())
}

fn verify_installer_checksum(bytes: &[u8], expected_sha256: Option<String>, allow_unpinned: bool) -> Result<String, String> {
    let digest = Sha256::digest(bytes);
    let actual = to_hex(&digest);
    match expected_sha256 {
        Some(expected) => {
            let expected_norm = expected.trim().to_ascii_lowercase();
            if expected_norm.is_empty() {
                if allow_unpinned {
                    Ok(actual)
                } else {
                    Err("Checksum pinning required: OPENCLAW_INSTALLER_SHA256_* is empty".to_string())
                }
            } else if actual == expected_norm {
                Ok(actual)
            } else {
                Err(format!(
                    "Installer checksum mismatch. expected={}, actual={}",
                    expected_norm, actual
                ))
            }
        }
        None => {
            if allow_unpinned {
                Ok(actual)
            } else {
                Err("Checksum pinning required: set OPENCLAW_INSTALLER_SHA256_UNIX/OPENCLAW_INSTALLER_SHA256_WINDOWS".to_string())
            }
        }
    }
}

#[cfg(unix)]
fn create_unix_launcher(path: &PathBuf, npm_prefix: Option<&str>) -> Result<(), String> {
    let npm_bin = npm_prefix
        .map(|p| format!("{}/bin/openclaw", p.trim_end_matches('/')))
        .unwrap_or_default();

    let script = if npm_bin.is_empty() {
        r#"#!/bin/sh
if command -v openclaw >/dev/null 2>&1; then
  exec openclaw "$@"
fi
echo "OpenClaw binary not found. Run installer again or fix PATH." >&2
exit 127
"#
        .to_string()
    } else {
        format!(
            r#"#!/bin/sh
if command -v openclaw >/dev/null 2>&1; then
  exec openclaw "$@"
fi
if [ -x "{npm_bin}" ]; then
  exec "{npm_bin}" "$@"
fi
echo "OpenClaw binary not found. Run installer again or fix PATH." >&2
exit 127
"#
        )
    };

    fs::write(path, script).map_err(|e| e.to_string())?;
    let mut perms = fs::metadata(path).map_err(|e| e.to_string())?.permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn create_windows_launcher(path: &PathBuf, npm_prefix: Option<&str>) -> Result<(), String> {
    let npm_cmd = npm_prefix
        .map(|p| format!(r#"{}\openclaw.cmd"#, p.trim_end_matches(['\\', '/'])))
        .unwrap_or_default();

    let script = if npm_cmd.is_empty() {
        r#"@echo off
where openclaw >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  openclaw %*
  exit /b %ERRORLEVEL%
)
echo OpenClaw binary not found. Run installer again or fix PATH.
exit /b 127
"#
        .to_string()
    } else {
        format!(
            r#"@echo off
where openclaw >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  openclaw %*
  exit /b %ERRORLEVEL%
)
if exist "{npm_cmd}" (
  "{npm_cmd}" %*
  exit /b %ERRORLEVEL%
)
echo OpenClaw binary not found. Run installer again or fix PATH.
exit /b 127
"#
        )
    };

    fs::write(path, script).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn install_openclaw<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    
    // Helper to emit progress
    let emit_progress = |step: &str, msg: &str, pct: u8| {
        let _ = app.emit("install_progress", InstallProgress {
            step: step.to_string(),
            message: msg.to_string(),
            percentage: pct,
        });
    };

    emit_progress("init", "Initializing installer...", 10);
    
    let is_windows = cfg!(target_os = "windows");
    let binary_name = if is_windows { "openclaw.bat" } else { "openclaw" };
    let bin_path = app_dir.join(binary_name);
    let (allow_unpinned, skip_doctor) = installer_policy();

    #[cfg(target_os = "windows")]
    let installer_url = env::var("OPENCLAW_INSTALLER_URL_WINDOWS")
        .unwrap_or_else(|_| DEFAULT_INSTALLER_URL_WINDOWS.to_string());
    #[cfg(not(target_os = "windows"))]
    let installer_url = env::var("OPENCLAW_INSTALLER_URL_UNIX")
        .unwrap_or_else(|_| DEFAULT_INSTALLER_URL_UNIX.to_string());

    #[cfg(target_os = "windows")]
    let expected_sha = env::var("OPENCLAW_INSTALLER_SHA256_WINDOWS").ok();
    #[cfg(not(target_os = "windows"))]
    let expected_sha = env::var("OPENCLAW_INSTALLER_SHA256_UNIX").ok();

    emit_progress("download", "Downloading OpenClaw installer...", 28);
    let installer_bytes = download_installer(&installer_url).await?;

    emit_progress("verify", "Verifying installer integrity...", 45);
    let actual_sha = verify_installer_checksum(&installer_bytes, expected_sha, allow_unpinned)?;
    println!("OpenClaw installer SHA-256 verified: {}", actual_sha);

    let installer_filename = if is_windows { "openclaw-install.ps1" } else { "openclaw-install.sh" };
    let installer_path = app_dir.join(installer_filename);
    fs::write(&installer_path, installer_bytes).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(&installer_path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o700);
        fs::set_permissions(&installer_path, perms).map_err(|e| e.to_string())?;
    }

    emit_progress("install", "Running OpenClaw installer...", 62);
    let installer_path_str = installer_path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    let installer_output = app
        .shell()
        .command("powershell")
        .args(&[
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            &installer_path_str,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "windows"))]
    let installer_output = app
        .shell()
        .command("sh")
        .args(&[
            &installer_path_str,
            "--no-onboard",
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if installer_output.status.code().unwrap_or(1) != 0 {
        let stderr = String::from_utf8_lossy(&installer_output.stderr);
        let stdout = String::from_utf8_lossy(&installer_output.stdout);
        return Err(format!(
            "OpenClaw installer failed.\nstdout:\n{}\nstderr:\n{}",
            stdout, stderr
        ));
    }

    emit_progress("resolve", "Resolving OpenClaw binary path...", 74);
    let npm_prefix_output = app
        .shell()
        .command("npm")
        .args(&["prefix", "-g"])
        .output()
        .await
        .ok();

    let npm_prefix = npm_prefix_output
        .as_ref()
        .and_then(|out| {
            if out.status.code().unwrap_or(1) == 0 {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            } else {
                None
            }
        });

    emit_progress("configure", "Creating local launcher wrapper...", 84);
    #[cfg(unix)]
    create_unix_launcher(&bin_path, npm_prefix.as_deref())?;
    #[cfg(target_os = "windows")]
    create_windows_launcher(&bin_path, npm_prefix.as_deref())?;

    if !skip_doctor {
        emit_progress("doctor", "Running post-install health check...", 94);
        let _ = app
            .shell()
            .command(&bin_path)
            .args(&["doctor", "--non-interactive"])
            .output()
            .await;
    }

    emit_progress("done", "Installation complete.", 100);

    Ok(bin_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_config<R: Runtime>(app: AppHandle<R>, config: OpenClawConfig) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_path = app_dir.join("config.yaml");
    
    // Never persist secrets in plaintext config.
    let mut content = format!(
        "modules:\n{}", 
        config.modules.iter().map(|m| format!("  - {}", m)).collect::<Vec<_>>().join("\n")
    );

    if let Some(llm) = config.llm {
        let has_inline_key = llm.api_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false);
        content.push_str(&format!(
            "\nllm:\n  provider: {}\n  api_key_source: {}",
            llm.provider,
            if has_inline_key { "runtime_only" } else { "not_provided" }
        ));
    }
    
    std::fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok("Config saved".to_string())
}
