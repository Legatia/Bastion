# Getting Started with Bastion

This guide will get you up and running with Bastion in under 10 minutes.

## Prerequisites

- **Node.js** 18+ (for backend)
- **Rust** 1.70+ (for CLI)
- **PostgreSQL** 14+ (for database)

Quick installs:
```bash
# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# PostgreSQL (Ubuntu)
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## Step 1: Set Up Backend (5 minutes)

### 1.1 Install Dependencies

```bash
cd backend
npm install
```

### 1.2 Configure Database

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

Update the `DATABASE_URL`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bastion"
```

### 1.3 Initialize Database

```bash
# Create database
createdb bastion

# Or if using psql:
psql -U postgres -c "CREATE DATABASE bastion;"

# Push schema to database
npm run db:generate
npm run db:push
```

### 1.4 Create Test User

```bash
npm run db:seed
```

This creates:
- Test user: `test@bastion.sh`
- API key: `bst_demo_xxx` (will be displayed)
- Sample agent and policies

**Save the API key!** You'll need it for the CLI.

### 1.5 Start Backend

```bash
npm run dev
```

You should see:
```
╔══════════════════════════════════════════════╗
║   🛡️  Bastion Protocol Backend API          ║
║   Status: Running                            ║
║   Port: 3000                                 ║
╚══════════════════════════════════════════════╝
```

Test it:
```bash
curl http://localhost:3000/health
# Should return: {"status":"healthy","timestamp":"..."}
```

---

## Step 2: Build CLI (2 minutes)

### 2.1 Build the Binary

```bash
cd ../cli
cargo build --release
```

This takes 1-2 minutes on first build.

### 2.2 Test the CLI

```bash
# Run from the cli directory
cargo run -- --help

# Or copy to PATH
sudo cp target/release/bastion-cli /usr/local/bin/bastion
bastion --help
```

---

## Step 3: Protect Your First Agent (3 minutes)

### 3.1 Login to Bastion

```bash
bastion login
```

For demo, enter any email/password. It will generate an API key.

**Or** use the test key from Step 1.4:
```bash
# Manually create config
mkdir -p ~/.bastion
cat > ~/.bastion/config.json <<EOF
{
  "email": "test@bastion.sh",
  "api_key": "bst_demo_YOUR_KEY_HERE",
  "backend_url": "http://localhost:3000/v1"
}
EOF
```

### 3.2 Initialize Agent Protection

```bash
# Go to your agent directory
cd /path/to/your/agent

# Initialize Bastion
bastion init
```

Answer the prompts:
- Agent name: `my-trading-bot`
- Language: `python`
- Framework: `custom`

This creates `.bastion-agent.json` in your directory.

### 3.3 Run Your Agent with Protection

```bash
bastion start -- python agent.py
```

Or for Node.js:
```bash
bastion start -- node agent.js
```

You'll see:
```
🛡️  Starting Bastion Supervisor

✓ Loaded configuration
✓ Backend: http://localhost:3000/v1
✓ Proxy listening on port: 8080

🚀 Bastion Supervisor active!
   Proxy: http://localhost:8080
   Dashboard: http://localhost:3001

📊 Monitoring agent actions...

🤖 Launching agent: python agent.py
✓ Agent started (PID: 12345)
```

### 3.4 Watch It Work

As your agent makes actions, you'll see:
```
[10:30:15] http_request - GET https://api.example.com
   ✓ ALLOWED

[10:30:22] file_delete - important.db
   🛑 BLOCKED: Critical file protection
```

---

## Step 4: Test with Sample Agent (Optional)

Create a test agent to see Bastion in action:

```bash
# Create test directory
mkdir ~/bastion-test && cd ~/bastion-test

# Create sample Python agent
cat > test_agent.py <<'EOF'
import requests
import time

print("🤖 Test Agent Starting...")

# This should be allowed
print("\n1. Making safe API call...")
response = requests.get("https://httpbin.org/get")
print(f"   Response: {response.status_code}")

time.sleep(1)

# This might be blocked by rate limiting
print("\n2. Making multiple requests...")
for i in range(5):
    response = requests.get("https://httpbin.org/get")
    print(f"   Request {i+1}: {response.status_code}")
    time.sleep(0.5)

print("\n✅ Agent finished")
EOF

# Initialize Bastion
bastion init

# Run with protection
bastion start -- python test_agent.py
```

