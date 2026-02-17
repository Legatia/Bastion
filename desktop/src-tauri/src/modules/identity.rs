use tauri::{AppHandle, Runtime};
use bastion_core::config::load_config;
use reqwest::Client;
use serde_json::json;

#[tauri::command]
pub async fn verify_identity<R: Runtime>(_app: AppHandle<R>, chain: String) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    
    // If agent_id is missing, we can't verify
    let agent_id = config.agent_id.ok_or("Agent ID not configured. Run bastion init first.")?;
    
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

/// Register an agent on-chain via ERC-8004 using the backend's CDP wallet.
/// This mirrors the CLI's `bastion register` command.
#[tauri::command]
pub async fn register_agent<R: Runtime>(_app: AppHandle<R>, chain: String) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured. Run bastion init first.")?;

    let client = Client::new();
    let resp = client
        .post(format!("{}/agents/{}/register", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .json(&json!({ "chain": chain }))
        .timeout(std::time::Duration::from_secs(60)) // Registration waits for mining
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let body: serde_json::Value = resp.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if status.is_success() {
        Ok(body)
    } else if status.as_u16() == 400 {
        // Already registered is not an error
        if body["error"].as_str() == Some("Already registered") {
            Ok(body)
        } else {
            Err(format!("Registration error: {}", body["message"].as_str().unwrap_or("Bad request")))
        }
    } else if status.as_u16() == 403 {
        Err(format!("Upgrade required: {}", body["reason"].as_str().unwrap_or("ERC-8004 registration requires STARTER tier or higher")))
    } else {
        Err(format!("Error ({}): {}", status, body["message"].as_str().unwrap_or("Unknown error")))
    }
}

/// Get the agent's CDP wallet details (address, network, balances).
#[tauri::command]
pub async fn get_agent_wallet<R: Runtime>(_app: AppHandle<R>, network: Option<String>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let agent_id = config.agent_id.ok_or("Agent ID not configured")?;
    let net = network.unwrap_or_else(|| "avalanche".to_string());

    let client = Client::new();
    let resp = client
        .get(format!("{}/agents/{}/wallet?network={}", config.backend_url, agent_id, net))
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
