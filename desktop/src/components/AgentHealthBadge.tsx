/**
 * MoltMind Agent Health Badge
 * Shows health score with color coding
 */

import { Shield, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react';

interface AgentHealthBadgeProps {
    score: number | null;
    status: 'ready' | 'computing' | 'insufficient_data';
    flags?: string[];
    size?: 'sm' | 'md' | 'lg';
}

export default function AgentHealthBadge({
    score,
    status,
    flags = [],
    size = 'md',
}: AgentHealthBadgeProps) {
    const getColor = (score: number) => {
        if (score >= 80) return '#22c55e';
        if (score >= 60) return '#eab308';
        if (score >= 40) return '#f97316';
        return '#ef4444';
    };

    const getLabel = (score: number) => {
        if (score >= 80) return 'Healthy';
        if (score >= 60) return 'Stable';
        if (score >= 40) return 'Attention';
        return 'Critical';
    };

    const getIcon = (score: number) => {
        if (score >= 80) return CheckCircle;
        if (score >= 60) return Shield;
        if (score >= 40) return AlertTriangle;
        return XCircle;
    };

    const sizeStyles = {
        sm: { padding: '4px 8px', fontSize: '0.75rem', iconSize: 14 },
        md: { padding: '6px 12px', fontSize: '0.875rem', iconSize: 16 },
        lg: { padding: '8px 16px', fontSize: '1rem', iconSize: 20 },
    };

    const styles = sizeStyles[size];

    if (status === 'computing') {
        return (
            <span
                className="inline-flex items-center gap-1.5"
                style={{
                    padding: styles.padding,
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: '20px',
                    fontSize: styles.fontSize,
                    color: '#93c5fd',
                }}
            >
                <Loader size={styles.iconSize} className="animate-spin" />
                Computing...
            </span>
        );
    }

    if (status === 'insufficient_data' || score === null) {
        return (
            <span
                className="inline-flex items-center gap-1.5"
                style={{
                    padding: styles.padding,
                    background: 'rgba(100,100,100,0.15)',
                    border: '1px solid rgba(100,100,100,0.3)',
                    borderRadius: '20px',
                    fontSize: styles.fontSize,
                    color: '#888',
                }}
            >
                <Shield size={styles.iconSize} />
                No data
            </span>
        );
    }

    const color = getColor(score);
    const label = getLabel(score);
    const Icon = getIcon(score);

    return (
        <span
            className="inline-flex items-center gap-1.5"
            style={{
                padding: styles.padding,
                background: `${color}15`,
                border: `1px solid ${color}40`,
                borderRadius: '20px',
                fontSize: styles.fontSize,
                color: color,
                fontWeight: 500,
            }}
            title={flags.length > 0 ? `Flags: ${flags.join(', ')}` : undefined}
        >
            <Icon size={styles.iconSize} />
            {score}% {label}
        </span>
    );
}
