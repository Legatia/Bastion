# Bastion Desktop Overview

The Bastion Desktop App is a native management suite for Mac, Windows, and Linux. It provides a premium, visual layer over the core Bastion protocol, making it easier to monitor behavioral patterns and manage agent identities.

## Why use the Desktop App?

While the CLI is perfect for production servers and CI/CD pipelines, the Desktop App is designed for:

- **Visual Monitoring**: See real-time "Health Badges" for every running agent.
- **Identity Management**: Verifiably register your agents on the Base blockchain (ERC-8004) via an easy-to-use wizard.
- **Easy Setup**: Configure your agent runtime and Bastion proxy in 60 seconds without touching the terminal.
- **Native Experience**: Deep integration with your OS for alerts, background operation, and tray-based management.

## Installation

1.  **Download**: Get the latest `.dmg` (Mac), `.exe` (Windows), or `.AppImage` (Linux) from our [GitHub Releases](https://github.com/Legatia/Bastion/releases).
2.  **Authenticate**: Log in with your Bastion API key.
3.  **Run with Proxy**: The app automatically manages a local proxy at `http://localhost:3000`. Point your agents to this proxy, or use the integrated **Install Wizard** to auto-configure your environment.

## Key Screens

### Dashboard
View all your agents in one place. Each agent displays its current status, uptime, and **MoltMind Health Score**.

### Identity (ERC-8004)
The Desktop app allows you to create and verify on-chain identities for your agents. This enables other agents and services to trust your agent's origin and history.

### Install Wizard
A step-by-step assistant that:
- Configures your **agent runtime** for Bastion protection.
- Sets up the **Bastion Proxy** for local interception.
- Syncs your **API Keys** and Policies.
