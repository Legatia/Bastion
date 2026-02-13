import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Check, ExternalLink, Zap, Shield, Bot, BarChart3, CreditCard, Loader } from 'lucide-react';
import { api } from '../lib/api';

interface UsageSummary {
    tier: string;
    agents: { current: number; max: number };
    dailyChecks: { current: number; max: number };
}

const FEATURE_LABELS: Record<string, string> = {
    CDP_WALLET: 'CDP Wallet (Agent Wallet)',
    ERC8004: 'ERC-8004 On-Chain Identity',
    MOLTMIND_HEALTH: 'MoltMind Health Scores',
    MOLTMIND_ALERTS: 'MoltMind Cognitive Alerts',
    MOLTMIND_BASELINE: 'MoltMind Behavioral Baseline',
    x402: 'x402 Payment Protocol',
    DLP: 'DLP Scanning (30+ patterns)',
    ENCRYPTED_LOGS: 'Encrypted Audit Logs',
    REFERRAL_COUPONS: 'Referral Coupons',
    PRIORITY_SUPPORT: 'Priority Support',
    CUSTOM_POLICIES: 'Custom Policy Types',
    SLA: 'SLA Guarantee',
    DEDICATED_SUPPORT: 'Dedicated Support',
};

const TIERS = [
    {
        name: 'Free',
        price: '$0',
        priceNote: 'forever',
        features: ['1 Agent', '100 Daily Checks', 'Rate Limit Policy', 'Community Support'],
        featureKeys: [],
        color: 'zinc',
        stripePriceId: null,
    },
    {
        name: 'Starter',
        price: '$9',
        priceNote: '/month',
        features: ['3 Agents', '1,000 Daily Checks', 'All Basic Policies'],
        featureKeys: ['CDP_WALLET', 'ERC8004', 'MOLTMIND_HEALTH'],
        color: 'green',
        stripePriceId: 'price_starter',
    },
    {
        name: 'Pro',
        price: '$29',
        priceNote: '/month',
        features: ['10 Agents', '10,000 Daily Checks', 'All Policy Types'],
        featureKeys: ['CDP_WALLET', 'ERC8004', 'MOLTMIND_HEALTH', 'MOLTMIND_ALERTS', 'MOLTMIND_BASELINE', 'DLP', 'ENCRYPTED_LOGS', 'x402', 'REFERRAL_COUPONS', 'PRIORITY_SUPPORT'],
        color: 'blue',
        stripePriceId: 'price_pro',
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        priceNote: 'contact us',
        features: ['Unlimited Agents', 'Unlimited Checks'],
        featureKeys: ['CDP_WALLET', 'ERC8004', 'MOLTMIND_HEALTH', 'MOLTMIND_ALERTS', 'MOLTMIND_BASELINE', 'DLP', 'ENCRYPTED_LOGS', 'x402', 'REFERRAL_COUPONS', 'CUSTOM_POLICIES', 'SLA', 'DEDICATED_SUPPORT'],
        color: 'purple',
        stripePriceId: null,
    },
];

