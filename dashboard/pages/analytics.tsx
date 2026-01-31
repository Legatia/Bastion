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

interface ActionLog {
    id: string;
    actionType: string;
    actionData: any;
    decision: 'ALLOWED' | 'BLOCKED' | 'ERROR';
    reason?: string;
    timestamp: string;
    encrypted: boolean;
    policy?: {
        name: string;
        type: string;
    };
}

import { useRouter } from 'next/router';

export default function Analytics() {
    const router = useRouter();
    const [stats, setStats] = useState<AnalyticsSummary | null>(null);
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [isDecrypted, setIsDecrypted] = useState(false);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) {
            router.push('/login');
            return;
        }

        // Fetch analytics summary
        api.get<{ summary: AnalyticsSummary }>('/analytics/summary')
            .then(data => setStats(data.summary))
            .catch(err => {
                console.error("Failed to fetch analytics", err);
            })
            .finally(() => setLoading(false));

        // Fetch logs (encrypted by default)
        fetchLogs(false);
    }, []);

    const fetchLogs = async (decrypt: boolean) => {
        setLogsLoading(true);
        try {
            const data = await api.get<{ logs: ActionLog[] }>(`/logs?limit=20&decrypt=${decrypt}`);
            setLogs(data.logs);
            setIsDecrypted(decrypt);
        } catch (err) {
            console.error("Failed to fetch logs", err);
        } finally {
            setLogsLoading(false);
        }
    };

    const toggleDecryption = () => {
        fetchLogs(!isDecrypted);
    };

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
                            onClick={toggleDecryption}
                            disabled={logsLoading}
                            style={{
                                background: isDecrypted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.1)',
                                color: isDecrypted ? '#10b981' : '#fff',
                                border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: logsLoading ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500',
                                opacity: logsLoading ? 0.5 : 1
                            }}
                        >
                            {logsLoading ? 'Loading...' : isDecrypted ? <><EyeOff size={16} /> Hide Secrets</> : <><Eye size={16} /> Decrypt Logs</>}
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
                                {logs.length === 0 ? (
                                    <tr style={{ borderTop: '1px solid #222' }}>
                                        <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                                            {logsLoading ? 'Loading logs...' : 'No audit logs yet. Logs will appear when actions are evaluated.'}
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const time = new Date(log.timestamp).toLocaleString();
                                        const displayData = isDecrypted
                                            ? (typeof log.actionData === 'string' ? log.actionData : JSON.stringify(log.actionData, null, 2))
                                            : log.actionData;

                                        return (
                                            <tr key={log.id} style={{ borderTop: '1px solid #222' }}>
                                                <td style={{ padding: '1rem', color: '#666', fontSize: '0.85rem' }}>{time}</td>
                                                <td style={{ padding: '1rem', fontWeight: '500' }}>
                                                    {log.policy?.type || log.actionType}
                                                </td>
                                                <td style={{
                                                    padding: '1rem',
                                                    fontFamily: 'monospace',
                                                    color: isDecrypted ? '#fff' : '#444',
                                                    fontSize: '0.85rem',
                                                    maxWidth: '400px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {log.reason || displayData}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{
                                                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem',
                                                        background: log.decision === 'BLOCKED' ? 'rgba(239, 68, 68, 0.2)' :
                                                                   log.decision === 'ERROR' ? 'rgba(245, 158, 11, 0.2)' :
                                                                   'rgba(16, 185, 129, 0.2)',
                                                        color: log.decision === 'BLOCKED' ? '#ef4444' :
                                                              log.decision === 'ERROR' ? '#f59e0b' :
                                                              '#10b981'
                                                    }}>
                                                        {log.decision}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!isDecrypted && logs.length > 0 && (
                        <p style={{ marginTop: '1rem', color: '#555', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={14} /> Logs are encrypted with AES-256-GCM using your API key. Only you can decrypt them.
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
