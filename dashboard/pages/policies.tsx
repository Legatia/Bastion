import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Head from 'next/head';
import InteractiveBackground from '../components/InteractiveBackground';
import Link from 'next/link';
import { Shield, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';

import Navbar from '../components/Navbar';


export default function Policies() {
    const [spendLimit, setSpendLimit] = useState('100');
    const [whitelist, setWhitelist] = useState(['api.openai.com']);
    const [isSaved, setIsSaved] = useState(false);
    const [policyId, setPolicyId] = useState<string | null>(null);

    // Load initial policy
    useEffect(() => {
        // For MVP, we just fetch one 'SPENDING_LIMIT' policy if check exists
        api.get<{ policies: any[] }>('/policies')
            .then(data => {
                const p = data.policies.find(p => p.type === 'SPENDING_LIMIT');
                if (p) {
                    setSpendLimit(p.config.max_amount);
                    setPolicyId(p.id);
                }
            })
            .catch(err => console.error("Failed load policies", err));
    }, []);

    const handleSave = () => {
        const payload = {
            name: 'Daily Spending Limit',
            type: 'SPENDING_LIMIT',
            config: { max_amount: parseInt(spendLimit) },
            enabled: true,
            priority: 10
        };

        const req = policyId
            ? api.put(`/policies/${policyId}`, payload)
            : api.post('/policies', payload);

        req.then(() => {
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        }).catch(err => alert("Failed to save policy: " + err.message));
    };

    const addContract = () => setWhitelist([...whitelist, '']);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <Head>
                <title>Policy Builder | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '2rem 4rem', flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <header style={{ marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Configure Security Policy</h1>
                    <p style={{ color: '#889', marginBottom: '2rem' }}>
                        Define the constraints for your AI Agents. These rules are cryptographically signed and enforced in real-time.
                    </p>
                    <p style={{ color: '#889' }}>Defining constraints for <span style={{ color: 'var(--foreground)', fontFamily: 'monospace' }}>Agent-001</span></p>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                    {/* Left Column: Form */}
                    <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        padding: '2rem',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        {/* 1. Spend Limits */}
                        <section style={{ marginBottom: '2.5rem' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ZapIcon /> Daily Spend Limit
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input
                                    type="number"
                                    value={spendLimit}
                                    onChange={(e) => setSpendLimit(e.target.value)}
                                    style={inputStyle}
                                />
                                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#666' }}>USD</span>
                            </div>
                        </section>

                        {/* 2. Data Privacy & DLP */}
                        <section style={{ marginBottom: '2.5rem' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <LockIcon /> Data Loss Prevention (DLP)
                            </h3>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '0.9rem' }}>Block PII Transmission (SSN, Email, Keys)</span>
                                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.5)', accentColor: 'var(--primary)' }} />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px' }}>
                                <span style={{ fontSize: '0.9rem' }}>Require Encrypted Payloads</span>
                                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.5)', accentColor: 'var(--primary)' }} />
                            </div>
                        </section>

                        {/* 3. Contract Whitelist */}
                        <section style={{ marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                    <ShieldIcon /> Approved APIs / Services
                                </h3>
                                <button onClick={addContract} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Plus size={16} /> Add
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {whitelist.map((addr, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            value={addr}
                                            onChange={(e) => {
                                                const newW = [...whitelist];
                                                newW[idx] = e.target.value;
                                                setWhitelist(newW);
                                            }}
                                            style={{ ...inputStyle, fontFamily: 'monospace' }}
                                            placeholder="api.stripe.com"
                                        />
                                        {whitelist.length > 1 && (
                                            <button onClick={() => setWhitelist(whitelist.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Save Action */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                            {isSaved && <span style={{ color: '#0f0', fontWeight: 'bold' }}>Generic Hash Deployed!</span>}
                            <button className="button-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Save size={18} /> Deploy Policy
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Preview / Status */}
                    <div>
                        <div style={{
                            background: 'rgba(255, 0, 60, 0.05)',
                            border: '1px solid var(--accent)',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}>
                            <h4 style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={18} /> Kill Switch Active
                            </h4>
                            <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>
                                If the supervisor detects anomalous behavior, the circuit breaker will trigger immediately.
                            </p>
                        </div>

                        <div style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--card-border)',
                            padding: '1.5rem',
                            borderRadius: '8px'
                        }}>
                            <h4 style={{ margin: '0 0 1rem 0' }}>Policy Hash Preview</h4>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--secondary)', wordBreak: 'break-all' }}>
                                keccak256(
                                <br />&nbsp;&nbsp;spendLimit: {spendLimit},
                                <br />&nbsp;&nbsp;dlpEnabled: true,
                                <br />&nbsp;&nbsp;whitelist: [...]
                                <br />)
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

// Simple internal components to avoid prop drilling complex icons for now
const ZapIcon = () => <span style={{ color: 'var(--primary)' }}>⚡</span>;
const ShieldIcon = () => <span style={{ color: 'var(--secondary)' }}>🛡️</span>;
const LockIcon = () => <span style={{ color: 'var(--accent)' }}>🔒</span>;

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    padding: '12px',
    borderRadius: '4px',
    width: '100%',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s'
};
