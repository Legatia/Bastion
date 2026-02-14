import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Bastion',
  description: 'Programmable Firewall for AI Agents',
  base: '/docs/',

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
      {
        text: 'Dashboard',
        link: 'https://bastion.legatia.solutions/'
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
        ]
      },
      {
        text: 'Desktop App',
        items: [
          { text: 'Overview', link: '/desktop/overview' },
        ]
      },
      {
        text: 'CLI Reference',
        items: [
          { text: 'Overview', link: '/cli/overview' },
          { text: 'Commands', link: '/cli/commands' },
          { text: 'MoltMind Monitoring', link: '/cli/moltmind' },
          { text: 'On-Chain Identity', link: '/cli/identity' },
          { text: 'Agent Wallet', link: '/cli/wallet' },
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
          { text: 'Pattern Matching', link: '/policies/pattern-matching' },
          { text: 'Custom Webhooks', link: '/policies/webhooks' },
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'Your First Agent', link: '/guides/first-agent' },
        ]
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Agent Integration', link: '/guides/openclaw-integration' },
          { text: 'AutoGPT', link: '/guides/autogpt-integration' },
          { text: 'LangChain', link: '/guides/langchain-integration' },
          { text: 'CrewAI', link: '/guides/crewai-integration' },
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Legatia/Bastion' }
    ],

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/Legatia/Bastion/edit/main/docs/:path',
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
