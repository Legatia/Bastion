# CrewAI Integration

> 🔜 **Coming Soon** - Integration in development

CrewAI integration is planned for Q2 2026.

## Planned Features

- Auto-detection of CrewAI crews
- Per-agent policy configuration
- Inter-agent communication monitoring
- Task execution limits

## Current Workaround

Use the standard proxy approach:

```bash
# Start Bastion
bastion start -d --port 3000

# Set environment
export HTTP_PROXY=http://localhost:3000
export HTTPS_PROXY=http://localhost:3000

# Run CrewAI
python your_crew.py
```

Check back soon for native integration!
