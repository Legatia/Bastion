use axum::{
    body::Body,
    extract::{Request, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{any, get, post},
    Json, Router,
};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpStream;
use hyper::upgrade::Upgraded;
use hyper_util::rt::TokioIo;

use daemonize::Daemonize;
use std::fs::File;

use dialoguer::{theme::ColorfulTheme, Confirm, Input, Password};

#[derive(Parser)]
#[command(name = "bastion")]
#[command(about = "Bastion Protocol CLI - Protect AI Agents", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Login to Bastion (get API key)
    Login {
        /// API Key from Dashboard
        #[arg(long)]
        key: Option<String>,
    },
    /// Initialize agent protection in current directory
    Init,
    /// Start the local supervisor proxy
    Start {
        /// Port to listen on
        #[arg(long, default_value_t = 3000)]
        port: u16,

        /// Run in background (daemon mode)
        #[arg(long, short = 'd')]
        daemon: bool,

        /// Command to run (e.g., "python agent.py")
        #[arg(trailing_var_arg = true)]
        command: Vec<String>,
    },
    /// Check connection to Bastion backend
    Health,
}

// Configuration stored locally
#[derive(Clone)]
struct Config {
    api_key: String,
    backend_url: String,
    agent_id: Option<String>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match &cli.command {
        Commands::Login { key } => {
            handle_login(key.clone()).await;
        }
        Commands::Init => {
            handle_init().await;
        }
        Commands::Start { port, command, daemon } => handle_start(*port, command, *daemon).await,
        Commands::Health => {
            handle_health().await;
        }
    }
}

async fn handle_login(provided_key: Option<String>) {
    println!("🛡️  Bastion Protocol Login\n");

    let api_key = if let Some(k) = provided_key {
        k
    } else {
        println!("Please enter your API Key from the Dashboard.");
        println!("(You can find it at http://localhost:3001/settings after logging in)\n");
        
        // Use password input so it masks the key
        Password::with_theme(&ColorfulTheme::default())
            .with_prompt("API Key")
            .interact()
            .unwrap()
    };
    
    // For MVP: We trust the key format or validtate length
    if api_key.len() < 10 {
         println!("❌ Invalid API Key format.");
         return;
    }

    println!("\n🔄 Authenticating...");

    // Save to config file
    let config_path = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join("config.json");

    std::fs::create_dir_all(config_path.parent().unwrap()).ok();

    // We can infer email from key or just leave it blank for now
    let config = serde_json::json!({
        "email": "user@bastion.ai", // Placeholder
        "api_key": api_key,
        "backend_url": "http://localhost:3000/v1"
    });

    std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).unwrap();

    println!("✅ Login successful!");
    println!("\nYour API Key: {}...", &api_key[0..5]);
    println!("Config saved to: {:?}", config_path);
    println!("\nNext step: Run `bastion init` in your agent directory");
}

