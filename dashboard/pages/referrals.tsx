import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { Gift, Users, Copy, Check, TrendingUp, Ticket } from 'lucide-react';
import { api } from '../lib/api';

interface ReferralData {
    referral_code: string;
    referral_url: string;
    total_referrals: number;
    active_referrals: number;
}

interface CouponData {
    total_coupons: number;
    used_coupons: number;
    available_coupons: number;
    this_month: {
        coupons_used: number;
        discount_applied: string;
    };
    available_discount: string;
}

export default function Referrals() {
    const router = useRouter();
    const [referralData, setReferralData] = useState<ReferralData | null>(null);
    const [couponData, setCouponData] = useState<CouponData | null>(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) {
            router.push('/login');
            return;
        }

        // Don't set loading true here to avoid flickering on refresh

        Promise.all([
            api.get<ReferralData>('/referrals/code'), // Reverting to correct endpoint
            api.get<CouponData>('/referrals/coupons')
        ])
            .then(([refData, coupData]) => {
                setReferralData(refData);
                setCouponData(coupData);
            })
            .catch(err => console.error("Failed to fetch referral data", err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCopy = () => {
        if (referralData) {
            navigator.clipboard.writeText(referralData.referral_url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>Referrals | Bastion Protocol</title>
            </Head>

            <Navbar />

            <main style={{ padding: '3rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2.5rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Gift size={28} color="#a855f7" /> Referral Program
                    </h1>
                    <p style={{ color: '#a1a1aa', marginTop: '8px' }}>
                        Share your link and earn 5% discount coupons for each paid referral
                    </p>
                </header>

                {loading ? (
                    <p style={{ color: '#888' }}>Loading...</p>
                ) : (
                    <div style={{ display: 'grid', gap: '2rem' }}>

                        {/* Referral Link */}
                        {referralData && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(59,130,246,0.1) 100%)',
                                border: '1px solid rgba(168,85,247,0.3)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}>
                                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Your Referral Link</h2>
                                <div style={{
                                    background: '#000', padding: '1rem', borderRadius: '8px', border: '1px solid #333',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem'
                                }}>
                                    <code style={{ color: '#a855f7', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {referralData.referral_url}
                                    </code>
                                    <button
                                        onClick={handleCopy}
                                        style={{
                                            background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)',
                                            border: 'none', color: copied ? '#22c55e' : '#a855f7',
                                            padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '0.85rem'
                                        }}
                                    >
                                        {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Stats Cards */}
                        <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                                <Users size={24} color="#3b82f6" style={{ marginBottom: '8px' }} />
                                <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px' }}>TOTAL REFERRALS</p>
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{referralData?.total_referrals || 0}</p>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                                <TrendingUp size={24} color="#22c55e" style={{ marginBottom: '8px' }} />
                                <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px' }}>ACTIVE (PAYING)</p>
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#22c55e' }}>{referralData?.active_referrals || 0}</p>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                                <Ticket size={24} color="#fbbf24" style={{ marginBottom: '8px' }} />
                                <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px' }}>AVAILABLE COUPONS</p>
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#fbbf24' }}>{couponData?.available_coupons || 0}</p>
                            </div>
                        </div>

                        {/* Generate Discount Code */}
                        {couponData && couponData.available_coupons > 0 && (
                            <DiscountCodeGenerator
                                availableCoupons={couponData.available_coupons}
                                onSuccess={fetchData}
                            />
                        )}

                        {/* Coupon Info */}
                        {couponData && (
                            <div style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px', padding: '1.5rem'
                            }}>
                                <h3 style={{ margin: '0 0 1rem 0' }}>How Coupons Work</h3>
                                <ul style={{ color: '#a1a1aa', lineHeight: '1.8', margin: 0, paddingLeft: '1.2rem' }}>
                                    <li>Each paying referral = 1 coupon worth <strong style={{ color: '#fff' }}>5% off</strong></li>
                                    <li>Use up to 10 coupons/month = <strong style={{ color: '#22c55e' }}>50% max discount</strong></li>
                                    <li>Generate Polar discount codes above to use at checkout</li>
                                    <li>This month: <strong style={{ color: '#fff' }}>{couponData.this_month.coupons_used}</strong> coupons used ({couponData.this_month.discount_applied} off)</li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

// Discount Code Generator Component
interface DiscountCodeGeneratorProps {
    availableCoupons: number;
    onSuccess: () => void;
}

function DiscountCodeGenerator({ availableCoupons, onSuccess }: DiscountCodeGeneratorProps) {
    const router = useRouter();
    const [couponsToUse, setCouponsToUse] = useState(Math.min(availableCoupons, 10));
    const [loading, setLoading] = useState(false);
    const [discountCode, setDiscountCode] = useState<string | null>(null);
    const [percentage, setPercentage] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const maxCoupons = Math.min(availableCoupons, 10);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await api.get<{
                code: string;
                percentage: number;
                message?: string;
                isNewCode?: boolean;
            }>(`/polar/discount-code?couponsToUse=${couponsToUse}`);

            setDiscountCode(response.code);
            setPercentage(response.percentage);
            onSuccess(); // Refresh parent data
        } catch (err: any) {
            setError(err.message || 'Failed to generate discount code');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = () => {
        if (discountCode) {
            navigator.clipboard.writeText(discountCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.1) 100%)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '16px',
            padding: '2rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <Ticket size={24} color="#22c55e" />
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Generate Polar Discount Code</h2>
            </div>

            <p style={{ color: '#a1a1aa', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Create a discount code to use at Polar.sh checkout
            </p>

            {!discountCode ? (
                <>
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <label style={{ color: '#fff', fontWeight: '600' }}>
                                Coupons to Use: {couponsToUse}
                            </label>
                            <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                {couponsToUse * 5}% OFF
                            </span>
                        </div>

                        <input
                            type="range"
                            min="1"
                            max={maxCoupons}
                            value={couponsToUse}
                            onChange={(e) => setCouponsToUse(parseInt(e.target.value))}
                            style={{
                                width: '100%',
                                height: '8px',
                                background: `linear-gradient(to right, #22c55e 0%, #22c55e ${(couponsToUse / maxCoupons) * 100}%, rgba(255,255,255,0.1) ${(couponsToUse / maxCoupons) * 100}%, rgba(255,255,255,0.1) 100%)`,
                                borderRadius: '4px',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
                            <span>1 coupon (5%)</span>
                            <span>{maxCoupons} coupons ({maxCoupons * 5}%)</span>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '8px',
                            padding: '1rem',
                            marginBottom: '1rem',
                            color: '#ef4444'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        style={{
                            width: '100%',
                            background: loading ? 'rgba(34,197,94,0.5)' : '#22c55e',
                            border: 'none',
                            color: '#000',
                            padding: '1rem 2rem',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? 'Generating...' : 'Generate Discount Code'}
                    </button>
                </>
            ) : (
                <div>
                    <div style={{
                        background: '#000',
                        border: '1px solid #22c55e',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>YOUR DISCOUNT CODE</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                                <code style={{ color: '#22c55e', fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {discountCode}
                                </code>
                                <button
                                    onClick={handleCopyCode}
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
                            <p style={{ color: '#22c55e', fontSize: '1.25rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                                {percentage}% OFF
                            </p>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(34,197,94,0.1)',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem'
                    }}>
                        <p style={{ color: '#6ee7b7', fontSize: '0.9rem', margin: 0 }}>
                            ✅ <strong>Success!</strong> Use this code at Polar.sh checkout to get {percentage}% off your subscription.
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/billing')}
                        style={{
                            width: '100%',
                            background: '#fff',
                            border: 'none',
                            color: '#000',
                            padding: '1rem 2rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            marginBottom: '0.75rem'
                        }}
                    >
                        Go to Checkout →
                    </button>

                    <button
                        onClick={() => setDiscountCode(null)}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Generate New Code
                    </button>
                </div>
            )}
        </div>
    );
}
