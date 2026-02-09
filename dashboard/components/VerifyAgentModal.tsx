import { useState, useEffect } from 'react';
import { Shield, Mail, CheckCircle, Loader, ExternalLink, X } from 'lucide-react';
import { usePrivy, useLoginWithEmail, useSendTransaction } from '@privy-io/react-auth';
import { api } from '../lib/api';

interface VerifyAgentModalProps {
    agent: { id: string; name: string };
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'email' | 'otp' | 'ready' | 'signing' | 'confirming' | 'success';

export default function VerifyAgentModal({ agent, onClose, onSuccess }: VerifyAgentModalProps) {
    const [step, setStep] = useState<Step>('email');
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [txHash, setTxHash] = useState('');
    const [onchainId, setOnchainId] = useState('');

    const { ready, authenticated, user, logout } = usePrivy();
    const { sendCode, loginWithCode, state: loginState } = useLoginWithEmail();
    const { sendTransaction } = useSendTransaction();

    const chain = 'base-sepolia';
    const explorerUrl = chain === 'base-sepolia'
        ? 'https://sepolia.basescan.org'
        : 'https://basescan.org';

    // If already authenticated, skip to ready step
    useEffect(() => {
        if (ready && authenticated && user?.wallet?.address) {
            setStep('ready');
        }
    }, [ready, authenticated, user]);

    const handleSendOtp = async () => {
        setError('');
        if (!email.trim()) {
            setError('Please enter your email');
            return;
        }
        try {
            await sendCode({ email });
            setStep('otp');
        } catch (err: any) {
            setError(err.message || 'Failed to send code');
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        if (!otp.trim()) {
            setError('Please enter the code');
            return;
        }
        try {
            await loginWithCode({ code: otp });
            // User is now logged in, wallet created automatically
            setStep('ready');
        } catch (err: any) {
            setError(err.message || 'Invalid code');
        }
    };

    const submitVerification = async () => {
        setError('');
        setStep('signing');

        try {
            // 1. Get transaction data from backend
            const txData = await api.post<{
                transaction: { to: string; data: string; chainId: number; value: string };
                agentURI: string;
            }>(`/agents/${agent.id}/verify`, { chain });

            setStep('confirming');

            // 2. Send transaction via Privy
            const receipt = await sendTransaction({
                to: txData.transaction.to as `0x${string}`,
                data: txData.transaction.data as `0x${string}`,
                value: BigInt(0),
                chainId: txData.transaction.chainId,
            });

            if (!receipt?.hash) {
                throw new Error('Transaction failed');
            }

            setTxHash(receipt.hash);

            // 3. Parse the tokenId from logs (simplified - may need adjustment)
            // For now, we'll use a placeholder and let the backend handle it
            const agentIdFromChain = '0'; // Backend should parse this from tx receipt
            setOnchainId(agentIdFromChain);

            // 4. Confirm with backend
            await api.post(`/agents/${agent.id}/verify/confirm`, {
                onchainId: agentIdFromChain,
                registryChain: chain,
                ownerAddress: user?.wallet?.address,
                txHash: receipt.hash,
            });

            setStep('success');
        } catch (err: any) {
            console.error('Verification failed:', err);
            setError(err.message || 'Verification failed');
            setStep('ready');
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

    const inputStyle: React.CSSProperties = {
        width: '100%', background: '#000', border: '1px solid #333',
        padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none',
        fontSize: '1rem', marginBottom: '1rem',
    };

    const buttonStyle: React.CSSProperties = {
        background: '#3b82f6', color: '#fff', border: 'none',
        padding: '14px 28px', borderRadius: '10px', cursor: 'pointer',
        fontWeight: '600', width: '100%', fontSize: '1rem',
    };

    if (!ready) {
        return (
            <div style={modalStyle}>
                <div style={contentStyle}>
                    <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

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

                {/* Trust Hook Message */}
                <div style={{
                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem'
                }}>
                    <p style={{ margin: 0, color: '#93c5fd', fontSize: '0.9rem' }}>
                        <strong>Clients only trust verified agents.</strong><br />
                        Verified agents can receive payments.
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '8px', padding: '12px', marginBottom: '1rem', color: '#ef4444'
                    }}>
                        {error}
                    </div>
                )}

                {/* Step: Email */}
                {step === 'email' && (
                    <div>
                        <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>
                            Enter your email to create a wallet and verify <strong>{agent.name}</strong>.
                        </p>
                        <input
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={inputStyle}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                        />
                        <button
                            onClick={handleSendOtp}
                            style={buttonStyle}
                            disabled={loginState.status === 'sending-code'}
                        >
                            {loginState.status === 'sending-code' ? 'Sending...' : 'Continue with Email'}
                        </button>
                    </div>
                )}

                {/* Step: OTP */}
                {step === 'otp' && (
                    <div>
                        <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>
                            We sent a code to <strong>{email}</strong>
                        </p>
                        <input
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.5rem' }}
                            maxLength={6}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                        />
                        <button
                            onClick={handleVerifyOtp}
                            style={buttonStyle}
                            disabled={loginState.status === 'awaiting-code-input'}
                        >
                            Verify Code
                        </button>
                        <button
                            onClick={() => setStep('email')}
                            style={{ ...buttonStyle, background: 'transparent', color: '#888', marginTop: '0.5rem' }}
                        >
                            Use different email
                        </button>
                    </div>
                )}

                {/* Step: Ready */}
                {step === 'ready' && (
                    <div>
                        <div style={{
                            background: '#000', borderRadius: '8px', padding: '1rem', marginBottom: '1rem',
                            border: '1px solid #333'
                        }}>
                            <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '0.8rem' }}>Your Wallet</p>
                            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
                            </p>
                        </div>

                        <div style={{
                            background: '#000', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem',
                            border: '1px solid #333'
                        }}>
                            <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '0.8rem' }}>Agent to Verify</p>
                            <p style={{ margin: 0, fontWeight: '600' }}>{agent.name}</p>
                            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '0.8rem' }}>
                                Network: Base Sepolia (Testnet)
                            </p>
                        </div>

                        <button onClick={submitVerification} style={{ ...buttonStyle, background: '#22c55e' }}>
                            Verify Now (Free)
                        </button>
                        <p style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', marginTop: '8px' }}>
                            You'll only pay network gas fees
                        </p>
                    </div>
                )}

                {/* Step: Signing / Confirming */}
                {(step === 'signing' || step === 'confirming') && (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <Loader size={48} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ color: '#a1a1aa', marginTop: '1rem' }}>
                            {step === 'signing' ? 'Preparing transaction...' : 'Confirming on-chain...'}
                        </p>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircle size={64} color="#22c55e" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>Agent Verified!</h3>
                        <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>
                            <strong>{agent.name}</strong> is now on-chain
                        </p>

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

                        <button onClick={handleSuccess} style={buttonStyle}>
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
