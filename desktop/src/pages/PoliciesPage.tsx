import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Shield, Save, Plus, Trash2, Lock, Clock, FileText } from 'lucide-react';
import { api } from '../lib/api';

type PolicyType = 'RATE_LIMIT' | 'ALLOWLIST' | 'BLOCKLIST' | 'DLP';

interface Policy {
    id?: string;
    name: string;
    type: PolicyType;
    enabled: boolean;
    priority: number;
    config: any;
}

const POLICY_ICONS: Record<PolicyType, any> = {
    RATE_LIMIT: Clock,
    ALLOWLIST: Shield,
    BLOCKLIST: Shield,
    DLP: Lock,
};

const POLICY_DESCRIPTIONS: Record<PolicyType, string> = {
    RATE_LIMIT: 'Limit request frequency to prevent abuse',
    ALLOWLIST: 'Allow or block specific domains',
    BLOCKLIST: 'Allow or block specific domains',
    DLP: 'Scan for sensitive data in agent traffic',
};

export default function PoliciesPage() {
    const navigate = useNavigate();
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeType, setActiveType] = useState<PolicyType>('RATE_LIMIT');
    const [showCreate, setShowCreate] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formEnabled] = useState(true);
    const [maxRequests, setMaxRequests] = useState('100');
    const [windowSeconds, setWindowSeconds] = useState('60');
    const [filterMode, setFilterMode] = useState<'whitelist' | 'blacklist'>('blacklist');
    const [domains, setDomains] = useState('');

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) { navigate('/login'); return; }
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            const data = await api.get<{ policies: Policy[] }>('/policies');
            setPolicies(data.policies || []);
        } catch (err) {
            console.error('Failed to fetch policies', err);
        } finally {
            setLoading(false);
        }
    };

    const savePolicy = async () => {
        if (!formName.trim()) return;
        setSaving(true);

        let config: any = {};
        let payloadType = activeType as any;
        if (activeType === 'RATE_LIMIT') {
            const seconds = parseInt(windowSeconds);
            const per = seconds >= 86400 ? '24h' : seconds >= 3600 ? '1h' : '1m';
            config = { max_requests: parseInt(maxRequests), per };
        } else if (activeType === 'ALLOWLIST') {
            const parsedDomains = domains.split('\n').map(d => d.trim()).filter(Boolean);
            payloadType = filterMode === 'blacklist' ? 'BLOCKLIST' : 'ALLOWLIST';
            config = filterMode === 'blacklist'
                ? { blocked_values: parsedDomains }
                : { allowed_values: parsedDomains };
        } else if (activeType === 'DLP') {
            config = {
                use_builtin_patterns: true,
                block_on_match: true,
                enabled_pattern_types: ['OPENAI_API_KEY', 'AWS_ACCESS_KEY', 'PRIVATE_KEY', 'SSN'],
                severity_threshold: 'MEDIUM',
            };
        }

        try {
            await api.post('/policies', {
                name: formName,
                type: payloadType,
                enabled: formEnabled,
                priority: 1,
                config,
            });
            setFormName('');
            setShowCreate(false);
            await fetchPolicies();
        } catch (err: any) {
            alert('Failed to save policy: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const deletePolicy = async (id: string) => {
        if (!confirm('Delete this policy?')) return;
        try {
            await api.delete(`/policies/${id}`);
            setPolicies(prev => prev.filter(p => p.id !== id));
        } catch (err: any) {
            alert('Failed to delete: ' + err.message);
        }
    };

    const togglePolicy = async (policy: Policy) => {
        try {
            await api.put(`/policies/${policy.id}`, { ...policy, enabled: !policy.enabled });
            setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, enabled: !p.enabled } : p));
        } catch (err: any) {
            alert('Failed to toggle: ' + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-6xl mx-auto p-8">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Security Policies</h1>
                        <p className="text-zinc-500">Configure rules for your agent proxy.</p>
                    </div>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors cursor-pointer"
                    >
                        <Plus size={16} /> New Policy
                    </button>
                </div>

                {/* Create Form */}
                {showCreate && (
                    <div className="mb-8 p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-6">
                        <div className="grid grid-cols-3 gap-3">
                            {(['RATE_LIMIT', 'ALLOWLIST', 'DLP'] as PolicyType[]).map(type => {
                                const Icon = POLICY_ICONS[type];
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setActiveType(type)}
                                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${activeType === type
                                            ? 'bg-blue-500/10 border-blue-500/50'
                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                            }`}
                                    >
                                        <Icon size={20} className={activeType === type ? 'text-blue-400' : 'text-zinc-500'} />
                                        <h4 className="font-medium mt-2 text-white">{type.replace(/_/g, ' ')}</h4>
                                        <p className="text-xs text-zinc-500 mt-1">{POLICY_DESCRIPTIONS[type]}</p>
                                    </button>
                                );
                            })}
                        </div>

                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">Policy Name</label>
                            <input
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder={`My ${activeType.replace(/_/g, ' ').toLowerCase()} policy`}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {activeType === 'RATE_LIMIT' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Max Requests</label>
                                    <input type="number" value={maxRequests} onChange={e => setMaxRequests(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Window (seconds)</label>
                                    <input type="number" value={windowSeconds} onChange={e => setWindowSeconds(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                                </div>
                            </div>
                        )}

                        {activeType === 'ALLOWLIST' && (
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <button onClick={() => setFilterMode('blacklist')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${filterMode === 'blacklist' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                                        Blacklist
                                    </button>
                                    <button onClick={() => setFilterMode('whitelist')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${filterMode === 'whitelist' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                                        Whitelist
                                    </button>
                                </div>
                                <textarea
                                    value={domains}
                                    onChange={e => setDomains(e.target.value)}
                                    placeholder="One domain per line&#10;e.g. evil.com&#10;malware.xyz"
                                    rows={4}
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm resize-none"
                                />
                            </div>
                        )}

                        {activeType === 'DLP' && (
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                                <p className="text-sm text-zinc-400 mb-2">Default DLP patterns will be enabled:</p>
                                <div className="flex flex-wrap gap-2">
                                    {['OpenAI Key', 'AWS Key', 'Private Key', 'SSN'].map(p => (
                                        <span key={p} className="px-2.5 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/20">{p}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none">Cancel</button>
                            <button
                                onClick={savePolicy}
                                disabled={saving || !formName.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors cursor-pointer"
                            >
                                <Save size={14} />
                                {saving ? 'Saving...' : 'Create Policy'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Policy List */}
                {loading ? (
                    <div className="text-center py-16 text-zinc-600">Loading policies...</div>
                ) : policies.length === 0 ? (
                    <div className="text-center py-16 space-y-4">
                        <Shield size={48} className="mx-auto text-zinc-700" />
                        <p className="text-zinc-500">No policies configured. Create one to start protecting your agents.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {policies.map(policy => {
                            const Icon = POLICY_ICONS[policy.type] || FileText;
                            return (
                                <div
                                    key={policy.id}
                                    className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-between hover:border-zinc-700 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${policy.enabled ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-600'}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-white">{policy.name}</h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                                <span className="px-2 py-0.5 bg-zinc-800 rounded">{policy.type.replace(/_/g, ' ')}</span>
                                                <span>Priority: {policy.priority}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => togglePolicy(policy)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer border ${policy.enabled
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                                }`}
                                        >
                                            {policy.enabled ? 'Active' : 'Disabled'}
                                        </button>
                                        <button
                                            onClick={() => deletePolicy(policy.id!)}
                                            className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer bg-transparent border-none"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
