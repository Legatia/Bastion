import Head from 'next/head';
import { Shield, Check, CreditCard, Zap, Cpu, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';
import { loadStripe } from '@stripe/stripe-js';
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface TierInfo {
    tier: string;
    price: number;
    priceDisplay: string;
    label: string;
    maxAgents: number;
    maxDailyChecks: number;
    features: string[];
}

interface TierStatus {
    tier: string;
    openclawPurchased: boolean;
    hasSubscription: boolean;
    features: string[];
    limits: { maxAgents: number; maxDailyChecks: number };
}

const TIER_COLORS: Record<string, string> = {
    FREE: '#6b7280',
    STARTER: '#3b82f6',
    PRO: '#8b5cf6',
    ENTERPRISE: '#f59e0b',
};

const FEATURE_LABELS: Record<string, string> = {
    CDP_WALLET: 'CDP Wallet',
    ERC8004_DAILY: 'ERC-8004 Daily Registration',
    ERC8004_REALTIME: 'ERC-8004 Real-time Registration',
    MOLTMIND_HEALTH: 'MoltMind Health Score',
    MOLTMIND_FULL: 'MoltMind Full (Alerts, Drift, Analysis)',
    X402: 'x402 Support',
};

export default function Billing() {
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [tierStatus, setTierStatus] = useState<TierStatus | null>(null);
    const [tiers, setTiers] = useState<TierInfo[]>([]);
    const [showCheckout, setShowCheckout] = useState(false);
    const [clientSecret, setClientSecret] = useState('');
    const [checkoutTier, setCheckoutTier] = useState<string | null>(null);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        setIsLoggedIn(!!key);
    }, []);

    const refreshData = useCallback(() => {
        // Always fetch pricing (public)
        api.get<any>('/modules/pricing').then((data) => {
            setTiers(data.tiers || []);
        }).catch(() => { });

        if (isLoggedIn) {
            api.get<TierStatus>('/modules').then(setTierStatus).catch(() => { });
        }
    }, [isLoggedIn]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        if (router.query.success) {
            alert('Payment successful! Your tier has been upgraded.');
            router.replace('/billing', undefined, { shallow: true });
            refreshData();
        }
        if (router.query.canceled) {
            alert('Payment canceled.');
            router.replace('/billing', undefined, { shallow: true });
        }
    }, [router.query, refreshData]);

    const handleUpgrade = async (tier: string) => {
        try {
            setCheckoutTier(tier);
            const response = await api.post<any>('/modules/checkout', { tier });
            setClientSecret(response.clientSecret);
            setShowCheckout(true);
        } catch (err: any) {
            alert(err.message || 'Failed to start checkout');
        }
    };

    const handleDebugUpgrade = async () => {
        if (!checkoutTier) return;
        try {
            await api.post('/modules/checkout/debug', { tier: checkoutTier });
            setShowCheckout(false);
            refreshData();
            alert(`Debug upgrade to ${checkoutTier} successful!`);
        } catch (err: any) {
            alert(err.message || 'Failed debug upgrade');
        }
    };

    const handlePortal = async () => {
        try {
            const { url } = await api.post<any>('/modules/portal', {});
            window.location.href = url;
        } catch (err: any) {
            alert('Failed to open billing portal');
        }
    };

    const currentTier = tierStatus?.tier || 'FREE';
    const tierOrder = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
    const currentTierIndex = tierOrder.indexOf(currentTier);

    return (
        <div style={{ minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Billing | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '2rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
                <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Simple Tier Pricing</h1>
                    <p style={{ color: '#889', fontSize: '1.1rem' }}>
                        Everything bundled per tier. No per-module billing.
                    </p>
                    {isLoggedIn && tierStatus?.hasSubscription && (
                        <>
                            <button
                                onClick={handlePortal}
                                style={{
                                    marginTop: '1rem',
                                    background: 'transparent',
                                    border: '1px solid #444',
                                    color: '#ccc',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Manage Subscription
                            </button>
                            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                                Downgrade, cancel, or update payment method
                            </p>
                        </>
                    )}
                </header>

                {/* Current Tier Banner */}
                {isLoggedIn && tierStatus && (
                    <div style={{
                        background: `linear-gradient(135deg, ${TIER_COLORS[currentTier]}15 0%, transparent 100%)`,
                        border: `1px solid ${TIER_COLORS[currentTier]}44`,
                        borderRadius: '12px',
                        padding: '1.25rem 1.5rem',
                        marginBottom: '2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: TIER_COLORS[currentTier] }}>
                                Current Plan: {currentTier}
                            </h3>
                            <p style={{ margin: '0.25rem 0 0', color: '#889', fontSize: '0.85rem' }}>
                                {tierStatus.limits.maxAgents === -1 ? 'Unlimited' : tierStatus.limits.maxAgents} agents
                                {' / '}
                                {tierStatus.limits.maxDailyChecks === -1 ? 'Unlimited' : tierStatus.limits.maxDailyChecks.toLocaleString()} checks/day
                            </p>
                        </div>
                        <Shield size={32} color={TIER_COLORS[currentTier]} />
                    </div>
                )}

                {/* Tier Cards */}
                <div className="tier-grid">
                    {tiers.map((t) => {
                        const isCurrentTier = currentTier === t.tier;
                        const tierIndex = tierOrder.indexOf(t.tier);
                        const canUpgrade = isLoggedIn && tierIndex > currentTierIndex && t.tier !== 'ENTERPRISE';
                        const color = TIER_COLORS[t.tier] || '#888';

                        return (
                            <div key={t.tier} style={{
                                background: isCurrentTier
                                    ? `linear-gradient(145deg, ${color}12, transparent)`
                                    : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isCurrentTier ? color + '66' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '16px',
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                            }}>
                                {/* Header */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color }}>{t.label}</h3>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                            {t.tier === 'ENTERPRISE' ? 'Custom' : `$${t.price / 100}`}
                                        </span>
                                        {t.price > 0 && <span style={{ color: '#889', fontSize: '0.9rem' }}>/mo</span>}
                                    </div>
                                </div>

                                {/* Limits */}
                                <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '1rem' }}>
                                    <div>{t.maxAgents === -1 ? 'Unlimited' : t.maxAgents} agents</div>
                                    <div>{t.maxDailyChecks === -1 ? 'Unlimited' : t.maxDailyChecks.toLocaleString()} authorize checks/day</div>
                                </div>

                                {/* Features */}
                                <div style={{ marginBottom: '1.25rem', flex: 1 }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.4rem', color: '#ccc' }}>
                                        <Check size={14} color={color} style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.85rem' }}>Policy engine</span>
                                    </div>
                                    {t.features.map((f, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.4rem', color: '#ccc' }}>
                                            <Check size={14} color={color} style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.85rem' }}>{FEATURE_LABELS[f] || f}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Action Button */}
                                {isCurrentTier ? (
                                    <div style={{
                                        background: `${color}15`,
                                        color,
                                        padding: '0.65rem',
                                        borderRadius: '8px',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        textAlign: 'center',
                                    }}>
                                        Current Plan
                                    </div>
                                ) : canUpgrade ? (
                                    <button
                                        onClick={() => handleUpgrade(t.tier)}
                                        style={{
                                            background: `${color}20`,
                                            color,
                                            border: `1px solid ${color}44`,
                                            padding: '0.65rem',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        Upgrade to {t.label}
                                    </button>
                                ) : t.tier === 'ENTERPRISE' ? (
                                    <a
                                        href="mailto:bastion.feedback@legatia.solutions?subject=Enterprise%20Plan"
                                        style={{
                                            display: 'block',
                                            background: `${color}20`,
                                            color,
                                            border: `1px solid ${color}44`,
                                            padding: '0.65rem',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            textAlign: 'center',
                                            textDecoration: 'none',
                                        }}
                                    >
                                        Contact Sales
                                    </a>
                                ) : !isLoggedIn ? (
                                    <button
                                        onClick={() => router.push('/login?redirect=/billing')}
                                        style={{
                                            background: `${color}20`,
                                            color,
                                            border: `1px solid ${color}44`,
                                            padding: '0.65rem',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        Sign In
                                    </button>
                                ) : null}
                            </div>
                        );
                    })}
                </div>

                {/* Feature Comparison Table */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '3rem',
                    overflowX: 'auto',
                }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Feature Comparison</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#888' }}>Feature</th>
                                {['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].map(t => (
                                    <th key={t} style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: TIER_COLORS[t], fontWeight: 600 }}>{t}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { feature: 'Policy engine', values: [true, true, true, true] },
                                { feature: 'Authorize checks/day', values: ['1,000', '50,000', 'Unlimited', 'Unlimited'] },
                                { feature: 'ERC-8004 registration', values: [false, 'Daily', 'Real-time', 'Real-time'] },
                                { feature: 'CDP Wallet', values: [false, true, true, true] },
                                { feature: 'x402 support', values: [false, true, true, true] },
                                { feature: 'MoltMind health score', values: [false, true, true, true] },
                                { feature: 'MoltMind full monitoring', values: [false, false, true, true] },
                            ].map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '0.75rem 1rem', color: '#ccc' }}>{row.feature}</td>
                                    {row.values.map((val, j) => (
                                        <td key={j} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                                            {val === true ? (
                                                <Check size={16} color="#22c55e" style={{ display: 'inline' }} />
                                            ) : val === false ? (
                                                <span style={{ color: '#444' }}>—</span>
                                            ) : (
                                                <span style={{ color: '#ccc', fontSize: '0.8rem' }}>{val}</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Agent Runtime Add-on */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '3rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: '#f59e0b20', color: '#f59e0b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Cpu size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Agent Runtime Manager</h3>
                            <span style={{ fontSize: '0.8rem', color: '#889' }}>
                                <strong style={{ color: '#fff', fontSize: '1.1rem' }}>$99</strong> one-time add-on
                            </span>
                        </div>
                        {tierStatus?.openclawPurchased && (
                            <span style={{
                                marginLeft: 'auto',
                                background: '#f59e0b20',
                                color: '#f59e0b',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                            }}>
                                PURCHASED
                            </span>
                        )}
                    </div>
                    <p style={{ color: '#889', fontSize: '0.85rem' }}>
                        Launch, monitor, and control your AI agents via the desktop app. Process lifecycle management for any HTTP/HTTPS agent.
                    </p>
                </div>

                {/* Secure Payment Footer */}
                <div style={{ marginTop: '3rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                        <CreditCard size={16} /> Secure payments via Stripe
                    </div>
                </div>
            </main>

            {/* Embedded Checkout Modal */}
            {showCheckout && clientSecret && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(5px)',
                }}>
                    <div style={{
                        width: '95%', maxWidth: '600px',
                        background: '#111',
                        border: '1px solid #333',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        position: 'relative',
                    }}>
                        <button
                            onClick={() => setShowCheckout(false)}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'transparent', border: 'none', color: '#666',
                                cursor: 'pointer', zIndex: 10
                            }}
                        >
                            <X size={24} />
                        </button>

                        {/* Debug Button — only in development */}
                        {process.env.NODE_ENV === 'development' && (
                            <button
                                onClick={handleDebugUpgrade}
                                style={{
                                    position: 'absolute', top: '16px', left: '16px',
                                    background: '#333', border: '1px solid #444', color: '#fff',
                                    padding: '4px 8px', borderRadius: '4px',
                                    cursor: 'pointer', zIndex: 10, fontSize: '0.8rem'
                                }}
                            >
                                Debug: Skip Payment
                            </button>
                        )}
                        <div style={{ padding: '2rem' }}>
                            <EmbeddedCheckoutProvider
                                stripe={stripePromise}
                                options={{ clientSecret }}
                            >
                                <EmbeddedCheckout />
                            </EmbeddedCheckoutProvider>
                        </div>
                    </div>
                </div>
            )}

            <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#666', fontSize: '0.9rem' }}>
                <p>Questions? Contact us at <a href="mailto:bastion.feedback@legatia.solutions" style={{ color: '#888', textDecoration: 'none' }}>bastion.feedback@legatia.solutions</a></p>
                <p style={{ marginTop: '0.5rem' }}>&copy; {new Date().getFullYear()} Legatia Solutions. All rights reserved.</p>
            </footer>
        </div>
    );
}
