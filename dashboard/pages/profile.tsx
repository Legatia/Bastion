import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { Shield, Key, Copy, Check, User, Zap, Users, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';

interface UsageSummary {
    tier: string;
    agents: { current: number; max: number };
    dailyChecks: { current: number; max: number };
}

export default function Profile() {
    const router = useRouter();
    const [apiKey, setApiKey] = useState('');
    const [copied, setCopied] = useState(false);
    const [usage, setUsage] = useState<UsageSummary | null>(null);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) {
            router.push('/login');
            return;
        }
        setApiKey(key);

        // Fetch usage summary
        api.get<UsageSummary>('/usage')
            .then(data => setUsage(data))
            .catch(err => console.error("Failed to fetch usage", err));
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatLimit = (val: number) => val === -1 ? '∞' : val.toLocaleString();

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Profile | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '4rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
                <header style={{ marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1rem' }}>
                        <div style={{ padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                            <User size={32} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Account Settings</h1>
                            <p style={{ color: '#a1a1aa', marginTop: '4px' }}>Manage your credentials and subscription</p>
                        </div>
                    </div>
                </header>

                <div style={{ display: 'grid', gap: '2rem' }}>

                    {/* Tier & Usage Section */}
                    {usage && (
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            padding: '2rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                <Zap size={20} color="#a855f7" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Subscription & Usage</h2>
                            </div>

                            <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                {/* Tier Badge */}
                                <div style={{ background: '#000', padding: '1.25rem', borderRadius: '12px', border: '1px solid #27272a', textAlign: 'center' }}>
                                    <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem' }}>PLAN</p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a855f7' }}>{usage.tier}</p>
                                </div>

                                {/* Agents Usage */}
                                <div style={{ background: '#000', padding: '1.25rem', borderRadius: '12px', border: '1px solid #27272a', textAlign: 'center' }}>
                                    <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <Users size={14} /> AGENTS
                                    </p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                        {usage.agents.current} / {formatLimit(usage.agents.max)}
                                    </p>
                                </div>

                                {/* Daily Checks */}
                                <div style={{ background: '#000', padding: '1.25rem', borderRadius: '12px', border: '1px solid #27272a', textAlign: 'center' }}>
                                    <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <BarChart3 size={14} /> TODAY CHECKS
                                    </p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                        {usage.dailyChecks.current.toLocaleString()} / {formatLimit(usage.dailyChecks.max)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* API Key Section */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '2rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                            <Key size={20} color="#fbbf24" />
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>API Credentials</h2>
                        </div>

                        <p style={{ color: '#a1a1aa', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
                            Use this key to authenticate your local Bastion CLI. Keep it secret.
                        </p>

                        <div style={{
                            background: '#000',
                            padding: '1.25rem',
                            borderRadius: '8px',
                            border: '1px solid #27272a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            position: 'relative'
                        }}>
                            <code style={{
                                fontFamily: 'monospace',
                                color: apiKey ? '#22c55e' : '#666',
                                fontSize: '1rem'
                            }}>
                                {apiKey || 'No API Key found. Please log in.'}
                            </code>

                            {apiKey && (
                                <button
                                    onClick={handleCopy}
                                    style={{
                                        background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        color: copied ? '#22c55e' : '#fff',
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy Key</>}
                                </button>
                            )}
                        </div>

                        {apiKey && (
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                                <p style={{ fontSize: '0.9rem', color: '#bfdbfe', margin: 0, marginBottom: '0.5rem' }}>
                                    <strong>Installation Guide:</strong>
                                </p>
                                <ol style={{ fontSize: '0.85rem', color: '#bfdbfe', margin: 0, paddingLeft: '1.25rem', lineHeight: '1.8' }}>
                                    <li>Install: <code style={{ background: '#000', padding: '2px 6px', borderRadius: '4px', color: '#10b981' }}>curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash</code></li>
                                    <li>Login: <code style={{ background: '#000', padding: '2px 6px', borderRadius: '4px', color: '#10b981' }}>bastion login</code> (paste your API key above)</li>
                                </ol>
                            </div>
                        )}
                    </div>

                    {/* Integrations Section */}
                    {apiKey && (
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            padding: '2rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                <Shield size={20} color="#10b981" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Agent Integrations</h2>
                            </div>

                            <p style={{ color: '#a1a1aa', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                Protect your agents with one command. No code changes required.
                            </p>

                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {/* Universal Setup */}
                                <div style={{
                                    background: '#000',
                                    padding: '1.5rem',
                                    borderRadius: '12px',
                                    border: '1px solid #27272a'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, marginBottom: '0.5rem' }}>🌐 Universal Proxy Setup</h3>
                                            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>Works with all agents via HTTP proxy</p>
                                        </div>
                                        <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                                            READY
                                        </span>
                                    </div>
                                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                                        <code style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', display: 'block' }}>
                                            export HTTP_PROXY=http://localhost:3000
                                        </code>
                                    </div>
                                    <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: 0 }}>
                                        After running <code style={{ background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#10b981' }}>bastion start</code>, configure your agent to use localhost:3000 as HTTP proxy
                                    </p>
                                </div>

                                {/* Node.js / TypeScript Agents */}
                                <div style={{
                                    background: '#000',
                                    padding: '1.5rem',
                                    borderRadius: '12px',
                                    border: '1px solid #27272a'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, marginBottom: '0.5rem' }}>🟢 Node.js / TypeScript Agents</h3>
                                            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>Works with any Node-based agent framework</p>
                                        </div>
                                        <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                                            READY
                                        </span>
                                    </div>
                                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                                        <code style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', display: 'block' }}>
                                            HTTP_PROXY=http://localhost:3000 node agent.js
                                        </code>
                                    </div>
                                </div>

                                {/* LangChain/Python */}
                                <div style={{
                                    background: '#000',
                                    padding: '1.5rem',
                                    borderRadius: '12px',
                                    border: '1px solid #27272a'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, marginBottom: '0.5rem' }}>🐍 Python Agents (LangChain, AutoGPT)</h3>
                                            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>Set proxy in your code</p>
                                        </div>
                                        <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                                            READY
                                        </span>
                                    </div>
                                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                                        <code style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', display: 'block' }}>
                                            os.environ["HTTP_PROXY"] = "http://localhost:3000"
                                        </code>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                                <p style={{ fontSize: '0.9rem', color: '#6ee7b7', margin: 0 }}>
                                    📚 <strong>Full Guide:</strong> View detailed integration docs at{' '}
                                    <a href="https://github.com/Legatia/Bastion#quick-start" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>
                                        GitHub
                                    </a>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
