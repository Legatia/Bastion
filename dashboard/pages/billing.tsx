import Head from 'next/head';
import Link from 'next/link';
import { Shield, Check, CreditCard, Zap, Copy, Ticket } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';

interface Plan {
    name: string;
    price: string;
    period: string;
    description: string;
    features: Array<{ text: string; ready: boolean }>;
    highlight: boolean;
    buttonText: string;
    action: 'stripe' | 'polar' | 'sales';
    polarLink?: string;
}

const PLANS: Plan[] = [
    {
        name: 'Starter',
        price: '$15',
        period: '/mo',
        description: 'Perfect for solopreneurs building their first autonomous agents.',
        features: [
            { text: '1 Active Agent', ready: true },
            { text: 'Basic Policy Engine', ready: true },
            { text: '7-Day Audit Logs', ready: true },
            { text: 'Community Support', ready: true }
        ],
        highlight: false,
        buttonText: 'Start Free Trial',
        action: 'polar',
        polarLink: process.env.NEXT_PUBLIC_POLAR_LINK_STARTER
    },
    {
        name: 'Growth',
        price: '$99',
        period: '/mo',
        description: 'For small teams scaling their agentic workforce.',
        features: [
            { text: '5 Active Agents', ready: true },
            { text: 'Advanced Logic (Time/Velocity)', ready: false },
            { text: '30-Day Audit Logs', ready: true },
            { text: 'Slack & Email Alerts', ready: false },
            { text: 'CSV Exports', ready: true }
        ],
        highlight: true,
        buttonText: 'Upgrade to Growth',
        action: 'polar',
        polarLink: process.env.NEXT_PUBLIC_POLAR_LINK_GROWTH
    },
    {
        name: 'Pro',
        price: '$299',
        period: '/mo',
        description: 'Compliance-ready infrastructure for serious operations.',
        features: [
            { text: 'Unlimited Agents', ready: true },
            { text: 'Compliance Templates (SOC2)', ready: false },
            { text: 'Unlimited History', ready: true },
            { text: 'API Access', ready: true },
            { text: 'Priority Support', ready: true },
            { text: 'RBAC (Roles)', ready: false }
        ],
        highlight: false,
        buttonText: 'Upgrade to Pro',
        action: 'polar',
        polarLink: process.env.NEXT_PUBLIC_POLAR_LINK_PRO
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'Full autonomy for large-scale agent deployments.',
        features: [
            { text: 'Dedicated Instance', ready: false },
            { text: 'Custom SLAs (99.99%)', ready: false },
            { text: '24/7 Dedicated Support', ready: true },
            { text: 'Self-Hosted Options', ready: false },
            { text: 'Custom Integrations', ready: true },
            { text: 'Audit Log Export (SIEM)', ready: false }
        ],
        highlight: false,
        buttonText: 'Contact Sales',
        action: 'sales'
    }
];

