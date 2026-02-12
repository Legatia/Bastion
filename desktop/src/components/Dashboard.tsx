import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Shield, Activity, Power, Lock, CheckCircle, XCircle, Terminal } from 'lucide-react';
import clsx from 'clsx';

interface IdentityStatus {
    verified: boolean;
    tier?: string;
    reputation?: number;
}

export default function Dashboard() {
    const [proxyRunning, setProxyRunning] = useState(false);
    const [identity, setIdentity] = useState<IdentityStatus | null>(null);
    const [loadingIdentity, setLoadingIdentity] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        // Poll status
        checkStatus();
        const interval = setInterval(checkStatus, 2000); // Poll faster for logs
        return () => clearInterval(interval);
    }, []);

    const checkStatus = async () => {
        try {
            const isRunning = await invoke('get_bastion_status') as boolean;
            setProxyRunning(isRunning);
        } catch (e) {
            console.error("Proxy status check failed", e);
        }

        try {
            const idStatus = await invoke('check_identity_status') as any;
            setIdentity({ verified: idStatus.verified ?? false });
        } catch (e) {
            // calculated noise
        }

        try {
            const events = await invoke('get_behavior_events') as string[];
            setLogs(events.reverse());
        } catch (e) {
            console.error("Log fetch failed", e);
        }
    };

    const toggleProxy = async () => {
        try {
            if (proxyRunning) {
                await invoke('stop_bastion_proxy');
                setProxyRunning(false);
            } else {
                await invoke('start_bastion_proxy');
                setProxyRunning(true);
            }
        } catch (e) {
            console.error("Proxy toggle failed", e);
        }
    };

    const verifyIdentity = async () => {
        setLoadingIdentity(true);
        try {
            // Hardcoded chain for now, typically user selects
            await invoke('verify_identity', { chain: 'base-sepolia' });
            checkStatus();
        } catch (e) {
            console.error("Verification failed", e);
            alert("Verification failed: " + e);
        }
        setLoadingIdentity(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Agent Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Runtime Status */}
                <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-zinc-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <Activity size={16} /> Runtime Status
                    </h3>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        <span className="text-xl font-bold text-white">Active</span>
                    </div>
                    <p className="text-sm text-zinc-500">OpenClaw v1.0.2 running</p>
                </div>

                {/* Identity Card */}
                <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl relative overflow-hidden">
                    <h3 className="text-zinc-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <Shield size={16} /> Agent Identity
                    </h3>
                    <div className="flex items-center gap-3 mb-4">
                        {identity?.verified ? (
                            <>
                                <CheckCircle className="text-green-500" size={24} />
                                <span className="text-xl font-bold text-white">Verified</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="text-zinc-600" size={24} />
                                <span className="text-xl font-bold text-zinc-500">Unverified</span>
                            </>
                        )}
                    </div>

                    {!identity?.verified && (
                        <button
                            onClick={verifyIdentity}
                            disabled={loadingIdentity}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loadingIdentity ? 'Verifying...' : 'Verify on Base Sepolia'}
                        </button>
                    )}
                    {identity?.verified && (
                        <p className="text-sm text-zinc-500">ERC-8004 Registry #402</p>
                    )}
                </div>

                {/* Security Proxy */}
                <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl relative overflow-hidden">
                    <h3 className="text-zinc-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <Lock size={16} /> Security Proxy
                    </h3>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className={clsx("w-3 h-3 rounded-full transition-colors", proxyRunning ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-zinc-700")} />
                            <span className={clsx("text-xl font-bold transition-colors", proxyRunning ? "text-white" : "text-zinc-500")}>
                                {proxyRunning ? "Enabled" : "Disabled"}
                            </span>
                        </div>
                        <button
                            onClick={toggleProxy}
                            className={clsx("p-2 rounded-lg transition-colors", proxyRunning ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500/20")}
                        >
                            <Power size={20} />
                        </button>
                    </div>
                    <p className="text-sm text-zinc-500">
                        {proxyRunning ? "Intercepting traffic on port 3000" : "Traffic flow restricted"}
                    </p>
                </div>
            </div>

            {/* Logs Terminal */}
            <div className="mt-8 bg-black/80 border border-zinc-800 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto flex flex-col-reverse">
                <div className="space-y-1 text-zinc-400">
                    {logs.length === 0 ? (
                        <p className="text-zinc-600 italic">Waiting for agent activity...</p>
                    ) : (
                        logs.map((log, i) => (
                            <p key={i} className="break-all border-b border-zinc-900/50 pb-1 mb-1 last:border-0">
                                <span className={clsx(
                                    log.includes("STDERR") ? "text-red-400" :
                                        log.includes("PROXY") ? "text-amber-400" : "text-blue-400"
                                )}>
                                    {log.split(' ')[0]}
                                </span>
                                <span className="ml-2 text-zinc-300">{log.substring(log.indexOf(' ') + 1)}</span>
                            </p>
                        ))
                    )}
                </div>
                <div className="flex items-center gap-2 text-zinc-500 mb-2 pb-2 border-b border-zinc-800 sticky top-0 bg-black/80">
                    <Terminal size={14} /> Agent Logs (Real-time)
                </div>
            </div>
        </div>
    );
}
