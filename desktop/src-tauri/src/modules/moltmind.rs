use tauri::{AppHandle, Manager, Runtime};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use bastion_core::config::load_config;


/// Flush buffered events to backend every 10 seconds.
const BATCH_FLUSH_INTERVAL_SECS: u64 = 10;
/// Maximum buffer size — oldest events are dropped if backend is unreachable.
const BATCH_MAX_BUFFER: usize = 200;

#[derive(Clone)]
struct PendingEvent {
    event_type: String,
    endpoint: String,
    raw_length: usize,
}

pub struct MoltMindState {
    pub is_running: Arc<Mutex<bool>>,
    pub events: Arc<Mutex<Vec<String>>>, // Local ring buffer for UI display
    pending_batch: Arc<Mutex<Vec<PendingEvent>>>,
}

impl MoltMindState {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(Mutex::new(false)),
            events: Arc::new(Mutex::new(Vec::new())),
            pending_batch: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[tauri::command]
pub async fn start_moltmind<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let state = app.state::<MoltMindState>();
    *state.is_running.lock().unwrap() = true;

    // Spawn background flush loop
    let is_running = state.is_running.clone();
    let pending_batch = state.pending_batch.clone();
    tauri::async_runtime::spawn(async move {
        flush_loop(is_running, pending_batch).await;
    });

    Ok("MoltMind active".to_string())
}

#[tauri::command]
pub async fn stop_moltmind<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let state = app.state::<MoltMindState>();
    *state.is_running.lock().unwrap() = false;
    Ok("MoltMind stopped".to_string())
}

#[tauri::command]
pub async fn get_moltmind_status<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    let state = app.state::<MoltMindState>();
    let is_running = *state.is_running.lock().unwrap();
    Ok(is_running)
}

#[tauri::command]
pub async fn get_behavior_events<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    let state = app.state::<MoltMindState>();
    let events = state.events.lock().unwrap().clone();
    Ok(events)
}

/// Record an event locally and buffer it for batch forwarding to backend.
/// Called from other modules (e.g. runtime process stdout/stderr).
pub fn record_event<R: Runtime>(app: &AppHandle<R>, event: String) {
    let state = app.state::<MoltMindState>();
    if !*state.is_running.lock().unwrap() {
        return;
    }

    // Store locally for UI display (ring buffer, max 100)
    let timestamp = chrono::Local::now().format("%H:%M:%S");
    let display_line = format!("[{}] {}", timestamp, event);
    {
        let mut events = state.events.lock().unwrap();
        events.push(display_line);
        if events.len() > 100 {
            events.remove(0);
        }
    }

    // Classify and buffer for batch sending (no HTTP call per event)
    let (event_type, endpoint) = classify_log_event(&event);
    let pending = PendingEvent {
        event_type: event_type.to_string(),
        endpoint,
        raw_length: event.len(),
    };

    {
        let mut batch = state.pending_batch.lock().unwrap();
        batch.push(pending);
        // Cap buffer to prevent memory growth if backend is unreachable
        if batch.len() > BATCH_MAX_BUFFER {
            let overflow = batch.len() - BATCH_MAX_BUFFER;
            batch.drain(0..overflow);
        }
    }
}

/// Background loop that drains the pending event buffer every BATCH_FLUSH_INTERVAL_SECS
/// and forwards events to the backend. Exits when is_running becomes false.
async fn flush_loop(
    is_running: Arc<Mutex<bool>>,
    pending_batch: Arc<Mutex<Vec<PendingEvent>>>,
) {
    let client = reqwest::Client::new();

    loop {
        tokio::time::sleep(Duration::from_secs(BATCH_FLUSH_INTERVAL_SECS)).await;

        // Check if we should stop
        if !*is_running.lock().unwrap() {
            break;
        }

        // Drain the buffer
        let events: Vec<PendingEvent> = {
            let mut batch = pending_batch.lock().unwrap();
            batch.drain(..).collect()
        };

        if events.is_empty() {
            continue;
        }

        // Load config once per flush cycle
        let config = match load_config() {
            Ok(c) => c,
            Err(_) => continue,
        };

        let agent_id = match config.agent_id.as_deref() {
            Some(id) => id.to_string(),
            None => continue,
        };

        // Send buffered events sequentially (reusing the same client)
        for event in &events {
            let res = client
                .post(format!("{}/authorize", config.backend_url))
                .header("x-api-key", &config.api_key)
                .json(&serde_json::json!({
                    "agent_id": agent_id,
                    "action": {
                        "type": event.event_type,
                        "details": {
                            "url": event.endpoint,
                            "source": "desktop_runtime",
                            "raw_length": event.raw_length,
                        }
                    }
                }))
                .send()
                .await;

            // If backend is down, don't keep hammering — break and retry next cycle
            if res.is_err() {
                break;
            }
        }
    }
}

