# CLI Commands Reference

Complete reference for all Bastion CLI commands.

## Global Flags

These flags work with any command:

```bash
-v, --verbose    # Enable detailed output
-h, --help       # Show help information
-V, --version    # Show version number
```

---

## Authentication

### `bastion login`

Authenticate with Bastion backend.

**Usage:**
```bash
bastion login [--key <API_KEY>] [--env <ENVIRONMENT>]
```

**Options:**
- `--key <API_KEY>` - API key from dashboard (optional, prompts if not provided)
- `--env <ENV>` - Environment: `dev`, `staging`, or `prod` (default: `dev`)

**Examples:**
```bash
# Interactive login
bastion login

# Direct login with key
bastion login --key bst_your_api_key_here

# Login to production
bastion login --key bst_prod_key --env prod
```

**Output:**
```
🛡️  Bastion Protocol Login

🔄 Authenticating...
✅ Login successful!

Your API Key: bst_d...
Environment: dev
Backend URL: http://localhost:3000/v1

Next step: Run `bastion init` in your agent directory
```

**Configuration:**
Stores credentials in `~/.bastion/config.json`:
```json
{
  "email": "user@bastion.ai",
  "api_key": "bst_...",
  "backend_url": "http://localhost:3000/v1",
  "environment": "dev"
}
```

---

## Agent Setup

### `bastion init`

Initialize agent protection in current directory.

**Usage:**
```bash
bastion init
```

**Interactive Prompts:**
- Agent name
- Language (python, javascript, go, etc.)
- Framework (langchain, autogpt, custom)

**Examples:**
```bash
cd /path/to/agent
bastion init
```

**Output:**
```
🛡️  Bastion Protocol Setup

Logged in as: you@example.com

Agent name: my-agent
Language: python
Framework: custom

🔄 Creating agent...
✅ Agent created!

Agent ID: 550e8400-e29b-41d4-a716-446655440000

Next step: Run your agent with Bastion protection:
  bastion start -- python agent.py
```

**Configuration:**
Creates `.bastion-agent.json` in current directory:
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

---

## Running Agents

### `bastion start`

Start the local supervisor proxy and run your agent.

**Usage:**
```bash
bastion start [OPTIONS] [-- <COMMAND>]
```

**Options:**
- `--port <PORT>` - Port for proxy (default: 3000)
- `-d, --daemon` - Run in background
- `-- <COMMAND>` - Command to execute (optional)

**Examples:**
```bash
# Foreground mode (recommended for development)
bastion start -- python agent.py

# Background daemon mode
bastion start --daemon -- python agent.py

# Custom port
bastion start --port 8080 -- node agent.js

# Proxy only (no agent command)
bastion start --port 3000
```

**Foreground Output:**
```
🛡️  Starting Bastion Supervisor

✓ Loaded configuration
✓ Backend: http://localhost:3000/v1
✓ Proxy listening on port: 3000

🚀 Bastion Supervisor active!
   Proxy: http://localhost:3000
   Dashboard: http://localhost:3001

📊 Monitoring agent actions...

🤖 Launching agent: python agent.py
✓ Agent started (PID: 12345)

[10:30:15] http_request - {"method": "GET", "url": "..."}
   ✓ ALLOWED
```

**Daemon Output:**
```
🛡️  Starting Bastion Supervisor in background...
✅ Daemon started successfully
   PID file: /Users/user/.bastion/550e8400-....pid

Use `bastion status` to check status
Use `bastion logs` to view logs
```

**Environment Variables Set:**
The proxy sets these automatically for your agent:
```bash
HTTP_PROXY=http://localhost:3000
HTTPS_PROXY=http://localhost:3000
BASTION_ENABLED=true
```

---

## Daemon Management

### `bastion stop`

Stop the running daemon.

**Usage:**
```bash
bastion stop
```

**Examples:**
```bash
bastion stop
```

**Output:**
```
🛑 Stopping Bastion daemon...

Found PID: 12345
✅ Sent shutdown signal to process 12345
✅ Daemon stopped successfully
```

**Behavior:**
1. Sends SIGTERM for graceful shutdown
2. Waits up to 5 seconds
3. Sends SIGKILL if still running
4. Cleans up PID file

---

### `bastion status`

Check daemon status and information.

**Usage:**
```bash
bastion status [-v]
```

**Examples:**
```bash
# Basic status
bastion status

# Verbose output
bastion status --verbose
```

**Output (Running):**
```
📊 Bastion Status

Status: ✅ Running
PID: 12345
Uptime: 3600s
Log size: 45123 bytes
```

