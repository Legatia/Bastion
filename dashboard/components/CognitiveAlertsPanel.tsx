/**
 * MoltMind Cognitive Alerts Panel
 * Shows recent behavioral alerts for an agent
 */

import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from 'lucide-react';
import { api } from '../lib/api';

interface CognitiveAlert {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metric: string;
    message: string;
    driftScore: number;
    acknowledged: boolean;
    createdAt: string;
}

interface CognitiveAlertsPanelProps {
    agentId: string;
    alerts: CognitiveAlert[];
    onAcknowledge?: (alertId: string) => void;
}

export default function CognitiveAlertsPanel({
    agentId,
    alerts,
    onAcknowledge,
}: CognitiveAlertsPanelProps) {
    const [acknowledging, setAcknowledging] = useState<string | null>(null);

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'critical':
                return { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', color: '#ef4444' };
            case 'high':
                return { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)', color: '#f97316' };
            case 'medium':
                return { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', color: '#eab308' };
            default:
                return { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#3b82f6' };
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical':
                return AlertCircle;
            case 'high':
                return AlertTriangle;
            default:
                return Info;
        }
    };

    const handleAcknowledge = async (alertId: string) => {
        setAcknowledging(alertId);
        try {
            await api.post(`/agents/${agentId}/alerts/${alertId}/acknowledge`, {});
            onAcknowledge?.(alertId);
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
        }
        setAcknowledging(null);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);
    const acknowledgedAlerts = alerts.filter((a) => a.acknowledged);

    if (alerts.length === 0) {
        return (
            <div
                style={{
                    background: '#18181b',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'center',
                }}
            >
                <CheckCircle size={32} color="#22c55e" style={{ marginBottom: '0.5rem' }} />
                <p style={{ color: '#a1a1aa', margin: 0 }}>No alerts. Agent is behaving normally.</p>
            </div>
        );
    }

    return (
        <div
            style={{
                background: '#18181b',
                borderRadius: '12px',
                padding: '1rem',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>
                Cognitive Alerts ({unacknowledgedAlerts.length} active)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {unacknowledgedAlerts.map((alert) => {
                    const styles = getSeverityStyles(alert.severity);
                    const Icon = getSeverityIcon(alert.severity);

                    return (
                        <div
                            key={alert.id}
                            style={{
                                background: styles.bg,
                                border: `1px solid ${styles.border}`,
                                borderRadius: '8px',
                                padding: '0.75rem',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <Icon size={18} color={styles.color} style={{ marginTop: '2px' }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span
                                                style={{
                                                    textTransform: 'uppercase',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    color: styles.color,
                                                    letterSpacing: '0.5px',
                                                }}
                                            >
                                                {alert.severity}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#888' }}>
                                                {formatTime(alert.createdAt)}
                                            </span>
                                        </div>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#e4e4e7' }}>
                                            {alert.message}
                                        </p>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#888' }}>
                                            Drift: {(alert.driftScore * 100).toFixed(0)}% • Metric: {alert.metric}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleAcknowledge(alert.id)}
                                    disabled={acknowledging === alert.id}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#888',
                                        cursor: 'pointer',
                                        padding: '4px',
                                    }}
                                    title="Acknowledge"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {acknowledgedAlerts.length > 0 && (
                    <details style={{ marginTop: '0.5rem' }}>
                        <summary style={{ color: '#888', fontSize: '0.875rem', cursor: 'pointer' }}>
                            {acknowledgedAlerts.length} acknowledged
                        </summary>
                        <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
                            {acknowledgedAlerts.slice(0, 5).map((alert) => (
                                <div
                                    key={alert.id}
                                    style={{
                                        fontSize: '0.8rem',
                                        color: '#888',
                                        padding: '0.5rem 0',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    }}
                                >
                                    <span style={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>{alert.severity}</span>
                                    {' — '}
                                    {alert.message}
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
}
