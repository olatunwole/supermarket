import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, Server, Briefcase, TrendingUp, CheckCircle, RefreshCw, Layers } from 'lucide-react';

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  subscription_plan: 'Starter' | 'Pro' | 'Advanced';
  created_at: string;
  admin_username?: string;
  admin_email?: string;
}

export const SuperAdmin: React.FC = () => {
  const { apiFetch, showNotification } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/tenants');
      setTenants(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch tenants list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handlePlanChange = async (tenantId: number, newPlan: 'Starter' | 'Pro' | 'Advanced') => {
    setUpdatingId(tenantId);
    try {
      await apiFetch(`/api/tenants/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify({ subscription_plan: newPlan })
      });
      setTenants(tenants.map(t => t.id === tenantId ? { ...t, subscription_plan: newPlan } : t));
      showNotification(`Tenant subscription updated to ${newPlan} successfully`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update plan', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const starterCount = tenants.filter(t => t.subscription_plan === 'Starter').length;
  const proCount = tenants.filter(t => t.subscription_plan === 'Pro').length;
  const advCount = tenants.filter(t => t.subscription_plan === 'Advanced').length;

  return (
    <div className="superadmin-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield style={{ color: 'var(--accent-cyan)' }} /> Platform Super Admin
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Global tenant administration, licensing, and package upgrades</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchTenants} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} /> Refresh Tenants
        </button>
      </div>

      {/* platform metrics */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="metric-card glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Total Registered Tenants</span>
            <Server size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{tenants.length}</div>
        </div>

        <div className="metric-card glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Starter Packages</span>
            <Layers size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{starterCount}</div>
        </div>

        <div className="metric-card glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--warning-amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Pro Subscriptions</span>
            <Briefcase size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{proCount}</div>
        </div>

        <div className="metric-card glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--success-emerald)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Advanced Subscriptions</span>
            <TrendingUp size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{advCount}</div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="table-wrapper glass-card" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', fontWeight: 700 }}>Registered Merchant Tenants</h2>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
            Loading platform accounts...
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Tenant Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Subdomain</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>Created At</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)' }}>License Level</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Scale Plan</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px 12px', fontWeight: 600 }}>{t.name}</td>
                  <td style={{ padding: '16px 12px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                      {t.subdomain}
                    </span>
                  </td>
                  <td style={{ padding: '16px 12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    <span 
                      style={{ 
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: t.subscription_plan === 'Starter' 
                          ? 'rgba(6,182,212,0.1)' 
                          : t.subscription_plan === 'Pro' 
                          ? 'rgba(245,158,11,0.1)' 
                          : 'rgba(16,185,129,0.1)',
                        color: t.subscription_plan === 'Starter' 
                          ? 'var(--accent-cyan)' 
                          : t.subscription_plan === 'Pro' 
                          ? 'var(--warning-amber)' 
                          : 'var(--success-emerald)'
                      }}
                    >
                      {t.subscription_plan}
                    </span>
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                    <select
                      value={t.subscription_plan}
                      onChange={(e) => handlePlanChange(t.id, e.target.value as any)}
                      disabled={updatingId === t.id}
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--glass-border)',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Starter">Starter</option>
                      <option value="Pro">Pro</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .table tr:hover {
          background: rgba(255,255,255,0.01);
        }
      `}} />
    </div>
  );
};
