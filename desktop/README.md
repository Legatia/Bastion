# Bastion Desktop App

A one-click desktop application for managing AI agent infrastructure with modular components.

## Features

| Module | Description | Pricing |
|--------|-------------|---------|
| **Agent Runtime** | AI agent process lifecycle manager | Core tier |
| **ERC-8004** | On-chain identity verification | +$5/mo |
| **Bastion Proxy** | Security policy enforcement | +$10/mo |
| **MoltMind** | Cognitive monitoring & health checks | +$15/mo |

## Quick Start

### Prerequisites
- Node.js 18+
- Rust 1.75+
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites/)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Building

```bash
# Build for current platform
npm run tauri build

# Build for specific platform (from CI)
# See .github/workflows/release.yml
```

## Architecture

```
desktop/
├── src/                    # React frontend
│   └── components/
│       └── Dashboard.tsx   # Main control panel
├── src-tauri/
│   └── src/
│       ├── main.rs         # App entry + system tray
│       └── modules/
│           ├── openclaw.rs # Agent runtime process management
│           ├── bastion.rs  # Proxy server integration
│           ├── identity.rs # ERC-8004 verification
│           ├── moltmind.rs # Behavioral monitoring
│           └── billing.rs  # Subscription sync
└── package.json
```

## Key Features

### System Tray
- Minimizes to tray instead of closing
- Left-click: Restore window
- Right-click menu: Show Dashboard, Toggle Proxy, Quit

### Real-time Logs
- Live STDOUT/STDERR from agent runtime
- Color-coded by event type (INFO/ERROR/PROXY)
- Auto-scrolling terminal view

### Cross-Platform
- **macOS**: `.app` bundle with `.dmg` installer
- **Windows**: `.exe` with `.msi` installer
- **Linux**: `.deb` and `.AppImage`

### Auto-Update
- Configured for GitHub Releases
- Requires signing key for production (see below)

## Configuration

### Backend Connection
The app reads config from `~/.bastion/config.json`:
```json
{
  "api_key": "your-api-key",
  "backend_url": "https://bastion-gamma.vercel.app/v1",
  "agent_id": "optional-agent-id"
}
```

### Auto-Updater Setup
Before release, generate a signing key:
```bash
npm run tauri signer generate -- -w ~/.tauri/bastion.key
```

Add the public key to `src-tauri/tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

## Development Notes

### Network Sandboxing
Agent processes run with enforced `HTTP_PROXY` environment variables pointing to the Bastion Proxy (`http://127.0.0.1:3000`). This ensures all outbound traffic is monitored and policy-checked.

### Module State
Each module has its own Tauri-managed state:
- `OpenClawState` - Agent runtime process PID tracking
- `BastionState` - Proxy server handle
- `MoltMindState` - Event buffer (ring buffer, max 100 entries)

## License

MIT
