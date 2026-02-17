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
    /// [FREE] Login to Bastion (get API key)
    Login {
        /// API Key from Dashboard
        #[arg(long)]
        key: Option<String>,

        /// Environment to connect to (dev/staging/prod)
        #[arg(long, default_value = "dev")]
        env: String,
    },
    /// [FREE] Initialize agent protection in current directory
    Init,
    /// [FREE] Start the local supervisor proxy
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
    /// [FREE] Stop the running daemon
    Stop,
    /// [FREE] Check status of Bastion daemon
    Status,
    /// [FREE] View daemon logs
    Logs {
        /// Number of lines to show (0 = all)
        #[arg(long, short = 'n', default_value_t = 50)]
        lines: usize,

        /// Follow log output
        #[arg(long, short = 'f')]
        follow: bool,
    },
    /// [FREE] Restart the daemon
    Restart {
        /// Port to listen on
        #[arg(long, default_value_t = 3000)]
        port: u16,
    },
    /// [FREE] List all configured agents
    List,
    /// [FREE] Manage agent configuration
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
    /// [FREE] View audit log of agent actions
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
    /// [FREE] Show usage statistics
    Stats {
        /// Time range (today/week/month/all)
        #[arg(long, default_value = "today")]
        range: String,
    },
    /// [FREE] Test policy enforcement (dry-run)
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
    /// [FREE] Validate configuration files
    Validate,
    /// [FREE] Check connection to Bastion backend
    Health,
    /// [FREE] Update Bastion CLI to the latest version
    Update,
    /// [FREE] Manage security policies
    Policy {
        #[command(subcommand)]
        action: PolicyAction,
    },
    /// [FREE] Delete an agent
    Delete {
        /// Agent ID to delete (uses current directory's agent if not specified)
        #[arg(long)]
        agent_id: Option<String>,
    },
    /// [STARTER+] Show agent CDP wallet address and balances
    Wallet {
        /// Agent ID (uses current directory's agent if not specified)
        #[arg(long)]
        agent_id: Option<String>,

        /// Network to query balances on (default: avalanche; testnet: avalanche-fuji)
        #[arg(long, default_value = "avalanche")]
        network: String,
    },
    /// [STARTER+] Verify agent on-chain (ERC-8004) — prepares tx for user wallet signing
    Verify {
        /// Chain to register on
        #[arg(long, default_value = "avalanche")]
        chain: String,

        /// Agent ID to verify (uses current directory's agent if not specified)
        #[arg(long)]
        agent_id: Option<String>,
    },
    /// [STARTER+] MoltMind behavioral monitoring
    Moltmind {
        #[command(subcommand)]
        action: MoltmindAction,

        /// Agent ID (uses current directory's agent if not specified)
        #[arg(long, global = true)]
        agent_id: Option<String>,

        /// Suppress output except errors and machine-readable data (for cron jobs)
        #[arg(long, short = 'q', global = true)]
        quiet: bool,
    },
    /// [STARTER+] Register agent on-chain (ERC-8004) via CDP wallet — automated, no signing needed
    Register {
        /// Chain to register on (default: avalanche; testnet: avalanche-fuji)
        #[arg(long, default_value = "avalanche")]
        chain: String,

        /// Agent ID to register (uses current directory's agent if not specified)
        #[arg(long)]
        agent_id: Option<String>,

        /// Suppress output except errors (for cron jobs)
        #[arg(long, short = 'q')]
        quiet: bool,
    },
}

#[derive(Subcommand)]
enum MoltmindAction {
    /// [STARTER+] Get agent health score
    Health,
    /// [PRO] List cognitive drift alerts
    Alerts {
        /// Max alerts to return
        #[arg(long, short = 'n', default_value_t = 20)]
        limit: usize,
    },
    /// [PRO] Acknowledge an alert by ID
    Ack {
        /// Alert ID to acknowledge
        alert_id: String,
    },
    /// [PRO] Run on-demand drift analysis
    Analyze {
        /// Analysis window in hours
        #[arg(long, default_value_t = 24)]
        window: u32,
    },
    /// [PRO] Show behavioral baseline
    Baseline,
    /// [PRO] Force baseline recalculation
    RefreshBaseline,
}

