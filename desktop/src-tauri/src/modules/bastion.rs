use tauri::{AppHandle, Manager, Runtime};
use std::sync::{Arc, Mutex};
use bastion_core::proxy::proxy_handler;
use bastion_core::config::load_config;

use tokio::net::TcpListener;
use axum::{Router, routing::any};

pub struct BastionState {
    pub proxy_handle: Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
}

impl BastionState {
    pub fn new() -> Self {
        Self {
            proxy_handle: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn start_bastion_proxy<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let state = app.state::<BastionState>();
    let mut handle_lock = state.proxy_handle.lock().unwrap();
    
    if handle_lock.is_some() {
        return Ok("Proxy already running".to_string());
    }

    // Load config (or use defaults)
    // For desktop we might want to override config with passed params, but for now load from disk
    let config = load_config().map_err(|e| e.to_string())?;
    let config_arc = Arc::new(config);
    
    let port = 3000; // TODO: Make configurable
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    
    // Create axum app
    let axum_app = Router::new()
        .route("/", any(proxy_handler))
        .route("/*path", any(proxy_handler))
        .with_state(config_arc.clone());

    // Spawn server
    let server_handle = tauri::async_runtime::spawn(async move {
        match TcpListener::bind(addr).await {
            Ok(listener) => {
                if let Err(e) = axum::serve(listener, axum_app).await {
                     eprintln!("Bastion Proxy Error: {}", e);
                }
            }
            Err(e) => {
                eprintln!("Failed to bind to port {}: {}", port, e);
            }
        }
    });
    
    *handle_lock = Some(server_handle);
    
    Ok(format!("Proxy started on port {}", port))
}

#[tauri::command]
pub async fn stop_bastion_proxy<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let state = app.state::<BastionState>();
    let mut handle_lock = state.proxy_handle.lock().unwrap();
    
    if let Some(handle) = handle_lock.take() {
        handle.abort(); // axum server might need graceful shutdown signal, but abort works for now
        Ok("Proxy stopped".to_string())
    } else {
        Ok("Proxy was not running".to_string())
    }
}

#[tauri::command]
pub async fn get_bastion_status<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    let state = app.state::<BastionState>();
    let handle_lock = state.proxy_handle.lock().unwrap();
    Ok(handle_lock.is_some())
}
