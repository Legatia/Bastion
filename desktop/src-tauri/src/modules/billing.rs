use tauri::{AppHandle, Runtime};
use bastion_core::config::load_config;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Serialize, Deserialize)]
pub struct ModuleStatus {
    pub openclaw_purchased: bool,
    pub agent_modules: std::collections::HashMap<String, Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillingSummary {
    #[serde(rename = "monthlyTotal")]
    pub monthly_total: i64,
    #[serde(rename = "monthlyTotalDisplay")]
    pub monthly_total_display: String,
    pub breakdown: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn sync_billing<R: Runtime>(_app: AppHandle<R>, modules: Vec<String>) -> Result<String, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    if config.backend_url.contains("localhost") {
        println!("Mocking billing sync to {}", config.backend_url);
        return Ok("Billing synced (Mock)".to_string());
    }

    let client = reqwest::Client::new();
    let res = client.post(format!("{}/api/billing/sync", config.backend_url))
        .header("x-api-key", config.api_key)
        .json(&json!({ "modules": modules }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok("Billing synced".to_string())
    } else {
        Err(format!("Sync failed: {}", res.status()))
    }
}

#[tauri::command]
pub async fn get_active_modules<R: Runtime>(_app: AppHandle<R>) -> Result<ModuleStatus, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let res = client.get(format!("{}/modules", config.backend_url))
        .header("x-api-key", &config.api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let status: ModuleStatus = res.json().await.map_err(|e| e.to_string())?;
        Ok(status)
    } else {
        Err(format!("Failed to fetch modules: {}", res.status()))
    }
}

#[tauri::command]
pub async fn check_module_access<R: Runtime>(
    _app: AppHandle<R>,
    module: String,
    agent_id: Option<String>,
) -> Result<bool, String> {
    let _config = load_config().map_err(|e| e.to_string())?;

    let modules = get_active_modules(_app).await?;

    if module == "OPENCLAW" {
        return Ok(modules.openclaw_purchased);
    }

    let aid = agent_id.ok_or("agent_id required for per-agent modules")?;
    let agent_mods = modules.agent_modules.get(&aid).cloned().unwrap_or_default();
    Ok(agent_mods.contains(&module))
}

#[tauri::command]
pub async fn activate_module<R: Runtime>(
    _app: AppHandle<R>,
    module: String,
    agent_id: Option<String>,
) -> Result<String, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let res = client.post(format!("{}/modules/activate", config.backend_url))
        .header("x-api-key", &config.api_key)
        .json(&json!({ "module": module, "agentId": agent_id }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(format!("{} activated", module))
    } else {
        let body = res.text().await.unwrap_or_default();
        Err(format!("Activation failed: {}", body))
    }
}

#[tauri::command]
pub async fn get_billing_summary<R: Runtime>(_app: AppHandle<R>) -> Result<BillingSummary, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let res = client.get(format!("{}/modules/billing", config.backend_url))
        .header("x-api-key", &config.api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let summary: BillingSummary = res.json().await.map_err(|e| e.to_string())?;
        Ok(summary)
    } else {
        Err(format!("Failed to fetch billing: {}", res.status()))
    }
}
