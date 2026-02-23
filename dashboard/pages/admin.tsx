import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { API_BASE_URL } from '../lib/api';

type AttestStatus = {
    enabled: boolean;
    network: string;
    walletName: string;
    walletAddress: string;
    contractAddress: string | null;
    lastErrorHint: string | null;
    healthCheckpoint?: {
        enabled: boolean;
        intervalHours: number;
        minEvents: number;
    };
};

type LaunchMetrics = {
    window: {
        days: number;
        start: string;
        end: string;
    };
    funnel: {
        signups: number;
        activatedUsers: number;
        usersWithPolicies: number;
        usersWithChecks: number;
        activationRate: number;
        policySetupRate: number;
        firstCheckRate: number;
    };
    usage: {
        totalAuthorizeChecks: number;
        blockedChecks: number;
        blockRate: number;
    };
    revenue: {
        paidUsers: number;
        starterUsers: number;
        proUsers: number;
        enterpriseUsers: number;
        estimatedMrrUsd: number;
    };
};

export default function AdminPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<AttestStatus | null>(null);
    const [launchMetrics, setLaunchMetrics] = useState<LaunchMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        const userRaw = localStorage.getItem('bastion_user');
        let user: any = null;
        if (userRaw) {
            try {
                user = JSON.parse(userRaw);
            } catch {
                user = null;
            }
        }

        if (!key) {
            router.push('/login?redirect=/admin');
            return;
        }

        if (!user?.isAdmin) {
            router.push('/analytics');
            return;
        }

        Promise.all([
            fetch(`${API_BASE_URL}/attest/status`).then((res) => res.json()),
            fetch(`${API_BASE_URL}/admin/launch-metrics?days=30`, {
                headers: { 'X-API-Key': key },
            }).then((res) => {
                if (!res.ok) throw new Error(`Launch metrics failed (${res.status})`);
                return res.json();
            }),
        ])
            .then(([attestData, metricsData]) => {
                setStatus(attestData);
                setLaunchMetrics(metricsData);
            })
            .catch((err) => setError(err.message || 'Failed to load admin status'))
            .finally(() => setLoading(false));
    }, [router]);

    return (
        <div style={{ minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Navbar />
            <main style={{ maxWidth: '980px', margin: '0 auto', padding: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Admin Dashboard</h1>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                    Internal controls and operational status.
                </p>

                {loading && <p>Loading...</p>}
                {error && <p style={{ color: '#f87171' }}>{error}</p>}

                {!loading && status && (
                    <>
                        <div style={{
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '12px',
                            padding: '1rem',
                            background: 'rgba(15,23,42,0.45)',
                            marginBottom: '1rem',
                        }}>
                            <h2 style={{ marginTop: 0 }}>On-Chain Attestation</h2>
                            <p><strong>Enabled:</strong> {String(status.enabled)}</p>
                            <p><strong>Network:</strong> {status.network}</p>
                            <p><strong>Wallet:</strong> {status.walletName}</p>
                            <p><strong>Wallet Address:</strong> {status.walletAddress}</p>
                            <p><strong>Contract:</strong> {status.contractAddress || 'Not configured'}</p>
                            <p><strong>Checkpoint Enabled:</strong> {String(Boolean(status.healthCheckpoint?.enabled))}</p>
                            <p><strong>Checkpoint Interval:</strong> {status.healthCheckpoint?.intervalHours ?? 24}h</p>
                            <p><strong>Checkpoint Min Events:</strong> {status.healthCheckpoint?.minEvents ?? 10}</p>
                            {status.lastErrorHint && (
                                <p style={{ color: '#fbbf24' }}>
                                    <strong>Hint:</strong> {status.lastErrorHint}
                                </p>
                            )}
                        </div>

                        {launchMetrics && (
                            <div style={{
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '12px',
                                padding: '1rem',
                                background: 'rgba(2,132,199,0.15)',
                            }}>
                                <h2 style={{ marginTop: 0 }}>Launch Metrics (30d)</h2>
                                <p><strong>Signups:</strong> {launchMetrics.funnel.signups}</p>
                                <p><strong>Activated (agent created):</strong> {launchMetrics.funnel.activatedUsers} ({launchMetrics.funnel.activationRate}%)</p>
                                <p><strong>Policy setup:</strong> {launchMetrics.funnel.usersWithPolicies} ({launchMetrics.funnel.policySetupRate}%)</p>
                                <p><strong>First authorize check:</strong> {launchMetrics.funnel.usersWithChecks} ({launchMetrics.funnel.firstCheckRate}%)</p>
                                <p><strong>Total authorize checks:</strong> {launchMetrics.usage.totalAuthorizeChecks}</p>
                                <p><strong>Block rate:</strong> {launchMetrics.usage.blockRate}%</p>
                                <p><strong>Paid users:</strong> {launchMetrics.revenue.paidUsers}</p>
                                <p><strong>Estimated MRR:</strong> ${launchMetrics.revenue.estimatedMrrUsd}</p>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
