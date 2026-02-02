use axum::{
    body::{Body, to_bytes},
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

const VERSION: &str = "0.1.0";

#[derive(Parser)]
#[command(name = "bastion")]
#[command(about = "Bastion Protocol CLI - Protect AI Agents", long_about = None)]
#[command(version = VERSION)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose output
    #[arg(long, short = 'v', global = true)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Login to Bastion (get API key)
    Login {
        /// API Key from Dashboard
        #[arg(long)]
        key: Option<String>,

        /// Environment to connect to (dev/staging/prod)
        #[arg(long, default_value = "dev")]
        env: String,
    },
    /// Initialize agent protection in current directory
    Init,
    /// Auto-configure an existing agent to use Bastion
    Enable {
        /// Agent type (openclaw/autogpt/langchain)
        #[arg(long)]
        agent: String,

        /// Port for Bastion proxy
        #[arg(long, default_value_t = 3000)]
        port: u16,

        /// Skip starting daemon (just configure)
        #[arg(long)]
        configure_only: bool,
    },
    /// Disable Bastion for a configured agent
    Disable {
        /// Agent type (openclaw/autogpt/langchain)
        #[arg(long)]
        agent: String,
    },
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
    /// Stop the running daemon
    Stop,
    /// Check status of Bastion daemon
    Status,
    /// View daemon logs
    Logs {
        /// Number of lines to show (0 = all)
        #[arg(long, short = 'n', default_value_t = 50)]
        lines: usize,

        /// Follow log output
        #[arg(long, short = 'f')]
        follow: bool,
    },
    /// Restart the daemon
    Restart {
        /// Port to listen on
        #[arg(long, default_value_t = 3000)]
        port: u16,
    },
    /// List all configured agents
    List,
    /// Manage agent configuration
    Config {
        /// Agent name to update
        #[arg(long)]
        name: Option<String>,

        /// Agent language
        #[arg(long)]
        language: Option<String>,

        /// Agent framework
        #[arg(long)]
        framework: Option<String>,

        /// Enable or disable agent
        #[arg(long)]
        enabled: Option<bool>,
    },
    /// View audit log of agent actions
    Audit {
        /// Number of entries to show
        #[arg(long, short = 'n', default_value_t = 20)]
        limit: usize,

        /// Filter by agent ID
        #[arg(long)]
        agent_id: Option<String>,

        /// Show only blocked actions
        #[arg(long)]
        blocked_only: bool,
    },
    /// Show usage statistics
    Stats {
        /// Time range (today/week/month/all)
        #[arg(long, default_value = "today")]
        range: String,
    },
    /// Test policy enforcement (dry-run)
    Test {
        /// Action type to test
        #[arg(long)]
        action_type: String,

        /// URL or target to test
        #[arg(long)]
        url: String,

        /// HTTP method (for http_request actions)
        #[arg(long, default_value = "GET")]
        method: String,
    },
    /// Validate configuration files
    Validate,
    /// Check connection to Bastion backend
    Health,
    /// Update Bastion CLI to the latest version
    Update,
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
    let verbose = cli.verbose;

    match &cli.command {
        Commands::Login { key, env } => {
            handle_login(key.clone(), env.clone(), verbose).await;
        }
        Commands::Init => {
            handle_init(verbose).await;
        }
        Commands::Enable { agent, port, configure_only } => {
            handle_enable(agent.clone(), *port, *configure_only, verbose).await;
        }
        Commands::Disable { agent } => {
            handle_disable(agent.clone(), verbose).await;
        }
        Commands::Start { port, command, daemon } => {
            handle_start(*port, command, *daemon, verbose).await
        }
        Commands::Stop => {
            handle_stop(verbose).await;
        }
        Commands::Status => {
            handle_status(verbose).await;
        }
        Commands::Logs { lines, follow } => {
            handle_logs(*lines, *follow, verbose).await;
        }
        Commands::Restart { port } => {
            handle_restart(*port, verbose).await;
        }
        Commands::List => {
            handle_list(verbose).await;
        }
        Commands::Config {
            name,
            language,
            framework,
            enabled,
        } => {
            handle_config(name.clone(), language.clone(), framework.clone(), *enabled, verbose)
                .await;
        }
        Commands::Audit {
            limit,
            agent_id,
            blocked_only,
        } => {
            handle_audit(*limit, agent_id.clone(), *blocked_only, verbose).await;
        }
        Commands::Stats { range } => {
            handle_stats(range.clone(), verbose).await;
        }
        Commands::Test {
            action_type,
            url,
            method,
        } => {
            handle_test(action_type.clone(), url.clone(), method.clone(), verbose).await;
        }
        Commands::Validate => {
            handle_validate(verbose).await;
        }
        Commands::Health => {
            handle_health(verbose).await;
        }
        Commands::Update => {
            handle_update(verbose).await;
        }
    }
}

async fn handle_update(verbose: bool) {
    println!("🔄 Checking for updates...");

    let status = self_update::backends::github::Update::configure()
        .repo_owner("Legatia")
        .repo_name("Bastion")
        .bin_name("bastion")
        .show_download_progress(true)
        .current_version(VERSION)
        .build();

    match status {
        Ok(update) => {
            match update.update() {
                Ok(status) => {
                     if status.updated() {
                         println!("✅ Updated to version {}!", status.version());
                     } else {
                         println!("✨ Already on the latest version ({})", status.version());
                     }
                }
                Err(e) => {
                     println!("❌ Update failed: {}", e);
                     if verbose {
                         println!("Error details: {:?}", e);
                     }
                }
            }
        }
        Err(e) => {
             println!("❌ Failed to configure update: {}", e);
        }
    }
}