#[derive(Subcommand)]
enum PolicyAction {
    /// List all policies
    List,
    /// Show a specific policy
    Get {
        /// Policy ID
        policy_id: String,
    },
    /// Create a new policy
    Create {
        /// Policy name
        #[arg(long)]
        name: String,

        /// Policy type (SPENDING_LIMIT, RATE_LIMIT, PATTERN_MATCH, FILE_PROTECTION, DLP, CUSTOM_WEBHOOK, TIME_WINDOW, ALLOWLIST, BLOCKLIST)
        #[arg(long, value_name = "TYPE")]
        r#type: String,

        /// Policy config as JSON string (e.g. '{"max_amount": 100}')
        #[arg(long)]
        config: String,

        /// Description
        #[arg(long)]
        description: Option<String>,

        /// Priority (0-100, higher = evaluated first)
        #[arg(long, default_value_t = 0)]
        priority: u32,
    },
    /// Enable or disable a policy
    Toggle {
        /// Policy ID
        policy_id: String,

        /// Enable (true) or disable (false)
        #[arg(long)]
        enabled: bool,
    },
    /// Delete a policy
    Delete {
        /// Policy ID
        policy_id: String,
    },
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
        Commands::Policy { action } => {
            handle_policy(action, verbose).await;
        }
        Commands::Delete { agent_id } => {
            handle_delete_agent(agent_id.clone(), verbose).await;
        }
        Commands::Wallet { agent_id, network } => {
            handle_wallet(agent_id.clone(), network.clone(), verbose).await;
        }
        Commands::Verify { chain, agent_id } => {
            handle_verify(chain.clone(), agent_id.clone(), verbose).await;
        }
        Commands::Moltmind { action, agent_id, quiet } => {
            handle_moltmind(action, agent_id.clone(), *quiet, verbose).await;
        }
        Commands::Register { chain, agent_id, quiet } => {
            handle_register(chain.clone(), agent_id.clone(), *quiet, verbose).await;
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
    println!("🛡️  Bastion Protocol Setup\n");

    if verbose {
        println!("Environment: {}", env);
    }

    let api_key = if let Some(k) = provided_key {
        k
    } else {
        println!("Enter your API Key from the Dashboard.");
        println!("(Get one at https://bastion.legatia.solutions/profile)\n");

        match Password::with_theme(&ColorfulTheme::default())
            .with_prompt("API Key")
            .interact()
        {
            Ok(k) => k,
            Err(e) => {
                eprintln!("❌ Failed to read input: {}", e);
                std::process::exit(1);
            }
        }
    };

    // Validate key format
    if api_key.len() < 10 {
         println!("❌ Invalid API Key format. Key must be at least 10 characters.");
         return;
    }

    if !api_key.starts_with("bst_") {
        println!("⚠️  Warning: API Key doesn't start with 'bst_'. This may be invalid.");
    }

    // Determine backend URL based on environment
    let backend_url = match env.as_str() {
        "prod" | "production" => "https://bastion-gamma.vercel.app/v1",
        "staging" => "https://bastion-gamma.vercel.app/v1",
        _ => "https://bastion-gamma.vercel.app/v1",
    };

    // Validate key against backend
    println!("🔄 Verifying API key...");
    let client = reqwest::Client::new();
    let email = match client
        .get(format!("{}/usage", backend_url))
        .header("X-API-Key", &api_key)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<serde_json::Value>().await {
                Ok(data) => {
                    let tier = data["tier"].as_str().unwrap_or("FREE");
                    println!("✅ Authenticated! Tier: {}", tier);
                    data["email"].as_str().unwrap_or("user@bastion.ai").to_string()
                }
                Err(_) => {
                    println!("✅ API key accepted.");
                    "user@bastion.ai".to_string()
                }
            }
        }
        Ok(resp) if resp.status().as_u16() == 401 => {
            println!("❌ Invalid API key. Check your key at https://bastion.legatia.solutions/profile");
            return;
        }
        Ok(_) | Err(_) => {
            println!("⚠️  Could not verify key (backend unreachable). Saving anyway.");
            "user@bastion.ai".to_string()
        }
    };

    // Save config
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            eprintln!("❌ Cannot determine home directory.");
            std::process::exit(1);
        }
    };
    let config_dir = home.join(".bastion");
    let config_path = config_dir.join("config.json");

    if let Err(e) = std::fs::create_dir_all(&config_dir) {
        eprintln!("❌ Failed to create config directory: {}", e);
        std::process::exit(1);
    }

    let config = serde_json::json!({
        "email": email,
        "api_key": api_key,
        "backend_url": backend_url,
        "environment": env
    });

    let config_str = serde_json::to_string_pretty(&config).expect("failed to serialize config");
    if let Err(e) = std::fs::write(&config_path, &config_str) {
        eprintln!("❌ Failed to write config: {}", e);
        std::process::exit(1);
    }

    // Set config file permissions (owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&config_path, std::fs::Permissions::from_mode(0o600)).ok();
    }

    if verbose {
        println!("Config saved to: {:?}", config_path);
    }

    // ── Step 2: Auto-chain into init if no agent exists ──
    if !std::path::Path::new(".bastion-agent.json").exists() {
        println!("\n── Agent Setup ──\n");

        let setup_agent = Confirm::with_theme(&ColorfulTheme::default())
            .with_prompt("Register an agent in this directory?")
            .default(true)
            .interact()
            .unwrap_or(true);

        if setup_agent {
            handle_init(verbose).await;
        } else {
            println!("\nSkipped. Run `bastion init` later when you're in your agent's directory.");
            return;
        }
    } else {
        println!("\n✓ Agent already configured in this directory.");
    }

    println!("\n✅ Setup complete! Run `bastion start` to launch the proxy.");
    println!("   Or: bastion start -- python agent.py");
}

async fn handle_init(verbose: bool) {
    println!("🛡️  Bastion Protocol Setup\n");

    // Check if logged in
    let config_path = match dirs::home_dir() {
        Some(h) => h.join(".bastion").join("config.json"),
        None => {
            eprintln!("❌ Cannot determine home directory.");
            std::process::exit(1);
        }
    };

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
            .unwrap_or(false);

        if !overwrite {
            println!("Cancelled.");
            return;
        }
    }

    let config: serde_json::Value = match std::fs::read_to_string(&config_path) {
        Ok(contents) => match serde_json::from_str(&contents) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("❌ Config file is corrupt: {}", e);
                eprintln!("   Delete ~/.bastion/config.json and run `bastion login` again.");
                std::process::exit(1);
            }
        },
        Err(e) => {
            eprintln!("❌ Cannot read config: {}", e);
            std::process::exit(1);
        }
    };

    println!("Logged in as: {}\n", config["email"].as_str().unwrap_or("unknown"));

    // Interactive setup
    let name: String = Input::with_theme(&ColorfulTheme::default())
        .with_prompt("Agent name")
        .default("my-agent".into())
        .interact_text()
        .unwrap_or_else(|_| "my-agent".into());

    let language: String = Input::with_theme(&ColorfulTheme::default())
        .with_prompt("Language")
        .default("python".into())
        .interact_text()
        .unwrap_or_else(|_| "python".into());

    let framework: String = Input::with_theme(&ColorfulTheme::default())
        .with_prompt("Framework (langchain/autogpt/custom)")
        .default("custom".into())
        .interact_text()
        .unwrap_or_else(|_| "custom".into());

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

    match serde_json::to_string_pretty(&agent_config) {
        Ok(json) => {
            if let Err(e) = std::fs::write(".bastion-agent.json", json) {
                eprintln!("❌ Failed to write agent config: {}", e);
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to serialize agent config: {}", e);
            std::process::exit(1);
        }
    }

    println!("✅ Agent created!");
    println!("   ID: {}", agent_id);
    if verbose {
        println!("   Config saved to: .bastion-agent.json");
    }
}

