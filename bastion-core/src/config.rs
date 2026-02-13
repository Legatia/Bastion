use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub api_key: String,
    pub backend_url: String,
    pub agent_id: Option<String>,
}

pub fn load_config() -> Result<Config, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_path = home.join(".bastion").join("config.json");

    if !config_path.exists() {
        return Err("Config file not found. Please log in.".to_string());
    }

    let content = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let mut config_json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Auto-migrate old localhost backend URLs to production
    let mut needs_save = false;
    if let Some(backend_url) = config_json["backend_url"].as_str() {
        if backend_url.contains("localhost:3000") {
            config_json["backend_url"] = serde_json::json!("https://bastion-gamma.vercel.app/v1");
            needs_save = true;
        }
    }

    if needs_save {
        std::fs::write(&config_path, serde_json::to_string_pretty(&config_json).unwrap()).ok();
    }
    
    // Try to load agent config from current directory (optional)
    // This part might depend on where the app is running.
    // For library usage, maybe we should pass agent_id or handle it differently.
    // But keeping CLI behavior for now.
    
    let agent_id = if let Ok(agent_config) = std::fs::read_to_string(".bastion-agent.json") {
         let agent: serde_json::Value = serde_json::from_str(&agent_config).unwrap_or(serde_json::json!({}));
         agent["agent_id"].as_str().map(|s| s.to_string())
    } else {
        None
    };
    
    // If loaded from file has agent_id, use it, otherwise use one found in current dir
    let loaded_agent_id = config_json["agent_id"].as_str().map(|s| s.to_string());
    
    Ok(Config {
        api_key: config_json["api_key"].as_str().unwrap_or_default().to_string(),
        backend_url: config_json["backend_url"]
            .as_str()
            .unwrap_or("https://bastion-gamma.vercel.app/v1")
            .to_string(),
        agent_id: agent_id.or(loaded_agent_id),
    })
}
