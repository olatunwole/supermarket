import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Store, 
  Coins, 
  Palette, 
  Upload, 
  ShieldCheck, 
  Clock, 
  X, 
  User as UserIcon
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { 
    apiFetch, 
    showNotification, 
    user, 
    currency, 
    setCurrency, 
    rates, 
    updateRate, 
    storeSettings, 
    updateStoreSettings, 
    themeColor, 
    setThemeColor,
    bgColor,
    setBgColor,
    theme,
    setTheme
  } = useAuth();

  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<string>('profile');

  // Activity Log State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'activity-log' && isAdmin) {
      const fetchLogs = async () => {
        try {
          setLogsLoading(true);
          const data = await apiFetch('/api/audit-logs');
          setAuditLogs(data);
        } catch (err: any) {
          showNotification(err.message || 'Failed to fetch activity logs', 'error');
        } finally {
          setLogsLoading(false);
        }
      };
      fetchLogs();
    }
  }, [activeTab, isAdmin]);

  // Profile Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSubmitting, setPassSubmitting] = useState(false);

  // Logo upload preview state
  const [logoPreview, setLogoPreview] = useState<string | null>(storeSettings.logo || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfilePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showNotification('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showNotification('New password must be at least 6 characters.', 'error');
      return;
    }

    try {
      setPassSubmitting(true);
      await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      showNotification('Your password has been changed successfully.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to change password.', 'error');
    } finally {
      setPassSubmitting(false);
    }
  };

  // Logo file readers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showNotification('Logo image must be smaller than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      updateStoreSettings({ ...storeSettings, logo: base64 });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoPreview(null);
    updateStoreSettings({ ...storeSettings, logo: '' });
  };

  return (
    <div className="users-wrapper" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '30px', alignItems: 'start' }}>
      
      {/* Sidebar Navigation */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button 
          className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ justifyContent: 'flex-start', textAlign: 'left', height: '44px', width: '100%', gap: '10px' }}
          onClick={() => setActiveTab('profile')}
        >
          <UserIcon size={18} />
          <span>My Profile</span>
        </button>

        {isAdmin && (
          <>
            <button 
              className={`btn ${activeTab === 'branding' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', height: '44px', width: '100%', gap: '10px' }}
              onClick={() => setActiveTab('branding')}
            >
              <Store size={18} />
              <span>Branding & Logo</span>
            </button>
            <button 
              className={`btn ${activeTab === 'rates' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', height: '44px', width: '100%', gap: '10px' }}
              onClick={() => setActiveTab('rates')}
            >
              <Coins size={18} />
              <span>Exchange Rates</span>
            </button>
            <button 
              className={`btn ${activeTab === 'theme' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', height: '44px', width: '100%', gap: '10px' }}
              onClick={() => setActiveTab('theme')}
            >
              <Palette size={18} />
              <span>Color & Timeout</span>
            </button>
            <button 
              className={`btn ${activeTab === 'activity-log' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', height: '44px', width: '100%', gap: '10px' }}
              onClick={() => setActiveTab('activity-log')}
            >
              <Clock size={18} />
              <span>Activity Log</span>
            </button>
          </>
        )}
      </div>

      {/* Main Settings Display Area */}
      <div className="settings-content-panel">
        
        {/* Profile Change Password Tab */}
        {activeTab === 'profile' && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} className="text-cyan" />
                Security & Account Profile
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Manage your login details. Your username is locked for audit integrity</p>
            </div>

            <form onSubmit={handleProfilePasswordSubmit} style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Username (Read-Only)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  value={user?.username || ''}
                  disabled 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ opacity: 0.65, cursor: 'not-allowed', textTransform: 'capitalize' }}
                  value={user?.role?.replace('_', ' ') || ''}
                  disabled 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter current password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="At least 6 characters"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Confirm new password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={passSubmitting}
                style={{ alignSelf: 'flex-start', marginTop: '10px' }}
              >
                {passSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Branding Tab (Admins Only) */}
        {isAdmin && activeTab === 'branding' && (
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={20} className="text-cyan" />
                Store Branding & Profile
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Rebrand the POS software with your company details and receipt logos</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget;
              const name = (target.elements.namedItem('store-name') as HTMLInputElement).value;
              const address = (target.elements.namedItem('store-address') as HTMLInputElement).value;
              const phone = (target.elements.namedItem('store-phone') as HTMLInputElement).value;
              const taxId = (target.elements.namedItem('store-tax') as HTMLInputElement).value;
              updateStoreSettings({ ...storeSettings, name, address, phone, taxId });
            }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Supermarket / Company Name</label>
                  <input 
                    type="text" 
                    id="store-name"
                    name="store-name"
                    className="form-input" 
                    defaultValue={storeSettings.name}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">VAT / Tax ID Number</label>
                  <input 
                    type="text" 
                    id="store-tax"
                    name="store-tax"
                    className="form-input" 
                    defaultValue={storeSettings.taxId}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Business Address</label>
                <input 
                  type="text" 
                  id="store-address"
                  name="store-address"
                  className="form-input" 
                  defaultValue={storeSettings.address}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Contact</label>
                <input 
                  type="text" 
                  id="store-phone"
                  name="store-phone"
                  className="form-input" 
                  defaultValue={storeSettings.phone}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Save Branding Profile
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>Store Logo Image</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Upload a custom PNG/JPG logo to appear on screen layouts and invoices.</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    border: '2px dashed var(--glass-border)', 
                    borderRadius: '12px', 
                    width: '160px', 
                    height: '160px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'var(--transition-smooth)',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Store logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} />
                  ) : (
                    <>
                      <Upload size={24} style={{ opacity: 0.6, marginBottom: '8px' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Choose Image</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept="image/*" 
                  onChange={handleLogoChange} 
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                    Upload New Image
                  </button>
                  {logoPreview && (
                    <button className="btn btn-secondary btn-sm text-danger" onClick={removeLogo}>
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exchange Rates Tab (Admins Only) */}
        {isAdmin && activeTab === 'rates' && (
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins size={20} className="text-cyan" />
                Active Store Currency & Exchange Rates
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Choose the primary active currency and update manually set exchange rates relative to GBP base</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <label htmlFor="currency-select" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Active Terminal Currency:</label>
              <select 
                id="currency-select"
                className="form-select"
                style={{ width: '220px', height: '40px', padding: '0 12px' }}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="GBP">Pounds (GBP, £)</option>
                <option value="USD">Dollars (USD, $)</option>
                <option value="EUR">Euros (EUR, €)</option>
                <option value="NGN">Naira (NGN, ₦)</option>
                <option value="GHS">Ghana Cedis (GHS, GH₵)</option>
              </select>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>Manual Exchange Rates (1 GBP = ...)</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">USD ($)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    value={rates.USD || ''}
                    onChange={(e) => updateRate('USD', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">EUR (€)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    value={rates.EUR || ''}
                    onChange={(e) => updateRate('EUR', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">NGN (₦)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    value={rates.NGN || ''}
                    onChange={(e) => updateRate('NGN', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GHS (GH₵)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    value={rates.GHS || ''}
                    onChange={(e) => updateRate('GHS', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Color & Inactivity Tab (Admins Only) */}
        {isAdmin && activeTab === 'theme' && (
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={20} className="text-cyan" />
                Color Theme & Security Timeouts
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Customize interface color presets and configure automatic inactivity lockouts</p>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>Accent Color Palette</h4>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { name: 'Cyan Glow', key: 'cyan', color: '#06b6d4' },
                  { name: 'Emerald Garden', key: 'emerald', color: '#10b981' },
                  { name: 'Royal Amethyst', key: 'purple', color: '#a855f7' },
                  { name: 'Sunset Amber', key: 'orange', color: '#f59e0b' },
                  { name: 'Crimson Rose', key: 'rose', color: '#f43f5e' },
                  { name: 'Classic Blue', key: 'blue', color: '#3b82f6' }
                ].map((preset) => (
                  <button 
                    key={preset.key} 
                    onClick={() => setThemeColor(preset.key)}
                    style={{ 
                      background: 'rgba(255,255,255,0.02)',
                      border: themeColor === preset.key ? '2px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                      borderRadius: '8px', 
                      padding: '10px 16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>Background Color Palette</h4>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { name: 'Deep Midnight', key: 'midnight', color: '#0b0f19' },
                  { name: 'Obsidian Abyss', key: 'obsidian', color: '#000000' },
                  { name: 'Slate Nebula', key: 'slate', color: '#0f172a' },
                  { name: 'Emerald Shadows', key: 'forest', color: '#022c22' },
                  { name: 'Royal Indigo', key: 'indigo', color: '#1e1b4b' }
                ].map((preset) => (
                  <button 
                    key={preset.key} 
                    type="button"
                    onClick={() => {
                      setBgColor(preset.key);
                      if (theme === 'light') {
                        setTheme('dark');
                      }
                    }}
                    style={{ 
                      background: 'rgba(255,255,255,0.02)',
                      border: bgColor === preset.key ? '2px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                      borderRadius: '8px', 
                      padding: '10px 16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.color, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} />
                Terminal Inactivity Timeout
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Automatically log out users after a set period of keyboard/mouse inactivity to prevent unauthorized access.</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <select 
                  className="form-select"
                  style={{ width: '220px', height: '40px', padding: '0 12px' }}
                  value={storeSettings.inactivityTimeout}
                  onChange={(e) => updateStoreSettings({ ...storeSettings, inactivityTimeout: parseInt(e.target.value) })}
                >
                  <option value="1">1 Minute (Security Test)</option>
                  <option value="5">5 Minutes</option>
                  <option value="10">10 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="0">Disabled</option>
                </select>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {storeSettings.inactivityTimeout > 0 ? `Terminal locks after ${storeSettings.inactivityTimeout} minutes of idle state` : 'Idle lockout is disabled'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity-log' && isAdmin && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} className="text-cyan" />
                <span>System Activity Log</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Review real-time administrative actions, inventory modifications, and security events.
              </p>
            </div>

            {logsLoading ? (
              <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
            ) : auditLogs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>No activity records found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ padding: '12px' }}>Timestamp</th>
                      <th style={{ padding: '12px' }}>User</th>
                      <th style={{ padding: '12px' }}>Action</th>
                      <th style={{ padding: '12px' }}>Details</th>
                      <th style={{ padding: '12px' }}>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="table-row">
                        <td style={{ padding: '12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('en-GB')}
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                          <span className="badge badge-info">{log.username || 'System'}</span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                          {log.action}
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {log.details}
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {log.ip_address || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
