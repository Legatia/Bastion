import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { Shield, ArrowRight, Lock, Loader2, CheckCircle, Zap, Globe } from 'lucide-react';
import { api, API_BASE_URL } from '../lib/api';

export default function Login() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);

    // Form States
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!isLogin) {
            if (email !== confirmEmail) {
                setError("Emails do not match");
                setLoading(false);
                return;
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }
        }

        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            localStorage.setItem('bastion_api_key', data.apiKey);

            // Handle Redirect (e.g., back to Checkout)
            const { redirect } = router.query;
            if (redirect && typeof redirect === 'string') {
                window.location.href = decodeURIComponent(redirect);
            } else {
                window.location.href = '/analytics';
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', background: '#09090b', fontFamily: 'Inter, sans-serif' }}>
            <Head>
                <title>{isLogin ? 'Login' : 'Sign Up'} | Bastion Protocol</title>
            </Head>

            {/* Left Column - Branding (Hidden on mobile) */}
            <div style={{
                flex: 1,
                backgroundImage: 'url(/hero-bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
                display: 'none',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '4rem',
                color: '#fff'
            }} className="desktop-only">

                {/* Overlay for readability */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(9,9,11,0.95) 100%)' }}></div>

                <div style={{ position: 'relative', zIndex: 10, maxWidth: '500px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '2rem', color: '#60a5fa' }}>
                        <Shield size={32} />
                        <span>BASTION PROTOCOL</span>
                    </div>

                    <h1 style={{ fontSize: '3.5rem', lineHeight: '1.1', marginBottom: '1.5rem', fontWeight: '800' }}>
                        Secure the <br />
                        <span style={{ background: 'linear-gradient(to right, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Agent Economy</span>
                    </h1>

                    <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: '1.6', marginBottom: '3rem' }}>
                        The first immutable insurance layer for autonomous intelligence. Prevent rogue behavior with programmable policies and real-time audit trails.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <FeatureItem icon={<CheckCircle size={20} color="#34d399" />} text="Cryptographic Signature Verification" />
                        <FeatureItem icon={<Zap size={20} color="#fbbf24" />} text="Sub-10ms Latency Policy Engine" />
                        <FeatureItem icon={<Globe size={20} color="#60a5fa" />} text="Global Edge Network Deployment" />
                    </div>
                </div>
            </div>

            {/* Right Column - Form */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                position: 'relative',
                background: '#09090b'
            }}>
                <div style={{ width: '100%', maxWidth: '420px' }}>

                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                            {isLogin ? 'Welcome back' : 'Create an account'}
                        </h2>
                        <p style={{ color: '#71717a' }}>
                            {isLogin ? 'Enter your credentials to access the dashboard' : 'Start securing your agents in seconds'}
                        </p>
                    </div>

                    {/* Social Auth */}
                    <button
                        onClick={() => {
                            const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
                            if (!clientId) {
                                alert("Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local");
                                return;
                            }

                            const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';
                            const scope = 'email profile';
                            const responseType = 'token'; // Using Implicit flow for client-side demo

                            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;

                            window.location.href = authUrl;
                        }}
                        style={{
                            width: '100%', padding: '0.75rem', marginBottom: '1.5rem',
                            background: '#fff', color: '#09090b', border: '1px solid #e4e4e7', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s',
                            fontSize: '0.9rem'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f4f4f5'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" width="18" height="18" alt="Google" />
                        <span>Continue with Google</span>
                    </button>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px', color: '#52525b', fontSize: '0.75rem', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px'
                    }}>
                        <div style={{ flex: 1, height: '1px', background: '#27272a' }}></div>
                        OR CONTINUE WITH EMAIL
                        <div style={{ flex: 1, height: '1px', background: '#27272a' }}></div>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {error && (
                            <div style={{
                                padding: '0.75rem', background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
                                borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center'
                            }}>
                                {error}
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#a1a1aa', marginBottom: '0.5rem' }}>Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem',
                                    background: '#18181b', border: '1px solid #27272a',
                                    borderRadius: '8px', color: '#fff', outline: 'none',
                                    fontSize: '0.95rem', transition: 'border-color 0.2s'
                                }}
                                placeholder="name@example.com"
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#27272a'}
                            />
                        </div>

                        {!isLogin && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#a1a1aa', marginBottom: '0.5rem' }}>Confirm Email</label>
                                <input
                                    type="email"
                                    required
                                    value={confirmEmail}
                                    onChange={e => setConfirmEmail(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.75rem',
                                        background: '#18181b', border: '1px solid #27272a',
                                        borderRadius: '8px', color: '#fff', outline: 'none',
                                        fontSize: '0.95rem', transition: 'border-color 0.2s'
                                    }}
                                    placeholder="name@example.com"
                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={(e) => e.target.style.borderColor = '#27272a'}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#a1a1aa', marginBottom: '0.5rem' }}>Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem',
                                    background: '#18181b', border: '1px solid #27272a',
                                    borderRadius: '8px', color: '#fff', outline: 'none',
                                    fontSize: '0.95rem', transition: 'border-color 0.2s'
                                }}
                                placeholder="••••••••"
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#27272a'}
                            />
                        </div>

                        {!isLogin && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#a1a1aa', marginBottom: '0.5rem' }}>Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.75rem',
                                        background: '#18181b', border: '1px solid #27272a',
                                        borderRadius: '8px', color: '#fff', outline: 'none',
                                        fontSize: '0.95rem', transition: 'border-color 0.2s'
                                    }}
                                    placeholder="••••••••"
                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={(e) => e.target.style.borderColor = '#27272a'}
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '0.5rem', padding: '0.75rem',
                                background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px',
                                cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                opacity: loading ? 0.7 : 1, fontSize: '0.95rem',
                                boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
                            }}
                            onMouseOver={(e) => { if (!loading) e.currentTarget.style.background = '#2563eb' }}
                            onMouseOut={(e) => { if (!loading) e.currentTarget.style.background = '#3b82f6' }}
                        >
                            {loading ? <Loader2 size={18} className="spin" /> : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>}
                        </button>
                    </form>

                    <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: '#71717a' }}>
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => { setIsLogin(!isLogin); setError(''); }}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
                        >
                            {isLogin ? 'Sign up' : 'Log in'}
                        </button>
                    </div>

                    <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: '#52525b' }}>
                        By clicking continue, you agree to our <a href="#" style={{ color: '#71717a', textDecoration: 'underline' }}>Terms of Service</a> and <a href="#" style={{ color: '#71717a', textDecoration: 'underline' }}>Privacy Policy</a>.
                    </p>
                </div>
            </div>

            <style jsx global>{`
                body { margin: 0; background: #09090b; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (min-width: 1024px) {
                    .desktop-only { display: flex !important; }
                }
            `}</style>
        </div>
    );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode, text: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '50%' }}>
                {icon}
            </div>
            <span style={{ fontSize: '1rem', color: '#e2e8f0', fontWeight: '500' }}>{text}</span>
        </div>
    );
}
