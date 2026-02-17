import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Shield, Lock, Activity, Monitor, Terminal } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Head>
        <title>Bastion | AI Agent Security</title>
        <meta name="description" content="The security layer for autonomous AI agents. Policy enforcement, on-chain identity, and behavioral monitoring with zero code changes." />
      </Head>

      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{
          background: 'linear-gradient(180deg, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 100%)',
          padding: '10px 20px',
          borderRadius: '20px',
          border: '1px solid rgba(59,130,246,0.2)',
          marginBottom: '2rem',
          color: '#3b82f6',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          AI AGENT SECURITY
        </div>

        <h1 className="hero-title">
          The Security Layer for <br />
          <span className="gradient-text">Autonomous AI Agents</span>
        </h1>

        <p style={{ fontSize: '1.1rem', color: '#889', maxWidth: '600px', marginBottom: '2rem', lineHeight: '1.6', padding: '0 1rem' }}>
          Policy enforcement, on-chain identity, and behavioral monitoring for your AI workforce. Works via HTTP proxy — zero code changes required.
        </p>

        <div className="hero-cta-row">
          <Link href="/analytics" style={{
            background: '#fff', color: '#000', padding: '1rem 2rem', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem'
          }}>Launch App</Link>
          <a href="https://bastion-docs.vercel.app" target="_blank" rel="noopener noreferrer" style={{
            background: 'transparent', color: '#fff', padding: '1rem 2rem', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid rgba(255,255,255,0.2)'
          }}>Documentation</a>
        </div>

        {/* Quick Start - Install Options */}
        <InstallOptions />

        {/* Stats */}
        <div className="hero-stats">
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>9</div>
            <div style={{ color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>Policy Types</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>30+</div>
            <div style={{ color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>DLP Patterns</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>&lt;50ms</div>
            <div style={{ color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>Policy Evaluation</div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section style={{ padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)' }}>
        <div className="features-grid">
          <FeatureCard
            icon={<Shield color="var(--primary)" />}
            title="Policy Engine"
            desc="9 policy types including DLP, rate limits, spending caps, and blocklists. 30 built-in patterns for secrets, API keys, and PII. Works via HTTP proxy — no code changes."
          />
          <FeatureCard
            icon={<Lock color="var(--secondary)" />}
            title="On-chain Identity"
            desc="ERC-8004 agent registration on Avalanche. Verifiable on-chain identity with reputation. CDP-managed wallet for agent transactions."
          />
          <FeatureCard
            icon={<Activity color="var(--accent)" />}
            title="Behavioral Monitoring"
            desc="Statistical baselines per agent. Anomaly detection on request volume, endpoints, and interaction partners. Health scores and drift alerts."
          />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#666', fontSize: '0.9rem' }}>
        <p>Questions? Contact us at <a href="mailto:bastion.feedback@legatia.solutions" style={{ color: '#888', textDecoration: 'none' }}>bastion.feedback@legatia.solutions</a></p>
        <p style={{ marginTop: '0.5rem' }}>&copy; {new Date().getFullYear()} Legatia Solutions. All rights reserved.</p>
      </footer>

    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

function InstallOptions() {
  const [tab, setTab] = useState<'cli' | 'desktop'>('cli');

  const tabStyle = (active: boolean) => ({
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer' as const,
    fontSize: '0.85rem',
    fontWeight: 600,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.5rem',
    background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
    color: active ? '#6ee7b7' : '#666',
    transition: 'all 0.2s',
  });

  return (
    <div style={{
      background: 'rgba(16,185,129,0.1)',
      border: '1px solid rgba(16,185,129,0.3)',
      borderRadius: '12px',
      padding: '1.5rem 2rem',
      maxWidth: '700px',
      marginBottom: '2rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: '600' }}>
          GET STARTED
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '3px' }}>
          <button onClick={() => setTab('cli')} style={tabStyle(tab === 'cli')}>
            <Terminal size={14} /> CLI
          </button>
          <button onClick={() => setTab('desktop')} style={tabStyle(tab === 'desktop')}>
            <Monitor size={14} /> Desktop App
          </button>
        </div>
      </div>

      {tab === 'cli' ? (
        <>
          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
            <code style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash
            </code>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#888', textAlign: 'left' }}>
            Then run <code style={{ background: '#000', padding: '2px 8px', borderRadius: '4px', color: '#10b981' }}>bastion login</code> to authenticate. macOS, Linux, and ARM boards.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.9rem', color: '#ccc', textAlign: 'left', marginBottom: '1rem', lineHeight: '1.6' }}>
            Full GUI with proxy control, agent management, policy editor, and behavioral monitoring. No terminal required.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const }}>
            <a
              href="https://github.com/Legatia/Bastion/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1.2rem', background: '#10b981', color: '#000',
                borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
              }}
            >
              <Monitor size={16} /> Download for Windows (.exe)
            </a>
            <a
              href="https://github.com/Legatia/Bastion/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1.2rem', background: 'transparent', color: '#10b981',
                borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
                border: '1px solid rgba(16,185,129,0.4)',
              }}
            >
              macOS (.dmg)
            </a>
            <a
              href="https://github.com/Legatia/Bastion/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1.2rem', background: 'transparent', color: '#10b981',
                borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
                border: '1px solid rgba(16,185,129,0.4)',
              }}
            >
              Linux (.AppImage)
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, desc }: FeatureCardProps) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      padding: '2rem',
      borderRadius: '12px',
      transition: 'transform 0.2s',
      cursor: 'default'
    }}>
      <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', width: 'fit-content', padding: '10px', borderRadius: '8px' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{title}</h3>
      <p style={{ color: '#889', lineHeight: '1.6' }}>{desc}</p>
    </div>
  );
}
