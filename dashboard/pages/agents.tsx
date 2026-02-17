import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import VerifyAgentModal from '../components/VerifyAgentModal';
import AgentHealthBadge from '../components/AgentHealthBadge';
import CognitiveAlertsPanel from '../components/CognitiveAlertsPanel';
import { Bot, Plus, Trash2, Activity, AlertCircle, Shield, CheckCircle, Wallet } from 'lucide-react';
import { api } from '../lib/api';

interface Agent {
    id: string;
    name: string;
    description?: string;
    status: string;
    lastSeenAt?: string;
    createdAt: string;
    // CDP Wallet
    cdpWalletAddress?: string;
    // ERC-8004 fields
    onchainId?: string;
    registryChain?: string;
    ownerAddress?: string;
}

interface TierStatus {
    tier: string;
    openclawPurchased: boolean;
    hasSubscription: boolean;
    features: string[];
    limits: { maxAgents: number; maxDailyChecks: number };
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

export default function Agents() {
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAgentName, setNewAgentName] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState('');
    const [verifyingAgent, setVerifyingAgent] = useState<Agent | null>(null);
    const [healthScores, setHealthScores] = useState<Record<string, { score: number; status: string; flags: string[] }>>({});
    const [tierStatus, setTierStatus] = useState<TierStatus | null>(null);
    const [agentAlerts, setAgentAlerts] = useState<Record<string, CognitiveAlert[]>>({});

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) {
            router.push('/login');
            return;
        }
        fetchAgents();
        api.get<TierStatus>('/modules')
            .then(data => setTierStatus(data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!tierStatus?.features?.includes('MOLTMIND_FULL') || agents.length === 0) return;
        agents.forEach(agent => {
            api.get<{ alerts: CognitiveAlert[] }>(`/agents/${agent.id}/alerts`)
                .then(data => {
                    setAgentAlerts(prev => ({ ...prev, [agent.id]: data.alerts }));
                })
                .catch(() => {});
        });
    }, [agents, tierStatus]);

    const fetchAgents = () => {
        api.get<{ agents: Agent[] }>('/agents')
            .then(data => {
                setAgents(data.agents);
                // Fetch health for each agent
                data.agents.forEach(agent => fetchHealth(agent.id));
            })
            .catch(err => console.error("Failed to fetch agents", err))
            .finally(() => setLoading(false));
    };

    const fetchHealth = async (agentId: string) => {
        try {
            const health = await api.get<{ score: number; status: string; flags: string[] }>(`/agents/${agentId}/health`);
            setHealthScores(prev => ({ ...prev, [agentId]: health }));
        } catch {
            // Health not available yet
        }
    };

    const createAgent = async () => {
        if (!newAgentName.trim()) return;
        setError('');

        try {
            await api.post('/agents', { name: newAgentName, description: 'Created from Dashboard' });
            setNewAgentName('');
            setShowForm(false);
            fetchAgents();
        } catch (err: any) {
            if (err.message.includes('403')) {
                setError('Agent limit reached. Upgrade your plan to add more agents.');
            } else {
                setError(err.message);
            }
        }
    };

    const deleteAgent = async (id: string) => {
        if (!confirm('Delete this agent?')) return;
        try {
            await api.delete(`/agents/${id}`);
            fetchAgents();
        } catch (err: any) {
            alert('Failed to delete agent: ' + err.message);
        }
    };

    const handleAlertAcknowledge = (agentId: string, alertId: string) => {
        setAgentAlerts(prev => ({
            ...prev,
            [agentId]: (prev[agentId] || []).map(a =>
                a.id === alertId ? { ...a, acknowledged: true } : a
            ),
        }));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#22c55e';
            case 'INACTIVE': return '#888';
            case 'BLOCKED': return '#ef4444';
            default: return '#888';
        }
    };

    const truncateAddress = (addr: string) => {
        if (addr.length <= 10) return addr;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Agents | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Bot size={28} color="#3b82f6" /> Agents
                        </h1>
                        <p style={{ color: '#a1a1aa', marginTop: '8px' }}>Manage your AI agents monitored by Bastion</p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        style={{
                            background: '#3b82f6', color: '#fff', border: 'none',
                            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600'
                        }}
                    >
                        <Plus size={18} /> New Agent
                    </button>
                </header>

                {/* Create Form */}
                {showForm && (
                    <div style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0' }}>Create New Agent</h3>
                        {error && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <input
                                type="text"
                                placeholder="Agent name (e.g., Data-Analyst-1)"
                                value={newAgentName}
                                onChange={(e) => setNewAgentName(e.target.value)}
                                style={{
                                    flex: 1, background: '#000', border: '1px solid #333',
                                    padding: '12px', borderRadius: '8px', color: '#fff', outline: 'none'
                                }}
                            />
                            <button
                                onClick={createAgent}
                                style={{
                                    background: '#22c55e', color: '#fff', border: 'none',
                                    padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
                                }}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                )}

                {/* Agents List */}
                {loading ? (
                    <p style={{ color: '#888' }}>Loading agents...</p>
                ) : agents.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '4rem 2rem',
                        background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                        <Bot size={48} color="#333" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ color: '#888', margin: '0 0 0.5rem 0' }}>No agents yet</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem' }}>Create your first agent to start monitoring</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {agents.map(agent => (
                            <div key={agent.id}>
                                <div className="agent-card-inner" style={{
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px', padding: '1.5rem',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getStatusColor(agent.status) }} />
                                        <div>
                                            <h4 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {agent.name}
                                                {healthScores[agent.id] && (
                                                    <AgentHealthBadge
                                                        score={healthScores[agent.id].score}
                                                        status={healthScores[agent.id].status as any}
                                                        flags={healthScores[agent.id].flags}
                                                        size="sm"
                                                    />
                                                )}
                                            </h4>
                                            <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                                                ID: {agent.id.substring(0, 8)}... • Created {new Date(agent.createdAt).toLocaleDateString()}
                                            </p>
                                            {agent.cdpWalletAddress && (
                                                <p style={{ color: '#888', fontSize: '0.8rem', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Wallet size={12} />
                                                    <a
                                                        href={`https://snowtrace.io/address/${agent.cdpWalletAddress}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#3b82f6', textDecoration: 'none' }}
                                                    >
                                                        {truncateAddress(agent.cdpWalletAddress)}
                                                    </a>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="agent-card-actions">
                                        {agent.onchainId ? (
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                                                background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
                                                display: 'flex', alignItems: 'center', gap: '4px'
                                            }}>
                                                <CheckCircle size={12} /> Verified #{agent.onchainId}
                                            </span>
                                        ) : !tierStatus?.features?.includes('ERC8004_DAILY') ? (
                                            <Link
                                                href="/billing"
                                                style={{
                                                    background: 'rgba(136,136,136,0.1)', color: '#888', border: '1px solid rgba(136,136,136,0.3)',
                                                    padding: '6px 12px', borderRadius: '6px', fontWeight: '600',
                                                    fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px',
                                                    textDecoration: 'none', cursor: 'pointer',
                                                }}
                                            >
                                                <Shield size={14} /> Upgrade to Verify
                                            </Link>
                                        ) : (
                                            <button
                                                onClick={() => setVerifyingAgent(agent)}
                                                style={{
                                                    background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)',
                                                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
                                                    fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
                                                }}
                                            >
                                                <Shield size={14} /> Get Verified
                                            </button>
                                        )}
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                                            background: agent.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(136,136,136,0.1)',
                                            color: getStatusColor(agent.status)
                                        }}>
                                            {agent.status}
                                        </span>
                                        <button
                                            onClick={() => deleteAgent(agent.id)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Cognitive Alerts Panel */}
                                {tierStatus?.features?.includes('MOLTMIND_FULL') && agentAlerts[agent.id]?.length > 0 && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <CognitiveAlertsPanel
                                            agentId={agent.id}
                                            alerts={agentAlerts[agent.id]}
                                            onAcknowledge={(alertId) => handleAlertAcknowledge(agent.id, alertId)}
                                        />
                                    </div>
                                )}

                                {/* MoltMind upsell for STARTER tier */}
                                {tierStatus?.features?.includes('MOLTMIND_HEALTH') && !tierStatus?.features?.includes('MOLTMIND_FULL') && (
                                    <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                        <Link href="/billing" style={{ color: '#8b5cf6', textDecoration: 'none' }}>
                                            Upgrade to Pro for drift alerts and analysis
                                        </Link>
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Verification Modal */}
            {verifyingAgent && (
                <VerifyAgentModal
                    agent={verifyingAgent}
                    onClose={() => setVerifyingAgent(null)}
                    onSuccess={fetchAgents}
                />
            )}
        </div>
    );
}
