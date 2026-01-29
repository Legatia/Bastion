import Head from 'next/head';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { Shield, Key, Copy, Check, User } from 'lucide-react';

export default function Profile() {
    const [apiKey, setApiKey] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (key) setApiKey(key);
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Profile | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
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
                                <p style={{ fontSize: '0.9rem', color: '#bfdbfe', margin: 0 }}>
                                    <strong>Quick Start:</strong> Run <code>bastion login --key {apiKey.substring(0, 8)}...</code> in your terminal.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