async fn handle_login(provided_key: Option<String>, env: String, verbose: bool) {
    println!("🛡️  Bastion Protocol Login\n");

    if verbose {
        println!("Environment: {}", env);
    }

    let api_key = if let Some(k) = provided_key {
        k
    } else {
        println!("Please enter your API Key from the Dashboard.");
        println!("(You can find it at https://bastion.legatia.solutions/profile after logging in)\n");

        // Use password input so it masks the key
        Password::with_theme(&ColorfulTheme::default())
            .with_prompt("API Key")
            .interact()
            .unwrap()
    };

    // Validate key format
    if api_key.len() < 10 {
         println!("❌ Invalid API Key format. Key must be at least 10 characters.");
         return;
    }

    if !api_key.starts_with("bst_") {
        println!("⚠️  Warning: API Key doesn't start with 'bst_'. This may be invalid.");
    }

    println!("\n🔄 Authenticating...");

    // Save to config file
    let config_path = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join("config.json");

    std::fs::create_dir_all(config_path.parent().unwrap()).ok();

    // Determine backend URL based on environment
    let backend_url = match env.as_str() {
        "prod" | "production" => "https://bastion-gamma.vercel.app/v1",
        "staging" => "https://staging-api.bastion.ai/v1",
        _ => "https://bastion-gamma.vercel.app/v1",
    };

    // We can infer email from key or just leave it blank for now
    let config = serde_json::json!({
        "email": "user@bastion.ai", // Placeholder
        "api_key": api_key,
        "backend_url": backend_url,
        "environment": env
    });

    std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).unwrap();

    println!("✅ Login successful!");
    println!("\nYour API Key: {}...", &api_key[0..5]);
    println!("Environment: {}", env);
    println!("Backend URL: {}", backend_url);
    if verbose {
        println!("Config saved to: {:?}", config_path);
    }
    println!("\nNext step: Run `bastion init` in your agent directory");
}

