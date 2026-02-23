import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { Shield, Activity, Power, Lock, CheckCircle, XCircle, Terminal, Bot, FileText, BarChart2, CreditCard } from 'lucide-react';
import clsx from 'clsx';

interface IdentityStatus {
    verified: boolean;
    tier?: string;
    reputation?: number;
}

interface IndustryProfile {
    id: string;
    name: string;
    description: string;
    policyCount: number;
}

interface IndustryProfilesResponse {
    profiles: IndustryProfile[];
    activeProfileId?: string | null;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [runtimeRunning, setRuntimeRunning] = useState(false);
    const [runtimeBusy, setRuntimeBusy] = useState(false);
    const [proxyRunning, setProxyRunning] = useState(false);
    const [identity, setIdentity] = useState<IdentityStatus | null>(null);
    const [loadingIdentity, setLoadingIdentity] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [activeProfileName, setActiveProfileName] = useState<string>('Default Security Bundle');

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        if (!key) { navigate('/login'); return; }

        checkStatus();
        loadActiveProfile();
        const interval = setInterval(checkStatus, 2000);
        const profileInterval = setInterval(loadActiveProfile, 30000);

        return () => {
            clearInterval(interval);
            clearInterval(profileInterval);
        };
    }, []);

    const checkStatus = async () => {
        try {
            const isRuntimeRunning = await invoke('get_openclaw_status') as boolean;
            setRuntimeRunning(isRuntimeRunning);
        } catch (e) {
            console.error("Runtime status check failed", e);
            setRuntimeRunning(false);
        }

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
            // silenced
        }

        try {
            const events = await invoke('get_behavior_events') as string[];
            setLogs(events.reverse());
        } catch (e) {
            console.error("Log fetch failed", e);
        }
    };

    const toggleRuntime = async () => {
        setRuntimeBusy(true);
        try {
            if (runtimeRunning) {
                await invoke('stop_openclaw');
                setRuntimeRunning(false);
            } else {
                await invoke('run_openclaw');
                setRuntimeRunning(true);
            }
        } catch (e) {
            console.error("Runtime toggle failed", e);
            alert("Runtime action failed: " + e);
        } finally {
            setRuntimeBusy(false);
        }
    };

    const loadActiveProfile = async () => {
        try {
            const data = await invoke<IndustryProfilesResponse>('list_industry_profiles');
            if (!data?.profiles?.length) return;

            const activeId = data.activeProfileId;
            if (!activeId) return;

            const active = data.profiles.find((p) => p.id === activeId);
            if (active?.name) {
                setActiveProfileName(active.name);
            }
        } catch (e) {
            // Keep dashboard resilient if profile endpoint is unavailable
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
            await invoke('verify_identity', { chain: 'avalanche' });
            checkStatus();
        } catch (e) {
            console.error("Verification failed", e);
            alert("Verification failed: " + e);
        }
        setLoadingIdentity(false);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex items-start justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                        <p className="text-zinc-500">Local agent runtime overview.</p>
                    </div>
                    <button
                        onClick={() => navigate('/policies')}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/15 transition-colors cursor-pointer"
                        title="Open Policies"
                    >
                        <Shield size={12} />
                        Active profile: {activeProfileName}
                    </button>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {/* Runtime Status */}
                    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl group hover:border-zinc-700 transition-colors">
                        <h3 className="text-zinc-400 text-sm font-medium mb-3 flex items-center gap-2">
                            <Activity size={16} /> Runtime Status
                        </h3>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={clsx("w-2.5 h-2.5 rounded-full", runtimeRunning ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-zinc-700")} />
                                <span className={clsx("text-xl font-bold", runtimeRunning ? "text-white" : "text-zinc-500")}>
                                    {runtimeRunning ? "Running" : "Stopped"}
                                </span>
                            </div>
                            <button
                                onClick={toggleRuntime}
                                disabled={runtimeBusy}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                                    runtimeRunning ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                                )}
                            >
                                <Power size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-zinc-500">
                            {runtimeRunning ? "OpenClaw process active" : "OpenClaw process not running"}
                        </p>
                    </div>

                    {/* Identity Card */}
                    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <h3 className="text-zinc-400 text-sm font-medium mb-3 flex items-center gap-2">
                            <Shield size={16} /> Agent Identity
                        </h3>
                        <div className="flex items-center gap-2 mb-3">
                            {identity?.verified ? (
                                <>
                                    <CheckCircle className="text-green-500" size={20} />
                                    <span className="text-xl font-bold">Verified</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="text-zinc-600" size={20} />
                                    <span className="text-xl font-bold text-zinc-500">Unverified</span>
                                </>
                            )}
                        </div>
                        {!identity?.verified && (
                            <button
                                onClick={verifyIdentity}
                                disabled={loadingIdentity}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {loadingIdentity ? 'Verifying...' : 'Verify on Avalanche'}
                            </button>
                        )}
                        {identity?.verified && (
                            <p className="text-sm text-zinc-500">ERC-8004 Registry</p>
                        )}
                    </div>

                    {/* Security Proxy */}
                    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <h3 className="text-zinc-400 text-sm font-medium mb-3 flex items-center gap-2">
                            <Lock size={16} /> Security Proxy
                        </h3>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={clsx("w-2.5 h-2.5 rounded-full", proxyRunning ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-zinc-700")} />
                                <span className={clsx("text-xl font-bold", proxyRunning ? "text-white" : "text-zinc-500")}>
                                    {proxyRunning ? "Enabled" : "Disabled"}
                                </span>
                            </div>
                            <button
                                onClick={toggleProxy}
                                className={clsx("p-2 rounded-lg transition-colors cursor-pointer", proxyRunning ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500/20")}
                            >
                                <Power size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-zinc-500">
                            {proxyRunning ? "Intercepting traffic on port 3000" : "Traffic flow unrestricted"}
                        </p>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-4 gap-3 mb-8">
                    {[
                        { icon: Bot, label: 'Agents', path: '/agents', color: 'text-blue-400' },
                        { icon: FileText, label: 'Policies', path: '/policies', color: 'text-purple-400' },
                        { icon: BarChart2, label: 'Analytics', path: '/analytics', color: 'text-green-400' },
                        { icon: CreditCard, label: 'Billing', path: '/billing', color: 'text-amber-400' },
                    ].map(link => (
                        <button
                            key={link.path}
                            onClick={() => navigate(link.path)}
                            className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl hover:border-zinc-700 hover:bg-zinc-900/50 transition-all flex items-center gap-3 cursor-pointer text-left"
                        >
                            <link.icon size={18} className={link.color} />
                            <span className="text-sm font-medium text-zinc-300">{link.label}</span>
                        </button>
                    ))}
                </div>

                {/* Logs Terminal */}
                <div className="bg-black/80 border border-zinc-800 rounded-xl p-4 font-mono text-sm overflow-hidden" style={{ height: 280 }}>
                    <div className="flex items-center gap-2 text-zinc-500 mb-3 pb-2 border-b border-zinc-800">
                        <Terminal size={14} /> Agent Logs (Real-time)
                    </div>
                    <div className="overflow-y-auto space-y-1 text-zinc-400" style={{ height: 220 }}>
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
                </div>
            </div>
        </div>
    );
}
