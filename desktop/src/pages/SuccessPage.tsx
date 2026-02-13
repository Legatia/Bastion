import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { CheckCircle, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

export default function SuccessPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tier, setTier] = useState<string | null>(null);
    const [, setLoading] = useState(true);

    useEffect(() => {
        const tierParam = searchParams.get('tier');
        if (tierParam) setTier(tierParam);

        // Refresh usage to pick up the new tier
        api.get<{ tier: string }>('/usage/summary')
            .then(data => {
                if (data.tier) setTier(data.tier);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const tierColors: Record<string, string> = {
        starter: 'from-green-500 to-emerald-600',
        pro: 'from-blue-500 to-indigo-600',
        enterprise: 'from-purple-500 to-violet-600',
    };

    const tierName = tier?.toLowerCase() || 'pro';
    const gradient = tierColors[tierName] || tierColors.pro;

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <main className="max-w-2xl mx-auto px-8 py-20 text-center">
                {/* Success Animation */}
                <div className="relative mb-8">
                    <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center animate-pulse`}>
                        <CheckCircle size={40} className="text-white" />
                    </div>
                    <Sparkles size={16} className="text-yellow-400 absolute top-0 right-1/3 animate-bounce" />
                    <Sparkles size={12} className="text-blue-400 absolute top-2 left-1/3 animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>

                <h1 className="text-4xl font-bold mb-3">
                    Welcome to <span className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{tier || 'Pro'}</span>!
                </h1>
                <p className="text-lg text-zinc-400 mb-10">
                    Your subscription is active. All premium features are now unlocked.
                </p>

                {/* Features Unlocked */}
                <div className="grid grid-cols-2 gap-3 mb-10 text-left">
                    {getUnlockedFeatures(tierName).map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                            <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                            <span className="text-sm text-zinc-300">{feature}</span>
                        </div>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => navigate('/agents')}
                        className={`w-full py-3.5 bg-gradient-to-r ${gradient} text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90`}
                    >
                        <Zap size={18} /> Start Using Premium Features
                        <ArrowRight size={16} />
                    </button>
                    <button
                        onClick={() => navigate('/billing')}
                        className="w-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl cursor-pointer transition-colors"
                    >
                        View Billing Details
                    </button>
                </div>

                {/* Help Text */}
                <p className="text-xs text-zinc-600 mt-8">
                    Questions? Contact us at{' '}
                    <a href="mailto:bastion.feedback@legatia.solutions" className="text-zinc-500 hover:text-white transition-colors">
                        bastion.feedback@legatia.solutions
                    </a>
                </p>
            </main>
        </div>
    );
}

function getUnlockedFeatures(tier: string): string[] {
    const features: Record<string, string[]> = {
        starter: [
            '3 Agents',
            'CDP Wallet',
            'ERC-8004 Identity',
            'MoltMind Health Scores',
            '1,000 Daily Checks',
            'All Basic Policies',
        ],
        pro: [
            '10 Agents',
            'Cognitive Drift Alerts',
            'Behavioral Baselines',
            'DLP Scanning (30+ patterns)',
            'Encrypted Audit Logs',
            'Referral Coupons',
            'x402 Payments',
            'Priority Support',
        ],
        enterprise: [
            'Unlimited Agents',
            'Custom Policies',
            'SLA Guarantee',
            'Dedicated Support',
            'All Pro Features',
            'Custom Integrations',
        ],
    };
    return features[tier] || features.pro;
}
