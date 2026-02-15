import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AgentHealthBadge from '../components/AgentHealthBadge';
import CognitiveAlertsPanel from '../components/CognitiveAlertsPanel';
import VerifyAgentModal from '../components/VerifyAgentModal';
import { Bot, Plus, Trash2, Activity, Shield, Wallet, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';

interface Agent {
    id: string;
    name: string;
    description?: string;
    status: string;
    lastSeenAt?: string;
    createdAt: string;
    cdpWalletAddress?: string;
    onchainId?: string;
    registryChain?: string;
    ownerAddress?: string;
}

interface HealthData {
    score: number | null;
    status: 'ready' | 'computing' | 'insufficient_data';
    flags?: string[];
}

interface CognitiveAlert {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metric: string;
    message: string;
    driftScore: number;
    acknowledged: boolean;
    createdAt: string;
}

interface WalletData {
    address: string;
    network: string;
    explorerUrl?: string;
    balances: { asset: string; amount: string }[];
}

export default function AgentsPage() {
    const navigate = useNavigate();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [creating, setCreating] = useState(false);
    const [healthMap, setHealthMap] = useState<Record<string, HealthData>>({});
    const [alertsMap, setAlertsMap] = useState<Record<string, CognitiveAlert[]>>({});
    const [walletMap, setWalletMap] = useState<Record<string, WalletData>>({});
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
    const [verifyingAgent, setVerifyingAgent] = useState<Agent | null>(null);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) { navigate('/login'); return; }
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const data = await api.get<{ agents: Agent[] }>('/agents');
            setAgents(data.agents || []);
            // Fetch health + alerts for each agent
            for (const agent of (data.agents || [])) {
                fetchHealth(agent.id);
                fetchAlerts(agent.id);
            }
        } catch (err) {
            console.error('Failed to fetch agents', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHealth = async (agentId: string) => {
        try {
            const data = await api.get<HealthData>(`/agents/${agentId}/health`);
            setHealthMap(prev => ({ ...prev, [agentId]: data }));
        } catch {
            setHealthMap(prev => ({ ...prev, [agentId]: { score: null, status: 'insufficient_data' } }));
        }
    };

    const fetchAlerts = async (agentId: string) => {
        try {
            const data = await api.get<{ alerts: CognitiveAlert[] }>(`/agents/${agentId}/alerts`);
            setAlertsMap(prev => ({ ...prev, [agentId]: data.alerts || [] }));
        } catch {
            // PRO-only, ignore
        }
    };

    const fetchWallet = async (agentId: string) => {
        try {
            const data = await api.get<WalletData>(`/agents/${agentId}/wallet?network=base`);
            setWalletMap(prev => ({ ...prev, [agentId]: data }));
        } catch {
            // ignore
        }
    };

    const createAgent = async () => {
        if (!name.trim()) return;
        setCreating(true);
        try {
            await api.post('/agents', { name: name.trim(), description: desc.trim() || undefined });
            setName(''); setDesc('');
            fetchAgents();
        } catch (err) {
            console.error('Failed to create agent', err);
        } finally {
            setCreating(false);
        }
    };

    const deleteAgent = async (id: string) => {
        if (!confirm('Delete this agent? This cannot be undone.')) return;
        try {
            await api.delete(`/agents/${id}`);
            fetchAgents();
        } catch (err) {
            console.error('Failed to delete agent', err);
        }
    };

    const runAnalysis = async (agentId: string) => {
        try {
            await api.post(`/agents/${agentId}/analyze`, { windowHours: 24 });
            fetchHealth(agentId);
            fetchAlerts(agentId);
        } catch (err) {
            console.error('Analysis failed', err);
        }
    };

    const handleAlertAcknowledge = (agentId: string, alertId: string) => {
        setAlertsMap(prev => ({
            ...prev,
            [agentId]: (prev[agentId] || []).map(a => a.id === alertId ? { ...a, acknowledged: true } : a),
        }));
    };

    const toggleExpand = (agentId: string) => {
        if (expandedAgent === agentId) {
            setExpandedAgent(null);
        } else {
            setExpandedAgent(agentId);
            if (!walletMap[agentId]) fetchWallet(agentId);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-400';
            case 'inactive': return 'text-zinc-500';
            case 'error': return 'text-red-400';
            default: return 'text-blue-400';
        }
    };

    const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-6xl mx-auto p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">Agent Management</h1>
                    <p className="text-zinc-500">Create, monitor, and manage your AI agents.</p>
                </div>

                {/* Create Agent */}
                <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl mb-8">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus size={18} /> New Agent</h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Agent name" className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 text-sm" />
                        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 text-sm" />
                    </div>
                    <button onClick={createAgent} disabled={creating || !name.trim()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer">
                        {creating ? 'Creating...' : 'Create Agent'}
                    </button>
                </div>

                {/* Agents List */}
                {loading ? (
                    <p className="text-zinc-600 text-center py-8">Loading agents...</p>
                ) : agents.length === 0 ? (
                    <p className="text-zinc-600 text-center py-8">No agents yet. Create one above.</p>
                ) : (
                    <div className="space-y-4">
                        {agents.map(agent => {
                            const health = healthMap[agent.id];
                            const alerts = alertsMap[agent.id] || [];
                            const wallet = walletMap[agent.id];
                            const isExpanded = expandedAgent === agent.id;
                            const activeAlerts = alerts.filter(a => !a.acknowledged).length;

                            return (
                                <div key={agent.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
                                    {/* Agent Header */}
                                    <div className="p-5 flex items-center gap-4">
                                        <div className="p-2 bg-blue-500/10 rounded-lg flex-shrink-0">
                                            <Bot size={20} className="text-blue-400" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold">{agent.name}</span>
                                                <span className={`text-xs ${getStatusColor(agent.status)} flex items-center gap-1`}>
                                                    <Activity size={10} /> {agent.status}
                                                </span>
                                                {agent.onchainId && (
                                                    <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Shield size={10} /> #{agent.onchainId}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-zinc-600">
                                                <span className="font-mono">{agent.id.slice(0, 12)}...</span>
                                                {agent.cdpWalletAddress && (
                                                    <span className="flex items-center gap-1"><Wallet size={10} /> {truncateAddress(agent.cdpWalletAddress)}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Health Badge */}
                                        {health && (
                                            <AgentHealthBadge
                                                score={health.score}
                                                status={health.status}
                                                flags={health.flags}
                                                size="sm"
                                            />
                                        )}

                                        {/* Alert count badge */}
                                        {activeAlerts > 0 && (
                                            <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full font-medium">
                                                {activeAlerts} alert{activeAlerts > 1 ? 's' : ''}
                                            </span>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {!agent.onchainId && (
                                                <button
                                                    onClick={() => setVerifyingAgent(agent)}
                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                                                    title="Register On-Chain"
                                                >
                                                    <Shield size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => runAnalysis(agent.id)}
                                                className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                                                title="Run Drift Analysis"
                                            >
                                                <BarChart3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => toggleExpand(agent.id)}
                                                className="p-2 text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                                                title={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                            <button
                                                onClick={() => deleteAgent(agent.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                                                title="Delete Agent"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-zinc-800 p-5 grid grid-cols-2 gap-6">
                                            {/* Left: Wallet + Identity */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                                                    <Wallet size={14} /> CDP Wallet
                                                </h4>
                                                {wallet ? (
                                                    <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-zinc-500">Address</span>
                                                            <span className="font-mono text-xs">{truncateAddress(wallet.address)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-zinc-500">Network</span>
                                                            <span>{wallet.network}</span>
                                                        </div>
                                                        {wallet.balances.length > 0 ? (
                                                            wallet.balances.map((b, i) => (
                                                                <div key={i} className="flex justify-between text-sm">
                                                                    <span className="text-zinc-500">{b.asset}</span>
                                                                    <span>{b.amount}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-zinc-600">No balances</p>
                                                        )}
                                                        {wallet.explorerUrl && (
                                                            <a href={wallet.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                                                                View on Explorer →
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : agent.cdpWalletAddress ? (
                                                    <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                                                        <span className="font-mono text-xs text-zinc-500">{agent.cdpWalletAddress}</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-zinc-600">No wallet provisioned</p>
                                                )}

                                                {/* On-chain Identity */}
                                                {agent.onchainId && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-1.5 mb-2">
                                                            <Shield size={14} /> On-Chain Identity
                                                        </h4>
                                                        <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-zinc-500">ID</span>
                                                                <span>#{agent.onchainId}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-zinc-500">Chain</span>
                                                                <span>{agent.registryChain}</span>
                                                            </div>
                                                            {agent.ownerAddress && (
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-zinc-500">Owner</span>
                                                                    <span className="font-mono text-xs">{truncateAddress(agent.ownerAddress)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Alerts */}
                                            <div>
                                                <CognitiveAlertsPanel
                                                    agentId={agent.id}
                                                    alerts={alerts}
                                                    onAcknowledge={(alertId) => handleAlertAcknowledge(agent.id, alertId)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Verify Modal */}
                {verifyingAgent && (
                    <VerifyAgentModal
                        agent={verifyingAgent}
                        onClose={() => setVerifyingAgent(null)}
                        onSuccess={() => fetchAgents()}
                    />
                )}
            </main>
        </div>
    );
}
