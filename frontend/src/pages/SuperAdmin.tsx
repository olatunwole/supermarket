import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, Server, Briefcase, TrendingUp, RefreshCw, Layers, DollarSign, Settings, UserCheck, ShieldAlert, Key, ClipboardList, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  admin_user_id?: number;
  admin_username?: string;
  admin_email?: string;
}

interface Plan {
  id: number;
  name: string;
  price_gbp: string;
  features: {
    accounting: boolean;
    advanced_reports: boolean;
    max_products: number;
    max_users: number;
  };
}

interface SystemSettings {
  grace_period_days: number;
  reminder_days_before: number;
  paypal_client_id: string;
  paystack_public_key: string;
  flutterwave_public_key: string;
}

interface AuditLog {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  user_id: number;
  username?: string;
  action: string;
  details: string;
  ip_address?: string;
  created_at: string;
}

interface SuperAdminProps {
  tab?: 'overview' | 'merchants' | 'plans' | 'settings' | 'audit-logs';
}

export const SuperAdmin: React.FC<SuperAdminProps> = ({ tab = 'overview' }) => {
  const { apiFetch, showNotification, impersonate, formatCurrency } = useAuth();
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    grace_period_days: 7,
    reminder_days_before: 3,
    paypal_client_id: '',
    paystack_public_key: '',
    flutterwave_public_key: ''
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tenantsData, plansData, settingsData] = await Promise.all([
        apiFetch('/api/tenants'),
        apiFetch('/api/tenants/plans'),
        apiFetch('/api/tenants/settings')
      ]);
      setTenants(tenantsData);
      setPlans(plansData);
      if (settingsData && settingsData.grace_period_days !== undefined) {
        setSettings(settingsData);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch administrative data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const logsData = await apiFetch('/api/audit-logs');
      setAuditLogs(logsData);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch platform logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (tab === 'audit-logs') {
      fetchLogs();
    }
  }, [tab]);

  const handleUpdateTenantLicensing = async (tenantId: number, plan: string, status: string) => {
    setUpdatingId(tenantId);
    try {
      await apiFetch(`/api/tenants/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify({ subscription_plan: plan, subscription_status: status })
      });
      setTenants(tenants.map(t => t.id === tenantId ? { ...t, subscription_plan: plan, subscription_status: status } : t));
      showNotification('Tenant merchant license updated successfully', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update tenant license', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdatePlanSettings = async (planId: number, updatedPlan: Plan) => {
    try {
      await apiFetch(`/api/tenants/plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify({
          price_gbp: parseFloat(updatedPlan.price_gbp),
          features: updatedPlan.features
        })
      });
      showNotification(`${updatedPlan.name} package configurations updated`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update plan configurations', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await apiFetch('/api/tenants/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      showNotification('Global SaaS settings updated successfully', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleImpersonateClick = async (adminUserId: number | undefined) => {
    if (!adminUserId) {
      showNotification('Cannot impersonate. Owner user context is missing.', 'error');
      return;
    }
    await impersonate(adminUserId);
  };

  const planFeatureChange = (planId: number, field: string, value: any) => {
    setPlans(plans.map(p => {
      if (p.id === planId) {
        if (field.startsWith('features.')) {
          const featureName = field.split('.')[1];
          return {
            ...p,
            features: {
              ...p.features,
              [featureName]: value
            }
          };
        }
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const refreshCurrentView = () => {
    if (tab === 'audit-logs') {
      fetchLogs();
    }
    fetchData();
  };

  // Metrics
  const activeCount = tenants.filter(t => t.subscription_status === 'active' || t.subscription_status === 'granted').length;
  const unpaidCount = tenants.filter(t => t.subscription_status === 'unpaid').length;
  const expiredCount = tenants.filter(t => t.subscription_status === 'expired' || t.subscription_status === 'grace_period').length;

  const getPageTitle = () => {
    switch (tab) {
      case 'overview': return 'Platform Overview';
      case 'merchants': return 'Merchant Registry';
      case 'plans': return 'Pricing Plans & Features';
      case 'settings': return 'SaaS Configuration Settings';
      case 'audit-logs': return 'System Audit Logs';
      default: return 'Platform Administration';
    }
  };

  return (
    <div className="superadmin-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield style={{ color: 'var(--accent-cyan)' }} /> {getPageTitle()}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Global tenant administration, licensing, and package upgrades</p>
        </div>
        <button className="btn btn-secondary" onClick={refreshCurrentView} disabled={loading || logsLoading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} className={loading || logsLoading ? 'spin-anim' : ''} /> Refresh View
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="metric-card glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Total Merchant Tenants</span>
            <Server size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{tenants.length}</div>
        </div>

        <div className="metric-card glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--success-emerald)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Active Licenses</span>
            <UserCheck size={20} style={{ color: 'var(--success-emerald)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{activeCount}</div>
        </div>

        <div className="metric-card glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--warning-amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Unpaid Onboarding</span>
            <DollarSign size={20} style={{ color: 'var(--warning-amber)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{unpaidCount}</div>
        </div>

        <div className="metric-card glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--error-rose)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Expired / Grace Period</span>
            <ShieldAlert size={20} style={{ color: 'var(--error-rose)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{expiredCount}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
          Loading administrative modules...
        </div>
      ) : (
        <div className="tab-viewport">
          
          {/* Layout 1: Platform Overview */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Welcome, SaaS Administrator</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Use this dedicated admin panel to control merchant operations. You have complete authority to manage packages, update pricing structures, configure API credentials, and review user audit trails across all registered business tenants.
                </p>
                <div style={{ padding: '16px', background: 'rgba(6,182,212,0.05)', border: '1px solid var(--accent-cyan-glow)', borderRadius: '8px', marginTop: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>System Security Status</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Platform-wide JWT sessions are monitored. Global transaction audit log is online.
                  </p>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>Quick Operations</h3>
                <div className="quick-actions-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Link to="/super-admin/merchants" className="action-link-item">
                    <span>Manage Merchant Registries</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link to="/super-admin/plans" className="action-link-item">
                    <span>Edit Tier Pricing & Features</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link to="/super-admin/settings" className="action-link-item">
                    <span>API Gateway Keys & Config</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link to="/super-admin/audit-logs" className="action-link-item">
                    <span>Review System Audit Trails</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          )}
          
          {/* Layout 2: Merchants & Impersonation */}
          {tab === 'merchants' && (
            <div className="table-wrapper glass-card" style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', fontWeight: 700 }}>Registered Merchant Tenants</h2>
              
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Merchant Info</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Subdomain</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Owner Credentials</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Subscription Settings</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Impersonate</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registered: {new Date(t.created_at).toLocaleDateString()}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                          {t.subdomain}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontSize: '0.85rem' }}>Username: <strong>{t.admin_username || 'N/A'}</strong></div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.admin_email || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            value={t.subscription_plan}
                            onChange={(e) => handleUpdateTenantLicensing(t.id, e.target.value, t.subscription_status)}
                            disabled={updatingId === t.id}
                            style={{
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid var(--glass-border)',
                              color: '#fff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem'
                            }}
                          >
                            <option value="Starter">Starter</option>
                            <option value="Pro">Pro</option>
                            <option value="Ultra">Ultra</option>
                            <option value="advanced">Advanced</option>
                          </select>

                          <select
                            value={t.subscription_status}
                            onChange={(e) => handleUpdateTenantLicensing(t.id, t.subscription_plan, e.target.value)}
                            disabled={updatingId === t.id}
                            style={{
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid var(--glass-border)',
                              color: t.subscription_status === 'active' || t.subscription_status === 'granted' ? 'var(--success-emerald)' : 'var(--error-rose)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}
                          >
                            <option value="active">Active</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="expired">Expired</option>
                            <option value="grace_period">Grace Period</option>
                            <option value="granted">Granted (Bypassed)</option>
                          </select>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleImpersonateClick(t.admin_user_id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(124, 58, 237, 0.1)',
                            border: '1px solid rgba(124, 58, 237, 0.3)',
                            color: '#a78bfa'
                          }}
                        >
                          🕵️ Impersonate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Layout 3: Pricing Plans */}
          {tab === 'plans' && (
            <div className="plans-editor-view" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {plans.map((p) => (
                <div key={p.id} className="plan-editor-card glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{p.name} Package</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Update features configuration and pricing for {p.name}</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Price Plan (GBP £)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={p.price_gbp}
                      onChange={(e) => planFeatureChange(p.id, 'price_gbp', e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Max Catalog Products</label>
                      <input
                        type="number"
                        className="form-input"
                        value={p.features.max_products}
                        onChange={(e) => planFeatureChange(p.id, 'features.max_products', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Active Users</label>
                      <input
                        type="number"
                        className="form-input"
                        value={p.features.max_users}
                        onChange={(e) => planFeatureChange(p.id, 'features.max_users', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={p.features.accounting}
                        onChange={(e) => planFeatureChange(p.id, 'features.accounting', e.target.checked)}
                      />
                      Enable Financial Accounting Journals
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={p.features.advanced_reports}
                        onChange={(e) => planFeatureChange(p.id, 'features.advanced_reports', e.target.checked)}
                      />
                      Enable Advanced Performance Reports
                    </label>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleUpdatePlanSettings(p.id, p)}
                    style={{ marginTop: 'auto', background: 'var(--accent-cyan)', color: '#000', fontWeight: 700 }}
                  >
                    Save Changes
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Layout 4: SaaS Config Settings */}
          {tab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="settings-form-view glass-card" style={{ padding: '24px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>SaaS Platform Rules & Payment Credentials</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Set licensing parameters and public credentials for integrations.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Grace Period (Days)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.grace_period_days}
                    onChange={(e) => setSettings({ ...settings, grace_period_days: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Reminders (Days Before)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.reminder_days_before}
                    onChange={(e) => setSettings({ ...settings, reminder_days_before: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  <Key size={16} /> API Integration Credentials (Keys)
                </h4>

                <div className="form-group">
                  <label className="form-label">PayPal Client ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.paypal_client_id}
                    onChange={(e) => setSettings({ ...settings, paypal_client_id: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Paystack Public Key</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.paystack_public_key}
                    onChange={(e) => setSettings({ ...settings, paystack_public_key: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Flutterwave Public Key</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.flutterwave_public_key}
                    onChange={(e) => setSettings({ ...settings, flutterwave_public_key: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={isSavingSettings} style={{ padding: '12px', fontWeight: 700 }}>
                {isSavingSettings ? 'Saving Settings...' : 'Save Global SaaS Configuration'}
              </button>
            </form>
          )}

          {/* Layout 5: System Audit Logs */}
          {tab === 'audit-logs' && (
            <div className="table-wrapper glass-card" style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList style={{ color: 'var(--accent-cyan)' }} /> Platform System Audit Trails
              </h2>

              {logsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
                  Loading system audit logs...
                </div>
              ) : (
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Timestamp</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Merchant Tenant</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Trigger User</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Action Type</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Activity Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.88rem' }}>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          {log.tenant_name || `Tenant #${log.tenant_id}`}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
                            {log.username || `User #${log.user_id}`}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .table tr:hover {
          background: rgba(255, 255, 255, 0.01);
        }
        .quick-actions-list {
          display: flex;
          flex-direction: column;
        }
        .action-link-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 18px;
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          background: rgba(255, 255, 255, 0.01);
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }
        .action-link-item:hover {
          background: rgba(6, 182, 212, 0.04);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          transform: translateX(4px);
        }
        .action-link-item svg {
          color: var(--text-muted);
          transition: transform 0.2s ease;
        }
        .action-link-item:hover svg {
          color: var(--accent-cyan);
          transform: translateX(2px);
        }
      `}} />
    </div>
  );
};
