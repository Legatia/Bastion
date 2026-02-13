# Troubleshooting

Common issues and their solutions.

## Installation Issues

### Cargo Build Fails

**Problem:**
```bash
error: linking with `cc` failed
```

**Solution:**
Make sure you have a C compiler installed:

```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential

# Fedora/RHEL
sudo dnf install gcc
```

### Command Not Found

**Problem:**
```bash
bastion: command not found
```

**Solution:**
The binary isn't in your PATH. Either:

```bash
# Add cargo bin to PATH
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Or use full path
~/.cargo/bin/bastion --version
```

---

## Configuration Issues

### Not Logged In

**Problem:**
```bash
❌ Not logged in. Run `bastion login` first.
```

**Solution:**
```bash
# Login with your API key
bastion login --key bst_your_api_key
```

Get your API key from: https://bastion.legatia.solutions/settings

### Invalid API Key

**Problem:**
```bash
❌ Invalid API Key format. Key must be at least 10 characters.
```

**Solution:**
1. Check your API key starts with `bst_`
2. Make sure you copied the entire key
3. Generate a new key if needed

### Config File Corrupted

**Problem:**
```bash
Error parsing config file
```

**Solution:**
```bash
# Backup old config
mv ~/.bastion/config.json ~/.bastion/config.json.backup

# Login again
bastion login --key bst_your_api_key
```

---

## Agent Issues

### Agent Not Using Proxy

**Problem:**
Agent makes requests but Bastion doesn't see them.

**Solution:**

#### Check Environment Variables

```python
import os
print(os.environ.get('HTTP_PROXY'))
print(os.environ.get('HTTPS_PROXY'))
# Should print: http://localhost:3000
```

#### Configure Library Explicitly

**Python (requests):**
```python
import requests

proxies = {
    'http': 'http://localhost:3000',
    'https': 'http://localhost:3000',
}

requests.get('https://api.example.com', proxies=proxies)
```

**Node.js (axios):**
```javascript
const axios = require('axios');

axios.get('https://api.example.com', {
  proxy: {
    host: 'localhost',
    port: 3000
  }
});
```

**Python (aiohttp):**
```python
import aiohttp

async with aiohttp.ClientSession() as session:
    async with session.get(
        'https://api.example.com',
        proxy='http://localhost:3000'
    ) as response:
        return await response.text()
```

### Agent Crashes on Start

**Problem:**
```bash
❌ Failed to start agent: No such file or directory
```

**Solution:**
1. Check the command is correct:
   ```bash
   # Wrong
   bastion start -- my-agent.py

   # Correct
   bastion start -- python my-agent.py
   ```

2. Make sure the program is installed:
   ```bash
   which python
   which node
   ```

3. Use full path if needed:
   ```bash
   bastion start -- /usr/bin/python3 agent.py
   ```

---

## Daemon Issues

### Daemon Already Running

**Problem:**
```bash
❌ Daemon already running with PID 12345.
```

**Solution:**
```bash
# Stop existing daemon
bastion stop

# Then start new one
bastion start --daemon -- python agent.py
```

### Daemon Won't Stop

**Problem:**
```bash
⚠️  Process still running. Sending SIGKILL...
```

**Solution:**
```bash
# Find PID
bastion status

# Kill manually if needed
kill -9 <PID>

# Clean up PID file
rm ~/.bastion/*.pid
```

### Stale PID File

**Problem:**
```bash
Status: ⚠️  Stale (process 12345 not running)
```

**Solution:**
```bash
# Clean up automatically
bastion stop

# Or manually
rm ~/.bastion/*.pid
```

### Can't Write PID File

**Problem:**
```bash
Error: Permission denied (os error 13)
```

**Solution:**
```bash
# Check permissions
ls -la ~/.bastion/

# Fix permissions
chmod 755 ~/.bastion
chmod 644 ~/.bastion/*
```

---

## Network Issues

### Port Already in Use

**Problem:**
```bash
Error: Address already in use (os error 48)
```

**Solution:**

#### Use Different Port
```bash
bastion start --port 8080 -- python agent.py
```

#### Find What's Using Port 3000
```bash
# macOS/Linux
lsof -i :3000

# Then kill it
kill -9 <PID>
```

### Backend Not Reachable

**Problem:**
```bash
❌ Cannot reach backend: Connection refused
```

**Solution:**

1. **Check backend URL in your config:**
   ```bash
   cat ~/.bastion/config.json
   ```

   Should show one of:
   - Production: `"backend_url": "https://bastion-gamma.vercel.app/v1"`
   - Development: `"backend_url": "http://localhost:3000/v1"`

2. **If using production backend:**
   ```bash
   curl https://bastion-gamma.vercel.app/health
   # Should return: {"status":"healthy"}
   ```

3. **If using local backend:**
   ```bash
   # Make sure it's running:
   cd backend && npm run dev

   # Test it:
   curl http://localhost:3000/health
   ```

4. **Check firewall:**
   ```bash
   # macOS - allow incoming connections
   System Preferences → Security & Privacy → Firewall

   # Linux
   sudo ufw allow 3000
   ```

### SSL/TLS Errors

**Problem:**
```bash
SSL certificate verify failed
```

**Solution:**

**For development (not recommended for production):**
```python
import requests
requests.get('https://api.example.com', verify=False)
```

**Better solution:**
```bash
# Update CA certificates
# macOS
brew upgrade openssl

# Ubuntu
sudo apt-get update
sudo apt-get install ca-certificates
```