async fn handle_start(port: u16, command: &[String], daemon: bool, verbose: bool) {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            eprintln!("❌ Cannot determine home directory.");
            std::process::exit(1);
        }
    };
    let config_path = home.join(".bastion").join("config.json");

    // If not logged in, chain into login (which chains into init → start)
    if !config_path.exists() {
        println!("🛡️  First time? Let's get you set up.\n");
        handle_login(None, "prod".to_string(), verbose).await;
        return; // login already chains into start
    }

    // If logged in but no agent in this directory, chain into init
    if !std::path::Path::new(".bastion-agent.json").exists() {
        println!("⚠️  No agent configured in this directory.\n");
        let setup = Confirm::with_theme(&ColorfulTheme::default())
            .with_prompt("Register an agent here?")
            .default(true)
            .interact()
            .unwrap_or(true);

        if setup {
            handle_init(verbose).await;
            println!();
        } else {
            println!("Run `bastion init` first, or `bastion start` from a directory with .bastion-agent.json");
            return;
        }
    }

    // Load config (guaranteed to exist now)
    let config = load_config();
    let agent_id = config.agent_id.clone().unwrap_or_else(|| "default".to_string());

    // Create agent-specific PID and log files
    let bastion_dir = dirs::home_dir().unwrap_or_else(|| {
        eprintln!("❌ Cannot determine home directory.");
        std::process::exit(1);
    }).join(".bastion");
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

        let stdout = match File::create(&log_file) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("❌ Failed to create log file: {}", e);
                std::process::exit(1);
            }
        };
        let stderr = match File::create(&err_file) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("❌ Failed to create error log file: {}", e);
                std::process::exit(1);
            }
        };

        let cwd = std::env::current_dir().unwrap_or_else(|e| {
            eprintln!("❌ Cannot determine current directory: {}", e);
            std::process::exit(1);
        });

        let daemonize = Daemonize::new()
            .pid_file(&pid_file)
            .chown_pid_file(true)
            .working_directory(cwd)
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
        println!("\n💡 To route your existing bots, set these in their terminal:");
        println!("   export HTTP_PROXY=http://localhost:{}", port);
        println!("   export HTTPS_PROXY=http://localhost:{}", port);
        println!("\n📊 Monitoring agent actions...\n");
    }

    // Start agent in background with proxy environment
    if !command.is_empty() {
        tokio::spawn(start_agent(command.to_vec(), port, verbose));
    }

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("❌ Failed to bind to port {}: {}", port, e);
            eprintln!("   Is another process already using this port?");
            std::process::exit(1);
        }
    };

    // Serve with graceful shutdown
    if let Err(e) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await
    {
        eprintln!("❌ Server error: {}", e);
        std::process::exit(1);
    }

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
                    eprintln!("   🛑 HTTPS policy check failed (fail-closed): {}", e);
                    return (StatusCode::SERVICE_UNAVAILABLE, "Policy check unavailable — connection blocked").into_response();
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
             // Fail closed — block traffic when policy check fails
             eprintln!("   🛑 Policy check failed (fail-closed): {}", e);
             return (StatusCode::SERVICE_UNAVAILABLE, "Policy check unavailable — request blocked").into_response();
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
        println!("   API Key: {}...", config.api_key.get(..5).unwrap_or(&config.api_key));
    }
    println!("   URL: {}\n", config.backend_url);

    let client = reqwest::Client::new();
    match client
        .get(format!("{}/health", config.backend_url.trim_end_matches("/v1")))
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
            println!("  1. Check your network connection");
            println!("  2. Verify the backend URL in your config");
            println!("  3. Check service status at https://bastion.legatia.solutions");
            if verbose {
                if let Some(home) = dirs::home_dir() {
                    println!("\nConfig path: {:?}", home.join(".bastion/config.json"));
                }
            }
        }
    }
}

