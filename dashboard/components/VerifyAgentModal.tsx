import { useState } from 'react';
import { Shield, CheckCircle, Loader, ExternalLink, X } from 'lucide-react';
import { api } from '../lib/api';

interface VerifyAgentModalProps {
    agent: { id: string; name: string; cdpWalletAddress?: string };
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'confirm' | 'registering' | 'success' | 'error';

export default function VerifyAgentModal({ agent, onClose, onSuccess }: VerifyAgentModalProps) {
    const [step, setStep] = useState<Step>('confirm');
    const [error, setError] = useState('');
    const [txHash, setTxHash] = useState('');

    const chain = 'base';
    const explorerUrl = 'https://basescan.org';

    const handleRegister = async () => {
        setError('');
        setStep('registering');

        try {
            const result = await api.post<{
                agent: { onchainId: string; ownerAddress: string };
                message: string;
            }>(`/agents/${agent.id}/register`, { chain });

            // txHash comes from the registration response
            setTxHash((result as any).txHash || '');
            setStep('success');
        } catch (err: any) {
            const message = err?.response?.data?.error || err.message || 'Registration failed';
            setError(message);
            setStep('error');
        }
    };

    const handleSuccess = () => {
        onSuccess();
        onClose();
    };

    const modalStyle: React.CSSProperties = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    };

    const contentStyle: React.CSSProperties = {
        background: '#18181b', borderRadius: '16px', padding: '2rem',
        maxWidth: '480px', width: '90%', border: '1px solid rgba(255,255,255,0.1)',
    };

    const buttonStyle: React.CSSProperties = {
        background: '#3b82f6', color: '#fff', border: 'none',
        padding: '14px 28px', borderRadius: '10px', cursor: 'pointer',
        fontWeight: '600', width: '100%', fontSize: '1rem',
    };

    return (
        <div style={modalStyle} onClick={onClose}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield size={24} color="#3b82f6" />
                        Verify Agent
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Step: Confirm */}
                {step === 'confirm' && (
                    <div>
                        <div style={{
                            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                            borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem'
                        }}>
                            <p style={{ margin: 0, color: '#93c5fd', fontSize: '0.9rem' }}>
                                <strong>On-chain verification via ERC-8004.</strong><br />
                                Your agent gets a verifiable identity on Base. No wallet or signing required.
                            </p>
                        </div>

                        <div style={{
                            background: '#000', borderRadius: '8px', padding: '1rem', marginBottom: '1rem',
                            border: '1px solid #333'
                        }}>
                            <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '0.8rem' }}>Agent</p>
                            <p style={{ margin: 0, fontWeight: '600' }}>{agent.name}</p>
                        </div>

                        <div style={{
                            background: '#000', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem',
                            border: '1px solid #333'
                        }}>
                            <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '0.8rem' }}>Network</p>
                            <p style={{ margin: 0 }}>Base (Mainnet)</p>
                        </div>

                        <button onClick={handleRegister} style={{ ...buttonStyle, background: '#22c55e' }}>
                            Register On-Chain
                        </button>
                        <p style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', marginTop: '8px' }}>
                            One click — no wallet, no gas, no signing
                        </p>
                    </div>
                )}

                {/* Step: Registering */}
                {step === 'registering' && (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <Loader size={48} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ color: '#a1a1aa', marginTop: '1rem' }}>
                            Registering agent on-chain...
                        </p>
                        <p style={{ color: '#555', fontSize: '0.8rem' }}>
                            This may take a few seconds
                        </p>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* Step: Error */}
                {step === 'error' && (
                    <div>
                        <div style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '8px', padding: '12px', marginBottom: '1.5rem', color: '#ef4444'
                        }}>
                            {error}
                        </div>
                        <button onClick={() => setStep('confirm')} style={buttonStyle}>
                            Try Again
                        </button>
                    </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircle size={64} color="#22c55e" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>Agent Verified!</h3>
                        <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>
                            <strong>{agent.name}</strong> is now registered on-chain
                        </p>

                        {txHash && (
                            <a
                                href={`${explorerUrl}/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    color: '#3b82f6', textDecoration: 'none', marginBottom: '1.5rem'
                                }}
                            >
                                View on Explorer <ExternalLink size={16} />
                            </a>
                        )}

                        <button onClick={handleSuccess} style={buttonStyle}>
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