**Output (Not Running):**
```
📊 Bastion Status

Status: ⭕ Not running
```

**Output (Stale):**
```
📊 Bastion Status

Status: ⚠️  Stale (process 12345 not running)
```

---

### `bastion logs`

View daemon logs.

**Usage:**
```bash
bastion logs [OPTIONS]
```

**Options:**
- `-n, --lines <N>` - Number of lines to show (default: 50, 0 = all)
- `-f, --follow` - Follow log output in real-time

**Examples:**
```bash
# Show last 50 lines
bastion logs

# Show last 100 lines
bastion logs -n 100

# Show all logs
bastion logs -n 0

# Follow logs (like tail -f)
bastion logs -f

# Follow with specific line count
bastion logs -f -n 20
```

**Output:**
```
📜 Stdout logs (last 50 lines):

[10:30:15] http_request - {"method": "GET"}
   ✓ ALLOWED
[10:30:18] http_request - {"method": "POST"}
   🛑 BLOCKED: Rate limit exceeded
...
```

**Log Files:**
- Stdout: `~/.bastion/{agent_id}.out`
- Stderr: `~/.bastion/{agent_id}.err`
- Rotated: `~/.bastion/{agent_id}.out.1`, `.out.2`, etc.

---

### `bastion restart`

Restart the daemon (convenience command).

**Usage:**
```bash
bastion restart [--port <PORT>]
```

**Options:**
- `--port <PORT>` - Port for proxy (default: 3000)

**Examples:**
```bash
bastion restart
bastion restart --port 8080
```

**Note:** This command stops the daemon, but you need to manually start it again with the original command. A future version will remember the command.

---

## Agent Management

### `bastion list`

List all configured agents.

**Usage:**
```bash
bastion list [-v]
```

**Examples:**
```bash
bastion list
bastion list --verbose
```

**Output:**
```
📋 Configured Agents

Agent: my-trading-bot
  ID: 550e8400-e29b-41d4-a716-446655440000
  Language: python
  Framework: custom
  Status: ✅ Enabled
  Running: ✅ Yes (PID: 12345)

Agent: data-processor
  ID: 660f9511-f3ac-52e5-b827-557766551111
  Language: javascript
  Framework: langchain
  Status: ✅ Enabled
  Running: ⭕ No
```

---

### `bastion config`

Update agent configuration.

**Usage:**
```bash
bastion config [OPTIONS]
```

**Options:**
- `--name <NAME>` - Update agent name
- `--language <LANG>` - Update language
- `--framework <FW>` - Update framework
- `--enabled <BOOL>` - Enable or disable agent

**Examples:**
```bash
# Update name
bastion config --name "Production Trading Bot"

# Disable agent
bastion config --enabled false

# Multiple updates
bastion config --name "New Name" --language rust

# View current config (no options)
bastion config
```

**Output:**
```
✓ Updated name to: Production Trading Bot
✓ Updated enabled to: true

✅ Configuration updated successfully
```

---

## Monitoring & Debugging

### `bastion audit`

View audit log of agent actions.

**Usage:**
```bash
bastion audit [OPTIONS]
```

**Options:**
- `-n, --limit <N>` - Number of entries to show (default: 20)
- `--agent-id <ID>` - Filter by agent ID
- `--blocked-only` - Show only blocked actions

**Examples:**
```bash
# Show last 20 actions
bastion audit

# Show last 100 actions
bastion audit --limit 100

# Show only blocked actions
bastion audit --blocked-only

# Filter by agent
bastion audit --agent-id 550e8400-e29b-41d4-a716-446655440000

# Verbose output with details
bastion audit --verbose
```

**Output:**
```
📊 Audit Log

[2025-01-30T10:30:15Z] ✅ ALLOWED - http_request
  Details: {"method": "GET", "url": "https://api.example.com"}

[2025-01-30T10:30:18Z] 🛑 BLOCKED - http_request
  Details: {"method": "POST", "url": "https://blocked.com"}
  Reason: Domain not in allow list

[2025-01-30T10:30:20Z] 🛑 BLOCKED - http_request
  Reason: Rate limit exceeded (100 requests/minute)
```

---

### `bastion stats`

Show usage statistics.

**Usage:**
```bash
bastion stats [OPTIONS]
```

**Options:**
- `--range <RANGE>` - Time range: `today`, `week`, `month`, `all` (default: `today`)