export default function Billing() {
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        setIsLoggedIn(!!key);
    }, []);

    const handleSubscribe = (plan: Plan) => {
        if (plan.action === 'sales') {
            window.location.href = 'mailto:bastion.feedback@legatia.solutions?subject=Enterprise Inquiry';
            return;
        }

        const link = plan.polarLink;
        if (!link) {
            alert(`Polar.sh Product Link for ${plan.name} not configured yet.`);
            return;
        }

        if (isLoggedIn) {
            window.open(link, '_blank');
        } else {
            router.push(`/login?redirect=${encodeURIComponent(link)}`);
        }
    };

    const [usage, setUsage] = useState<{ tier: string; trialEndsAt: string | null } | null>(null);

    useEffect(() => {
        if (isLoggedIn) {
            api.get<any>('/usage')
                .then(data => setUsage(data))
                .catch(() => { });
        }
    }, [isLoggedIn]);

    const getTrialDaysLeft = () => {
        if (!usage?.trialEndsAt) return 0;
        const end = new Date(usage.trialEndsAt);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };


    return (
        <div style={{ minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Billing | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '4rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>

                <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Simple, Transparent Pricing</h1>
                    <p style={{ color: '#889', fontSize: '1.2rem' }}>Secure your agent fleet with an immutable insurance layer.</p>

                    {/* Trial Banner */}
                    {usage?.tier === 'TRIAL' && (
                        <div style={{
                            marginTop: '2rem',
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.1) 100%)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            borderRadius: '12px',
                            padding: '1rem',
                            maxWidth: '600px',
                            margin: '2rem auto 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px'
                        }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                            }}>
                                <Zap size={18} fill="currentColor" />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <h3 style={{ fontSize: '1rem', margin: 0, color: '#60a5fa' }}>
                                    Free Trial Active
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: '#93c5fd', margin: 0 }}>
                                    You have <strong>{getTrialDaysLeft()} days left</strong>. Subscribe to keep your agents running.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Discount Code Display */}
                    {isLoggedIn && <DiscountCodeDisplay />}
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '4rem' }}>
                    {PLANS.map((plan) => (
                        <div key={plan.name} style={{
                            background: plan.highlight ? 'linear-gradient(145deg, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 100%)' : 'rgba(255,255,255,0.03)',
                            border: plan.highlight ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative'
                        }}>
                            {plan.highlight && (
                                <div style={{
                                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                                    background: '#3b82f6', color: '#fff', padding: '4px 12px', borderRadius: '12px',
                                    fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <Zap size={12} fill="currentColor" /> POPULAR
                                </div>
                            )}

                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{plan.name}</h3>
                            <p style={{ color: '#889', marginBottom: '1.5rem', fontSize: '0.85rem', minHeight: '40px' }}>{plan.description}</p>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{plan.price}</span>
                                <span style={{ color: '#666' }}>{plan.period}</span>
                            </div>

                            <div style={{ marginBottom: '2rem', flex: 1 }}>
                                {plan.features.map((feature, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.6rem', color: '#ccc' }}>
                                        <Check size={14} color={feature.ready ? "#10b981" : "#666"} style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.85rem', opacity: feature.ready ? 1 : 0.5 }}>
                                            {feature.text}
                                            {!feature.ready && <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '4px' }}>(Soon)</span>}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <button style={{
                                background: plan.highlight ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                color: plan.highlight ? '#fff' : '#fff',
                                border: 'none',
                                padding: '0.8rem',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                fontSize: '0.9rem'
                            }} onClick={() => handleSubscribe(plan)}>
                                {usage?.tier === 'TRIAL' && plan.name === 'Starter' ? 'Extend Access' : plan.buttonText}
                            </button>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '4rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                    <p>All plans include full access to the Bastion API and Dashboard.</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem', alignItems: 'center' }}>
                        <CreditCard size={16} /> Secure subscriptions via Polar.sh
                    </div>
                </div>

            </main>

            {/* Footer */}
            <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#666', fontSize: '0.9rem' }}>
                <p>Questions? Contact us at <a href="mailto:bastion.feedback@legatia.solutions" style={{ color: '#888', textDecoration: 'none' }}>bastion.feedback@legatia.solutions</a></p>
                <p style={{ marginTop: '0.5rem' }}>&copy; {new Date().getFullYear()} Legatia Solutions. All rights reserved.</p>
            </footer>
        </div>
    );
}

// Discount Code Display Component
function DiscountCodeDisplay() {
    const [discountCode, setDiscountCode] = useState<string | null>(null);
    const [percentage, setPercentage] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        api.get<{
            code: string;
            percentage: number;
        }>('/polar/discount-code')
            .then(data => {
                setDiscountCode(data.code);
                setPercentage(data.percentage);
            })
            .catch(() => {
                // No discount code available - user has no coupons
            })
            .finally(() => setLoading(false));
    }, []);

    const handleCopy = () => {
        if (discountCode) {
            navigator.clipboard.writeText(discountCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading || !discountCode) return null;

    return (
        <div style={{
            marginTop: '2rem',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.1) 100%)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '600px',
            margin: '2rem auto 0'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', justifyContent: 'center' }}>
                <Ticket size={20} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#22c55e' }}>
                    Your Discount Code ({percentage}% OFF)
                </h3>
            </div>

            <div style={{
                background: '#000',
                border: '1px solid #22c55e',
                borderRadius: '8px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
            }}>
                <code style={{ color: '#22c55e', fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {discountCode}
                </code>
                <button
                    onClick={handleCopy}
                    style={{
                        background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)',
                        border: '1px solid #22c55e',
                        color: '#22c55e',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: '600',
                        fontSize: '0.85rem'
                    }}
                >
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#6ee7b7', margin: '0.75rem 0 0', textAlign: 'center' }}>
                Apply this code at Polar.sh checkout
            </p>
        </div>
    );
}
