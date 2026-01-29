import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { Bot, Plus, Trash2, Activity, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface Agent {
    id: string;
    name: string;
    description?: string;
    status: string;
    lastSeenAt?: string;
    createdAt: string;
}

export default function Agents() {
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAgentName, setNewAgentName] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) {
            router.push('/login');
            return;
        }
        fetchAgents();
    }, []);

    const fetchAgents = () => {
        api.get<{ agents: Agent[] }>('/agents')
            .then(data => setAgents(data.agents))
            .catch(err => console.error("Failed to fetch agents", err))
            .finally(() => setLoading(false));
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#22c55e';
            case 'INACTIVE': return '#888';
            case 'BLOCKED': return '#ef4444';
            default: return '#888';
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Agents | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '3rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
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
                            <div key={agent.id} style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getStatusColor(agent.status) }} />
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: '600' }}>{agent.name}</h4>
                                        <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                                            ID: {agent.id.substring(0, 8)}... • Created {new Date(agent.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