async fn handle_verify(chain: String, agent_id_arg: Option<String>, verbose: bool) {
    let config = load_config();
    
    // Get agent ID from argument or local config
    let agent_id = if let Some(id) = agent_id_arg {
        id
    } else if let Some(id) = config.agent_id.clone() {
        id
    } else {
        eprintln!("❌ No agent ID found. Run `bastion init` first or pass --agent-id");
        std::process::exit(1);
    };

    println!("\n🛡️  Bastion Agent Verification (ERC-8004)\n");
    println!("   Chain: {}", chain);
    println!("   Agent: {}\n", agent_id);

    // Call backend to prepare verification transaction
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/agents/{}/verify", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .json(&serde_json::json!({ "chain": chain }))
        .send()
        .await;

    match resp {
        Ok(response) => {
            if response.status().is_success() {
                let body: serde_json::Value = response.json().await.unwrap_or_default();
                
                println!("✅ Verification prepared!\n");
                println!("To complete verification, sign this transaction in your wallet:\n");
                println!("   Registry: {}", body["registryAddress"].as_str().unwrap_or("unknown"));
                println!("   Agent URI: {}", body["agentURI"].as_str().unwrap_or("unknown"));
                
                if let Some(tx) = body.get("transaction") {
                    println!("\n📝 Transaction Details:");
                    println!("   To: {}", tx["to"].as_str().unwrap_or("unknown"));
                    println!("   Chain ID: {}", tx["chainId"]);
                    if verbose {
                        println!("   Data: {}", tx["data"].as_str().unwrap_or("unknown"));
                    }
                }

                println!("\n🌐 Complete verification at:");
                println!("   https://bastion.legatia.solutions/agents");
                println!("\n   Use the \"Get Verified\" button on your agent card.");
                
            } else if response.status().as_u16() == 403 {
                let body: serde_json::Value = response.json().await.unwrap_or_default();
                eprintln!("❌ {}", body["reason"].as_str()
                    .unwrap_or("Upgrade required — ERC-8004 verification requires STARTER tier or higher."));
                eprintln!("   Upgrade at: https://bastion.legatia.solutions/billing");
                std::process::exit(1);
            } else if response.status().as_u16() == 400 {
                let body: serde_json::Value = response.json().await.unwrap_or_default();
                if body["error"].as_str() == Some("Already verified") {
                    println!("✅ Agent is already verified on-chain!");
                    if let Some(identity) = body.get("identity") {
                        println!("   On-chain ID: #{}", identity["onchainId"]);
                        println!("   Chain: {}", identity["registryChain"]);
                    }
                } else {
                    eprintln!("❌ Error: {}", body["message"].as_str().unwrap_or("Bad request"));
                }
            } else {
                eprintln!("❌ Failed to prepare verification: {}", response.status());
                if verbose {
                    if let Ok(text) = response.text().await {
                        eprintln!("   Response: {}", text);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to reach backend: {}", e);
        }
    }
}

async fn handle_moltmind(action: &MoltmindAction, agent_id_arg: Option<String>, quiet: bool, verbose: bool) {
    let config = load_config();

    let agent_id = if let Some(id) = agent_id_arg {
        id
    } else if let Some(id) = config.agent_id.clone() {
        id
    } else {
        eprintln!("Error: No agent ID found. Run `bastion init` first or pass --agent-id");
        std::process::exit(1);
    };

    let client = reqwest::Client::new();

    match action {
        MoltmindAction::Health => {
            if !quiet { println!("Fetching health score for {}...", agent_id); }

            let resp = client
                .get(format!("{}/agents/{}/health", config.backend_url, agent_id))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(15))
                .send()
                .await;

            match handle_api_response(resp, quiet).await {
                Some(body) => {
                    if quiet {
                        // Machine-readable: score only
                        println!("{}", body["score"].as_f64().unwrap_or(0.0));
                    } else {
                        let score = body["score"].as_f64().unwrap_or(0.0);
                        let status = body["status"].as_str().unwrap_or("unknown");
                        let icon = if score >= 80.0 { "green" } else if score >= 50.0 { "yellow" } else { "red" };

                        println!("\nMoltMind Health Score: {:.0}/100 [{}]", score, icon);
                        println!("  Status: {}", status);

                        if let Some(ic) = body["identityCoherence"].as_f64() {
                            println!("  Identity Coherence:   {:.0}", ic);
                        }
                        if let Some(bs) = body["behavioralStability"].as_f64() {
                            println!("  Behavioral Stability: {:.0}", bs);
                        }
                        if let Some(ih) = body["interactionHealth"].as_f64() {
                            println!("  Interaction Health:   {:.0}", ih);
                        }

                        if let Some(flags) = body["flags"].as_array() {
                            if !flags.is_empty() {
                                println!("\n  Flags:");
                                for flag in flags {
                                    println!("    - {}", flag.as_str().unwrap_or("unknown"));
                                }
                            }
                        }
                    }

                    if verbose {
                        println!("\n{}", serde_json::to_string_pretty(&body).unwrap());
                    }
                }
                None => {}
            }
        }

        MoltmindAction::Alerts { limit } => {
            if !quiet { println!("Fetching alerts for {}...", agent_id); }

            let resp = client
                .get(format!("{}/agents/{}/alerts?limit={}", config.backend_url, agent_id, limit))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, quiet).await {
                Some(body) => {
                    if let Some(alerts) = body["alerts"].as_array() {
                        if quiet {
                            // Machine-readable: one JSON line per alert
                            for alert in alerts {
                                println!("{}", serde_json::to_string(alert).unwrap());
                            }
                        } else if alerts.is_empty() {
                            println!("\nNo alerts. Agent is operating within normal parameters.");
                        } else {
                            println!("\n{} alert(s):\n", alerts.len());
                            for alert in alerts {
                                let severity = alert["severity"].as_str().unwrap_or("unknown");
                                let alert_type = alert["type"].as_str().unwrap_or("unknown");
                                let message = alert["message"].as_str().unwrap_or("");
                                let acknowledged = alert["acknowledged"].as_bool().unwrap_or(false);
                                let id = alert["id"].as_str().unwrap_or("");

                                let severity_icon = match severity {
                                    "critical" => "!!!",
                                    "high" => "!! ",
                                    "medium" => "!  ",
                                    _ => "   ",
                                };

                                let ack = if acknowledged { " [ack]" } else { "" };
                                println!("  [{}] {} — {}{}", severity_icon, alert_type, message, ack);

                                if verbose {
                                    println!("        ID: {}", id);
                                    if let Some(ts) = alert["createdAt"].as_str() {
                                        println!("        Time: {}", ts);
                                    }
                                    if let Some(z) = alert["zScore"].as_f64() {
                                        println!("        Z-score: {:.2}", z);
                                    }
                                }
                            }
                            println!("\nAcknowledge with: bastion moltmind ack <alert-id>");
                        }
                    }
                }
                None => {}
            }
        }

        MoltmindAction::Ack { alert_id } => {
            if !quiet { println!("Acknowledging alert {}...", alert_id); }

            let resp = client
                .post(format!("{}/agents/{}/alerts/{}/acknowledge", config.backend_url, agent_id, alert_id))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, quiet).await {
                Some(_) => {
                    if !quiet { println!("Alert acknowledged."); }
                }
                None => {}
            }
        }

        MoltmindAction::Analyze { window } => {
            if !quiet { println!("Running drift analysis ({}-hour window) for {}...", window, agent_id); }

            let resp = client
                .post(format!("{}/agents/{}/analyze", config.backend_url, agent_id))
                .header("X-API-Key", &config.api_key)
                .json(&serde_json::json!({ "windowHours": window }))
                .timeout(std::time::Duration::from_secs(30))
                .send()
                .await;

            match handle_api_response(resp, quiet).await {
                Some(body) => {
                    if quiet {
                        // Machine-readable: full JSON
                        println!("{}", serde_json::to_string(&body).unwrap());
                    } else {
                        let score = body["overallScore"].as_f64().unwrap_or(0.0);
                        println!("\nDrift Analysis Complete");
                        println!("  Overall Score: {:.0}/100", score);

                        if let Some(metrics) = body["metrics"].as_object() {
                            println!("\n  Metrics:");
                            for (key, val) in metrics {
                                if let Some(z) = val["zScore"].as_f64() {
                                    let severity = val["severity"].as_str().unwrap_or("none");
                                    println!("    {}: z={:.2} [{}]", key, z, severity);
                                }
                            }
                        }

                        if let Some(alerts) = body["alerts"].as_array() {
                            if !alerts.is_empty() {
                                println!("\n  New Alerts ({}):", alerts.len());
                                for a in alerts {
                                    println!("    - [{}] {}: {}",
                                        a["severity"].as_str().unwrap_or("?"),
                                        a["type"].as_str().unwrap_or("?"),
                                        a["message"].as_str().unwrap_or(""),
                                    );
                                }
                            }
                        }
                    }

                    if verbose {
                        println!("\n{}", serde_json::to_string_pretty(&body).unwrap());
                    }
                }
                None => {}
            }
        }

        MoltmindAction::Baseline => {
            if !quiet { println!("Fetching baseline for {}...", agent_id); }

            let resp = client
                .get(format!("{}/agents/{}/baseline", config.backend_url, agent_id))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, quiet).await {
                Some(body) => {
                    let status = body["status"].as_str().unwrap_or("unknown");

                    if quiet {
                        println!("{}", serde_json::to_string(&body).unwrap());
                    } else if status == "insufficient_data" {
                        println!("\nInsufficient data — need at least 50 events to build a baseline.");
                    } else if status == "pending" {
                        println!("\nBaseline is being calculated. Check back soon.");
                    } else if let Some(baseline) = body.get("baseline") {
                        println!("\nBaseline (status: {}):", status);
                        if let Some(b) = baseline.as_object() {
                            for (key, val) in b {
                                if let Some(mean) = val["mean"].as_f64() {
                                    let stddev = val["stddev"].as_f64().unwrap_or(0.0);
                                    println!("  {}: mean={:.2}, stddev={:.2}", key, mean, stddev);
                                } else {
                                    println!("  {}: {}", key, val);
                                }
                            }
                        } else {
                            println!("{}", serde_json::to_string_pretty(baseline).unwrap());
                        }
                    } else {
                        println!("\nNo baseline available.");
                    }

                    if verbose {
                        println!("\n{}", serde_json::to_string_pretty(&body).unwrap());
                    }
                }
                None => {}
            }
        }

        MoltmindAction::RefreshBaseline => {
            if !quiet { println!("Recalculating baseline for {}...", agent_id); }

            let resp = client
                .post(format!("{}/agents/{}/baseline/refresh", config.backend_url, agent_id))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(30))
                .send()
                .await;

            match handle_api_response(resp, quiet).await {
                Some(body) => {
                    if quiet {
                        println!("{}", serde_json::to_string(&body).unwrap());
                    } else if body["success"].as_bool() == Some(true) {
                        println!("Baseline recalculated.");
                    } else {
                        println!("Failed: {}", body["message"].as_str().unwrap_or("Unknown error"));
                    }
                }
                None => {}
            }
        }
    }
}