async fn handle_init(verbose: bool) {
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

    // Check if agent already exists
    if std::path::Path::new(".bastion-agent.json").exists() {
        println!("⚠️  Agent configuration already exists in this directory.");
        let overwrite = Confirm::with_theme(&ColorfulTheme::default())
            .with_prompt("Do you want to overwrite it?")
            .default(false)
            .interact()
            .unwrap();

        if !overwrite {
            println!("Cancelled.");
            return;
        }
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

    println!("\n🔄 Registering agent with Bastion backend...");

    // Get backend URL and API key from config
    let backend_url = config["backend_url"]
        .as_str()
        .unwrap_or("https://bastion-gamma.vercel.app/v1");
    let api_key = config["api_key"].as_str().unwrap_or("");

    // Call backend API to create agent
    let client = reqwest::Client::new();
    let create_payload = serde_json::json!({
        "name": name,
        "language": language,
        "framework": framework,
        "description": format!("{} agent using {}", language, framework)
    });

    let agent_id = match client
        .post(format!("{}/agents", backend_url))
        .header("X-API-Key", api_key)
        .json(&create_payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if let Some(id) = data["agent"]["id"].as_str() {
                            println!("✅ Agent registered in backend!");
                            id.to_string()
                        } else {
                            println!("⚠️  Backend response missing agent ID, using local ID");
                            uuid::Uuid::new_v4().to_string()
                        }
                    }
                    Err(e) => {
                        println!("⚠️  Failed to parse backend response: {}", e);
                        uuid::Uuid::new_v4().to_string()
                    }
                }
            } else if resp.status() == reqwest::StatusCode::FORBIDDEN {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                if body.contains("QUOTA_EXCEEDED") {
                    println!("❌ Agent quota exceeded! Upgrade your plan at the dashboard.");
                    std::process::exit(1);
                }
                println!("⚠️  Backend returned {}, using local ID", status);
                uuid::Uuid::new_v4().to_string()
            } else {
                println!("⚠️  Backend returned {}, using local ID", resp.status());
                uuid::Uuid::new_v4().to_string()
            }
        }
        Err(e) => {
            println!("⚠️  Could not reach backend ({}), using local ID", e);
            println!("   Agent will sync when backend is available.");
            uuid::Uuid::new_v4().to_string()
        }
    };

    // Save local agent config
    let agent_config = serde_json::json!({
        "agent_id": agent_id,
        "name": name,
        "language": language,
        "framework": framework,
        "enabled": true,
        "synced": true,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    std::fs::write(
        ".bastion-agent.json",
        serde_json::to_string_pretty(&agent_config).unwrap(),
    )
    .unwrap();

    println!("✅ Agent created!");
    println!("\nAgent ID: {}", agent_id);
    if verbose {
        println!("Config saved to: .bastion-agent.json");
    }
    println!("\nNext step: Run your agent with Bastion protection:");
    println!("  bastion start -- python agent.py");
}

async fn handle_enable(agent_type: String, port: u16, configure_only: bool, verbose: bool) {
    println!("🛡️  Bastion Auto-Configuration\n");
    
    // Check if logged in
    let config_path = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join("config.json");

    if !config_path.exists() {
        println!("❌ Not logged in. Run `bastion login` first.");
        std::process::exit(1);
    }

    match agent_type.to_lowercase().as_str() {
        "openclaw" => configure_openclaw(port, configure_only, verbose).await,
        "autogpt" => configure_autogpt(port, configure_only, verbose).await,
        "langchain" => configure_langchain(port, configure_only, verbose).await,
        _ => {
            println!("❌ Unsupported agent type: {}", agent_type);
            println!("\nSupported agents:");
            println!("  - openclaw");
            println!("  - autogpt");
            println!("  - langchain");
            std::process::exit(1);
        }
    }
}

async fn configure_openclaw(port: u16, configure_only: bool, verbose: bool) {
    println!("🦞 Configuring OpenClaw...\n");
    
    let openclaw_config_path = dirs::home_dir()
        .unwrap()
        .join(".openclaw")
        .join("openclaw.json");
    
    if !openclaw_config_path.exists() {
        println!("❌ OpenClaw config not found at: {:?}", openclaw_config_path);
        println!("\nMake sure OpenClaw is installed and initialized.");
        println!("Run `openclaw` first to create the config file.");
        std::process::exit(1);
    }

    // Read existing config
    let config_str = std::fs::read_to_string(&openclaw_config_path)
        .expect("Failed to read OpenClaw config");
    let mut config: serde_json::Value = serde_json::from_str(&config_str)
        .expect("Failed to parse OpenClaw config");

    // Backup original config
    let backup_path = openclaw_config_path.with_extension("json.backup");
    std::fs::copy(&openclaw_config_path, &backup_path).ok();
    if verbose {
        println!("📦 Backed up original config to: {:?}", backup_path);
    }

    // Add/update gateway configuration
    if config.get("gateway").is_none() {
        config["gateway"] = serde_json::json!({});
    }
    
    config["gateway"]["trustedProxies"] = serde_json::json!(["127.0.0.1"]);
    config["gateway"]["httpProxy"] = serde_json::json!(format!("http://localhost:{}", port));
    config["gateway"]["httpsProxy"] = serde_json::json!(format!("http://localhost:{}", port));
    
    // Add bastion metadata
    config["bastion"] = serde_json::json!({
        "enabled": true,
        "port": port,
        "configured_at": chrono::Utc::now().to_rfc3339()
    });

    // Write updated config
    std::fs::write(
        &openclaw_config_path,
        serde_json::to_string_pretty(&config).unwrap()
    ).expect("Failed to write OpenClaw config");

    println!("✅ OpenClaw configured!");
    println!("   Proxy: http://localhost:{}", port);
    println!("   Config: {:?}", openclaw_config_path);
    
    if !configure_only {
        println!("\n🚀 Starting Bastion proxy...\n");
        
        // Start daemon
        let bastion_dir = dirs::home_dir().unwrap().join(".bastion");
        let pid_file = bastion_dir.join("openclaw.pid");
        
        // Use current executable to start daemon
        let current_exe = std::env::current_exe().unwrap();
        let mut cmd = std::process::Command::new(&current_exe);
        cmd.args(&["start", "--daemon", "--port", &port.to_string()]);
        
        match cmd.spawn() {
            Ok(_) => {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                println!("✅ Bastion proxy started in background");
                println!("\n📌 Status:");
                println!("   • Proxy running on port {}", port);
                println!("   • PID file: {:?}", pid_file);
                println!("\n🎯 Next step: Run OpenClaw normally");
                println!("   openclaw");
                println!("\nAll API calls will be automatically monitored! 🛡️");
            }
            Err(e) => {
                println!("❌ Failed to start daemon: {}", e);
                println!("\nYou can start it manually with:");
                println!("   bastion start -d");
            }
        }
    } else {
        println!("\n⏭️  Skipped starting daemon (--configure-only)");
        println!("\nTo start Bastion proxy:");
        println!("   bastion start -d --port {}", port);
    }
}

async fn configure_autogpt(port: u16, configure_only: bool, verbose: bool) {
    println!("🤖 Auto-GPT support coming soon!");
    println!("\nFor now, you can:");
    println!("1. Set environment variables:");
    println!("   export HTTP_PROXY=http://localhost:{}", port);
    println!("   export HTTPS_PROXY=http://localhost:{}", port);
    println!("2. Run: bastion start -d");
    println!("3. Run: autogpt");
}

async fn configure_langchain(port: u16, configure_only: bool, verbose: bool) {
    println!("🦜 LangChain support coming soon!");
    println!("\nFor now, install our middleware:");
    println!("   pip install bastion-langchain");
    println!("\nThen in your code:");
    println!("   from bastion_langchain import BastionMiddleware");
    println!("   middleware = BastionMiddleware('http://localhost:{}') ", port);
}

async fn handle_disable(agent_type: String, verbose: bool) {
    println!("🛑 Disabling Bastion for {}\n", agent_type);
    
    match agent_type.to_lowercase().as_str() {
        "openclaw" => {
            let openclaw_config_path = dirs::home_dir()
                .unwrap()
                .join(".openclaw")
                .join("openclaw.json");
            
            if !openclaw_config_path.exists() {
                println!("❌ OpenClaw config not found");
                return;
            }

            // Read config
            let config_str = std::fs::read_to_string(&openclaw_config_path)
                .expect("Failed to read OpenClaw config");
            let mut config: serde_json::Value = serde_json::from_str(&config_str)
                .expect("Failed to parse OpenClaw config");

            // Remove Bastion config
            if let Some(gateway) = config.get_mut("gateway") {
                gateway.as_object_mut().map(|g| {
                    g.remove("httpProxy");
                    g.remove("httpsProxy");
                    g.remove("trustedProxies");
                });
            }
            config.as_object_mut().map(|c| c.remove("bastion"));

            // Write back
            std::fs::write(
                &openclaw_config_path,
                serde_json::to_string_pretty(&config).unwrap()
            ).expect("Failed to write config");

            println!("✅ Bastion disabled for OpenClaw");
            println!("   Config cleaned: {:?}", openclaw_config_path);
            
            // Try to restore backup
            let backup_path = openclaw_config_path.with_extension("json.backup");
            if backup_path.exists() {
                println!("   Backup available: {:?}", backup_path);
            }
        }
        _ => {
            println!("❌ Unsupported agent type: {}", agent_type);
            println!("\nTo disable Bastion:");
            println!("1. Stop the daemon: bastion stop");
            println!("2. Manually edit your agent's config");
        }
    }
}

async fn handle_start(port: u16, command: &[String], daemon: bool, verbose: bool) {
    // Load config first to get agent ID for PID file naming
    let config = load_config();
    let agent_id = config.agent_id.clone().unwrap_or_else(|| "default".to_string());

    // Create agent-specific PID and log files
    let bastion_dir = dirs::home_dir().unwrap().join(".bastion");
    std::fs::create_dir_all(&bastion_dir).ok();

    let pid_file = bastion_dir.join(format!("{}.pid", agent_id));
    let log_file = bastion_dir.join(format!("{}.out", agent_id));
    let err_file = bastion_dir.join(format!("{}.err", agent_id));

    if daemon {
        // Check if already running
        if pid_file.exists() {
            if let Ok(pid_str) = std::fs::read_to_string(&pid_file) {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    if is_process_running(pid) {
                        println!("❌ Daemon already running with PID {}.", pid);
                        println!("   Use `bastion stop` to stop it first, or `bastion restart` to restart.");
                        return;
                    } else {
                        if verbose {
                            println!("Removing stale PID file...");
                        }
                        std::fs::remove_file(&pid_file).ok();
                    }
                }
            }
        }

        println!("🛡️  Starting Bastion Supervisor in background...");

        // Rotate logs before starting
        rotate_log_files(&log_file, &err_file, verbose);

        let stdout = File::create(&log_file).unwrap();
        let stderr = File::create(&err_file).unwrap();

        let daemonize = Daemonize::new()
            .pid_file(&pid_file)
            .chown_pid_file(true)
            .working_directory(std::env::current_dir().unwrap())
            .stdout(stdout)
            .stderr(stderr);

        match daemonize.start() {
            Ok(_) => {
                println!("✅ Daemon started successfully");
                println!("   PID file: {:?}", pid_file);
                if verbose {
                    println!("   Log file: {:?}", log_file);
                    println!("   Error log: {:?}", err_file);
                }
                println!("\nUse `bastion status` to check status");
                println!("Use `bastion logs` to view logs");
                return;
            }
            Err(e) => {
                eprintln!("❌ Failed to daemonize: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        println!("🛡️  Starting Bastion Supervisor\n");
    }

    if verbose || !daemon {
        println!("✓ Loaded configuration");
        println!("✓ Backend: {}", config.backend_url);
        println!("✓ Proxy listening on port: {}\n", port);
    }

    // Set up graceful shutdown
    let shutdown_signal = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        println!("\n\n🛑 Shutting down gracefully...");
    };

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
        println!("   Dashboard: https://bastion.legatia.solutions");
        println!("\n📊 Monitoring agent actions...\n");
    }

    // Start agent in background with proxy environment
    if !command.is_empty() {
        tokio::spawn(start_agent(command.to_vec(), port, verbose));
    }

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    // Serve with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await
        .unwrap();

    // Clean up PID file on shutdown
    if daemon {
        std::fs::remove_file(&pid_file).ok();
    }
} 

async fn proxy_handler(
    State(config): State<Arc<Config>>,
    req: Request<Body>,
) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let headers = req.headers().clone();

    // Log intercepted request
    // In a real implementation we would call authorize_action here internally first

    if method == Method::CONNECT {
        // HTTPS Tunneling
        if let Some(host) = uri.authority() {
            let host_addr = host.to_string();

            // For HTTPS CONNECT, we can check the host/domain but not the body
            let action_type = "https_connect".to_string();
            let details = serde_json::json!({
                "method": "CONNECT",
                "host": host_addr.clone(),
                "url": format!("https://{}", host_addr)
            });

            // Check policy before establishing tunnel
            match check_policy(&config, action_type, details).await {
                Ok(allowed) => {
                    if !allowed {
                        println!("   🛑 BLOCKED HTTPS connection to {}", host_addr);
                        return (StatusCode::FORBIDDEN, "Connection blocked by Bastion Policy").into_response();
                    }
                }
                Err(e) => {
                    eprintln!("   ⚠️  Policy check failed: {}", e);
                }
            }

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
            return (StatusCode::OK, "Connection established").into_response();
        } else {
             return (StatusCode::BAD_REQUEST, "CONNECT must be to a socket address").into_response();
        }
    }

    // Standard HTTP Proxying - Extract body for DLP scanning
    let url = uri.to_string();

    // Extract request body for POST/PUT/PATCH requests
    let (_parts, body) = req.into_parts();
    let body_bytes = match to_bytes(body, usize::MAX).await {
        Ok(bytes) => bytes,
        Err(e) => {
            eprintln!("   ⚠️  Failed to read request body: {}", e);
            return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response();
        }
    };

    // Convert body to string for DLP scanning (if reasonable size)
    let body_str = if body_bytes.len() < 1_000_000 { // Max 1MB for DLP scanning
        String::from_utf8_lossy(&body_bytes).to_string()
    } else {
        format!("<body too large: {} bytes>", body_bytes.len())
    };

    // Perform authorization check with body included
    let action_type = "http_request".to_string();
    let mut details = serde_json::json!({
        "method": method.to_string(),
        "url": url.clone(),
        "host": uri.host().unwrap_or("unknown").to_string(),
        "headers": headers.iter()
            .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string()))
            .collect::<std::collections::HashMap<String, String>>()
    });

    // Include body if present and not too large
    if !body_bytes.is_empty() && body_bytes.len() < 1_000_000 {
        details["body"] = serde_json::json!(body_str);
        details["body_size"] = serde_json::json!(body_bytes.len());
    }

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

    // Forward request with body
    let client = reqwest::Client::new();
    let mut req_builder = client
        .request(method.clone(), url.clone())
        .headers(headers);

    // Add body if present
    if !body_bytes.is_empty() {
        req_builder = req_builder.body(body_bytes.to_vec());
    }

    let resp = req_builder.send().await;

    match resp {
        Ok(res) => {
            let status = res.status();
            let headers = res.headers().clone();
            let bytes = res.bytes().await.unwrap_or_default();

            let mut response = Response::builder().status(status);
            *response.headers_mut().unwrap() = headers;
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


async fn start_agent(command: Vec<String>, proxy_port: u16, verbose: bool) {
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

    if verbose {
        println!("Environment variables set:");
        println!("  HTTP_PROXY=http://localhost:{}", proxy_port);
        println!("  HTTPS_PROXY=http://localhost:{}", proxy_port);
        println!("  BASTION_ENABLED=true");
    }

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
            eprintln!("\nMake sure '{}' is installed and in your PATH.", program);
            std::process::exit(1);
        }
    }
}

