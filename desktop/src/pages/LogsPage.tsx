import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { CheckCircle, XCircle, Search, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

export default function LogsPage() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) { navigate('/login'); return; }

        const fetchLogs = () => {
            api.get<{ logs: any[] }>('/logs', { limit: '50' })
                .then(data => {
                    setLogs(data.logs || []);
                    setError(null);
                })
                .catch(err => {
                    console.error('Failed to fetch logs', err);
                    setError('Could not fetch logs from server');
                })
                .finally(() => setLoading(false));
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-6xl mx-auto p-8">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Forensic Log</h1>
                        <p className="text-zinc-500">Real-time audit trail of agent activity.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-green-400 text-xs mr-3">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                            LIVE
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                            <Search size={14} className="text-zinc-500" />
                            <input type="text" placeholder="Search..." className="bg-transparent border-none text-white outline-none text-sm w-32" />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/50">
                                <th className="px-5 py-3 text-zinc-500 text-sm font-normal">Status</th>
                                <th className="px-5 py-3 text-zinc-500 text-sm font-normal">Request ID</th>
                                <th className="px-5 py-3 text-zinc-500 text-sm font-normal">Type</th>
                                <th className="px-5 py-3 text-zinc-500 text-sm font-normal">Agent</th>
                                <th className="px-5 py-3 text-zinc-500 text-sm font-normal">Payload</th>
                                <th className="px-5 py-3 text-zinc-500 text-sm font-normal">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {error && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-orange-400">
                                            <AlertTriangle size={28} />
                                            <p>{error}</p>
                                            <p className="text-zinc-600 text-sm">Make sure the backend is running.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!error && !loading && logs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-600">
                                        <p>No logs yet. Run an agent with Bastion protection to see activity here.</p>
                                        <code className="text-sm text-blue-400 mt-2 block">bastion start -- python your_agent.py</code>
                                    </td>
                                </tr>
                            )}
                            {!error && logs.map((tx, idx) => (
                                <tr key={tx.id || idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-5 py-3">
                                        <StatusBadge status={tx.decision || 'UNKNOWN'} reason={tx.reason} />
                                    </td>
                                    <td className="px-5 py-3 font-mono text-blue-400 text-sm">
                                        {tx.id ? tx.id.substring(0, 8) + '...' : 'pending'}
                                    </td>
                                    <td className="px-5 py-3 text-sm">{tx.actionType}</td>
                                    <td className="px-5 py-3 text-sm">{tx.agent?.name || tx.agentId || 'Unknown'}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-zinc-400 max-w-[300px] truncate">
                                        {tx.actionData ? JSON.stringify(tx.actionData).substring(0, 40) : '-'}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-zinc-500">
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

function StatusBadge({ status, reason }: { status: string; reason?: string }) {
    if (status === 'ALLOWED' || status === 'Approved') {
        return (
            <div className="flex items-center gap-1.5 text-green-400 text-sm">
                <CheckCircle size={14} />
                <span>Approved</span>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-red-400 text-sm">
                <XCircle size={14} />
                <span>Blocked</span>
            </div>
            {reason && <span className="text-xs text-zinc-600">{reason}</span>}
        </div>
    );
}
