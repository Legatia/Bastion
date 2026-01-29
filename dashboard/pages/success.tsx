import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle, ArrowRight, Zap } from 'lucide-react';

export default function Success() {
    const router = useRouter();
    const [progress, setProgress] = useState(0);
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        // Fetch API Key from storage
        const key = localStorage.getItem('bastion_api_key');
        if (key) setApiKey(key);

        // Simulate a "Securing System" progress bar
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(timer);
                    return 100;
                }
                return prev + 2;
            });
        }, 30);
        return () => clearInterval(timer);
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#09090b',
            color: '#fff',
            fontFamily: 'Inter, sans-serif'
        }}>
            <Head>
                <title>System Secured | Bastion</title>
            </Head>

            <div style={{ maxWidth: '500px', width: '100%', padding: '2rem', textAlign: 'center' }}>

                {/* Animated Icon */}
                <div style={{
                    marginBottom: '2rem',
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        position: 'absolute',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: 'rgba(34, 197, 94, 0.2)',
                        animation: 'pulse 2s infinite'
                    }}></div>
                    <ShieldCheck size={64} className="text-green-500" style={{ color: '#22c55e', position: 'relative', zIndex: 10 }} />
                </div>

                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem', background: 'linear-gradient(to right, #fff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Protocol Activated
                </h1>

                <p style={{ color: '#a1a1aa', fontSize: '1.1rem', marginBottom: '3rem', lineHeight: '1.6' }}>
                    Your payment was successful. The specialized firewall has been deployed to secure your agent infrastructure.
                </p>

                {/* Progress Bar */}
                <div style={{ marginBottom: '3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', height: '6px', width: '100%', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: '#22c55e',
                        transition: 'width 0.1s linear',
                        boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                    }}></div>
                </div>

                <div style={{ display: 'grid', gap: '1rem', marginBottom: '3rem', textAlign: 'left' }}>
                    <FeatureRow icon={<CheckCircle size={20} color="#22c55e" />} text="Real-time transaction monitoring active" delay="0s" />
                    <FeatureRow icon={<CheckCircle size={20} color="#22c55e" />} text="Policy engine synced with edge nodes" delay="0.5s" />
                    <FeatureRow icon={<CheckCircle size={20} color="#22c55e" />} text="Audit logging enabled" delay="1s" />
                </div>

                {/* API Key Section */}
                {apiKey && progress === 100 && (
                    <div style={{
                        marginBottom: '2rem', padding: '1.5rem',
                        background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                        textAlign: 'left', animation: 'slideIn 0.5s ease-out'
                    }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#fff' }}>Initialize your Agent</h3>
                        <p style={{ fontSize: '0.9rem', color: '#a1a1aa', marginBottom: '1rem' }}>Run this command to connect your local CLI:</p>

                        <div style={{
                            background: '#000', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace',
                            fontSize: '0.9rem', color: '#22c55e', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span>bastion login --key {apiKey}</span>
                            <button
                                onClick={() => navigator.clipboard.writeText(`bastion login --key ${apiKey}`)}
                                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => router.push('/analytics')}
                    style={{
                        background: '#fff',
                        color: '#000',
                        border: 'none',
                        padding: '1rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '600',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'transform 0.2s',
                        opacity: progress === 100 ? 1 : 0.5,
                        pointerEvents: progress === 100 ? 'auto' : 'none'
                    }}
                >
                    Enter Dashboard <ArrowRight size={18} />
                </button>
            </div>

            <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.5; }
          70% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}

function FeatureRow({ icon, text, delay }: { icon: any, text: string, delay: string }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#e4e4e7',
            animation: `slideIn 0.5s ease-out forwards`,
            animationDelay: delay,
            opacity: 0
        }}>
            {icon}
            <span>{text}</span>
        </div>
    )
}