/// Classify a raw log line into an event type and synthetic endpoint.
fn classify_log_event(text: &str) -> (&'static str, String) {
    let lower = text.to_lowercase();

    if lower.contains("http") && (lower.contains("get ") || lower.contains("post ") || lower.contains("put ") || lower.contains("delete ")) {
        return ("http_request", extract_url_from_log(text));
    }
    if lower.contains("error") || lower.contains("stderr") {
        return ("runtime_error", "runtime://stderr".to_string());
    }
    if lower.contains("heartbeat") || lower.contains("ping") || lower.contains("alive") {
        return ("heartbeat", "runtime://heartbeat".to_string());
    }
    if lower.contains("started") || lower.contains("initialized") || lower.contains("ready") {
        return ("lifecycle", "runtime://startup".to_string());
    }
    if lower.contains("stopped") || lower.contains("shutdown") || lower.contains("exit") {
        return ("lifecycle", "runtime://shutdown".to_string());
    }

    ("runtime_log", "runtime://stdout".to_string())
}

/// Try to extract a URL from a log line.
fn extract_url_from_log(text: &str) -> String {
    for word in text.split_whitespace() {
        if word.starts_with("http://") || word.starts_with("https://") {
            return word.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '/' && c != ':' && c != '.' && c != '-' && c != '_')
                .to_string();
        }
    }
    "runtime://unknown".to_string()
}

// ──────────────────────────────────────────────────────────────
// Read-side commands: fetch health, alerts, baseline, analysis
// These mirror CLI's `bastion moltmind health/alerts/baseline`
// ──────────────────────────────────────────────────────────────

/// Get the health score for the configured agent.
#[tauri::command]
pub async fn get_health_score<R: Runtime>(_app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured")?;

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/agents/{}/health", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        Err(format!("Backend error: {}", resp.status()))
    }
}

/// Get cognitive drift alerts for the configured agent.
#[tauri::command]
pub async fn get_cognitive_alerts<R: Runtime>(
    _app: AppHandle<R>,
    limit: Option<u32>,
    window: Option<u32>,
) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured")?;

    let l = limit.unwrap_or(20);
    let w = window.unwrap_or(24);

    let client = reqwest::Client::new();
    let resp = client
        .get(format!(
            "{}/agents/{}/alerts?limit={}&window={}",
            config.backend_url, agent_id, l, w
        ))
        .header("X-API-Key", &config.api_key)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        Err(format!("Backend error: {}", resp.status()))
    }
}

/// Acknowledge (dismiss) a specific cognitive alert.
#[tauri::command]
pub async fn acknowledge_alert<R: Runtime>(
    _app: AppHandle<R>,
    alert_id: String,
) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured")?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}/agents/{}/alerts/{}/acknowledge",
            config.backend_url, agent_id, alert_id
        ))
        .header("X-API-Key", &config.api_key)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        Err(format!("Backend error: {}", resp.status()))
    }
}

/// Get behavioral baseline for the configured agent.
#[tauri::command]
pub async fn get_baseline<R: Runtime>(_app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured")?;

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/agents/{}/baseline", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        Err(format!("Backend error: {}", resp.status()))
    }
}

/// Trigger a drift analysis for the configured agent.
#[tauri::command]
pub async fn run_drift_analysis<R: Runtime>(_app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured")?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/agents/{}/analyze", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        Err(format!("Backend error: {}", resp.status()))
    }
}
