import Head from 'next/head';
import Link from 'next/link';
import { Shield, Lock, Zap, Activity } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Head>
        <title>Bastion Protocol | Trustless AI Insurance</title>
        <meta name="description" content="The Immutable Supervisor for the Agent Economy" />
      </Head>

      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem' }}>
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
          ENTERPRISE SECURITY PLATFORM
        </div>

        <h1 style={{ fontSize: '4rem', maxWidth: '800px', lineHeight: '1.1', marginBottom: '1.5rem' }}>
          Immutable Guardrails for <br />
          <span className="gradient-text">Autonomous Intelligence</span>
        </h1>

        <p style={{ fontSize: '1.2rem', color: '#889', maxWidth: '600px', marginBottom: '2rem', lineHeight: '1.6' }}>
          Prevent rogue agent behavior with a programmable policy engine. Bastion acts as a secure firewall and audit layer for your AI workforce.
        </p>

        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem' }}>
          <Link href="/analytics" style={{
            background: '#fff', color: '#000', padding: '1rem 2rem', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem'
          }}>Launch App</Link>
          <Link href="/policies" style={{
            background: 'transparent', color: '#fff', padding: '1rem 2rem', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid rgba(255,255,255,0.2)'
          }}>View Demo</Link>
        </div>

        {/* Quick Start - Install Instructions */}
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '12px',
          padding: '1.5rem 2rem',
          maxWidth: '700px',
          marginBottom: '2rem'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#6ee7b7', marginBottom: '1rem', fontWeight: '600', textAlign: 'left' }}>
            ⚡ INSTALL IN 60 SECONDS
          </div>
          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
            <code style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash
            </code>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#888', textAlign: 'left' }}>
            Then run <code style={{ background: '#000', padding: '2px 8px', borderRadius: '4px', color: '#10b981' }}>bastion init</code> and <code style={{ background: '#000', padding: '2px 8px', borderRadius: '4px', color: '#10b981' }}>bastion start</code>. Works with OpenClaw, LangChain, AutoGPT - any agent.
          </div>
        </div>

        {/* Stats / Social Proof */}
        <div style={{ display: 'flex', gap: '4rem', marginTop: '6rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '3rem' }}>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>$0</div>
            <div style={{ color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>Losses Prevented</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>100%</div>
            <div style={{ color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>Uptime</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>&lt;10ms</div>
            <div style={{ color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>Latency</div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section style={{ padding: '6rem 4rem', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <FeatureCard
            icon={<Lock color="var(--primary)" />}
            title="Dual Signature Security"
            desc="Every action requires a cryptographic signature from your Agent and the Bastion Supervisor. Fully auditable."
          />
          <FeatureCard
            icon={<Activity color="var(--secondary)" />}
            title="Policy Engine"
            desc="Define granular rules: Max Spend, Approved APIs, Velocity Limits. Enforced in real-time."
          />
          <FeatureCard
            icon={<Zap color="var(--accent)" />}
            title="Managed Infrastructure"
            desc="No infrastructure limits. We handle the high-throughput message signing and audit logging."
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