**Examples:**
```bash
# Today's stats
bastion stats

# This week
bastion stats --range week

# All time
bastion stats --range all

# Verbose with breakdown
bastion stats --range today --verbose
```

**Output:**
```
📊 Usage Statistics (today)

Total Requests: 1,245
Allowed: 1,180
Blocked: 65
Block Rate: 5.22%
```

**Verbose Output:**
```
📊 Usage Statistics (today)

Total Requests: 1,245
Allowed: 1,180
Blocked: 65
Block Rate: 5.22%

Breakdown by action type:
  http_request: 1,200
  file_operation: 45
```

---

### `bastion test`

Test policy enforcement without executing actions (dry-run).

**Usage:**
```bash
bastion test --action-type <TYPE> --url <URL> [OPTIONS]
```

**Options:**
- `--action-type <TYPE>` - Action type (e.g., `http_request`)
- `--url <URL>` - URL or target to test
- `--method <METHOD>` - HTTP method (default: `GET`)

**Examples:**
```bash
# Test GET request
bastion test \
  --action-type http_request \
  --url https://api.example.com

# Test POST request
bastion test \
  --action-type http_request \
  --url https://api.example.com/create \
  --method POST

# Verbose output
bastion test \
  --action-type http_request \
  --url https://blocked.com \
  --verbose
```

**Output (Allowed):**
```
🧪 Testing Policy Enforcement

Action Type: http_request
URL: https://api.example.com
Method: GET

✅ Action would be ALLOWED
```

**Output (Blocked):**
```
🧪 Testing Policy Enforcement

Action Type: http_request
URL: https://blocked.com
Method: GET

🛑 Action would be BLOCKED
```

---

## Configuration & Health

### `bastion validate`

Validate configuration files.

**Usage:**
```bash
bastion validate [-v]
```

**Examples:**
```bash
bastion validate
bastion validate --verbose
```

**Output:**
```
🔍 Validating Configuration

Checking global config...
  ✅ Global config valid
  ✅ API key format correct

Checking agent config...
  ✅ Agent config valid
  Agent ID: 550e8400-e29b-41d4-a716-446655440000

Checking backend connectivity...
  ✅ Backend reachable

==================================================
✅ All checks passed!
```

**Output (Errors):**
```
🔍 Validating Configuration

Checking global config...
  ❌ Global config not found
     Expected: /Users/user/.bastion/config.json
     Run: bastion login

Checking agent config...
  ⚠️  No agent config in current directory
     Run: bastion init

Checking backend connectivity...
  ⚠️  Cannot reach backend
     Make sure it's running: cd backend && npm run dev

==================================================
❌ 1 error(s) found
⚠️  2 warning(s) found
```

---

### `bastion health`

Check connection to Bastion backend.

**Usage:**
```bash
bastion health [-v]
```

**Examples:**
```bash
bastion health
bastion health --verbose
```

**Output (Healthy):**
```
🔍 Checking Bastion backend...
   URL: http://localhost:3000/v1

✅ Backend is healthy
```

**Output (Unreachable):**
```
🔍 Checking Bastion backend...
   URL: http://localhost:3000/v1

❌ Cannot reach backend: Connection refused

Troubleshooting:
  1. Make sure the backend is running:
     cd backend && npm run dev
  2. Check your network connection
  3. Verify the backend URL in your config
```

---

## Quick Reference

| Command | Purpose | Common Usage |
|---------|---------|--------------|
| `bastion login` | Authenticate | `bastion login --key bst_xxx` |
| `bastion init` | Setup agent | `bastion init` |
| `bastion start` | Run agent | `bastion start -- python agent.py` |
| `bastion stop` | Stop daemon | `bastion stop` |
| `bastion status` | Check status | `bastion status` |
| `bastion logs` | View logs | `bastion logs -f` |
| `bastion restart` | Restart daemon | `bastion restart` |
| `bastion list` | List agents | `bastion list` |
| `bastion config` | Update config | `bastion config --name "New Name"` |
| `bastion audit` | View actions | `bastion audit --blocked-only` |
| `bastion stats` | Show metrics | `bastion stats --range week` |
| `bastion test` | Test policies | `bastion test --action-type http_request --url https://api.com` |
| `bastion validate` | Check config | `bastion validate` |
| `bastion health` | Check backend | `bastion health` |

## Next Steps

- [Daemon Management Guide](/cli/daemon-management) - Deep dive into daemon operations
- [Configuration](/cli/configuration) - Advanced configuration options
- [Troubleshooting](/cli/troubleshooting) - Common issues and solutions
