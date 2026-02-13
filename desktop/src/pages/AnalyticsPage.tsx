import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Activity, Lock, Eye, EyeOff, AlertTriangle, BarChart2 } from 'lucide-react';
import { api } from '../lib/api';

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
    policy?: { name: string; type: string };
}

export default function AnalyticsPage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<AnalyticsSummary | null>(null);
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [isDecrypted, setIsDecrypted] = useState(false);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) { navigate('/login'); return; }

        api.get<{ summary: AnalyticsSummary }>('/analytics/summary')
            .then(data => setStats(data.summary))
            .catch(err => console.error('Failed to fetch analytics', err))
            .finally(() => setLoading(false));

        fetchLogs(false);
    }, []);

    const fetchLogs = async (decrypt: boolean) => {
        setLogsLoading(true);
        try {
            const data = await api.get<{ logs: ActionLog[] }>(`/logs?limit=20&decrypt=${decrypt}`);
            setLogs(data.logs || []);
            setIsDecrypted(decrypt);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLogsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-6xl mx-auto p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">Security Overview</h1>
                    <p className="text-zinc-500">Real-time threat intelligence for your agent workforce.</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4 mb-10">
                    <StatCard label="Active Agents" value={stats ? stats.activeAgents.toString() : '-'} trend="Online" color="text-blue-400" />
                    <StatCard label="Policy Checks" value={stats ? stats.checksCount.toLocaleString() : '-'} trend="Total" color="text-purple-400" />
                    <StatCard label="Threats Blocked" value={stats ? stats.blockedCount.toString() : '-'} trend={stats ? `${stats.blockRate}% block rate` : '-'} color="text-red-400" />
                    <StatCard label="System Status" value="UP" trend="100% Uptime" color="text-green-400" />
                </div>

                {/* Activity Chart Placeholder */}
                <div className="p-8 bg-zinc-900/30 border border-zinc-800 rounded-xl mb-10 flex flex-col items-center justify-center" style={{ height: 240 }}>
                    <BarChart2 size={40} className="text-zinc-700 mb-3" />
                    <p className="text-zinc-600 text-sm mb-4">Activity Volume (7 Day)</p>
                    <div className="flex items-end gap-2" style={{ height: 100 }}>
                        {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
                            <div key={i} className={`w-10 rounded ${i === 5 ? 'bg-blue-500' : 'bg-zinc-800'}`} style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>

                {/* Encrypted Logs */}
                <div className="mb-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Lock size={18} className={isDecrypted ? 'text-green-400' : 'text-zinc-600'} />
                        Encrypted Audit Trail
                    </h2>
                    <button
                        onClick={() => fetchLogs(!isDecrypted)}
                        disabled={logsLoading}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${isDecrypted
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-zinc-800 text-white border border-zinc-700'
                            } ${logsLoading ? 'opacity-50' : ''}`}
                    >
                        {logsLoading ? 'Loading...' : isDecrypted ? <><EyeOff size={14} /> Hide Secrets</> : <><Eye size={14} /> Decrypt Logs</>}
                    </button>
                </div>

                <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead className="bg-zinc-900/80 text-zinc-500 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Data Payload</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr className="border-t border-zinc-800">
                                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 text-sm">
                                        {logsLoading ? 'Loading logs...' : 'No audit logs yet.'}
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => {
                                    const time = new Date(log.timestamp).toLocaleString();
                                    const displayData = isDecrypted
                                        ? (typeof log.actionData === 'string' ? log.actionData : JSON.stringify(log.actionData, null, 2))
                                        : log.actionData;
                                    return (
                                        <tr key={log.id} className="border-t border-zinc-800 hover:bg-zinc-900/30 transition-colors">
                                            <td className="px-4 py-3 text-zinc-600 text-sm">{time}</td>
                                            <td className="px-4 py-3 text-sm font-medium">{log.policy?.type || log.actionType}</td>
                                            <td className={`px-4 py-3 font-mono text-sm max-w-[400px] truncate ${isDecrypted ? 'text-white' : 'text-zinc-700'}`}>
                                                {log.reason || displayData}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${log.decision === 'BLOCKED' ? 'bg-red-500/15 text-red-400' :
                                                    log.decision === 'ERROR' ? 'bg-yellow-500/15 text-yellow-400' :
                                                        'bg-green-500/15 text-green-400'
                                                    }`}>
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
                    <p className="mt-3 text-zinc-600 text-sm flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Logs are encrypted with AES-256-GCM using your API key. Only you can decrypt them.
                    </p>
                )}
            </main>
        </div>
    );
}

function StatCard({ label, value, trend, color }: { label: string; value: string; trend: string; color: string }) {
    return (
        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
            <p className="text-zinc-500 text-sm mb-1">{label}</p>
            <div className="text-3xl font-bold mb-1">{value}</div>
            <div className={`text-xs ${color} flex items-center gap-1`}>
                <Activity size={12} />
                {trend}
            </div>
        </div>
    );
}