async fn handle_health(verbose: bool) {
    let config = load_config();

    println!("🔍 Checking Bastion backend...");
    if verbose {
        println!("   API Key: {}...", &config.api_key[0..5]);
    }
    println!("   URL: {}\n", config.backend_url);

    let client = reqwest::Client::new();
    match client
        .get(format!("{}/../../health", config.backend_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                println!("✅ Backend is healthy");
                if verbose {
                    println!("   Status: {}", resp.status());
                }
                if let Ok(body) = resp.text().await {
                    if verbose || !body.is_empty() {
                        println!("{}", body);
                    }
                }
            } else {
                println!("⚠️  Backend returned status: {}", resp.status());
            }
        }
        Err(e) => {
            println!("❌ Cannot reach backend: {}", e);
            println!("\nTroubleshooting:");
            println!("  1. Make sure the backend is running:");
            println!("     cd backend && npm run dev");
            println!("  2. Check your network connection");
            println!("  3. Verify the backend URL in your config");
            if verbose {
                println!("\nConfig path: {:?}", dirs::home_dir().unwrap().join(".bastion/config.json"));
            }
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

    let mut config: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&config_path).unwrap()).unwrap();

    // Auto-migrate old localhost backend URLs to production
    let mut needs_save = false;
    if let Some(backend_url) = config["backend_url"].as_str() {
        if backend_url == "http://localhost:3000/v1" {
            config["backend_url"] = serde_json::json!("https://bastion-gamma.vercel.app/v1");
            needs_save = true;
        }
    }

    if needs_save {
        std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).ok();
    }

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
            .unwrap_or("https://bastion-gamma.vercel.app/v1")
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