export default function BillingPage() {
    const navigate = useNavigate();
    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const [upgrading, setUpgrading] = useState<string | null>(null);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) { navigate('/login'); return; }

        api.get<UsageSummary>('/usage/summary')
            .then(data => setUsage(data))
            .catch(err => console.error('Failed to fetch usage', err));
    }, []);

    const handleUpgrade = async (tierName: string) => {
        setUpgrading(tierName);
        try {
            const successUrl = `bastion://checkout-success?tier=${tierName.toLowerCase()}`;
            const data = await api.post<{ url: string }>('/billing/checkout', {
                tier: tierName.toUpperCase(),
                success_url: successUrl,
            });
            if (data.url) {
                window.open(data.url, '_blank');
            }
        } catch {
            // Fallback to dashboard
            window.open('https://bastion.legatia.solutions/billing', '_blank');
        } finally {
            setUpgrading(null);
        }
    };

    const handlePortal = async () => {
        try {
            const data = await api.post<{ url: string }>('/billing/portal', {});
            if (data.url) window.open(data.url, '_blank');
        } catch {
            window.open('https://bastion.legatia.solutions/billing', '_blank');
        }
    };

    const handleDebugUpgrade = async (tier: string) => {
        if (!confirm(`Debug: upgrade to ${tier}?`)) return;
        try {
            await api.post('/billing/debug-upgrade', { tier: tier.toUpperCase() });
            window.location.reload();
        } catch (err) {
            console.error('Debug upgrade failed', err);
        }
    };

    const currentTier = usage?.tier?.toLowerCase() || 'free';
    const isDev = import.meta.env.DEV;

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-6xl mx-auto p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">Billing & Plans</h1>
                    <p className="text-zinc-500">Manage your subscription and view usage.</p>
                </div>

                {/* Current Usage */}
                {usage && (
                    <div className="grid grid-cols-3 gap-4 mb-10">
                        <UsageCard
                            icon={<Bot size={18} className="text-blue-400" />}
                            label="Agents"
                            current={usage.agents.current}
                            max={usage.agents.max}
                        />
                        <UsageCard
                            icon={<BarChart3 size={18} className="text-purple-400" />}
                            label="Daily Checks"
                            current={usage.dailyChecks.current}
                            max={usage.dailyChecks.max}
                        />
                        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield size={18} className="text-green-400" />
                                <span className="text-sm text-zinc-400">Current Plan</span>
                            </div>
                            <div className="text-2xl font-bold capitalize">{currentTier}</div>
                        </div>
                    </div>
                )}

                {/* Tier Cards */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {TIERS.map(tier => {
                        const isCurrent = currentTier === tier.name.toLowerCase();
                        const borderColors: Record<string, string> = {
                            green: 'border-green-500/50',
                            blue: 'border-blue-500/50',
                            purple: 'border-purple-500/50',
                            zinc: 'border-zinc-600',
                        };
                        const borderColor = isCurrent ? (borderColors[tier.color] || 'border-zinc-600') : 'border-zinc-800';

                        return (
                            <div
                                key={tier.name}
                                className={`p-5 bg-zinc-900/50 border ${borderColor} rounded-xl flex flex-col relative`}
                            >
                                {isCurrent && (
                                    <span className="absolute -top-3 left-4 px-3 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                                        Current
                                    </span>
                                )}
                                <h3 className="text-lg font-semibold mb-0.5">{tier.name}</h3>
                                <div className="text-2xl font-bold">
                                    {tier.price}
                                    <span className="text-xs text-zinc-500 font-normal ml-1">{tier.priceNote}</span>
                                </div>

                                <ul className="space-y-1.5 mt-4 flex-1">
                                    {tier.features.map(f => (
                                        <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                                            <Check size={12} className="text-green-400 flex-shrink-0" /> {f}
                                        </li>
                                    ))}
                                    {tier.featureKeys.map(k => (
                                        <li key={k} className="flex items-center gap-2 text-sm text-zinc-500">
                                            <Check size={12} className="text-green-500/70 flex-shrink-0" /> {FEATURE_LABELS[k] || k}
                                        </li>
                                    ))}
                                </ul>

                                {!isCurrent && tier.name !== 'Free' && tier.name !== 'Enterprise' && (
                                    <button
                                        onClick={() => handleUpgrade(tier.name)}
                                        disabled={upgrading === tier.name}
                                        className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                                    >
                                        {upgrading === tier.name ? (
                                            <><Loader size={14} className="animate-spin" /> Processing...</>
                                        ) : (
                                            <><Zap size={14} /> Upgrade</>
                                        )}
                                    </button>
                                )}
                                {!isCurrent && tier.name === 'Enterprise' && (
                                    <a
                                        href="mailto:bastion.feedback@legatia.solutions"
                                        className="mt-4 w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 cursor-pointer no-underline"
                                    >
                                        Contact Sales
                                    </a>
                                )}

                                {/* Debug Upgrade (dev only) */}
                                {isDev && !isCurrent && tier.name !== 'Free' && (
                                    <button
                                        onClick={() => handleDebugUpgrade(tier.name)}
                                        className="mt-2 w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-colors cursor-pointer border border-zinc-700"
                                    >
                                        🐛 Debug Upgrade
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Subscription Management */}
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={handlePortal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors cursor-pointer border-none"
                    >
                        <CreditCard size={14} /> Manage Subscription
                    </button>
                    <button
                        onClick={() => window.open('https://bastion.legatia.solutions/billing', '_blank')}
                        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors cursor-pointer bg-transparent border-none"
                    >
                        <ExternalLink size={14} /> Open Web Dashboard
                    </button>
                </div>
            </main>
        </div>
    );
}

function UsageCard({ icon, label, current, max }: { icon: React.ReactNode; label: string; current: number; max: number }) {
    const pct = max === -1 ? 0 : Math.min((current / max) * 100, 100);
    const formatMax = max === -1 ? '∞' : max.toLocaleString();
    return (
        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-sm text-zinc-400">{label}</span>
            </div>
            <div className="text-2xl font-bold mb-2">
                {current.toLocaleString()} <span className="text-sm text-zinc-500 font-normal">/ {formatMax}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
