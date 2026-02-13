/**
 * MoltMind Cognitive Alerts Panel
 * Shows recent behavioral alerts for an agent with acknowledge action
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
            case 'critical': return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#f87171' };
            case 'high': return { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#fb923c' };
            case 'medium': return { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#facc15' };
            default: return { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa' };
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <X size={14} className="text-red-400" />;
            case 'high': return <AlertTriangle size={14} className="text-orange-400" />;
            case 'medium': return <AlertCircle size={14} className="text-yellow-400" />;
            default: return <Info size={14} className="text-blue-400" />;
        }
    };

    const handleAcknowledge = async (alertId: string) => {
        setAcknowledging(alertId);
        try {
            await api.post(`/agents/${agentId}/alerts/${alertId}/acknowledge`, {});
            onAcknowledge?.(alertId);
        } catch (err) {
            console.error('Failed to acknowledge alert', err);
        } finally {
            setAcknowledging(null);
        }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return `${Math.floor(diffHrs / 24)}d ago`;
    };

    if (alerts.length === 0) {
        return (
            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg text-center">
                <CheckCircle size={20} className="text-green-500 mx-auto mb-2" />
                <p className="text-sm text-green-400">No active alerts</p>
                <p className="text-xs text-zinc-600 mt-1">Agent behavior is within normal parameters</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    Cognitive Alerts ({alerts.filter(a => !a.acknowledged).length} active)
                </h4>
            </div>

            {alerts.map(alert => {
                const styles = getSeverityStyles(alert.severity);
                return (
                    <div
                        key={alert.id}
                        className="flex items-start gap-3 p-3 rounded-lg transition-opacity"
                        style={{
                            background: styles.bg,
                            border: `1px solid ${styles.border}`,
                            opacity: alert.acknowledged ? 0.5 : 1,
                        }}
                    >
                        <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium" style={{ color: styles.text }}>
                                    {alert.type.replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs text-zinc-600">{formatTime(alert.createdAt)}</span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">{alert.message}</p>
                            {alert.driftScore > 0 && (
                                <p className="text-xs text-zinc-600 mt-1">Drift: {alert.driftScore.toFixed(1)}</p>
                            )}
                        </div>
                        {!alert.acknowledged && (
                            <button
                                onClick={() => handleAcknowledge(alert.id)}
                                disabled={acknowledging === alert.id}
                                className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0 bg-transparent border-none"
                                title="Acknowledge"
                            >
                                <CheckCircle size={14} className={acknowledging === alert.id ? 'text-zinc-600 animate-pulse' : 'text-zinc-500 hover:text-green-400'} />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