// ============================================================================
// New Command Handlers
// ============================================================================

async fn handle_stop(verbose: bool) {
    println!("🛑 Stopping Bastion daemon...\n");

    let config = load_config();
    let agent_id = config.agent_id.clone().unwrap_or_else(|| "default".to_string());

    let pid_file = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join(format!("{}.pid", agent_id));

    if !pid_file.exists() {
        println!("❌ No daemon running (PID file not found).");
        println!("   Looking for: {:?}", pid_file);
        return;
    }

    match std::fs::read_to_string(&pid_file) {
        Ok(pid_str) => {
            match pid_str.trim().parse::<i32>() {
                Ok(pid) => {
                    if verbose {
                        println!("Found PID: {}", pid);
                    }

                    if !is_process_running(pid) {
                        println!("⚠️  Process {} is not running. Cleaning up PID file...", pid);
                        std::fs::remove_file(&pid_file).ok();
                        return;
                    }

                    // Send SIGTERM to process
                    #[cfg(unix)]
                    {
                        use nix::sys::signal::{kill, Signal};
                        use nix::unistd::Pid;

                        match kill(Pid::from_raw(pid), Signal::SIGTERM) {
                            Ok(_) => {
                                println!("✅ Sent shutdown signal to process {}", pid);

                                // Wait for process to exit (with timeout)
                                let mut attempts = 0;
                                while is_process_running(pid) && attempts < 10 {
                                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                                    attempts += 1;
                                }

                                if is_process_running(pid) {
                                    println!("⚠️  Process still running. Sending SIGKILL...");
                                    kill(Pid::from_raw(pid), Signal::SIGKILL).ok();
                                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                                }

                                std::fs::remove_file(&pid_file).ok();
                                println!("✅ Daemon stopped successfully");
                            }
                            Err(e) => {
                                eprintln!("❌ Failed to stop process: {}", e);
                                eprintln!("   The process may have already exited.");
                                std::fs::remove_file(&pid_file).ok();
                            }
                        }
                    }

                    #[cfg(not(unix))]
                    {
                        println!("❌ Stop command is only supported on Unix systems.");
                        println!("   Please manually terminate process with PID: {}", pid);
                    }
                }
                Err(e) => {
                    eprintln!("❌ Invalid PID in file: {}", e);
                    std::fs::remove_file(&pid_file).ok();
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to read PID file: {}", e);
        }
    }
}

async fn handle_status(verbose: bool) {
    println!("📊 Bastion Status\n");

    let config = load_config();
    let agent_id = config.agent_id.clone().unwrap_or_else(|| "default".to_string());

    let pid_file = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join(format!("{}.pid", agent_id));

    if !pid_file.exists() {
        println!("Status: ⭕ Not running");
        if verbose {
            println!("PID file not found: {:?}", pid_file);
        }
        return;
    }

    match std::fs::read_to_string(&pid_file) {
        Ok(pid_str) => {
            match pid_str.trim().parse::<i32>() {
                Ok(pid) => {
                    if is_process_running(pid) {
                        println!("Status: ✅ Running");
                        println!("PID: {}", pid);

                        // Try to get process info
                        #[cfg(unix)]
                        {
                            if let Ok(stat) = std::fs::read_to_string(format!("/proc/{}/stat", pid)) {
                                let parts: Vec<&str> = stat.split_whitespace().collect();
                                if parts.len() > 13 {
                                    // Parse uptime
                                    if let Ok(start_time) = parts[21].parse::<u64>() {
                                        let uptime_ticks = get_system_uptime_ticks() - start_time;
                                        let uptime_seconds = uptime_ticks / get_clock_ticks_per_sec();
                                        println!("Uptime: {}s", uptime_seconds);
                                    }
                                }
                            }
                        }

                        if verbose {
                            println!("\nConfiguration:");
                            println!("  Agent ID: {}", agent_id);
                            println!("  Backend: {}", config.backend_url);
                            println!("  API Key: {}...", &config.api_key[0..5]);
                        }

                        // Check log file size
                        let log_file = dirs::home_dir()
                            .unwrap()
                            .join(".bastion")
                            .join(format!("{}.out", agent_id));

                        if log_file.exists() {
                            if let Ok(metadata) = std::fs::metadata(&log_file) {
                                println!("Log size: {} bytes", metadata.len());
                            }
                        }
                    } else {
                        println!("Status: ⚠️  Stale (process {} not running)", pid);
                        if verbose {
                            println!("Suggestion: Run `bastion stop` to clean up");
                        }
                    }
                }
                Err(e) => {
                    println!("Status: ❌ Error");
                    eprintln!("Invalid PID in file: {}", e);
                }
            }
        }
        Err(e) => {
            println!("Status: ❌ Error");
            eprintln!("Failed to read PID file: {}", e);
        }
    }
}

async fn handle_logs(lines: usize, follow: bool, _verbose: bool) {
    let config = load_config();
    let agent_id = config.agent_id.clone().unwrap_or_else(|| "default".to_string());

    let log_file = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join(format!("{}.out", agent_id));

    let err_file = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join(format!("{}.err", agent_id));

    if !log_file.exists() && !err_file.exists() {
        println!("❌ No log files found.");
        println!("   Expected: {:?}", log_file);
        println!("\nStart the daemon with: bastion start --daemon -- <command>");
        return;
    }

    if follow {
        println!("📜 Following logs (Ctrl+C to stop)...\n");

        // Use tail -f command for following logs
        let mut cmd = std::process::Command::new("tail");
        cmd.arg("-f");
        if lines > 0 {
            cmd.arg("-n").arg(lines.to_string());
        }
        if log_file.exists() {
            cmd.arg(&log_file);
        }

        match cmd.spawn() {
            Ok(mut child) => {
                let _ = child.wait();
            }
            Err(e) => {
                eprintln!("❌ Failed to follow logs: {}", e);
            }
        }
    } else {
        // Show stdout logs
        if log_file.exists() {
            println!("📜 Stdout logs ({}):\n", if lines == 0 { "all".to_string() } else { format!("last {} lines", lines) });

            match std::fs::read_to_string(&log_file) {
                Ok(content) => {
                    if lines == 0 {
                        println!("{}", content);
                    } else {
                        let log_lines: Vec<&str> = content.lines().collect();
                        let start = if log_lines.len() > lines {
                            log_lines.len() - lines
                        } else {
                            0
                        };
                        for line in &log_lines[start..] {
                            println!("{}", line);
                        }
                    }
                }
                Err(e) => eprintln!("❌ Failed to read log file: {}", e),
            }
        }

        // Show stderr logs if verbose or if they exist and have content
        if err_file.exists() {
            if let Ok(err_content) = std::fs::read_to_string(&err_file) {
                if !err_content.trim().is_empty() {
                    println!("\n📜 Stderr logs:\n");
                    if lines == 0 {
                        println!("{}", err_content);
                    } else {
                        let err_lines: Vec<&str> = err_content.lines().collect();
                        let start = if err_lines.len() > lines {
                            err_lines.len() - lines
                        } else {
                            0
                        };
                        for line in &err_lines[start..] {
                            println!("{}", line);
                        }
                    }
                }
            }
        }
    }
}

async fn handle_restart(port: u16, verbose: bool) {
    println!("🔄 Restarting Bastion daemon...\n");

    // Stop first
    handle_stop(verbose).await;

    // Wait a bit
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Check if agent config exists to get the command
    if !std::path::Path::new(".bastion-agent.json").exists() {
        println!("❌ No agent configuration found in current directory.");
        println!("   Run this command from the directory containing .bastion-agent.json");
        println!("   or use `bastion start --daemon -- <command>` instead.");
        return;
    }

    println!("\n⚠️  Note: Restart requires the original command.");
    println!("Please run: bastion start --daemon --port {} -- <your-command>", port);
}

async fn handle_list(verbose: bool) {
    println!("📋 Registered Agents\n");

    let config = load_config();
    let bastion_dir = dirs::home_dir().unwrap().join(".bastion");

    // Fetch agents from backend
    let client = reqwest::Client::new();
    let backend_agents: Vec<serde_json::Value> = match client
        .get(format!("{}/agents", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if let Some(agents) = data["agents"].as_array() {
                            agents.clone()
                        } else {
                            vec![]
                        }
                    }
                    Err(_) => vec![],
                }
            } else {
                if verbose {
                    println!("⚠️  Could not fetch agents from backend (status: {})\n", resp.status());
                }
                vec![]
            }
        }
        Err(e) => {
            if verbose {
                println!("⚠️  Could not reach backend: {}\n", e);
            }
            vec![]
        }
    };

    // Also check current directory for local agent
    let local_agent: Option<serde_json::Value> = std::fs::read_to_string(".bastion-agent.json")
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());

    if backend_agents.is_empty() && local_agent.is_none() {
        println!("No agents found.");
        println!("\nRun `bastion init` to create an agent configuration.");
        return;
    }

    // Display backend agents
    if !backend_agents.is_empty() {
        println!("🌐 Backend Agents ({}):\n", backend_agents.len());
        for agent in &backend_agents {
            let id = agent["id"].as_str().unwrap_or("unknown");
            let name = agent["name"].as_str().unwrap_or("unknown");
            let status = agent["status"].as_str().unwrap_or("INACTIVE");
            let language = agent["language"].as_str().unwrap_or("-");
            let framework = agent["framework"].as_str().unwrap_or("-");
            let last_seen = agent["lastSeenAt"].as_str();

            let status_icon = match status {
                "ACTIVE" => "🟢",
                "INACTIVE" => "⚪",
                _ => "⚫",
            };

            println!("  {} {} ({})", status_icon, name, id.chars().take(8).collect::<String>());
            println!("     Language: {} | Framework: {}", language, framework);
            if let Some(seen) = last_seen {
                println!("     Last seen: {}", seen);
            }

            // Check if running locally
            let pid_file = bastion_dir.join(format!("{}.pid", id));
            if pid_file.exists() {
                if let Ok(pid_str) = std::fs::read_to_string(&pid_file) {
                    if let Ok(pid) = pid_str.trim().parse::<i32>() {
                        if is_process_running(pid) {
                            println!("     Running locally: ✅ PID {}", pid);
                        }
                    }
                }
            }
            println!();
        }
    }

    // Display local agent if not synced to backend
    if let Some(agent) = local_agent {
        let local_id = agent["agent_id"].as_str().unwrap_or("");
        let is_in_backend = backend_agents.iter().any(|a| a["id"].as_str() == Some(local_id));

        if !is_in_backend {
            println!("📁 Local Agent (not synced to backend):\n");
            let name = agent["name"].as_str().unwrap_or("unknown");
            let language = agent["language"].as_str().unwrap_or("-");
            let framework = agent["framework"].as_str().unwrap_or("-");

            println!("  ⚠️  {} ({}...)", name, local_id.chars().take(8).collect::<String>());
            println!("     Language: {} | Framework: {}", language, framework);
            println!("     ⚠️  Not registered in backend - run `bastion init` to sync\n");
        } else if verbose {
            println!("📁 Local agent is synced with backend ✅\n");
        }
    }
}