---

## Step 5: Create Your First Policy

### Via API:

```bash
curl -X POST http://localhost:3000/v1/policies \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spending Limit",
    "description": "Block transactions over $100",
    "type": "SPENDING_LIMIT",
    "config": {
      "max_amount": 100,
      "window": "24h"
    },
    "enabled": true,
    "priority": 10
  }'
```

### Via Database:

```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555 where you can:
- View all tables
- Create/edit policies visually
- See action logs
- Manage users and agents

---

## Step 6: View Logs & Analytics

### Get Recent Logs:

```bash
curl http://localhost:3000/v1/logs?limit=10 \
  -H "X-API-Key: YOUR_API_KEY" | jq
```

### Get Analytics Summary:

```bash
curl http://localhost:3000/v1/analytics/summary \
  -H "X-API-Key: YOUR_API_KEY" | jq
```

### Watch Live Logs:

```bash
# In another terminal
watch -n 1 'curl -s http://localhost:3000/v1/logs?limit=5 \
  -H "X-API-Key: YOUR_API_KEY" | jq ".logs[] | {time: .timestamp, action: .actionType, decision: .decision}"'
```

---

## Troubleshooting

### Backend won't start

**Error: Cannot connect to database**
```bash
# Check if PostgreSQL is running
pg_isready

# Create database if missing
createdb bastion

# Push schema again
cd backend && npm run db:push
```

**Error: Port 3000 already in use**
```bash
# Change port in .env
PORT=3001

# Or kill existing process
lsof -ti:3000 | xargs kill -9
```

### CLI won't build

**Error: Rust not found**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Error: OpenSSL not found (Linux)**
```bash
sudo apt install libssl-dev pkg-config
```

### Agent not intercepted

**Issue: Actions not showing in logs**

1. Check CLI is running: `curl http://localhost:8080/health`
2. Check backend is reachable: `bastion health`
3. Verify environment variables are set:
   ```bash
   echo $HTTP_PROXY
   # Should show: http://localhost:8080
   ```

4. Test direct backend call:
   ```bash
   curl -X POST http://localhost:3000/v1/authorize \
     -H "X-API-Key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"action":{"type":"test","details":{}}}'
   ```

---

## Next Steps

1. **Create Policies** - Add spending limits, rate limits, file protection
2. **Monitor Logs** - Watch what your agent is doing in real-time
3. **Add More Agents** - Run `bastion init` in other agent directories
4. **Connect Dashboard** - (Coming soon) Visual policy builder and monitoring
5. **Deploy to Production** - See `DEPLOYMENT.md` (coming soon)

---

## Quick Reference

### Common Commands

```bash
# Backend
cd backend
npm run dev          # Start development server
npm run db:push      # Update database schema
npm run db:seed      # Create test data
npm run db:studio    # Open database GUI

# CLI
bastion login        # Authenticate
bastion init         # Set up agent
bastion start -- CMD # Run agent with protection
bastion health       # Check backend connection

# Database
psql bastion         # Connect to database
\dt                  # List tables
\d users            # Describe users table
```

### API Endpoints

- `GET /health` - Health check
- `POST /v1/authorize` - Policy evaluation
- `GET /v1/policies` - List policies
- `GET /v1/logs` - Action logs
- `GET /v1/analytics/summary` - Usage metrics

### Environment Variables

```bash
# Backend (.env)
PORT=3000
DATABASE_URL="postgresql://..."
JWT_SECRET="secret"
CORS_ORIGIN="*"

# CLI (auto-configured after login)
~/.bastion/config.json
```

---

## Need Help?

- Check `/backend/README.md` for API documentation
- Check `/BACKEND_DEVELOPMENT_PLAN.md` for architecture details
- Check `/README.md` for project overview
- Open an issue on GitHub (coming soon)

---

**You're all set! Your agents are now protected by Bastion. 🛡️**
