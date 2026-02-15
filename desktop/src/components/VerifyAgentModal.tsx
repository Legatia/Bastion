/**
 * Verify Agent Modal
 * Allows ERC-8004 on-chain registration via CDP wallet (server-side)
 * Adapted from dashboard's VerifyAgentModal for desktop (no Privy dependency)
 */

import { useState } from 'react';
import { Shield, CheckCircle, Loader, X } from 'lucide-react';
import { api } from '../lib/api';

interface VerifyAgentModalProps {
    agent: { id: string; name: string };
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'confirm' | 'registering' | 'success' | 'error';

export default function VerifyAgentModal({ agent, onClose, onSuccess }: VerifyAgentModalProps) {
    const [step, setStep] = useState<Step>('confirm');
    const [chain, setChain] = useState('base');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    const handleRegister = async () => {
        setStep('registering');
        setError('');
        try {
            const data = await api.post<any>(`/agents/${agent.id}/register`, { chain });
            setResult(data);
            setStep('success');
        } catch (err: any) {
            setError(err?.message || 'Registration failed');
            setStep('error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full relative"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer bg-transparent border-none"
                >
                    <X size={18} />
                </button>

                {step === 'confirm' && (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Shield size={22} className="text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Register Agent On-Chain</h3>
                                <p className="text-sm text-zinc-500">ERC-8004 Identity Registry</p>
                            </div>
                        </div>

                        <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 mb-4">
                            <div className="text-sm text-zinc-400 mb-1">Agent</div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-xs text-zinc-600 mt-1 font-mono">{agent.id}</div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm text-zinc-400 mb-2">Chain</label>
                            <select
                                value={chain}
                                onChange={e => setChain(e.target.value)}
                                className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm"
                            >
                                <option value="base">Base (Mainnet)</option>
                                <option value="base-sepolia">Base Sepolia (Testnet)</option>
                            </select>
                        </div>

                        <p className="text-xs text-zinc-600 mb-4">
                            This will register your agent on the ERC-8004 Identity Registry using a CDP-managed wallet. No gas fees — the server signs and broadcasts the transaction.
                        </p>

                        <button
                            onClick={handleRegister}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
                        >
                            Register on {chain === 'base-sepolia' ? 'Testnet' : 'Mainnet'}
                        </button>
                    </>
                )}

                {step === 'registering' && (
                    <div className="py-8 text-center">
                        <Loader size={32} className="text-blue-400 animate-spin mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Registering On-Chain</h3>
                        <p className="text-sm text-zinc-500">Waiting for transaction confirmation...</p>
                        <p className="text-xs text-zinc-600 mt-2">This may take 15-30 seconds</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="py-6 text-center">
                        <CheckCircle size={40} className="text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Agent Registered!</h3>
                        <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 mb-4 text-left space-y-2">
                            {result?.agent?.onchainId && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">On-chain ID</span>
                                    <span className="font-mono">#{result.agent.onchainId}</span>
                                </div>
                            )}
                            {result?.agent?.ownerAddress && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Registrar</span>
                                    <span className="font-mono text-xs">{result.agent.ownerAddress.slice(0, 10)}...{result.agent.ownerAddress.slice(-6)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">Chain</span>
                                <span>{chain}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => { onSuccess(); onClose(); }}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                )}

                {step === 'error' && (
                    <div className="py-6 text-center">
                        <X size={40} className="text-red-400 mx-auto mb-4 p-2 bg-red-500/10 rounded-full" />
                        <h3 className="text-lg font-semibold mb-2">Registration Failed</h3>
                        <p className="text-sm text-red-400 mb-4">{error}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep('confirm')}
                                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors cursor-pointer"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
