import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Bastion',
  description: 'Programmable Firewall for AI Agents',

  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'CLI', link: '/cli/overview' },
      { text: 'Policies', link: '/policies/overview' },
      { text: 'API', link: '/api/reference' },
      {
        text: 'Dashboard',
        link: 'http://localhost:3001'
      }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Bastion?', link: '/index' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Quick Start', link: '/quick-start' },
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'How It Works', link: '/concepts/how-it-works' },
          { text: 'Architecture', link: '/concepts/architecture' },
          { text: 'Policies', link: '/concepts/policies' },
          { text: 'Security Model', link: '/concepts/security' },
        ]
      },
      {
        text: 'CLI Reference',
        items: [
          { text: 'Overview', link: '/cli/overview' },
          { text: 'Installation', link: '/cli/installation' },
          { text: 'Commands', link: '/cli/commands' },
          { text: 'Daemon Management', link: '/cli/daemon-management' },
          { text: 'Configuration', link: '/cli/configuration' },
          { text: 'Troubleshooting', link: '/cli/troubleshooting' },
        ]
      },
      {
        text: 'Policy Types',
        items: [
          { text: 'Overview', link: '/policies/overview' },
          { text: 'Spending Limits', link: '/policies/spending-limits' },
          { text: 'Rate Limiting', link: '/policies/rate-limiting' },
          { text: 'File Protection', link: '/policies/file-protection' },
          { text: 'Data Loss Prevention', link: '/policies/dlp' },
          { text: 'Time Windows', link: '/policies/time-windows' },
          { text: 'Allow/Block Lists', link: '/policies/allow-block-lists' },
          { text: 'Custom Webhooks', link: '/policies/webhooks' },
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'Your First Agent', link: '/guides/first-agent' },
          { text: 'Production Deployment', link: '/guides/production' },
          { text: 'Policy Examples', link: '/guides/policy-examples' },
          { text: 'Testing Policies', link: '/guides/testing' },
          { text: 'Monitoring & Alerts', link: '/guides/monitoring' },
        ]
      },
      {
        text: 'Integrations',
        items: [
          { text: 'OpenClaw', link: '/guides/openclaw-integration' },
          { text: 'AutoGPT', link: '/guides/autogpt-integration' },
          { text: 'LangChain', link: '/guides/langchain-integration' },
          { text: 'CrewAI', link: '/guides/crewai-integration' },
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'REST API', link: '/api/reference' },
          { text: 'Authorization Endpoint', link: '/api/authorize' },
          { text: 'Audit Logs', link: '/api/audit' },
          { text: 'Statistics', link: '/api/stats' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/bastion/bastion' }
    ],

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/bastion/bastion/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Bastion Protocol'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  }
})