---

## Policy Issues

### All Requests Blocked

**Problem:**
Every request shows:
```bash
🛑 BLOCKED
```

**Solution:**

1. **Check policies in dashboard:**
   - Go to https://bastion.legatia.solutions/policies
   - Look for overly restrictive policies
   - Temporarily disable policies to isolate issue

2. **Check allow list:**
   - Make sure the domains you're calling are in the allow list
   - Add missing domains

3. **Test with CLI:**
   ```bash
   bastion test --action-type http_request --url https://api.example.com
   ```

### Policies Not Enforced

**Problem:**
Requests that should be blocked are allowed.

**Solution:**

1. **Check policy is enabled:**
   - Dashboard → Policies → Verify "Enabled" is checked

2. **Verify policy scope:**
   - Make sure policy applies to your agent
   - Check agent_ids and action_types

3. **Check backend logs:**
   ```bash
   # In backend terminal
   # Look for policy evaluation logs
   ```

### False Positives

**Problem:**
Legitimate requests are being blocked.

**Solution:**

1. **Check audit log:**
   ```bash
   bastion audit --blocked-only --verbose
   ```

2. **Adjust policy parameters:**
   - Increase rate limits
   - Add domains to allow list
   - Tune DLP patterns

3. **Temporarily disable policy:**
   - Test if specific policy is causing issue
   - Adjust and re-enable

---

## Log Issues

### No Logs Showing

**Problem:**
```bash
bastion logs
# Shows nothing
```

**Solution:**

1. **Check if daemon is running:**
   ```bash
   bastion status
   ```

2. **Check log files exist:**
   ```bash
   ls -la ~/.bastion/*.out
   ```

3. **Run in foreground mode:**
   ```bash
   bastion start -- python agent.py
   # Watch output directly
   ```

### Logs Too Large

**Problem:**
Log files are gigabytes in size.

**Solution:**

1. **Rotate logs manually:**
   ```bash
   cd ~/.bastion
   for log in *.out; do
     mv $log $log.old
   done
   ```

2. **Restart daemon:**
   ```bash
   bastion restart
   ```

3. **Clean old logs:**
   ```bash
   rm ~/.bastion/*.out.[3-9]
   ```

---

## Performance Issues

### High Latency

**Problem:**
Requests are much slower with Bastion.

**Solution:**

1. **Check backend latency:**
   ```bash
   bastion health --verbose
   ```

2. **Reduce policy complexity:**
   - Disable expensive DLP policies temporarily
   - Simplify regex patterns

3. **Use local backend:**
   Make sure backend is running locally, not remote.

### High CPU Usage

**Problem:**
CLI process using 100% CPU.

**Solution:**

1. **Check for request loops:**
   - Agent might be retrying failed requests
   - Add exponential backoff

2. **Reduce request rate:**
   - Add delays between requests
   - Implement rate limiting in agent

3. **Restart daemon:**
   ```bash
   bastion restart
   ```

### Memory Leak

**Problem:**
CLI memory usage growing over time.

**Solution:**

1. **Restart daemon regularly:**
   ```bash
   # Cron job to restart daily
   0 0 * * * bastion restart
   ```

2. **Update to latest version:**
   ```bash
   cd cli
   git pull
   cargo install --path .
   ```

---

## Common Error Messages

### `EADDRINUSE`

```bash
Error: Address already in use (os error 48)
```

**Solution:** Port is taken, use `--port` flag or kill process using the port.

### `ECONNREFUSED`

```bash
Error: Connection refused (os error 61)
```

**Solution:** Backend isn't running. Start with `cd backend && npm run dev`.

### `EACCES`

```bash
Error: Permission denied (os error 13)
```

**Solution:** Don't have permission to bind to port. Use port > 1024 or run with sudo (not recommended).

### `QUOTA_EXCEEDED`

```bash
🚫 QUOTA EXCEEDED
```

**Solution:** Upgrade your plan or wait for quota to reset.

---

## Getting More Help

### Verbose Mode

Enable verbose output for debugging:

```bash
bastion --verbose start -- python agent.py
bastion -v logs
bastion -v health
```

### Check Versions

```bash
bastion --version
node --version
npm --version
cargo --version
```

### Validate Configuration

```bash
bastion validate
```

### Report Issues

If you're still stuck:

1. Gather information:
   ```bash
   bastion --version > debug.txt
   bastion validate >> debug.txt
   bastion health --verbose >> debug.txt
   bastion status --verbose >> debug.txt
   ```

2. Check logs:
   ```bash
   bastion logs -n 100 >> debug.txt
   ```

3. Report issue:
   - [GitHub Issues](https://github.com/Legatia/Bastion/issues)
   - Include `debug.txt`
   - Describe what you were trying to do
   - Provide error messages

### Community Support

- 💬 [GitHub Discussions](https://github.com/Legatia/Bastion/discussions)
- 📧 Email: bastion.feedback@legatia.solutions
- 🐦 Twitter: [@bastionprotocol](https://twitter.com/bastionprotocol)

---

## Prevention Tips

### Development
- Use foreground mode for debugging
- Test policies before deploying
- Start with permissive policies
- Monitor audit logs regularly

### Production
- Run in daemon mode
- Set up log rotation
- Monitor backend health
- Have rollback plan
- Test policies in staging first

### Monitoring
- Check `bastion status` daily
- Review `bastion stats` weekly
- Audit blocked actions regularly
- Update policies based on data