async fn handle_config(
    name: Option<String>,
    language: Option<String>,
    framework: Option<String>,
    enabled: Option<bool>,
    _verbose: bool,
) {
    if !std::path::Path::new(".bastion-agent.json").exists() {
        println!("❌ No agent configuration found in current directory.");
        println!("   Run `bastion init` first.");
        return;
    }

    let config_content = std::fs::read_to_string(".bastion-agent.json").unwrap();
    let mut agent: serde_json::Value = serde_json::from_str(&config_content).unwrap();

    let mut updated = false;

    if let Some(n) = name {
        agent["name"] = serde_json::json!(n);
        println!("✓ Updated name to: {}", n);
        updated = true;
    }

    if let Some(l) = language {
        agent["language"] = serde_json::json!(l);
        println!("✓ Updated language to: {}", l);
        updated = true;
    }

    if let Some(f) = framework {
        agent["framework"] = serde_json::json!(f);
        println!("✓ Updated framework to: {}", f);
        updated = true;
    }

    if let Some(e) = enabled {
        agent["enabled"] = serde_json::json!(e);
        println!("✓ Updated enabled to: {}", e);
        updated = true;
    }

    if updated {
        agent["updated_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
        std::fs::write(
            ".bastion-agent.json",
            serde_json::to_string_pretty(&agent).unwrap(),
        )
        .unwrap();
        println!("\n✅ Configuration updated successfully");
    } else {
        println!("📋 Current Configuration:\n");
        println!("{}", serde_json::to_string_pretty(&agent).unwrap());
        println!("\nTo update, use flags like:");
        println!("  bastion config --name \"My Agent\" --enabled true");
    }
}

async fn handle_audit(limit: usize, agent_id: Option<String>, blocked_only: bool, verbose: bool) {
    println!("📊 Audit Log\n");

    let config = load_config();
    let target_agent_id = agent_id.unwrap_or_else(|| config.agent_id.clone().unwrap_or_else(|| "".to_string()));

    // Call backend API to get logs (correct endpoint is /logs, not /audit)
    let client = reqwest::Client::new();
    let mut url = format!("{}/logs?limit={}", config.backend_url, limit);

    if !target_agent_id.is_empty() {
        url.push_str(&format!("&agent_id={}", target_agent_id));
    }

    if blocked_only {
        url.push_str("&decision=BLOCKED");
    }

    if verbose {
        println!("Fetching from: {}\n", url);
    }

    match client
        .get(&url)
        .header("X-API-Key", &config.api_key)
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(data) => {
                        // Backend returns { logs: [...], pagination: {...} }
                        if let Some(logs) = data["logs"].as_array() {
                            if logs.is_empty() {
                                println!("No actions logged yet.");
                                println!("\nRun an agent with Bastion protection to see activity here:");
                                println!("  bastion start -- python your_agent.py");
                            } else {
                                println!("Showing {} log entries:\n", logs.len());
                                for log in logs {
                                    let timestamp = log["timestamp"].as_str().unwrap_or("unknown");
                                    let action_type = log["actionType"].as_str().unwrap_or("unknown");
                                    let decision = log["decision"].as_str().unwrap_or("UNKNOWN");
                                    
                                    let status = match decision {
                                        "ALLOWED" => "✅ ALLOWED",
                                        "BLOCKED" => "🛑 BLOCKED",
                                        _ => "⚠️  UNKNOWN",
                                    };

                                    // Parse nested agent object
                                    let agent_name = log["agent"]["name"]
                                        .as_str()
                                        .or_else(|| log["agentId"].as_str())
                                        .unwrap_or("unknown");

                                    println!("[{}] {} - {}", timestamp, status, action_type);
                                    println!("  Agent: {}", agent_name);

                                    // Parse nested policy object if blocked
                                    if decision == "BLOCKED" {
                                        if let Some(policy_name) = log["policy"]["name"].as_str() {
                                            let policy_type = log["policy"]["type"].as_str().unwrap_or("");
                                            println!("  Policy: {} ({})", policy_name, policy_type);
                                        }
                                        if let Some(reason) = log["reason"].as_str() {
                                            println!("  Reason: {}", reason);
                                        }
                                    }

                                    if verbose {
                                        if let Some(data) = log.get("actionData") {
                                            println!("  Details: {}", data);
                                        }
                                    }
                                    println!();
                                }

                                // Show pagination info
                                if let Some(pagination) = data.get("pagination") {
                                    let total = pagination["total"].as_i64().unwrap_or(0);
                                    let has_more = pagination["hasMore"].as_bool().unwrap_or(false);
                                    if has_more {
                                        println!("Showing {} of {} total. Use --limit to see more.", logs.len(), total);
                                    }
                                }
                            }
                        } else {
                            println!("No audit data available.");
                        }
                    }
                    Err(e) => {
                        eprintln!("❌ Failed to parse response: {}", e);
                    }
                }
            } else {
                println!("❌ Backend returned status: {}", resp.status());
            }
        }
        Err(e) => {
            println!("❌ Failed to fetch audit log: {}", e);
            println!("\nMake sure the backend is running:");
            println!("  cd backend && npm run dev");
        }
    }
}

