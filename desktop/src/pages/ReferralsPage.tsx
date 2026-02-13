import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Gift, Users, Copy, Check, Ticket } from 'lucide-react';
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

interface ReferralEntry {
    id: string;
    email: string;
    tier: string;
    status: string;
    signup_at: string;
}

export default function ReferralsPage() {
    const navigate = useNavigate();
    const [referralData, setReferralData] = useState<ReferralData | null>(null);
    const [couponData, setCouponData] = useState<CouponData | null>(null);
    const [referralList, setReferralList] = useState<ReferralEntry[]>([]);
    const [copied, setCopied] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [discountCode, setDiscountCode] = useState('');

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) { navigate('/login'); return; }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [refData, coupons, stats] = await Promise.all([
                api.get<ReferralData>('/referrals/code'),
                api.get<CouponData>('/referrals/coupons').catch(() => null),
                api.get<{ referrals: ReferralEntry[] }>('/referrals/stats').catch(() => null),
            ]);
            setReferralData(refData);
            if (coupons) setCouponData(coupons);
            if (stats) setReferralList(stats.referrals || []);
        } catch (err) {
            console.error('Failed to fetch referral data', err);
        }
    };

    const handleCopy = () => {
        if (referralData) {
            navigator.clipboard.writeText(referralData.referral_url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleGenerateDiscount = async () => {
        setGeneratingCode(true);
        try {
            const data = await api.post<{ code: string }>('/referrals/coupons/generate', {});
            setDiscountCode(data.code);
            fetchData();
        } catch (err) {
            console.error('Failed to generate code', err);
        } finally {
            setGeneratingCode(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'text-green-400 bg-green-500/10';
            case 'PENDING': return 'text-yellow-400 bg-yellow-500/10';
            case 'CHURNED': return 'text-red-400 bg-red-500/10';
            default: return 'text-zinc-400 bg-zinc-500/10';
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-5xl mx-auto p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">Referral Program</h1>
                    <p className="text-zinc-500">Invite others to Bastion and earn discounts on your subscription.</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <p className="text-zinc-500 text-sm mb-1">Total Referrals</p>
                        <div className="text-2xl font-bold">{referralData?.total_referrals ?? '-'}</div>
                    </div>
                    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <p className="text-zinc-500 text-sm mb-1">Active</p>
                        <div className="text-2xl font-bold text-green-400">{referralData?.active_referrals ?? '-'}</div>
                    </div>
                    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <p className="text-zinc-500 text-sm mb-1">Available Coupons</p>
                        <div className="text-2xl font-bold text-purple-400">{couponData?.available_coupons ?? '-'}</div>
                    </div>
                    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <p className="text-zinc-500 text-sm mb-1">Discount</p>
                        <div className="text-2xl font-bold text-blue-400">{couponData?.available_discount ?? '0%'}</div>
                    </div>
                </div>

                {/* Referral Link */}
                {referralData && (
                    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Gift size={18} className="text-blue-400" />
                            <h2 className="font-semibold">Your Referral Link</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <code className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm font-mono text-blue-400 truncate">
                                {referralData.referral_url}
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
                            Code: <code className="text-blue-400">{referralData.referral_code}</code> — Share with friends to earn 5% discount coupons.
                        </p>
                    </div>
                )}

                {/* Coupon Generator */}
                {couponData && couponData.available_coupons > 0 && (
                    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Ticket size={18} className="text-purple-400" />
                            <h2 className="font-semibold">Generate Discount Code</h2>
                        </div>
                        <p className="text-sm text-zinc-400 mb-4">
                            You have <strong className="text-white">{couponData.available_coupons}</strong> coupon{couponData.available_coupons > 1 ? 's' : ''} available. Each coupon is worth 5% off your next invoice.
                        </p>
                        {discountCode ? (
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <p className="text-sm text-green-400 mb-1">Discount code generated:</p>
                                <code className="text-lg font-bold text-green-300">{discountCode}</code>
                            </div>
                        ) : (
                            <button
                                onClick={handleGenerateDiscount}
                                disabled={generatingCode}
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer"
                            >
                                {generatingCode ? 'Generating...' : 'Generate Code'}
                            </button>
                        )}

                        {couponData.this_month && (
                            <p className="text-xs text-zinc-600 mt-3">
                                This month: {couponData.this_month.coupons_used} coupons used, {couponData.this_month.discount_applied} discount applied. Max 50% monthly discount.
                            </p>
                        )}
                    </div>
                )}

                {/* Referral List */}
                {referralList.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800">
                            <h2 className="font-semibold flex items-center gap-2">
                                <Users size={18} className="text-zinc-400" />
                                Referral History
                            </h2>
                        </div>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead className="bg-zinc-900/80 text-zinc-500 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Tier</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Signed Up</th>
                                </tr>
                            </thead>
                            <tbody>
                                {referralList.map(ref => (
                                    <tr key={ref.id} className="border-t border-zinc-800 hover:bg-zinc-900/30 transition-colors">
                                        <td className="px-4 py-3 text-sm">{ref.email}</td>
                                        <td className="px-4 py-3 text-sm capitalize">{ref.tier?.toLowerCase()}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ref.status)}`}>
                                                {ref.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-500">
                                            {new Date(ref.signup_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
