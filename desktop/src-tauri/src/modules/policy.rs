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

/// List available industry profiles and active profile.
#[tauri::command]
pub async fn list_industry_profiles<R: Runtime>(_app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = Client::new();
    let resp = client
        .get(format!("{}/industry-profiles", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Failed to list industry profiles: {}", text))
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

/// Apply an industry profile (e.g. default, accounting) to current user policies.
#[tauri::command]
pub async fn apply_industry_profile<R: Runtime>(
    _app: AppHandle<R>,
    profile_id: String,
    replace_existing_types: Option<bool>,
) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let replace_existing = replace_existing_types.unwrap_or(true);

    let client = Client::new();
    let resp = client
        .post(format!("{}/industry-profiles/{}/apply", config.backend_url, profile_id))
        .header("X-API-Key", &config.api_key)
        .json(&json!({ "replaceExistingTypes": replace_existing }))
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Failed to apply industry profile: {}", text))
    }
}

/// Export the current tenant profile bundle (JSON).
#[tauri::command]
pub async fn export_industry_profile_bundle<R: Runtime>(
    _app: AppHandle<R>,
    enabled_only: Option<bool>,
) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let enabled = enabled_only.unwrap_or(true);

    let client = Client::new();
    let resp = client
        .get(format!("{}/industry-profiles/export", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .query(&[("enabled_only", enabled)])
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Failed to export profile bundle: {}", text))
    }
}

/// Import and apply a tenant profile bundle from JSON.
#[tauri::command]
pub async fn import_industry_profile_bundle<R: Runtime>(
    _app: AppHandle<R>,
    bundle_json: String,
) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    let bundle: serde_json::Value = serde_json::from_str(&bundle_json)
        .map_err(|e| format!("Invalid JSON bundle: {}", e))?;

    let profile = bundle.get("profile").cloned().unwrap_or(serde_json::json!({}));
    let profile_id = profile.get("id").and_then(|v| v.as_str()).unwrap_or("imported");
    let profile_name = profile.get("name").and_then(|v| v.as_str()).unwrap_or("Imported Profile");
    let version = profile.get("version").and_then(|v| v.as_str()).unwrap_or("1");
    let policies = bundle.get("policies").cloned().unwrap_or(serde_json::json!([]));

    let payload = serde_json::json!({
        "profileId": profile_id,
        "profileName": profile_name,
        "version": version,
        "replaceExistingTypes": true,
        "policies": policies
    });

    let client = Client::new();
    let resp = client
        .post(format!("{}/industry-profiles/import", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Failed to import profile bundle: {}", text))
    }
}

/// Get profile application changelog for the current tenant.
#[tauri::command]
pub async fn list_industry_profile_changelog<R: Runtime>(_app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    let client = Client::new();
    let resp = client
        .get(format!("{}/industry-profiles/changelog", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(body)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Failed to fetch profile changelog: {}", text))
    }
}
