use tauri::{AppHandle, Runtime};
use bastion_core::config::load_config;
use reqwest::Client;
use serde_json::json;

/// List all policies for the current user.
#[tauri::command]
pub async fn list_policies<R: Runtime>(_app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = Client::new();
    let resp = client
        .get(format!("{}/policies", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
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

/// Get a specific policy by ID.
#[tauri::command]
pub async fn get_policy<R: Runtime>(_app: AppHandle<R>, policy_id: String) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = Client::new();
    let resp = client
        .get(format!("{}/policies/{}", config.backend_url, policy_id))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
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

/// Create a new policy.
#[tauri::command]
pub async fn create_policy<R: Runtime>(
    _app: AppHandle<R>,
    name: String,
    policy_type: String,
    config_json: String,
    description: Option<String>,
    priority: Option<i64>,
) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let policy_config: serde_json::Value = serde_json::from_str(&config_json)
        .map_err(|e| format!("Invalid JSON config: {}", e))?;

    let mut body = json!({
        "name": name,
        "type": policy_type,
        "config": policy_config,
    });

    if let Some(desc) = description {
        body["description"] = json!(desc);
    }
    if let Some(p) = priority {
        body["priority"] = json!(p);
    }

    let client = Client::new();
    let resp = client
        .post(format!("{}/policies", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Failed to create policy: {}", text))
    }
}

/// Toggle a policy enabled/disabled.
#[tauri::command]
pub async fn toggle_policy<R: Runtime>(
    _app: AppHandle<R>,
    policy_id: String,
    enabled: bool,
) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = Client::new();
    let resp = client
        .put(format!("{}/policies/{}", config.backend_url, policy_id))
        .header("X-API-Key", &config.api_key)
        .json(&json!({ "enabled": enabled }))
        .timeout(std::time::Duration::from_secs(10))
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

/// Delete a policy.
#[tauri::command]
pub async fn delete_policy<R: Runtime>(_app: AppHandle<R>, policy_id: String) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = Client::new();
    let resp = client
        .delete(format!("{}/policies/{}", config.backend_url, policy_id))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
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
