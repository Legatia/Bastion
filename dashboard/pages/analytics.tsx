import Head from 'next/head';
import Link from 'next/link';
import { Shield, Activity, Lock, AlertTriangle, Eye, EyeOff, BarChart2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

// Types
interface AnalyticsSummary {
    checksCount: number;
    blockedCount: number;
    activeAgents: number;
    blockRate: string;
}

const ENCRYPTED_LOGS = [
    { id: 1, time: '10:42 AM', type: 'Policy Violation', encrypted: 'aes256:7e8f9a...', decrypted: 'Blocked: Over Spend Limit ($5,000)' },
    { id: 2, time: '09:15 AM', type: 'Signature Check', encrypted: 'aes256:3c4d5e...', decrypted: 'Success: Authorized API Call' },
    { id: 3, time: '08:30 AM', type: 'Data Leak', encrypted: 'aes256:1a2b3c...', decrypted: 'Blocked: Private Keys Pattern Detected' },
    { id: 4, time: 'Yesterday', type: 'Unknown Destination', encrypted: 'aes256:9z8y7x...', decrypted: 'Blocked: Endpoint not in Allowlist' },
];

import { useRouter } from 'next/router';

export default function Analytics() {
    const router = useRouter();
    const [stats, setStats] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDecrypted, setIsDecrypted] = useState(false);
    const [showLogs, setShowLogs] = useState(false); // Kept for compat, though unused

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) {
            router.push('/login');
            return;
        }

        api.get<{ summary: AnalyticsSummary }>('/analytics/summary')
            .then(data => setStats(data.summary))
            .catch(err => {
                console.error("Failed to fetch analytics", err);
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Analytics Dashboard | Bastion Protocol</title>
            </Head>

            {/* Navigation */}
            <Navbar />

            <main style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>

                {/* Header */}
                <header style={{ marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Security Overview</h1>
                    <p style={{ color: '#889' }}>Real-time threat intelligence for your Autonomous Workforce.</p>
                </header>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
                    <StatCard
                        label="Active Agents"
                        value={stats ? stats.activeAgents.toString() : '-'}
                        trend="Online"
                        color="#3b82f6"
                    />
                    <StatCard
                        label="Policy Checks"
                        value={stats ? stats.checksCount.toLocaleString() : '-'}
                        trend="Total Processed"
                        color="#a855f7"
                    />
                    <StatCard
                        label="Threats Blocked"
                        value={stats ? stats.blockedCount.toString() : '-'}
                        trend={stats ? `${stats.blockRate}% Block Rate` : '-'}
                        color="#ef4444"
                    />
                    <StatCard
                        label="System Status"
                        value="OPERATIONAL"
                        trend="100% Uptime"
                        color="#10b981"
                    />
                </div>

                {/* Charts / Visualization Placeholder */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px', padding: '2rem', marginBottom: '4rem', height: '300px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem'
                }}>
                    <BarChart2 size={48} color="#333" />
                    <p style={{ color: '#555' }}>Activity Volume (7 Day)</p>
                    {/* In a real app, use Recharts here. For MVP, this placeholder visualizes the "Tech/Analytics" focus */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px' }}>
                        {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
                            <div key={i} style={{ width: '40px', height: `${h}%`, background: i === 5 ? '#3b82f6' : '#222', borderRadius: '4px' }}></div>
                        ))}
                    </div>
                </div>

                {/* Encrypted Logs Section */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Lock size={20} color={isDecrypted ? "#10b981" : "#888"} />
                            Encrypted Audit Trail
                        </h2>
                        <button
                            onClick={() => setIsDecrypted(!isDecrypted)}
                            style={{
                                background: isDecrypted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.1)',
                                color: isDecrypted ? '#10b981' : '#fff',
                                border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500'
                            }}
                        >
                            {isDecrypted ? <><EyeOff size={16} /> Hide Secrets</> : <><Eye size={16} /> Decrypt Logs</>}
                        </button>
                    </div>

                    <div style={{ background: '#000', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ background: '#111', color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                                <tr>
                                    <th style={{ padding: '1rem' }}>Time</th>
                                    <th style={{ padding: '1rem' }}>Type</th>
                                    <th style={{ padding: '1rem' }}>Data payload</th>
                                    <th style={{ padding: '1rem' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ENCRYPTED_LOGS.map((log) => (
                                    <tr key={log.id} style={{ borderTop: '1px solid #222' }}>
                                        <td style={{ padding: '1rem', color: '#666' }}>{log.time}</td>
                                        <td style={{ padding: '1rem', fontWeight: '500' }}>{log.type}</td>
                                        <td style={{ padding: '1rem', fontFamily: 'monospace', color: isDecrypted ? '#fff' : '#444' }}>
                                            {isDecrypted ? log.decrypted : log.encrypted}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem',
                                                background: log.decrypted.includes('Blocked') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                color: log.decrypted.includes('Blocked') ? '#ef4444' : '#10b981'
                                            }}>
                                                {log.decrypted.includes('Blocked') ? 'BLOCKED' : 'VERIFIED'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!isDecrypted && (
                        <p style={{ marginTop: '1rem', color: '#555', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={14} /> Encrypted audit trails ensure no one (including Bastion) sees your raw data without permission.
                        </p>
                    )}
                </section>

            </main>
        </div>
    );
}

function StatCard({ label, value, trend, color }: { label: string, value: string, trend: string, color: string }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
            padding: '1.5rem', borderRadius: '12px', transition: 'transform 0.2s', cursor: 'default'
        }}>
            <p style={{ color: '#889', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{label}</p>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} />
                {trend}
            </div>
        </div>
    );
}
