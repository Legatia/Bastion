import { useState, useEffect, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Box, Activity, Check, ChevronRight, Zap, Terminal, Cpu, Settings } from 'lucide-react';
import clsx from 'clsx';

interface Module {
    id: string;
    name: string;
    description: string;
    price: number;
    billing: 'one-time' | 'monthly';
    required?: boolean;
    icon: any;
}

const MODULES: Module[] = [
    {
        id: 'openclaw',
        name: 'Agent Runtime',
        description: 'Process lifecycle management for your agents',
        price: 99,
        billing: 'one-time',
        required: true,
        icon: Box,
    },
    {
        id: 'identity',
        name: 'On-Chain Identity',
        description: 'ERC-8004 verification & reputation',
        price: 5,
        billing: 'monthly',
        icon: Shield,
    },
    {
        id: 'proxy',
        name: 'Bastion Security',
        description: 'Policy enforcement proxy',
        price: 20,
        billing: 'monthly',
        icon: Shield,
    },
    {
        id: 'moltmind',
        name: 'Cognitive Monitor',
        description: 'Behavioral drift detection',
        price: 59,
        billing: 'monthly',
        icon: Activity,
    },
];

interface LogEntry {
    step: string;
    message: string;
    timestamp: string;
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

const FALLBACK_PROFILES: IndustryProfile[] = [
    { id: 'default', name: 'Default Security Bundle', description: 'Balanced baseline guardrails for general autonomous agents.', policyCount: 0 },
    { id: 'accounting', name: 'Accounting Safe Mode', description: 'Strict controls for bookkeeping and finance-adjacent automation.', policyCount: 0 },
];

export default function InstallWizard({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = useState<'select' | 'auth' | 'config' | 'install'>('select');
    const [selectedModules, setSelectedModules] = useState<string[]>(['openclaw']);
    const [apiKey, setApiKey] = useState('');
    const [industryProfiles, setIndustryProfiles] = useState<IndustryProfile[]>(FALLBACK_PROFILES);
    const [industryProfile, setIndustryProfile] = useState<string>('default');

    // LLM Config State
    const [llmMode, setLlmMode] = useState<'cloud' | 'custom'>('cloud');
    const [customProvider, setCustomProvider] = useState('openai');
    const [customKey, setCustomKey] = useState('');

    // Install State
    const [installing, setInstalling] = useState(false);
    const [progressLogs, setProgressLogs] = useState<LogEntry[]>([]);
    const [progressPct, setProgressPct] = useState(0);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [progressLogs]);

    useEffect(() => {
        if (step === 'auth') {
            const unlisten = onOpenUrl((urls) => {
                console.log('Deep link received:', urls);
                for (const url of urls) {
                    if (url.startsWith('bastion://auth')) {
                        const params = new URLSearchParams(new URL(url).search);
                        const token = params.get('token');
                        if (token) {
                            setApiKey(token);
                            setStep('config');
                        }
                    }
                }
            });
            return () => {
                unlisten.then(f => f());
            };
        }
    }, [step]);

    useEffect(() => {
        if (step !== 'config') return;

        const loadProfiles = async () => {
            try {
                const result = await invoke<IndustryProfilesResponse>('list_industry_profiles');
                if (result.profiles?.length) {
                    setIndustryProfiles(result.profiles);
                    setIndustryProfile((current) => {
                        if (result.activeProfileId && result.profiles.some((p) => p.id === result.activeProfileId)) {
                            return result.activeProfileId;
                        }
                        if (result.profiles.some((p) => p.id === current)) {
                            return current;
                        }
                        return result.profiles[0].id;
                    });
                }
            } catch (error) {
                console.warn('Failed to load industry profiles, using fallback:', error);
                setIndustryProfiles(FALLBACK_PROFILES);
                setIndustryProfile((current) =>
                    FALLBACK_PROFILES.some((p) => p.id === current) ? current : FALLBACK_PROFILES[0].id
                );
            }
        };

        loadProfiles();
    }, [step]);

    useEffect(() => {
        if (step === 'install') {
            const setupInstall = async () => {
                setInstalling(true);
                setProgressLogs([]);

                // Listen for progress events
                const unlisten = await listen<{ step: string, message: string, percentage: number }>('install_progress', (event) => {
                    const { step, message, percentage } = event.payload;
                    setProgressPct(percentage);
                    setProgressLogs(prev => [...prev, {
                        step,
                        message,
                        timestamp: new Date().toLocaleTimeString()
                    }]);
                });

                try {
                    const llmConfig = llmMode === 'cloud'
                        ? { provider: 'zai', api_key: undefined } // key supplied at runtime, never persisted
                        : { provider: customProvider, api_key: customKey || undefined };

                    await invoke('save_config', {
                        config: {
                            modules: selectedModules,
                            llm: llmConfig
                        }
                    });

                    setProgressLogs(prev => [...prev, {
                        step: 'profile',
                        message: `Applying "${industryProfile}" security profile...`,
                        timestamp: new Date().toLocaleTimeString()
                    }]);

                    try {
                        await invoke('apply_industry_profile', {
                            profileId: industryProfile,
                            replaceExistingTypes: true
                        });
                    } catch (profileError) {
                        console.warn('Profile apply skipped/failed:', profileError);
                        setProgressLogs(prev => [...prev, {
                            step: 'warning',
                            message: `Profile apply warning: ${profileError}`,
                            timestamp: new Date().toLocaleTimeString()
                        }]);
                    }

                    await invoke('install_openclaw');
                } catch (error) {
                    console.error('Failed to install agent runtime:', error);
                    setProgressLogs(prev => [...prev, {
                        step: 'error',
                        message: `Installation failed: ${error}`,
                        timestamp: new Date().toLocaleTimeString()
                    }]);
                } finally {
                    unlisten();
                    setInstalling(false);
                }
            };
            setupInstall();
        }
    }, [step, apiKey, selectedModules, llmMode, customProvider, customKey]);

    const toggleModule = (id: string, required?: boolean) => {
        if (required) return;
        setSelectedModules(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const monthlyTotal = MODULES
        .filter(m => selectedModules.includes(m.id) && m.billing === 'monthly')
        .reduce((sum, m) => sum + m.price, 0);

    const oneTimeTotal = MODULES
        .filter(m => selectedModules.includes(m.id) && m.billing === 'one-time')
        .reduce((sum, m) => sum + m.price, 0);

    return (
        <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-blue-500" /> Bastion Suite Setup
                </h2>
                <div className="flex gap-1">
                    {['select', 'auth', 'config', 'install'].map((s, i) => (
                        <div key={s} className={clsx(
                            "w-2 h-2 rounded-full",
                            i <= ['select', 'auth', 'config', 'install'].indexOf(step) ? "bg-blue-500" : "bg-zinc-800"
                        )} />
                    ))}
                </div>
            </div>

            <div className="p-8">
                <AnimatePresence mode='wait'>
                    {step === 'select' && (
                        <motion.div
                            key="select"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">Select Components</h3>
                                <p className="text-zinc-400">Choose the modules you want to install for your agent.</p>
                            </div>

                            <div className="grid gap-4">
                                {MODULES.map((module) => {
                                    const isSelected = selectedModules.includes(module.id);
                                    const Icon = module.icon;

                                    return (
                                        <div
                                            key={module.id}
                                            onClick={() => toggleModule(module.id, module.required)}
                                            className={clsx(
                                                "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                                                isSelected
                                                    ? "bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20"
                                                    : "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={clsx(
                                                    "p-2 rounded-md",
                                                    isSelected ? "bg-blue-500/20 text-blue-400" : "bg-zinc-700 text-zinc-400"
                                                )}>
                                                    <Icon size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-white">{module.name}</h4>
                                                    <p className="text-sm text-zinc-400">{module.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="block text-sm font-medium text-white">
                                                        ${module.price}
                                                    </span>
                                                    <span className="text-xs text-zinc-500 capitalize">
                                                        {module.billing}
                                                    </span>
                                                </div>
                                                <div className={clsx(
                                                    "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                                    isSelected
                                                        ? "bg-blue-500 border-blue-500"
                                                        : "border-zinc-600"
                                                )}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                                <div className="text-zinc-400 text-sm">
                                    Total: <span className="text-white font-bold">${oneTimeTotal}</span> due now + <span className="text-white font-bold">${monthlyTotal}/mo</span>
                                </div>
                                <button
                                    onClick={() => setStep('auth')}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    Continue <ChevronRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'auth' && (
                        <motion.div
                            key="auth"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">Connect Account</h3>
                                <p className="text-zinc-400">Authenticate with Bastion to activate your modules.</p>
                            </div>

                            <div className="py-8 flex flex-col items-center justify-center space-y-6">
                                <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800">
                                    <Shield size={48} className="text-zinc-600" />
                                </div>
                                <p className="text-center text-zinc-400 max-w-sm">
                                    We'll open your browser to securely log you in. Once authenticated, the app will automatically continue.
                                </p>

                                <button
                                    onClick={() => open('https://bastion.legatia.solutions/auth/desktop-callback')}
                                    className="px-8 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-full flex items-center gap-2 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                                >
                                    <Zap size={20} className="fill-black" /> Connect to Bastion
                                </button>
                            </div>

                            <div className="flex justify-between pt-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setStep('select')}
                                    className="text-zinc-400 hover:text-white transition-colors"
                                >
                                    Back
                                </button>
                                {/* Dev backdoor to skip auth if needed */}
                                {import.meta.env.MODE === 'development' && (
                                    <button onClick={() => setStep('config')} className="text-xs text-zinc-800 hover:text-zinc-700">Skip</button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 'config' && (
                        <motion.div
                            key="config"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">Agent Configuration</h3>
                                <p className="text-zinc-400">Configure the LLM provider and security profile for your agent.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Security Profile</label>
                                <select
                                    value={industryProfile}
                                    onChange={(e) => setIndustryProfile(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                >
                                    {industryProfiles.map((profile) => (
                                        <option key={profile.id} value={profile.id}>
                                            {profile.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-zinc-500 mt-1.5">
                                    {industryProfiles.find((p) => p.id === industryProfile)?.description || 'Profiles are interchangeable overlays. You can switch later in Policies.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    onClick={() => setLlmMode('cloud')}
                                    className={clsx(
                                        "relative p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center gap-3",
                                        llmMode === 'cloud'
                                            ? "bg-blue-500/10 border-blue-500"
                                            : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                                    )}
                                >
                                    <div className="p-3 bg-blue-500/20 rounded-full text-blue-400"><Cpu size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-white">Bastion Cloud</h4>
                                        <p className="text-xs text-zinc-500 mt-1">Managed LLM via Zai. Best for quick start.</p>
                                    </div>
                                    {llmMode === 'cloud' && <div className="absolute top-3 right-3"><Check size={16} className="text-blue-500" /></div>}
                                </div>

                                <div
                                    onClick={() => setLlmMode('custom')}
                                    className={clsx(
                                        "relative p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center gap-3",
                                        llmMode === 'custom'
                                            ? "bg-blue-500/10 border-blue-500"
                                            : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                                    )}
                                >
                                    <div className="p-3 bg-purple-500/20 rounded-full text-purple-400"><Settings size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-white">Custom Provider</h4>
                                        <p className="text-xs text-zinc-500 mt-1">Use your own API keys (OpenAI, Anthropic).</p>
                                    </div>
                                    {llmMode === 'custom' && <div className="absolute top-3 right-3"><Check size={16} className="text-blue-500" /></div>}
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {llmMode === 'custom' && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="space-y-4 pt-2"
                                    >
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Provider</label>
                                            <select
                                                value={customProvider}
                                                onChange={(e) => setCustomProvider(e.target.value)}
                                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="openai">OpenAI (GPT-4o)</option>
                                                <option value="anthropic">Anthropic (Claude 3.5)</option>
                                                <option value="deepseek">DeepSeek V3</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">API Key</label>
                                            <input
                                                type="password"
                                                value={customKey}
                                                onChange={(e) => setCustomKey(e.target.value)}
                                                placeholder="sk-..."
                                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex justify-between pt-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setStep('auth')}
                                    className="text-zinc-400 hover:text-white transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep('install')}
                                    disabled={llmMode === 'custom' && !customKey}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    Start Installation <ChevronRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'install' && (
                        <motion.div
                            key="install"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">Setting Up Agent Runtime</h3>
                                <p className="text-zinc-400">Configuring runtime environment and downloading dependencies.</p>
                            </div>

                            {/* Terminal UI */}
                            <div className="w-full bg-black rounded-lg border border-zinc-800 overflow-hidden font-mono text-sm">
                                <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                                    <Terminal size={14} className="text-zinc-500" />
                                    <span className="text-zinc-500">installer — bash</span>
                                </div>
                                <div className="p-4 h-64 overflow-y-auto space-y-2">
                                    {progressLogs.map((log, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex gap-3"
                                        >
                                            <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                                            <span className={clsx(
                                                log.step === 'error' ? "text-red-400" : "text-zinc-300"
                                            )}>
                                                {log.step === 'error' ? '✖' : '❯'} {log.message}
                                            </span>
                                        </motion.div>
                                    ))}
                                    {installing && (
                                        <motion.div
                                            animate={{ opacity: [0.4, 1, 0.4] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="h-4 w-2 bg-blue-500 inline-block align-middle"
                                        />
                                    )}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-zinc-500">
                                    <span>Progress</span>
                                    <span>{progressPct}%</span>
                                </div>
                                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-blue-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPct}%` }}
                                        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                                    />
                                </div>
                            </div>

                            {!installing && progressPct === 100 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-end pt-4"
                                >
                                    <button
                                        onClick={onComplete}
                                        className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                                    >
                                        <Check size={18} /> Launch Dashboard
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