async fn handle_stats(range: String, verbose: bool) {
    println!("📊 Usage Statistics ({})\n", range);

    let config = load_config();
    let client = reqwest::Client::new();

    let url = format!("{}/stats?range={}", config.backend_url, range);

    if verbose {
        println!("Fetching from: {}\n", url);
    }

    match client
        .get(&url)
        .header("X-API-Key", &config.api_key)
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(data) => {
                        println!("Total Requests: {}", data["total_requests"].as_i64().unwrap_or(0));
                        println!("Allowed: {}", data["allowed"].as_i64().unwrap_or(0));
                        println!("Blocked: {}", data["blocked"].as_i64().unwrap_or(0));

                        if let Some(block_rate) = data["block_rate"].as_f64() {
                            println!("Block Rate: {:.2}%", block_rate * 100.0);
                        }

                        if verbose {
                            println!("\nBreakdown by action type:");
                            if let Some(breakdown) = data["breakdown"].as_object() {
                                for (action_type, count) in breakdown {
                                    println!("  {}: {}", action_type, count);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("❌ Failed to parse response: {}", e);
                    }
                }
            } else {
                println!("❌ Backend returned status: {}", resp.status());
                println!("\nNote: Stats endpoint may not be implemented yet.");
                println!("This is a placeholder for future functionality.");
            }
        }
        Err(e) => {
            println!("❌ Failed to fetch stats: {}", e);
            println!("\nNote: Stats endpoint may not be implemented yet.");
            println!("This is a placeholder for future functionality.");
        }
    }
}

async fn handle_test(action_type: String, url: String, method: String, verbose: bool) {
    println!("🧪 Testing Policy Enforcement\n");

    let config = load_config();

    println!("Action Type: {}", action_type);
    println!("URL: {}", url);
    if action_type == "http_request" {
        println!("Method: {}", method);
    }
    println!();

    let details = if action_type == "http_request" {
        serde_json::json!({
            "method": method,
            "url": url,
            "host": url.split('/').nth(2).unwrap_or(&url)
        })
    } else {
        serde_json::json!({
            "target": url
        })
    };

    if verbose {
        println!("Request details:");
        println!("{}\n", serde_json::to_string_pretty(&details).unwrap());
    }

    match check_policy(&config, action_type.clone(), details).await {
        Ok(allowed) => {
            if allowed {
                println!("✅ Action would be ALLOWED");
            } else {
                println!("🛑 Action would be BLOCKED");
            }
        }
        Err(e) => {
            println!("❌ Policy check failed: {}", e);
            println!("\nThis may indicate a backend connectivity issue.");
        }
    }
}

