import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Loader2, Zap, Lock, Globe } from 'lucide-react';
import { api, API_BASE_URL } from '../lib/api';

export default function LoginPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (mode === 'register') {
                const data = await api.post<{ apiKey: string }>('/auth/register', { name, email, password });
                localStorage.setItem('bastion_api_key', data.apiKey);
            } else {
                const data = await api.post<{ apiKey: string }>('/auth/login', { email, password });
                localStorage.setItem('bastion_api_key', data.apiKey);
            }
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.open(`${API_BASE_URL}/auth/google`, '_blank');
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex">
            {/* Left side - branding */}
            <div className="hidden lg:flex w-1/2 flex-col justify-center items-center p-12 bg-gradient-to-br from-zinc-900 via-zinc-950 to-blue-950/30 border-r border-zinc-800">
                <div className="max-w-md space-y-8">
                    <div className="flex items-center gap-3">
                        <Shield className="text-blue-500" size={40} />
                        <span className="text-3xl font-bold text-white">BASTION</span>
                    </div>
                    <p className="text-zinc-400 text-lg leading-relaxed">
                        The security layer for autonomous AI agents. Monitor, control, and protect your agent workforce.
                    </p>
                    <div className="space-y-4 pt-4">
                        <FeatureItem icon={<Lock size={16} className="text-blue-400" />} text="Policy-enforced proxy for all agent traffic" />
                        <FeatureItem icon={<Zap size={16} className="text-purple-400" />} text="MoltMind cognitive monitoring & drift detection" />
                        <FeatureItem icon={<Globe size={16} className="text-green-400" />} text="ERC-8004 on-chain identity verification" />
                    </div>
                </div>
            </div>

            {/* Right side - form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden flex items-center gap-3 justify-center mb-6">
                            <Shield className="text-blue-500" size={32} />
                            <span className="text-2xl font-bold text-white">BASTION</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white">
                            {mode === 'login' ? 'Welcome back' : 'Create your account'}
                        </h2>
                        <p className="text-zinc-500 mt-2">
                            {mode === 'login' ? 'Sign in to your Bastion account' : 'Get started with Bastion Protocol'}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
                        <div className="relative flex justify-center text-sm"><span className="px-4 bg-zinc-950 text-zinc-600">or</span></div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                        <Globe size={18} />
                        Continue with Google
                    </button>

                    <p className="text-center text-zinc-600 text-sm">
                        {mode === 'login' ? (
                            <>Don't have an account? <button onClick={() => setMode('register')} className="text-blue-400 hover:text-blue-300 bg-transparent border-none cursor-pointer">Sign up</button></>
                        ) : (
                            <>Already have an account? <button onClick={() => setMode('login')} className="text-blue-400 hover:text-blue-300 bg-transparent border-none cursor-pointer">Sign in</button></>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-3 text-zinc-400">
            {icon}
            <span className="text-sm">{text}</span>
        </div>
    );
}
