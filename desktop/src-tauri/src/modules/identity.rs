use tauri::{AppHandle, Runtime};
use bastion_core::config::load_config;
use reqwest::Client;
use serde_json::json;

#[tauri::command]
pub async fn verify_identity<R: Runtime>(_app: AppHandle<R>, chain: String) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    
    // If agent_id is missing, we can't verify
    let agent_id = config.agent_id.ok_or("Agent ID not configured. Install OpenClaw first.")?;
    
    let client = Client::new();
    let resp = client
        .post(format!("{}/agents/{}/verify", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .json(&json!({ "chain": chain }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let status = resp.status();
    if status.is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Backend error {}: {}", status, text))
    }
}

#[tauri::command]
pub async fn check_identity_status<R: Runtime>(_app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured")?;
    
    let client = Client::new();
    let resp = client
        .get(format!("{}/agents/{}", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(5))
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
