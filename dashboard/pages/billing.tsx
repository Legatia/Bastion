import Head from 'next/head';
import Link from 'next/link';
import { Shield, Check, CreditCard, Zap } from 'lucide-react';

interface Plan {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
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
            '1 Active Agent',
            'Basic Policy Engine',
            '7-Day Audit Logs',
            'Community Support'
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
            '5 Active Agents',
            'Advanced Logic (Time/Velocity)',
            '30-Day Audit Logs',
            'Slack & Email Alerts',
            'CSV Exports'
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
            'Unlimited Agents',
            'Compliance Templates (SOC2)',
            'Unlimited History',
            'API Access',
            'Priority Support',
            'RBAC (Roles)'
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
            'Dedicated Instance',
            'Custom SLAs (99.99%)',
            '24/7 Dedicated Support',
            'Self-Hosted Options',
            'Custom Integrations',
            'Audit Log Export (SIEM)'
        ],
        highlight: false,
        buttonText: 'Contact Sales',
        action: 'sales'
    }
];

import Navbar from '../components/Navbar';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Billing() {
    const router = useRouter();
    const [discountCode, setDiscountCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        setIsLoggedIn(!!key);
        // Note: Billing page is accessible to view plans, but checkout requires login (already handled)
    }, []);

    const handleApplyDiscount = () => {
        if (discountCode.trim().toUpperCase() === 'BASTION2024') {
            setAppliedDiscount(true);
            alert("Discount code applied: 20% OFF");
        } else {
            alert("Invalid discount code");
        }
    };

    const handleSubscribe = (plan: Plan) => {
        if (plan.action === 'sales') {
            alert(`Opening contact form for ${plan.name} Plan...`);
            return;
        }

        const link = plan.polarLink;
        if (!link) {
            alert(`Polar.sh Product Link for ${plan.name} not configured yet.`);
            return;
        }

        // Append discount if applied (mock logic for URL)
        const finalLink = appliedDiscount ? `${link}?discount=BASTION2024` : link;

        if (isLoggedIn) {
            window.open(finalLink, '_blank');
        } else {
            // Redirect to login with return intent
            router.push(`/login?redirect=${encodeURIComponent(finalLink)}`);
        }
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

                    {/* Discount Code Section */}
                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="Discount Code"
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value)}
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                padding: '0.5rem 1rem', borderRadius: '8px', color: '#fff', outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleApplyDiscount}
                            style={{
                                background: '#3b82f6', color: '#fff', border: 'none',
                                padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
                            }}
                        >
                            Apply
                        </button>
                    </div>
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
                                        <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.85rem' }}>{feature}</span>
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
                                {plan.buttonText}
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
        </div>
    );
}
