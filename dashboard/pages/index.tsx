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
        <link rel="icon" href="/favicon.ico" />
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

        <p style={{ fontSize: '1.2rem', color: '#889', maxWidth: '600px', marginBottom: '3rem', lineHeight: '1.6' }}>
          Prevent rogue agent behavior with a programmable policy engine. Bastion acts as a secure firewall and audit layer for your AI workforce.
        </p>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link href="/analytics" style={{
            background: '#fff', color: '#000', padding: '1rem 2rem', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem'
          }}>Launch App</Link>
          <Link href="/policies" style={{
            background: 'transparent', color: '#fff', padding: '1rem 2rem', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid rgba(255,255,255,0.2)'
          }}>View Demo</Link>
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
