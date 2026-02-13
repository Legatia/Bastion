# MoltMind Behavioral Monitoring

MoltMind is Bastion's behavioral analysis engine. It goes beyond simple "Allow/Block" firewalls by analyzing the *intent* and *pattern* of your agent's interactions over time.

## Subcommands

The CLI provides a dedicated `moltmind` module to interact with the monitoring engine.

### `bastion moltmind health`
Get the current health score for your agent. Scores range from 0-100.
- **90-100**: Healthy. Agent is operating within normal baseline.
- **70-89**: Warning. Minor deviations detected.
- **<70**: Critical. Significant behavioral drift detected.

### `bastion moltmind alerts`
List recent cognitive alerts. Alerts are triggered when an agent's requested action deviates significantly from its historical baseline.

### `bastion moltmind baseline`
View the current behavioral baseline for the agent. This includes expected domain patterns, request frequency, and typical payload structures.

### `bastion moltmind analyze`
Manually trigger a drift analysis. This compares the last 24 hours of activity against the primary baseline to identify emerging risks.

## How it Works

MoltMind uses statistical anomaly detection to build a map of "normal" behavior for your agent's specific role (e.g., a "Trading Bot" has a different baseline than a "Customer Support Bot").

When the agent attempts an action that is statistically improbable based on its history and configured category, MoltMind triggers an alert or blocks the action entirely depending on your policy settings.