async fn handle_init() {
    println!("🛡️  Bastion Protocol Setup\n");

    // Check if logged in
    let config_path = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join("config.json");

    if !config_path.exists() {
        println!("❌ Not logged in. Run `bastion login` first.");
        std::process::exit(1);
    }

    let config: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&config_path).unwrap()).unwrap();

    println!("Logged in as: {}\n", config["email"].as_str().unwrap());

    // Interactive setup
    let name: String = Input::with_theme(&ColorfulTheme::default())
        .with_prompt("Agent name")
        .default("my-agent".into())
        .interact_text()
        .unwrap();

    let language: String = Input::with_theme(&ColorfulTheme::default())
        .with_prompt("Language")
        .default("python".into())
        .interact_text()
        .unwrap();

    let framework: String = Input::with_theme(&ColorfulTheme::default())
        .with_prompt("Framework (langchain/autogpt/custom)")
        .default("custom".into())
        .interact_text()
        .unwrap();

    println!("\n🔄 Creating agent...");

    // TODO: Call backend API to create agent
    let agent_id = uuid::Uuid::new_v4().to_string();

    // Save local agent config
    let agent_config = serde_json::json!({
        "agent_id": agent_id,
        "name": name,
        "language": language,
        "framework": framework,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    std::fs::write(
        ".bastion-agent.json",
        serde_json::to_string_pretty(&agent_config).unwrap(),
    )
    .unwrap();

    println!("✅ Agent created!");
    println!("\nAgent ID: {}", agent_id);
    println!("Config saved to: .bastion-agent.json");
    println!("\nNext step: Run your agent with Bastion protection:");
    println!("  bastion start -- python agent.py");
}

async fn handle_start(port: u16, command: &[String], daemon: bool) {
    if daemon {
        println!("🛡️  Starting Bastion Supervisor in background...");
        let stdout = File::create("/tmp/bastion.out").unwrap();
        let stderr = File::create("/tmp/bastion.err").unwrap();

        let daemonize = Daemonize::new()
            .pid_file("/tmp/bastion.pid")
            .chown_pid_file(true)
            .working_directory("/tmp")
            .stdout(stdout)
            .stderr(stderr);

        match daemonize.start() {
            Ok(_) => println!("Success, daemonized"),
            Err(e) => eprintln!("Error, {}", e),
        }
    } else {
        println!("🛡️  Starting Bastion Supervisor\n");
    }

    // Load config
    let config = load_config();

    if !daemon {
        println!("✓ Loaded configuration");
        println!("✓ Backend: {}", config.backend_url);
        println!("✓ Proxy listening on port: {}\n", port);
    }

    // Start proxy server
    let app_state = Arc::new(config.clone());
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/authorize", post(authorize_action))
        .route("/", any(proxy_handler))
        .route("/*path", any(proxy_handler)) // Catch-all for proxying
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    if !daemon {
        println!("🚀 Bastion Supervisor active!");
        println!("   Proxy: http://localhost:{}", port);
        println!("   Dashboard: http://localhost:3001");
        println!("\n📊 Monitoring agent actions...\n");
    }

    // Start agent in background with proxy environment
    if !command.is_empty() {
        tokio::spawn(start_agent(command.to_vec(), port));
    }

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    
    // We need to handle CONNECT method manually for HTTPS tunneling if we want to support it properly,
    // but axum can route it. We just need to make sure our handler supports upgrade.
    axum::serve(listener, app).await.unwrap();
} 

async fn proxy_handler(
    State(config): State<Arc<Config>>,
    req: Request<Body>,
) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();

    // Log intercepted request
    // In a real implementation we would call authorize_action here internally first
    
    if method == Method::CONNECT {
        // HTTPS Tunneling
        if let Some(host) = uri.authority() {
            let host_addr = host.to_string();
            tokio::spawn(async move {
                match hyper::upgrade::on(req).await {
                    Ok(upgraded) => {
                        if let Err(e) = tunneling(upgraded, host_addr).await {
                            eprintln!("server io error: {}", e);
                        };
                    }
                    Err(e) => eprintln!("upgrade error: {}", e),
                }
            });
            return (StatusCode::OK, "Connection skipped").into_response(); // Standard response for CONNECT success
        } else {
             return (StatusCode::BAD_REQUEST, "CONNECT must be to a socket address").into_response();
        }
    }

    // Standard HTTP Proxying
    let client = reqwest::Client::new();
    // We need to construct the full URL. If it's a proxy request, the URI is absolute.
    // If it's a direct request (transparent proxy), we might need Host header.
    // For explicit proxying (export HTTP_PROXY=...), the client sends absolute URI.
    
    let url = uri.to_string();
    
    // Perform authorization check
    let action_type = "http_request".to_string();
    let details = serde_json::json!({
        "method": method.to_string(),
        "url": url,
        "host": uri.host().unwrap_or("unknown").to_string()
    });

    match check_policy(&config, action_type, details).await {
        Ok(allowed) => {
            if !allowed {
                println!("   🛑 BLOCKED by policy");
                return (StatusCode::FORBIDDEN, "Blocked by Bastion Policy").into_response();
            }
        }
        Err(e) => {
             // Fail open or closed based on preference. Here fail open but log.
             eprintln!("   ⚠️  Policy check failed: {}", e);
        }
    }
    
    // Forward request
    let resp = client
        .request(method, url)
        .headers(req.headers().clone())
        // .body(req.into_body()) // converting axum body to reqwest is tricky without bytes
        .send()
        .await;

    match resp {
        Ok(res) => {
            let mut response = Response::builder().status(res.status());
            *response.headers_mut().unwrap() = res.headers().clone();
            // We'd need to stream the body back. For now, empty body or simple text.
            let bytes = res.bytes().await.unwrap_or_default();
             response.body(Body::from(bytes)).unwrap()
        },
        Err(e) => {
             (StatusCode::BAD_GATEWAY, format!("Proxy error: {}", e)).into_response()
        }
    }
}

async fn tunneling(upgraded: Upgraded, host_addr: String) -> std::io::Result<()> {
    let mut upgraded = TokioIo::new(upgraded);
    let mut server = TcpStream::connect(host_addr).await?;
    let _ = tokio::io::copy_bidirectional(&mut upgraded, &mut server).await?;
    Ok(())
}


async fn start_agent(command: Vec<String>, proxy_port: u16) {
    // Wait a bit for proxy to start
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    let program = &command[0];
    let args = &command[1..];

    println!("🤖 Launching agent: {} {}", program, args.join(" "));

    let mut cmd = std::process::Command::new(program);
    cmd.args(args)
        .env("HTTP_PROXY", format!("http://localhost:{}", proxy_port))
        .env("HTTPS_PROXY", format!("http://localhost:{}", proxy_port))
        .env("BASTION_ENABLED", "true");

    match cmd.spawn() {
        Ok(mut child) => {
            println!("✓ Agent started (PID: {:?})", child.id());

            // Wait for agent to finish
            match child.wait() {
                Ok(status) => println!("\n🛑 Agent exited with status: {}", status),
                Err(e) => eprintln!("\n❌ Error waiting for agent: {}", e),
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to start agent: {}", e);
            std::process::exit(1);
        }
    }
}

async fn handle_health() {
    let config = load_config();

    println!("🔍 Checking Bastion backend...");
    println!("   URL: {}\n", config.backend_url);

    let client = reqwest::Client::new();
    match client
        .get(format!("{}/../../health", config.backend_url))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                println!("✅ Backend is healthy");
                if let Ok(body) = resp.text().await {
                    println!("{}", body);
                }
            } else {
                println!("⚠️  Backend returned status: {}", resp.status());
            }
        }
        Err(e) => {
            println!("❌ Cannot reach backend: {}", e);
            println!("\nMake sure the backend is running:");
            println!("  cd backend && npm run dev");
        }
    }
}

