# AutoGPT Integration

> 🚧 **Beta** - Manual setup currently available. Full auto-configuration coming soon.

AutoGPT integration with Bastion requires proxy environment configuration.

## Manual Setup

### 1. Install and Login to Bastion

```bash
bastion login --key your_api_key
```

### 2. Start Bastion Proxy

```bash
bastion start -d --port 3000
```

### 3. Configure AutoGPT Environment

Set environment variables before running AutoGPT:

```bash
export HTTP_PROXY=http://localhost:3000
export HTTPS_PROXY=http://localhost:3000
export BASTION_ENABLED=true
```

### 4. Run AutoGPT

```bash
python -m autogpt
```

All HTTP/HTTPS requests will now be routed through Bastion for policy enforcement.

## Coming Soon

Auto-configuration via:

```bash
bastion enable --agent autogpt
```

This will automatically modify AutoGPT's configuration files.

## Policy Recommendations

For AutoGPT, we recommend:
- **Spending Limits**: $100/day max
- **Rate Limiting**: 60 requests/minute
- **DLP**: Enable to prevent API key leakage
- **File Protection**: Protect critical system directories

[Create policies in Dashboard →](https://bastion.legatia.solutions/policies)
