# CLI Overview

The Bastion CLI is a Rust-based command-line tool that provides the local proxy and agent management capabilities.

## Installation

### Quick Install (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash
```

### From Source

```bash
git clone https://github.com/Legatia/Bastion.git
cd Bastion/cli
cargo install --path .
```

### Pre-built Binaries

Download from [releases page](https://github.com/Legatia/Bastion/releases):

```bash
# macOS (ARM64)
curl -L https://github.com/Legatia/Bastion/releases/latest/download/bastion-macos-arm64 -o bastion
chmod +x bastion
sudo mv bastion /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/Legatia/Bastion/releases/latest/download/bastion-macos-x64 -o bastion
chmod +x bastion
sudo mv bastion /usr/local/bin/

# Linux
curl -L https://github.com/Legatia/Bastion/releases/latest/download/bastion-linux-x64 -o bastion
chmod +x bastion
sudo mv bastion /usr/local/bin/
```

### Verify Installation

```bash
bastion --version
# Output: bastion 0.1.0
```

## Core Capabilities

### 1. Proxy Server
- HTTP/HTTPS interception
- Request routing and evaluation
- Policy enforcement
- Graceful error handling

### 2. Daemon Management
- Background process control
- PID file management
- Log rotation
- Health monitoring

### 3. Agent Configuration
- Interactive setup
- Config file management
- Multi-agent support

### 4. Observability
- Real-time action logs
- Audit trail access
- Usage statistics
- Policy testing

## Command Categories

### Authentication
```bash
bastion login          # Authenticate with backend
```

### Agent Setup
```bash
bastion init           # Initialize agent config
bastion config         # Update agent settings
bastion list           # List all agents
```

### Running Agents
```bash
bastion start          # Start proxy and agent
bastion stop           # Stop daemon
bastion restart        # Restart daemon
bastion status         # Check daemon status
```

### Monitoring
```bash
bastion logs           # View daemon logs
bastion audit          # View audit trail
bastion stats          # Show statistics
```

### Testing & Debugging
```bash
bastion test           # Test policies (dry-run)
bastion validate       # Validate config
bastion health         # Check backend
```

## Configuration Files

### Global Config
**Location:** `~/.bastion/config.json`

```json
{
  "email": "user@example.com",
  "api_key": "bst_...",
  "backend_url": "http://localhost:3000/v1",
  "environment": "dev"
}
```

### Agent Config
**Location:** `.bastion-agent.json` (per project)

```json
{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-agent",
  "language": "python",
  "framework": "custom",
  "enabled": true,
  "created_at": "2025-01-30T10:30:00Z"
}
```

### Daemon Files
**Location:** `~/.bastion/`

- `{agent_id}.pid` - Process ID file
- `{agent_id}.out` - Stdout log
- `{agent_id}.err` - Stderr log
- `{agent_id}.out.1` - Rotated log (keeps last 5)

## Workflow

### Development
```bash
# 1. Login once
bastion login --key bst_dev_key

# 2. Per project
cd my-agent/
bastion init

# 3. Run in foreground for debugging
bastion start -- python agent.py

# 4. Watch logs in real-time
# (in another terminal)
bastion logs -f
```

### Production
```bash
# 1. Login with production key
bastion login --key bst_prod_key --env prod

# 2. Start in daemon mode
bastion start --daemon --port 3000 -- python agent.py

# 3. Monitor
bastion status
bastion stats --range today

# 4. Stop when needed
bastion stop
```

## Architecture

```
┌─────────────────────────────────────────────┐
│         Bastion CLI (Rust Binary)           │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Command Handler (clap)             │   │
│  │  - Parse commands                   │   │
│  │  - Route to handlers                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  HTTP Proxy (axum)                  │   │
│  │  - Intercept requests               │   │
│  │  - HTTPS tunneling                  │   │
│  │  - Forward allowed requests         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Config Management                  │   │
│  │  - Read/write configs               │   │
│  │  - Validate settings                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Daemon Control (daemonize)         │   │
│  │  - Background process               │   │
│  │  - Signal handling                  │   │
│  │  - PID management                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Backend Client (reqwest)           │   │
│  │  - API calls                        │   │
│  │  - Policy checks                    │   │
│  │  - Audit/stats queries              │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Performance

### Binary Size
- **Debug build:** ~15 MB
- **Release build:** ~5 MB
- **Stripped release:** ~3 MB

### Startup Time
- **Cold start:** ~50ms
- **Proxy ready:** ~100ms
- **Agent launched:** ~200ms

### Memory Usage
- **Idle:** ~10 MB
- **Under load:** ~30 MB
- **Peak:** ~50 MB

### CPU Usage
- **Idle:** < 1%
- **1000 req/s:** ~10%
- **10000 req/s:** ~50%

## Dependencies

### Core
- `tokio` - Async runtime
- `axum` - Web framework
- `clap` - CLI parsing
- `reqwest` - HTTP client

### Features
- `daemonize` - Background processes
- `dialoguer` - Interactive prompts
- `nix` - Unix signal handling (Unix only)
- `serde_json` - Config serialization

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS (ARM64) | ✅ Fully supported | M1/M2/M3 Macs |
| macOS (Intel) | ✅ Fully supported | Intel Macs |
| Linux (x86_64) | ✅ Fully supported | Most distros |
| Linux (ARM64) | ✅ Supported | Raspberry Pi, etc. |
| Windows | ⚠️ Experimental | Limited daemon support |

## Next Steps

- [Commands Reference](/cli/commands) - All CLI commands
- [MoltMind Monitoring](/cli/moltmind) - Behavioral baselines and alerts
- [On-Chain Identity](/cli/identity) - ERC-8004 registration
- [Troubleshooting](/cli/troubleshooting) - Common issues