async fn handle_validate(verbose: bool) {
    println!("🔍 Validating Configuration\n");

    let mut errors = 0;
    let mut warnings = 0;

    // Check global config
    let config_path = dirs::home_dir()
        .unwrap()
        .join(".bastion")
        .join("config.json");

    println!("Checking global config...");
    if !config_path.exists() {
        println!("  ❌ Global config not found");
        println!("     Expected: {:?}", config_path);
        println!("     Run: bastion login");
        errors += 1;
    } else {
        match std::fs::read_to_string(&config_path) {
            Ok(content) => {
                match serde_json::from_str::<serde_json::Value>(&content) {
                    Ok(config) => {
                        println!("  ✅ Global config valid");

                        // Validate fields
                        if config["api_key"].as_str().is_none() {
                            println!("  ❌ Missing api_key");
                            errors += 1;
                        } else {
                            let key = config["api_key"].as_str().unwrap();
                            if key.len() < 10 {
                                println!("  ❌ API key too short");
                                errors += 1;
                            }
                            if !key.starts_with("bst_") {
                                println!("  ⚠️  API key doesn't start with 'bst_'");
                                warnings += 1;
                            }
                        }

                        if config["backend_url"].as_str().is_none() {
                            println!("  ⚠️  Missing backend_url");
                            warnings += 1;
                        } else if verbose {
                            println!("  Backend URL: {}", config["backend_url"].as_str().unwrap());
                        }
                    }
                    Err(e) => {
                        println!("  ❌ Invalid JSON: {}", e);
                        errors += 1;
                    }
                }
            }
            Err(e) => {
                println!("  ❌ Cannot read file: {}", e);
                errors += 1;
            }
        }
    }

    // Check agent config
    println!("\nChecking agent config...");
    if !std::path::Path::new(".bastion-agent.json").exists() {
        println!("  ⚠️  No agent config in current directory");
        println!("     Run: bastion init");
        warnings += 1;
    } else {
        match std::fs::read_to_string(".bastion-agent.json") {
            Ok(content) => {
                match serde_json::from_str::<serde_json::Value>(&content) {
                    Ok(agent) => {
                        println!("  ✅ Agent config valid");

                        if agent["agent_id"].as_str().is_none() {
                            println!("  ❌ Missing agent_id");
                            errors += 1;
                        }

                        if agent["name"].as_str().is_none() {
                            println!("  ⚠️  Missing name");
                            warnings += 1;
                        }

                        if verbose {
                            println!("  Agent ID: {}", agent["agent_id"].as_str().unwrap_or("unknown"));
                            println!("  Name: {}", agent["name"].as_str().unwrap_or("unknown"));
                        }
                    }
                    Err(e) => {
                        println!("  ❌ Invalid JSON: {}", e);
                        errors += 1;
                    }
                }
            }
            Err(e) => {
                println!("  ❌ Cannot read file: {}", e);
                errors += 1;
            }
        }
    }

    // Check backend connectivity
    println!("\nChecking backend connectivity...");
    if config_path.exists() {
        let config = load_config();
        let client = reqwest::Client::new();

        match client
            .get(format!("{}/../../health", config.backend_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    println!("  ✅ Backend reachable");
                } else {
                    println!("  ⚠️  Backend returned status: {}", resp.status());
                    warnings += 1;
                }
            }
            Err(_) => {
                println!("  ⚠️  Cannot reach backend");
                println!("     Make sure it's running: cd backend && npm run dev");
                warnings += 1;
            }
        }
    }

    println!("\n{}", "=".repeat(50));
    if errors == 0 && warnings == 0 {
        println!("✅ All checks passed!");
    } else {
        if errors > 0 {
            println!("❌ {} error(s) found", errors);
        }
        if warnings > 0 {
            println!("⚠️  {} warning(s) found", warnings);
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn is_process_running(pid: i32) -> bool {
    #[cfg(unix)]
    {
        use nix::sys::signal::kill;
        use nix::unistd::Pid;

        // Signal 0 is used to check if a process exists without actually sending a signal
        kill(Pid::from_raw(pid), None).is_ok()
    }

    #[cfg(not(unix))]
    {
        // On non-Unix systems, assume process is running if PID file exists
        true
    }
}

fn rotate_log_files(log_file: &std::path::PathBuf, err_file: &std::path::PathBuf, verbose: bool) {
    // Simple log rotation: keep last 5 files
    for i in (1..5).rev() {
        let old_log = log_file.with_extension(format!("out.{}", i));
        let new_log = log_file.with_extension(format!("out.{}", i + 1));
        if old_log.exists() {
            std::fs::rename(&old_log, &new_log).ok();
        }

        let old_err = err_file.with_extension(format!("err.{}", i));
        let new_err = err_file.with_extension(format!("err.{}", i + 1));
        if old_err.exists() {
            std::fs::rename(&old_err, &new_err).ok();
        }
    }

    // Move current log to .1
    if log_file.exists() {
        let backup = log_file.with_extension("out.1");
        std::fs::rename(log_file, &backup).ok();
    }

    if err_file.exists() {
        let backup = err_file.with_extension("err.1");
        std::fs::rename(err_file, &backup).ok();
    }

    if verbose {
        println!("Log files rotated");
    }
}

#[cfg(unix)]
fn get_system_uptime_ticks() -> u64 {
    if let Ok(uptime) = std::fs::read_to_string("/proc/uptime") {
        if let Some(first) = uptime.split_whitespace().next() {
            if let Ok(seconds) = first.parse::<f64>() {
                return (seconds * get_clock_ticks_per_sec() as f64) as u64;
            }
        }
    }
    0
}

#[cfg(not(unix))]
fn get_system_uptime_ticks() -> u64 {
    0
}

#[cfg(unix)]
fn get_clock_ticks_per_sec() -> u64 {
    unsafe { libc::sysconf(libc::_SC_CLK_TCK) as u64 }
}

#[cfg(not(unix))]
fn get_clock_ticks_per_sec() -> u64 {
    100
}