fn load_config() -> Config {
    let config_path = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join("config.json");

    if !config_path.exists() {
        eprintln!("❌ Not logged in. Run `bastion login` first.");
        std::process::exit(1);
    }

    let config: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&config_path).unwrap()).unwrap();

    // Try to load agent config
    let agent_id = if let Ok(agent_config) = std::fs::read_to_string(".bastion-agent.json") {
        let agent: serde_json::Value = serde_json::from_str(&agent_config).unwrap();
        Some(agent["agent_id"].as_str().unwrap().to_string())
    } else {
        None
    };

    Config {
        api_key: config["api_key"].as_str().unwrap().to_string(),
        backend_url: config["backend_url"]
            .as_str()
            .unwrap_or("http://localhost:3000/v1")
            .to_string(),
        agent_id,
    }
}

// API Handlers

async fn health_check() -> &'static str {
    "OK"
}

#[derive(Deserialize)]
struct AuthorizeRequest {
    action: Action,
}

#[derive(Deserialize, Serialize)]
struct Action {
    #[serde(rename = "type")]
    action_type: String,
    details: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
struct AuthorizeResponse {
    allowed: bool,
    reason: Option<String>,
}

async fn check_policy(config: &Config, action_type: String, details: serde_json::Value) -> Result<bool, String> {
    let client = reqwest::Client::new();
     let backend_payload = serde_json::json!({
        "api_key": config.api_key,
        "agent_id": config.agent_id,
        "action": {
            "type": action_type,
            "details": details
        }
    });

    match client
        .post(format!("{}/authorize", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .json(&backend_payload)
        .timeout(std::time::Duration::from_secs(2)) // Fast timeout for proxy
        .send()
        .await
    {
        Ok(resp) => {
             if resp.status().is_success() {
                let result = resp.json::<AuthorizeResponse>().await.map_err(|e| e.to_string())?;
                Ok(result.allowed)
             } else if resp.status() == reqwest::StatusCode::FORBIDDEN {
                // Check for quota exceeded
                let body = resp.text().await.unwrap_or_default();
                if body.contains("QUOTA_EXCEEDED") {
                    eprintln!("\n🚫 QUOTA EXCEEDED");
                    eprintln!("   You've reached your plan's limit.");
                    eprintln!("   Upgrade at: https://bastion.ai/billing\n");
                    Err("QUOTA_EXCEEDED".to_string())
                } else {
                    Err(format!("Access denied: {}", body))
                }
             } else {
                 Err(format!("Backend error: {}", resp.status()))
             }
        }
        Err(e) => Err(e.to_string())
    }
}

async fn authorize_action(
    State(config): State<Arc<Config>>,
    Json(payload): Json<AuthorizeRequest>,
) -> Json<AuthorizeResponse> {
    let client = reqwest::Client::new();

    // Log the action
    println!(
        "[{}] {} - {:?}",
        chrono::Utc::now().format("%H:%M:%S"),
        payload.action.action_type,
        payload.action.details
    );

    // Call backend API
    let backend_payload = serde_json::json!({
        "api_key": config.api_key,
        "agent_id": config.agent_id,
        "action": payload.action,
    });

    match client
        .post(format!("{}/authorize", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .json(&backend_payload)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<AuthorizeResponse>().await {
                    Ok(result) => {
                        if result.allowed {
                            println!("   ✓ ALLOWED");
                        } else {
                            println!("   🛑 BLOCKED: {}", result.reason.as_deref().unwrap_or("Policy violation"));
                        }
                        Json(result)
                    }
                    Err(e) => {
                        eprintln!("   ⚠️  Error parsing response: {}", e);
                        Json(AuthorizeResponse {
                            allowed: true, // Fail open
                            reason: Some("Backend response parse error".to_string()),
                        })
                    }
                }
            } else {
                eprintln!("   ⚠️  Backend error: {}", resp.status());
                Json(AuthorizeResponse {
                    allowed: true, // Fail open
                    reason: Some(format!("Backend error: {}", resp.status())),
                })
            }
        }
        Err(e) => {
            eprintln!("   ⚠️  Cannot reach backend: {}", e);
            Json(AuthorizeResponse {
                allowed: true, // Fail open
                reason: Some("Backend unreachable".to_string()),
            })
        }
    }
}
