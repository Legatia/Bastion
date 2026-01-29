import Head from 'next/head';
import InteractiveBackground from '../components/InteractiveBackground';
import Link from 'next/link';
import { Shield, CheckCircle, XCircle, Search, Filter } from 'lucide-react';
import { api } from '../lib/api';
import { useEffect, useState } from 'react';

const MOCK_LOGS = [
    { id: 'req_8f92a', actionType: 'API Request', agentId: 'Agent-001', actionData: { url: 'api.stripe.com', method: 'POST /v1/charges' }, decision: 'ALLOWED', timestamp: new Date().toISOString() },
    { id: 'req_1b3d4', actionType: 'Data Export', agentId: 'Agent-001', actionData: { url: 'unknown-host', payload: 'Customer DB Dump' }, decision: 'BLOCKED', reason: 'DLP: SSN Detected', timestamp: new Date().toISOString() },
];

export default function Logs() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = () => {
            api.get<{ logs: any[] }>('/logs', { limit: '50' })
                .then(data => setTransactions(data.logs))
                .catch(err => {
                    console.error("Failed to fetch logs", err);
                    if (transactions.length === 0) {
                        setTransactions(MOCK_LOGS);
                    }
                })
                .finally(() => setLoading(false));
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 2000); // Poll every 2 seconds matching backend speed

        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <InteractiveBackground />
            <Head>
                <title>Transaction Logs | Bastion Protocol</title>
            </Head>

            {/* Navigation */}
            <nav style={{ padding: '2rem 4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield color="var(--primary)" size={28} />
                        BASTION
                    </Link>
                    <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <Link href="/policies" style={{ color: '#889', transition: 'color 0.2s' }}>Policies</Link>
                        <Link href="/logs" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Forensic Logs</Link>
                    </div>
                </div>
            </nav>

            <main style={{ padding: '2rem 4rem', flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Forensic Log</h1>
                        <p style={{ color: '#889' }}>Real-time audit trail of Agent activity.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f0', fontSize: '0.8rem', marginRight: '1rem' }}>
                            <div style={{ width: '8px', height: '8px', background: '#0f0', borderRadius: '50%', boxShadow: '0 0 10px #0f0' }} className="pulse"></div>
                            LIVE
                        </div>
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '8px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={16} color="#889" />
                            <input type="text" placeholder="Search Request..." style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none' }} />
                        </div>
                        <button className="button-outline" style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={16} /> Filter
                        </button>
                    </div>
                </header>

                <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backdropFilter: 'blur(10px)'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '1.5rem', color: '#889', fontWeight: 'normal' }}>Status</th>
                                <th style={{ padding: '1.5rem', color: '#889', fontWeight: 'normal' }}>Request ID</th>
                                <th style={{ padding: '1.5rem', color: '#889', fontWeight: 'normal' }}>Type</th>
                                <th style={{ padding: '1.5rem', color: '#889', fontWeight: 'normal' }}>Agent</th>
                                <th style={{ padding: '1.5rem', color: '#889', fontWeight: 'normal' }}>Payload</th>
                                <th style={{ padding: '1.5rem', color: '#889', fontWeight: 'normal' }}>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx, idx) => (
                                <tr key={tx.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="hover-row">
                                    <td style={{ padding: '1.5rem' }}>
                                        <StatusBadge status={tx.decision || 'UNKNOWN'} reason={tx.reason} />
                                    </td>
                                    <td style={{ padding: '1.5rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{tx.id ? tx.id.substring(0, 8) + '...' : 'pending'}</td>
                                    <td style={{ padding: '1.5rem' }}>{tx.actionType}</td>
                                    <td style={{ padding: '1.5rem' }}>{tx.agent?.name || tx.agentId || 'Unknown'}</td>
                                    <td style={{ padding: '1.5rem', fontFamily: 'monospace' }}>
                                        {/* Extremely simplified visualization of payload */}
                                        {JSON.stringify(tx.actionData).substring(0, 40)}
                                    </td>
                                    <td style={{ padding: '1.5rem', color: '#889' }}>
                                        {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

function StatusBadge({ status, reason }: { status: string, reason?: string }) {
    if (status === 'ALLOWED' || status === 'Approved') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f0' }}>
                <CheckCircle size={16} />
                <span>Approved</span>
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
                <XCircle size={16} />
                <span>Blocked</span>
            </div>
            {reason && <span style={{ fontSize: '0.8rem', color: '#889' }}>{reason}</span>}
        </div>
    );
}
