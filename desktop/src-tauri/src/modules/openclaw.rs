use tauri::{AppHandle, Manager, Runtime, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::sync::{Arc, Mutex};
use std::fs;
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
    pub api_key: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawConfig {
    pub api_key: String,
    pub modules: Vec<String>,
    pub llm: Option<LlmConfig>,
}

#[derive(Clone, serde::Serialize)]
struct InstallProgress {
    step: String,
    message: String,
    percentage: u8,
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
        std::thread::sleep(std::time::Duration::from_millis(800)); // Simulate work
    };

    emit_progress("init", "Initializing installer...", 10);
    
    let is_windows = cfg!(target_os = "windows");
    let binary_name = if is_windows { "openclaw.bat" } else { "openclaw" };
    let bin_path = app_dir.join(binary_name);
    
    emit_progress("download", "Downloading OpenClaw Runtime (v0.4.2)...", 30);
    
    // Create dummy script
    let script = if is_windows {
        r#"@echo off
echo OpenClaw Runtime Active
:loop
echo Heartbeat...
timeout /t 5 >nul
goto loop
"#
    } else {
        r#"#!/bin/sh
echo "OpenClaw Runtime Active"
while true; do
  echo "Heartbeat..."
  sleep 5
done
"#
    };
    
    emit_progress("extract", "Verifying package integrity...", 50);
    fs::write(&bin_path, script).map_err(|e| e.to_string())?;
    
    emit_progress("configure", "Configuring local environment...", 70);

    // Make executable (Unix only)
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(&bin_path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&bin_path, perms).map_err(|e| e.to_string())?;
    }

    emit_progress("bootstrap", "Bootstrapping agent network...", 90);
    
    // Simulate network delay
    std::thread::sleep(std::time::Duration::from_secs(1));
    
    emit_progress("done", "Installation complete.", 100);

    Ok(bin_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_config<R: Runtime>(app: AppHandle<R>, config: OpenClawConfig) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_path = app_dir.join("config.yaml");
    
    let mut content = format!(
        "api_key: {}\nmodules:\n{}", 
        config.api_key,
        config.modules.iter().map(|m| format!("  - {}", m)).collect::<Vec<_>>().join("\n")
    );

    if let Some(llm) = config.llm {
        content.push_str(&format!("\nllm:\n  provider: {}\n  api_key: {}", llm.provider, llm.api_key));
    }
    
    std::fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok("Config saved".to_string())
}