/// Shared response handler for MoltMind API calls.
/// Returns parsed JSON body on success, None on error (after printing).
async fn handle_api_response(
    resp: Result<reqwest::Response, reqwest::Error>,
    _quiet: bool,
) -> Option<serde_json::Value> {
    match resp {
        Ok(response) => {
            let status = response.status();
            match response.json::<serde_json::Value>().await {
                Ok(body) => {
                    if status.is_success() {
                        Some(body)
                    } else if status.as_u16() == 403 {
                        eprintln!("Error: {}", body["reason"].as_str()
                            .unwrap_or("Upgrade required — this feature requires a higher tier."));
                        std::process::exit(1);
                    } else if status.as_u16() == 404 {
                        eprintln!("Error: {}", body["error"].as_str().unwrap_or("Not found"));
                        std::process::exit(1);
                    } else {
                        eprintln!("Error ({}): {}", status, body["error"].as_str().unwrap_or("Unknown error"));
                        std::process::exit(1);
                    }
                }
                Err(e) => {
                    eprintln!("Error: Failed to parse response: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("Error: Failed to reach backend: {}", e);
            std::process::exit(1);
        }
    }
}

async fn handle_register(chain: String, agent_id_arg: Option<String>, quiet: bool, verbose: bool) {
    let config = load_config();

    let agent_id = if let Some(id) = agent_id_arg {
        id
    } else if let Some(id) = config.agent_id.clone() {
        id
    } else {
        eprintln!("Error: No agent ID found. Run `bastion init` first or pass --agent-id");
        std::process::exit(1);
    };

    if !quiet {
        println!("Registering agent on-chain (ERC-8004)...");
        println!("  Chain: {}", chain);
        println!("  Agent: {}", agent_id);
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/agents/{}/register", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .json(&serde_json::json!({ "chain": chain }))
        .timeout(std::time::Duration::from_secs(60)) // Registration waits for mining
        .send()
        .await;

    match resp {
        Ok(response) => {
            let status = response.status();
            match response.json::<serde_json::Value>().await {
                Ok(body) => {
                    if status.is_success() {
                        if quiet {
                            // Machine-readable output for cron: just the on-chain ID
                            if let Some(onchain_id) = body["agent"]["onchainId"].as_i64() {
                                println!("{}", onchain_id);
                            }
                        } else {
                            println!("\nRegistered on-chain!");
                            println!("  On-chain ID: #{}", body["agent"]["onchainId"]);
                            println!("  Chain: {}", body["agent"]["registryChain"].as_str().unwrap_or(&chain));
                            println!("  Owner: {}", body["agent"]["ownerAddress"].as_str().unwrap_or("unknown"));
                        }
                        if verbose {
                            println!("\nFull response:");
                            println!("{}", serde_json::to_string_pretty(&body).unwrap());
                        }
                    } else if status.as_u16() == 400 {
                        if body["error"].as_str() == Some("Already registered") {
                            if !quiet {
                                println!("Agent is already registered on-chain.");
                                if let Some(identity) = body.get("identity") {
                                    println!("  On-chain ID: #{}", identity["onchainId"]);
                                    println!("  Chain: {}", identity["registryChain"].as_str().unwrap_or("unknown"));
                                }
                            }
                            // Exit 0 for cron — already registered is not an error
                        } else {
                            eprintln!("Error: {}", body["message"].as_str().unwrap_or("Bad request"));
                            std::process::exit(1);
                        }
                    } else if status.as_u16() == 403 {
                        eprintln!("Error: {}", body["reason"].as_str().unwrap_or("Upgrade required — ERC-8004 registration requires STARTER tier or higher."));
                        std::process::exit(1);
                    } else {
                        eprintln!("Error ({}): {}", status, body["message"].as_str().unwrap_or("Unknown error"));
                        std::process::exit(1);
                    }
                }
                Err(e) => {
                    eprintln!("Error: Failed to parse response: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("Error: Failed to reach backend: {}", e);
            std::process::exit(1);
        }
    }
}

// ============================================================================
// Policy, Delete Agent, Wallet Handlers
// ============================================================================

async fn handle_policy(action: &PolicyAction, verbose: bool) {
    let config = load_config();
    let client = reqwest::Client::new();

    match action {
        PolicyAction::List => {
            println!("📋 Policies\n");

            let resp = client
                .get(format!("{}/policies", config.backend_url))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, false).await {
                Some(body) => {
                    if let Some(policies) = body["policies"].as_array() {
                        if policies.is_empty() {
                            println!("No policies yet.");
                            println!("\nCreate one with:");
                            println!("  bastion policy create --name \"Block social media\" --type BLOCKLIST --config '{{\"domains\":[\"twitter.com\",\"facebook.com\"]}}'");
                        } else {
                            println!("{} policy(ies):\n", policies.len());
                            for p in policies {
                                let id = p["id"].as_str().unwrap_or("?");
                                let name = p["name"].as_str().unwrap_or("?");
                                let ptype = p["type"].as_str().unwrap_or("?");
                                let enabled = p["enabled"].as_bool().unwrap_or(false);
                                let priority = p["priority"].as_i64().unwrap_or(0);
                                let status = if enabled { "ON " } else { "OFF" };

                                println!("  [{}] {} — {} (priority: {})", status, name, ptype, priority);
                                if verbose {
                                    println!("       ID: {}", id);
                                    if let Some(desc) = p["description"].as_str() {
                                        if !desc.is_empty() { println!("       {}", desc); }
                                    }
                                }
                            }
                        }
                    }
                }
                None => {}
            }
        }

        PolicyAction::Get { policy_id } => {
            let resp = client
                .get(format!("{}/policies/{}", config.backend_url, policy_id))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, false).await {
                Some(body) => {
                    if let Some(p) = body.get("policy") {
                        println!("Policy: {}\n", p["name"].as_str().unwrap_or("?"));
                        println!("  ID:          {}", p["id"].as_str().unwrap_or("?"));
                        println!("  Type:        {}", p["type"].as_str().unwrap_or("?"));
                        println!("  Enabled:     {}", p["enabled"].as_bool().unwrap_or(false));
                        println!("  Priority:    {}", p["priority"].as_i64().unwrap_or(0));
                        if let Some(desc) = p["description"].as_str() {
                            if !desc.is_empty() { println!("  Description: {}", desc); }
                        }
                        if let Some(cfg) = p.get("config") {
                            println!("  Config:      {}", serde_json::to_string_pretty(cfg).unwrap());
                        }
                    }
                }
                None => {}
            }
        }

        PolicyAction::Create { name, r#type, config: cfg_str, description, priority } => {
            let cfg: serde_json::Value = match serde_json::from_str(cfg_str) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("Error: Invalid JSON in --config: {}", e);
                    eprintln!("Example: --config '{{\"domains\":[\"twitter.com\"]}}'");
                    std::process::exit(1);
                }
            };

            let mut payload = serde_json::json!({
                "name": name,
                "type": r#type,
                "config": cfg,
                "priority": priority,
            });

            if let Some(desc) = description {
                payload["description"] = serde_json::json!(desc);
            }

            println!("Creating policy \"{}\" ({})...", name, r#type);

            let resp = client
                .post(format!("{}/policies", config.backend_url))
                .header("X-API-Key", &config.api_key)
                .json(&payload)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, false).await {
                Some(body) => {
                    let id = body["policy"]["id"].as_str().unwrap_or("?");
                    println!("Policy created! ID: {}", id);
                }
                None => {}
            }
        }

        PolicyAction::Toggle { policy_id, enabled } => {
            let resp = client
                .put(format!("{}/policies/{}", config.backend_url, policy_id))
                .header("X-API-Key", &config.api_key)
                .json(&serde_json::json!({ "enabled": enabled }))
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, false).await {
                Some(_) => {
                    println!("Policy {} {}.", policy_id, if *enabled { "enabled" } else { "disabled" });
                }
                None => {}
            }
        }

        PolicyAction::Delete { policy_id } => {
            let confirm = Confirm::with_theme(&ColorfulTheme::default())
                .with_prompt(format!("Delete policy {}?", policy_id))
                .default(false)
                .interact()
                .unwrap_or(false);

            if !confirm {
                println!("Cancelled.");
                return;
            }

            let resp = client
                .delete(format!("{}/policies/{}", config.backend_url, policy_id))
                .header("X-API-Key", &config.api_key)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match handle_api_response(resp, false).await {
                Some(_) => {
                    println!("Policy deleted.");
                }
                None => {}
            }
        }
    }
}

async fn handle_delete_agent(agent_id_arg: Option<String>, _verbose: bool) {
    let config = load_config();

    let agent_id = if let Some(id) = agent_id_arg {
        id
    } else if let Some(id) = config.agent_id.clone() {
        id
    } else {
        eprintln!("Error: No agent ID found. Pass --agent-id or run from a directory with .bastion-agent.json");
        std::process::exit(1);
    };

    let confirm = Confirm::with_theme(&ColorfulTheme::default())
        .with_prompt(format!("Delete agent {}? This cannot be undone.", agent_id))
        .default(false)
        .interact()
        .unwrap_or(false);

    if !confirm {
        println!("Cancelled.");
        return;
    }

    let client = reqwest::Client::new();
    let resp = client
        .delete(format!("{}/agents/{}", config.backend_url, agent_id))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match handle_api_response(resp, false).await {
        Some(_) => {
            println!("Agent deleted from backend.");

            // Clean up local config if it matches
            if let Ok(local) = std::fs::read_to_string(".bastion-agent.json") {
                if let Ok(agent) = serde_json::from_str::<serde_json::Value>(&local) {
                    if agent["agent_id"].as_str() == Some(&agent_id) {
                        std::fs::remove_file(".bastion-agent.json").ok();
                        println!("Local .bastion-agent.json removed.");
                    }
                }
            }
        }
        None => {}
    }
}

async fn handle_wallet(agent_id_arg: Option<String>, network: String, verbose: bool) {
    let config = load_config();

    let agent_id = if let Some(id) = agent_id_arg {
        id
    } else if let Some(id) = config.agent_id.clone() {
        id
    } else {
        eprintln!("Error: No agent ID found. Pass --agent-id or run from a directory with .bastion-agent.json");
        std::process::exit(1);
    };

    println!("Fetching wallet for agent {}...\n", agent_id);

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/agents/{}/wallet?network={}", config.backend_url, agent_id, network))
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match handle_api_response(resp, false).await {
        Some(body) => {
            let address = body["address"].as_str().unwrap_or("?");
            let net = body["network"].as_str().unwrap_or(&network);
            let explorer = body["explorerUrl"].as_str().unwrap_or("");

            println!("  Address: {}", address);
            println!("  Network: {}", net);
            if !explorer.is_empty() {
                println!("  Explorer: {}", explorer);
            }

            if let Some(balances) = body["balances"].as_array() {
                if !balances.is_empty() {
                    println!("\n  Balances:");
                    for b in balances {
                        let asset = b["asset"].as_str().unwrap_or("?");
                        let amount = b["amount"].as_str()
                            .or_else(|| b["amount"].as_f64().map(|_| ""))
                            .unwrap_or("0");
                        println!("    {} {}", amount, asset);
                    }
                } else {
                    println!("\n  No balances found.");
                }
            }

            if verbose {
                println!("\n{}", serde_json::to_string_pretty(&body).unwrap());
            }
        }
        None => {}
    }
}

fn load_config() -> Config {
    let config_path = match dirs::home_dir() {
        Some(h) => h.join(".bastion").join("config.json"),
        None => {
            eprintln!("❌ Cannot determine home directory.");
            std::process::exit(1);
        }
    };

    if !config_path.exists() {
        eprintln!("❌ Not logged in. Run `bastion login` first.");
        std::process::exit(1);
    }

    let config_str = match std::fs::read_to_string(&config_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("❌ Cannot read config: {}", e);
            std::process::exit(1);
        }
    };

    let mut config: serde_json::Value = match serde_json::from_str(&config_str) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("❌ Config file is corrupt: {}", e);
            eprintln!("   Delete ~/.bastion/config.json and run `bastion login` again.");
            std::process::exit(1);
        }
    };

    // Auto-migrate old localhost backend URLs to production
    let mut needs_save = false;
    if let Some(backend_url) = config["backend_url"].as_str() {
        if backend_url.contains("localhost:3000") {
            config["backend_url"] = serde_json::json!("https://bastion-gamma.vercel.app/v1");
            needs_save = true;
        }
    }

    if needs_save {
        std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).ok();
    }

    // Try to load agent config
    let agent_id = if let Ok(agent_config) = std::fs::read_to_string(".bastion-agent.json") {
        match serde_json::from_str::<serde_json::Value>(&agent_config) {
            Ok(agent) => agent["agent_id"].as_str().map(|s| s.to_string()),
            Err(_) => None,
        }
    } else {
        None
    };

    let api_key = match config["api_key"].as_str() {
        Some(k) => k.to_string(),
        None => {
            eprintln!("❌ Config file missing api_key. Run `bastion login` again.");
            std::process::exit(1);
        }
    };

    Config {
        api_key,
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
                    eprintln!("   Upgrade at: https://bastion.legatia.solutions/billing\n");
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
                        eprintln!("   🛑 Error parsing response (fail-closed): {}", e);
                        Json(AuthorizeResponse {
                            allowed: false,
                            reason: Some("Backend response parse error — blocked for safety".to_string()),
                        })
                    }
                }
            } else {
                eprintln!("   🛑 Backend error (fail-closed): {}", resp.status());
                Json(AuthorizeResponse {
                    allowed: false,
                    reason: Some(format!("Backend error: {} — blocked for safety", resp.status())),
                })
            }
        }
        Err(e) => {
            eprintln!("   🛑 Cannot reach backend (fail-closed): {}", e);
            Json(AuthorizeResponse {
                allowed: false,
                reason: Some("Backend unreachable — blocked for safety".to_string()),
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

    let bastion_dir = match dirs::home_dir() {
        Some(h) => h.join(".bastion"),
        None => {
            eprintln!("❌ Cannot determine home directory.");
            return;
        }
    };
    let pid_file = bastion_dir.join(format!("{}.pid", agent_id));

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

    let bastion_dir = match dirs::home_dir() {
        Some(h) => h.join(".bastion"),
        None => {
            eprintln!("❌ Cannot determine home directory.");
            return;
        }
    };
    let pid_file = bastion_dir.join(format!("{}.pid", agent_id));

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
                            println!("  API Key: {}...", &config.api_key.get(..5).unwrap_or(&config.api_key));
                        }

                        // Check log file size
                        let log_file = bastion_dir.join(format!("{}.out", agent_id));

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

    let bastion_dir = match dirs::home_dir() {
        Some(h) => h.join(".bastion"),
        None => {
            eprintln!("❌ Cannot determine home directory.");
            return;
        }
    };
    let log_file = bastion_dir.join(format!("{}.out", agent_id));
    let err_file = bastion_dir.join(format!("{}.err", agent_id));

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
    let bastion_dir = match dirs::home_dir() {
        Some(h) => h.join(".bastion"),
        None => {
            eprintln!("❌ Cannot determine home directory.");
            return;
        }
    };

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

    let config_content = match std::fs::read_to_string(".bastion-agent.json") {
        Ok(c) => c,
        Err(e) => {
            eprintln!("❌ Failed to read agent config: {}", e);
            return;
        }
    };
    let mut agent: serde_json::Value = match serde_json::from_str(&config_content) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("❌ Agent config is corrupt: {}", e);
            return;
        }
    };

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
        if let Ok(json) = serde_json::to_string_pretty(&agent) {
            if let Err(e) = std::fs::write(".bastion-agent.json", json) {
                eprintln!("❌ Failed to save config: {}", e);
                return;
            }
        }
        println!("\n✅ Configuration updated successfully");
    } else {
        println!("📋 Current Configuration:\n");
        println!("{}", serde_json::to_string_pretty(&agent).unwrap_or_default());
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
            println!("\nCheck your network connection and backend status.");
        }
    }
}

