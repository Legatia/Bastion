import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/router';
import { Shield, Save, Plus, Trash2, AlertTriangle, Lock, Clock, FileText, Zap, CheckCircle } from 'lucide-react';

// DLP Pattern Types (matches backend)
const DLP_PATTERN_TYPES = [
  { id: 'OPENAI_API_KEY', name: 'OpenAI API Key', severity: 'CRITICAL', category: 'API Keys' },
  { id: 'ANTHROPIC_API_KEY', name: 'Anthropic API Key', severity: 'CRITICAL', category: 'API Keys' },
  { id: 'AWS_ACCESS_KEY', name: 'AWS Access Key', severity: 'CRITICAL', category: 'API Keys' },
  { id: 'GITHUB_TOKEN', name: 'GitHub Token', severity: 'HIGH', category: 'API Keys' },
  { id: 'STRIPE_KEY', name: 'Stripe API Key', severity: 'CRITICAL', category: 'API Keys' },
  { id: 'SLACK_TOKEN', name: 'Slack Token', severity: 'HIGH', category: 'API Keys' },
  { id: 'GOOGLE_API_KEY', name: 'Google API Key', severity: 'HIGH', category: 'API Keys' },

  { id: 'CREDIT_CARD', name: 'Credit Card Number', severity: 'CRITICAL', category: 'PII' },
  { id: 'SSN', name: 'Social Security Number', severity: 'CRITICAL', category: 'PII' },
  { id: 'PHONE_NUMBER', name: 'Phone Number', severity: 'MEDIUM', category: 'PII' },
  { id: 'EMAIL_ADDRESS', name: 'Email Address', severity: 'LOW', category: 'PII' },
  { id: 'IP_ADDRESS', name: 'IP Address', severity: 'LOW', category: 'PII' },

  { id: 'PASSWORD', name: 'Password', severity: 'HIGH', category: 'Credentials' },
  { id: 'DATABASE_URL', name: 'Database URL', severity: 'CRITICAL', category: 'Credentials' },
  { id: 'CONNECTION_STRING', name: 'Connection String', severity: 'CRITICAL', category: 'Credentials' },

  { id: 'PRIVATE_KEY', name: 'Private Key (RSA)', severity: 'CRITICAL', category: 'Crypto Keys' },
  { id: 'SSH_KEY', name: 'SSH Private Key', severity: 'CRITICAL', category: 'Crypto Keys' },
  { id: 'PGP_KEY', name: 'PGP Private Key', severity: 'CRITICAL', category: 'Crypto Keys' },
  { id: 'JWT_TOKEN', name: 'JWT Token', severity: 'MEDIUM', category: 'Crypto Keys' },

  { id: 'AZURE_KEY', name: 'Azure Key', severity: 'MEDIUM', category: 'Cloud' },
  { id: 'HEROKU_API_KEY', name: 'Heroku API Key', severity: 'HIGH', category: 'Cloud' },

  { id: 'IBAN', name: 'IBAN Number', severity: 'HIGH', category: 'Financial' },
  { id: 'ROUTING_NUMBER', name: 'Bank Routing Number', severity: 'MEDIUM', category: 'Financial' },
];

type PolicyType = 'DLP' | 'RATE_LIMIT' | 'TIME_WINDOW' | 'ALLOWLIST' | 'BLOCKLIST' | 'FILE_PROTECTION' | 'SPENDING_LIMIT';

interface Policy {
  id?: string;
  name: string;
  type: PolicyType;
  enabled: boolean;
  priority: number;
  config: any;
}

interface IndustryProfile {
  id: string;
  name: string;
  description: string;
  version?: string;
  policyCount: number;
}

interface IndustryProfilesResponse {
  profiles: IndustryProfile[];
  activeProfileId?: string | null;
  activeProfileVersion?: string | null;
}

