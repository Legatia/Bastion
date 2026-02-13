import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Key, Copy, Check, Zap, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';

interface UsageSummary {
    tier: string;
    agents: { current: number; max: number };
    dailyChecks: { current: number; max: number };
}

export default function ProfilePage() {
    const navigate = useNavigate();
    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const [, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const apiKey = localStorage.getItem('bastion_api_key') || '';

    useEffect(() => {
        if (!apiKey) { navigate('/login'); return; }

        api.get<UsageSummary>('/usage/summary')
            .then(data => setUsage(data))
            .catch(err => console.error('Failed to fetch usage', err))
            .finally(() => setLoading(false));
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatLimit = (val: number) => val === -1 ? '∞' : val.toLocaleString();

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-3xl mx-auto p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">Profile</h1>
                    <p className="text-zinc-500">Your account details and API key.</p>
                </div>

                {/* API Key Card */}
                <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Key size={18} className="text-blue-400" />
                        <h2 className="font-semibold">API Key</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <code className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm font-mono text-zinc-400 truncate">
                            {apiKey.slice(0, 8)}{'•'.repeat(24)}{apiKey.slice(-4)}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors cursor-pointer border-none text-white"
                        >
                            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <p className="text-xs text-zinc-600 mt-2">
                        Use this key in your CLI: <code className="text-blue-400">bastion login --key YOUR_KEY</code>
                    </p>
                </div>

                {/* Usage Summary */}
                {usage && (
                    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 size={18} className="text-purple-400" />
                            <h2 className="font-semibold">Usage</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                                <p className="text-sm text-zinc-500 mb-1">Agents</p>
                                <p className="text-2xl font-bold">
                                    {usage.agents.current} <span className="text-sm text-zinc-600 font-normal">/ {formatLimit(usage.agents.max)}</span>
                                </p>
                            </div>
                            <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                                <p className="text-sm text-zinc-500 mb-1">Daily Checks</p>
                                <p className="text-2xl font-bold">
                                    {usage.dailyChecks.current} <span className="text-sm text-zinc-600 font-normal">/ {formatLimit(usage.dailyChecks.max)}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tier Badge */}
                {usage && (
                    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Zap size={18} className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-500">Plan</p>
                                    <p className="font-bold text-lg capitalize">{usage.tier}</p>
                                </div>
                            </div>
                            {usage.tier.toLowerCase() !== 'enterprise' && (
                                <button
                                    onClick={() => navigate('/billing')}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                                >
                                    Upgrade
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