async fn handle_stats(range: String, verbose: bool) {
    println!("📊 Usage Statistics\n");

    let config = load_config();
    let client = reqwest::Client::new();

    // Calculate date range from the range argument
    let now = chrono::Utc::now();
    let from = match range.as_str() {
        "today" => now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc(),
        "week" => now - chrono::Duration::days(7),
        "month" => now - chrono::Duration::days(30),
        "all" => now - chrono::Duration::days(365),
        _ => now - chrono::Duration::days(30),
    };

    let url = format!(
        "{}/analytics/summary?from={}&to={}",
        config.backend_url,
        from.to_rfc3339(),
        now.to_rfc3339()
    );

    if verbose {
        println!("Fetching from: {}\n", url);
    }

    match client
        .get(&url)
        .header("X-API-Key", &config.api_key)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if let Some(summary) = data.get("summary") {
                            let checks = summary["checksCount"].as_i64().unwrap_or(0);
                            let allowed = summary["allowedCount"].as_i64().unwrap_or(0);
                            let blocked = summary["blockedCount"].as_i64().unwrap_or(0);
                            let errors = summary["errorCount"].as_i64().unwrap_or(0);
                            let block_rate = summary["blockRate"].as_str().unwrap_or("0.00");
                            let agents = summary["activeAgents"].as_i64().unwrap_or(0);
                            let policies = summary["activePolicies"].as_i64().unwrap_or(0);

                            println!("  Range: {}", range);
                            println!("  Total Checks: {}", checks);
                            println!("  Allowed: {}", allowed);
                            println!("  Blocked: {}", blocked);
                            println!("  Errors: {}", errors);
                            println!("  Block Rate: {}%", block_rate);
                            println!("  Active Agents: {}", agents);
                            println!("  Active Policies: {}", policies);
                        }

                        if let Some(blocks) = data["recentBlocks"].as_array() {
                            if !blocks.is_empty() {
                                println!("\n  Recent Blocks:");
                                for b in blocks.iter().take(5) {
                                    let agent = b["agent"]["name"].as_str().unwrap_or("?");
                                    let policy = b["policy"]["name"].as_str().unwrap_or("?");
                                    let action = b["actionType"].as_str().unwrap_or("?");
                                    println!("    {} — {} blocked by {}", agent, action, policy);
                                }
                            }
                        }

                        if verbose {
                            println!("\n{}", serde_json::to_string_pretty(&data).unwrap());
                        }
                    }
                    Err(e) => {
                        eprintln!("❌ Failed to parse response: {}", e);
                    }
                }
            } else {
                eprintln!("❌ Backend returned status: {}", resp.status());
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to fetch stats: {}", e);
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
    let config_path = match dirs::home_dir() {
        Some(h) => h.join(".bastion").join("config.json"),
        None => {
            println!("  ❌ Cannot determine home directory");
            println!("\n{}", "=".repeat(50));
            println!("❌ 1 error(s) found");
            return;
        }
    };

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
                            let key = config["api_key"].as_str().unwrap_or("");
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
                            println!("  Backend URL: {}", config["backend_url"].as_str().unwrap_or("not set"));
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
            .get(format!("{}/health", config.backend_url.trim_end_matches("/v1")))
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
                println!("     Check your network connection and service status.");
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