export default function PoliciesV2() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activeTab, setActiveTab] = useState<PolicyType>('DLP');
  const [isSaved, setIsSaved] = useState(false);
  const [profiles, setProfiles] = useState<IndustryProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('default');
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isApplyingProfile, setIsApplyingProfile] = useState(false);

  // DLP State
  const [dlpEnabled, setDlpEnabled] = useState(true);
  const [severityThreshold, setSeverityThreshold] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [enabledPatterns, setEnabledPatterns] = useState<string[]>([
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AWS_ACCESS_KEY', 'CREDIT_CARD', 'SSN', 'PASSWORD', 'DATABASE_URL', 'PRIVATE_KEY'
  ]);
  const [customPatterns, setCustomPatterns] = useState<string[]>([]);

  // Rate Limit State
  const [maxRequests, setMaxRequests] = useState('100');
  const [ratePer, setRatePer] = useState<'1m' | '1h' | '24h'>('1h');

  // Time Window State
  const [timeWindowEnabled, setTimeWindowEnabled] = useState(false);
  const [allowedHoursStart, setAllowedHoursStart] = useState('9');
  const [allowedHoursEnd, setAllowedHoursEnd] = useState('18');
  const [allowedDays, setAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Allowlist State
  const [allowedDomains, setAllowedDomains] = useState<string[]>(['api.openai.com', 'api.anthropic.com']);

  // Spending Limit State
  const [spendLimit, setSpendLimit] = useState('1000');

  useEffect(() => {
    const key = localStorage.getItem('bastion_api_key');
    if (!key) {
      router.push('/login');
      return;
    }

    // Load existing policies
    api.get<{ policies: Policy[] }>('/policies')
      .then(data => {
        setPolicies(data.policies);

        // Populate form from existing policies
        const dlpPolicy = data.policies.find(p => p.type === 'DLP');
        if (dlpPolicy) {
          setDlpEnabled(dlpPolicy.enabled);
          setSeverityThreshold(dlpPolicy.config.severity_threshold || 'MEDIUM');
          setEnabledPatterns(dlpPolicy.config.enabled_pattern_types || []);
          setCustomPatterns(dlpPolicy.config.scan_patterns || []);
        }

        const rateLimitPolicy = data.policies.find(p => p.type === 'RATE_LIMIT');
        if (rateLimitPolicy) {
          setMaxRequests(rateLimitPolicy.config.max_requests?.toString() || '100');
          setRatePer(rateLimitPolicy.config.per || '1h');
        }

        const allowlistPolicy = data.policies.find(p => p.type === 'ALLOWLIST');
        if (allowlistPolicy) {
          setAllowedDomains(allowlistPolicy.config.allowed_values || []);
        }
      })
      .catch(err => console.error('Failed to load policies:', err));

    api.get<IndustryProfilesResponse>('/industry-profiles')
      .then(data => {
        setProfiles(data.profiles);
        const activeProfileId = data.activeProfileId;
        setActiveProfileId(activeProfileId || null);
        if (data.profiles.length > 0 && activeProfileId && data.profiles.some((p) => p.id === activeProfileId)) {
          setSelectedProfile(activeProfileId);
        } else if (data.profiles.length > 0) {
          setSelectedProfile((current) =>
            data.profiles.some((p) => p.id === current) ? current : data.profiles[0].id
          );
        }
      })
      .catch(err => console.error('Failed to load industry profiles:', err));
  }, []);

  const togglePattern = (patternId: string) => {
    if (enabledPatterns.includes(patternId)) {
      setEnabledPatterns(enabledPatterns.filter(p => p !== patternId));
    } else {
      setEnabledPatterns([...enabledPatterns, patternId]);
    }
  };

  const savePolicy = async (type: PolicyType) => {
    let config: any = {};
    let name = '';

    switch (type) {
      case 'DLP':
        config = {
          use_builtin_patterns: true,
          severity_threshold: severityThreshold,
          enabled_pattern_types: enabledPatterns,
          block_on_match: true,
          scan_patterns: customPatterns,
        };
        name = 'Data Loss Prevention Scanner';
        break;

      case 'RATE_LIMIT':
        config = {
          max_requests: parseInt(maxRequests),
          per: ratePer,
        };
        name = 'API Rate Limit';
        break;

      case 'TIME_WINDOW':
        config = {
          allowed_hours: { start: parseInt(allowedHoursStart), end: parseInt(allowedHoursEnd) },
          allowed_days: allowedDays,
        };
        name = 'Business Hours Only';
        break;

      case 'ALLOWLIST':
        config = {
          allowed_values: allowedDomains,
        };
        name = 'Trusted APIs';
        break;

      case 'SPENDING_LIMIT':
        config = {
          max_amount: parseInt(spendLimit),
          window: '24h',
        };
        name = 'Daily Spending Limit';
        break;
    }

    const payload: Policy = {
      name,
      type,
      enabled: type === 'DLP' ? dlpEnabled : true,
      priority: type === 'DLP' ? 100 : 80,
      config,
    };

    const existingPolicy = policies.find(p => p.type === type);

    try {
      if (existingPolicy) {
        await api.put(`/policies/${existingPolicy.id}`, payload);
      } else {
        await api.post('/policies', payload);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);

      // Reload policies
      const data = await api.get<{ policies: Policy[] }>('/policies');
      setPolicies(data.policies);
    } catch (err: any) {
      alert('Failed to save policy: ' + err.message);
    }
  };

  const groupedPatterns = DLP_PATTERN_TYPES.reduce((acc, pattern) => {
    if (!acc[pattern.category]) acc[pattern.category] = [];
    acc[pattern.category].push(pattern);
    return acc;
  }, {} as Record<string, typeof DLP_PATTERN_TYPES>);

  const applyProfile = async () => {
    if (!selectedProfile) return;
    setIsApplyingProfile(true);

    try {
      const result = await api.post<{
        profile: { id: string; name: string };
        createdCount: number;
        updatedCount: number;
      }>(`/industry-profiles/${selectedProfile}/apply`, { replaceExistingTypes: true });
      setActiveProfileId(result.profile.id);

      const data = await api.get<{ policies: Policy[] }>('/policies');
      setPolicies(data.policies);

      alert(
        `Applied ${result.profile.name}. Created ${result.createdCount} and updated ${result.updatedCount} policies.`
      );
    } catch (err: any) {
      alert('Failed to apply profile: ' + err.message);
    } finally {
      setIsApplyingProfile(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Head>
        <title>Security Policies | Bastion Protocol</title>
      </Head>

      <Navbar />

      <main style={{ padding: '2rem 4rem', flex: 1, maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <header style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Security Policies</h1>
          <p style={{ color: '#889' }}>
            Configure real-time security controls for your AI agents
          </p>
        </header>

        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', margin: 0, marginBottom: '0.35rem' }}>Industry Profiles</h2>
              <p style={{ color: '#889', margin: 0, fontSize: '0.9rem' }}>
                Apply a pre-configured policy bundle (interchangeable overlay).
              </p>
              {activeProfileId && (
                <p style={{ color: '#9fb6ff', margin: '0.4rem 0 0', fontSize: '0.82rem' }}>
                  Active profile: {profiles.find((p) => p.id === activeProfileId)?.name || activeProfileId}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                style={{ ...inputStyle, minWidth: '240px', padding: '10px 12px' }}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.policyCount})
                  </option>
                ))}
              </select>
              <button
                onClick={applyProfile}
                disabled={isApplyingProfile || profiles.length === 0}
                className="button-primary"
                style={{ opacity: isApplyingProfile ? 0.7 : 1 }}
              >
                {isApplyingProfile ? 'Applying...' : 'Apply Profile'}
              </button>
            </div>
          </div>
          {selectedProfile && (
            <p style={{ color: '#aaa', marginTop: '0.75rem', marginBottom: 0, fontSize: '0.85rem' }}>
              {profiles.find((p) => p.id === selectedProfile)?.description}
            </p>
          )}
        </section>

        {/* Policy Type Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          {[
            { type: 'DLP' as PolicyType, icon: <Lock size={16} />, label: 'DLP Scanner' },
            { type: 'RATE_LIMIT' as PolicyType, icon: <Zap size={16} />, label: 'Rate Limits' },
            { type: 'TIME_WINDOW' as PolicyType, icon: <Clock size={16} />, label: 'Time Windows' },
            { type: 'ALLOWLIST' as PolicyType, icon: <Shield size={16} />, label: 'Allowlist' },
            { type: 'SPENDING_LIMIT' as PolicyType, icon: <FileText size={16} />, label: 'Spending' },
          ].map(tab => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              style={{
                background: activeTab === tab.type ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.type ? '#000' : '#889',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: activeTab === tab.type ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* DLP Configuration */}
        {activeTab === 'DLP' && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '2rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Data Loss Prevention</h2>
                <p style={{ color: '#889', fontSize: '0.9rem' }}>
                  Block sensitive data from being sent to external APIs (30+ built-in patterns)
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <span style={{ color: '#889' }}>Enabled</span>
                <input
                  type="checkbox"
                  checked={dlpEnabled}
                  onChange={(e) => setDlpEnabled(e.target.checked)}
                  style={{ transform: 'scale(1.5)', accentColor: 'var(--primary)' }}
                />
              </label>
            </div>

            {/* Severity Threshold */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Severity Threshold</h3>
              <p style={{ color: '#889', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Only block patterns at or above this severity level
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setSeverityThreshold(level)}
                    style={{
                      background: severityThreshold === level ? getSeverityColor(level) : 'rgba(255,255,255,0.05)',
                      color: severityThreshold === level ? '#000' : '#fff',
                      border: `1px solid ${getSeverityColor(level)}`,
                      padding: '0.75rem 1.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: severityThreshold === level ? 'bold' : 'normal',
                      flex: 1,
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern Selection */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Enabled Patterns</h3>
              <p style={{ color: '#889', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Select which patterns to scan for ({enabledPatterns.length} / {DLP_PATTERN_TYPES.length} enabled)
              </p>

              {Object.entries(groupedPatterns).map(([category, patterns]) => (
                <div key={category} style={{ marginBottom: '2rem' }}>
                  <h4 style={{ color: 'var(--secondary)', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase' }}>
                    {category}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                    {patterns.map(pattern => (
                      <label
                        key={pattern.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: enabledPatterns.includes(pattern.id) ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${enabledPatterns.includes(pattern.id) ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.9rem' }}>{pattern.name}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            color: getSeverityColor(pattern.severity),
                            fontWeight: 'bold',
                          }}>
                            {pattern.severity}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={enabledPatterns.includes(pattern.id)}
                          onChange={() => togglePattern(pattern.id)}
                          style={{ transform: 'scale(1.3)', accentColor: 'var(--primary)' }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Quick Select Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  onClick={() => setEnabledPatterns(DLP_PATTERN_TYPES.map(p => p.id))}
                  style={{ ...quickActionButton, background: 'rgba(var(--primary-rgb), 0.2)' }}
                >
                  Select All
                </button>
                <button
                  onClick={() => setEnabledPatterns(DLP_PATTERN_TYPES.filter(p => p.severity === 'CRITICAL').map(p => p.id))}
                  style={{ ...quickActionButton, background: 'rgba(239, 68, 68, 0.2)' }}
                >
                  Critical Only
                </button>
                <button
                  onClick={() => setEnabledPatterns([])}
                  style={{ ...quickActionButton, background: 'rgba(255,255,255,0.05)' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              {isSaved && <span style={{ color: '#0f0', marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} /> Policy Saved!
              </span>}
              <button onClick={() => savePolicy('DLP')} className="button-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> Save DLP Policy
              </button>
            </div>
          </div>
        )}

        {/* Rate Limit Configuration */}
        {activeTab === 'RATE_LIMIT' && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '2rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Rate Limiting</h2>
            <p style={{ color: '#889', marginBottom: '2rem' }}>
              Prevent runaway costs by limiting API requests per time window
            </p>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#889' }}>Max Requests</label>
                <input
                  type="number"
                  value={maxRequests}
                  onChange={(e) => setMaxRequests(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#889' }}>Per</label>
                <select value={ratePer} onChange={(e) => setRatePer(e.target.value as any)} style={inputStyle}>
                  <option value="1m">1 minute</option>
                  <option value="1h">1 hour</option>
                  <option value="24h">24 hours</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '0.5rem' }}>
                <AlertTriangle size={16} />
                <strong>Example</strong>
              </div>
              <p style={{ color: '#889', fontSize: '0.9rem', margin: 0 }}>
                With {maxRequests} requests per {ratePer}, request #{parseInt(maxRequests) + 1} will be blocked. This prevents infinite loops and runaway costs.
              </p>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => savePolicy('RATE_LIMIT')} className="button-primary">
                <Save size={18} /> Save Rate Limit
              </button>
            </div>
          </div>
        )}

        {/* Time Window Configuration */}
        {activeTab === 'TIME_WINDOW' && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '2rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Time Windows</h2>
            <p style={{ color: '#889', marginBottom: '2rem' }}>
              Restrict agent operations to specific hours and days
            </p>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Allowed Hours</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#889' }}>Start Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={allowedHoursStart}
                    onChange={(e) => setAllowedHoursStart(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <span style={{ color: '#889', paddingTop: '1.5rem' }}>to</span>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#889' }}>End Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={allowedHoursEnd}
                    onChange={(e) => setAllowedHoursEnd(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Allowed Days</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (allowedDays.includes(idx)) {
                        setAllowedDays(allowedDays.filter(d => d !== idx));
                      } else {
                        setAllowedDays([...allowedDays, idx].sort());
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '1rem',
                      background: allowedDays.includes(idx) ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: allowedDays.includes(idx) ? '#000' : '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: allowedDays.includes(idx) ? 'bold' : 'normal',
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => savePolicy('TIME_WINDOW')} className="button-primary">
                <Save size={18} /> Save Time Window
              </button>
            </div>
          </div>
        )}

        {/* Allowlist Configuration */}
        {activeTab === 'ALLOWLIST' && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '2rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Trusted APIs (Allowlist)</h2>
            <p style={{ color: '#889', marginBottom: '2rem' }}>
              Only allow requests to these approved domains
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {allowedDomains.map((domain, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    value={domain}
                    onChange={(e) => {
                      const newDomains = [...allowedDomains];
                      newDomains[idx] = e.target.value;
                      setAllowedDomains(newDomains);
                    }}
                    placeholder="api.example.com"
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                  />
                  <button
                    onClick={() => setAllowedDomains(allowedDomains.filter((_, i) => i !== idx))}
                    style={{ ...quickActionButton, width: '50px', background: 'rgba(239, 68, 68, 0.2)' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setAllowedDomains([...allowedDomains, ''])}
                style={{ ...quickActionButton, background: 'rgba(var(--primary-rgb), 0.2)' }}
              >
                <Plus size={18} /> Add Domain
              </button>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => savePolicy('ALLOWLIST')} className="button-primary">
                <Save size={18} /> Save Allowlist
              </button>
            </div>
          </div>
        )}

        {/* Spending Limit Configuration */}
        {activeTab === 'SPENDING_LIMIT' && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '2rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Daily Spending Limit</h2>
            <p style={{ color: '#889', marginBottom: '2rem' }}>
              Cap total spending per 24-hour window
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="number"
                value={spendLimit}
                onChange={(e) => setSpendLimit(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#889' }}>USD</span>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => savePolicy('SPENDING_LIMIT')} className="button-primary">
                <Save size={18} /> Save Spending Limit
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MEDIUM': return '#eab308';
    case 'LOW': return '#10b981';
    default: return '#888';
  }
}

const inputStyle = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff',
  padding: '12px',
  borderRadius: '6px',
  width: '100%',
  fontSize: '1rem',
  outline: 'none',
};

const quickActionButton = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff',
  padding: '0.75rem 1.5rem',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  justifyContent: 'center',
};
