import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Globe, Mail, User as UserIcon, Lock, CheckCircle, Shield } from 'lucide-react';

export const Signup: React.FC = () => {
  const { apiFetch, showNotification } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<'Starter' | 'Pro' | 'Ultra'>('Pro');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setSubdomain(slug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subdomain.trim() || !adminUsername.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/tenants/signup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          subdomain: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          subscription_plan: subscriptionPlan,
          admin_username: adminUsername,
          admin_email: adminEmail,
          admin_password: adminPassword
        })
      });
      showNotification('Business onboarded successfully! Please sign in.', 'success');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card glass-card">
        <div className="signup-header">
          <div className="signup-logo">
            <Store size={32} />
          </div>
          <h1>Register Your Business</h1>
          <p>Deploy a dedicated multi-tenant POS & Inventory terminal instantly</p>
        </div>

        {error && (
          <div className="signup-error-alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="form-section">
            <h3>1. Store Identity</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Business Name</label>
              <div className="input-with-icon">
                <Store size={18} className="input-icon" />
                <input
                  id="name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. London Supermarket"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="subdomain">Subdomain</label>
              <div className="input-with-icon">
                <Globe size={18} className="input-icon" />
                <input
                  id="subdomain"
                  type="text"
                  className="form-input"
                  placeholder="e.g. london-store"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={submitting}
                  required
                />
              </div>
              <small className="help-text">Your store URL will be: {window.location.host}/{subdomain || 'subdomain'}</small>
            </div>
          </div>

          <div className="form-section">
            <h3>2. Select SaaS Subscription Plan</h3>
            <div className="plans-grid">
              <div 
                className={`plan-card ${subscriptionPlan === 'Starter' ? 'active' : ''}`}
                onClick={() => !submitting && setSubscriptionPlan('Starter')}
              >
                <h4>Starter</h4>
                <p className="plan-price">£19<span>/mo</span></p>
                <ul>
                  <li><CheckCircle size={12} /> Max 50 products</li>
                  <li><CheckCircle size={12} /> Max 3 staff users</li>
                  <li><CheckCircle size={12} /> Basic POS & Inventory</li>
                  <li className="disabled">❌ Accounting Journals</li>
                  <li className="disabled">❌ Digital Storefront Catalog</li>
                </ul>
              </div>

              <div 
                className={`plan-card ${subscriptionPlan === 'Pro' ? 'active' : ''}`}
                onClick={() => !submitting && setSubscriptionPlan('Pro')}
              >
                <div className="badge">Popular</div>
                <h4>Pro</h4>
                <p className="plan-price">£49<span>/mo</span></p>
                <ul>
                  <li><CheckCircle size={12} /> Max 500 products</li>
                  <li><CheckCircle size={12} /> Max 10 staff users</li>
                  <li><CheckCircle size={12} /> Complete Accounting</li>
                  <li><CheckCircle size={12} /> Sales Staging Review</li>
                  <li className="disabled">❌ Storefront Ordering</li>
                </ul>
              </div>

              <div 
                className={`plan-card ${subscriptionPlan === 'Ultra' ? 'active' : ''}`}
                onClick={() => !submitting && setSubscriptionPlan('Ultra')}
              >
                <h4>Ultra</h4>
                <p className="plan-price">£99<span>/mo</span></p>
                <ul>
                  <li><CheckCircle size={12} /> Unlimited products</li>
                  <li><CheckCircle size={12} /> Unlimited staff users</li>
                  <li><CheckCircle size={12} /> Full Accounting & Ledger</li>
                  <li><CheckCircle size={12} /> Customer Storefront Page</li>
                  <li><CheckCircle size={12} /> Stock level auto-deductions</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>3. Owner Credentials</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="adminUsername">Admin Username</label>
              <div className="input-with-icon">
                <UserIcon size={18} className="input-icon" />
                <input
                  id="adminUsername"
                  type="text"
                  className="form-input"
                  placeholder="e.g. manager"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="adminEmail">Admin Email</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="adminEmail"
                  type="email"
                  className="form-input"
                  placeholder="e.g. owner@store.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="adminPassword">Admin Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="adminPassword"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary signup-btn" disabled={submitting}>
            {submitting ? 'Creating Business Subdomain...' : 'Register and Setup Business'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Already registered? </span>
          <Link to="/login" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>Sign In here</Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .signup-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 40px 20px;
        }

        .signup-card {
          width: 100%;
          max-width: 680px;
          padding: 40px;
          animation: cardSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .signup-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .signup-logo {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--accent-cyan), var(--success-emerald));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(6, 182, 212, 0.2);
        }

        .signup-logo svg {
          color: #000;
        }

        .signup-header h1 {
          font-size: 1.85rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 8px;
        }

        .signup-header p {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .signup-error-alert {
          padding: 12px 16px;
          background: var(--error-rose-glow);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: var(--border-radius-md);
          margin-bottom: 24px;
          color: var(--error-rose);
          font-size: 0.9rem;
        }

        .form-section {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 20px;
          margin-bottom: 24px;
        }

        .form-section h3 {
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--accent-cyan);
          margin-bottom: 16px;
          font-weight: 700;
        }

        .help-text {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 4px;
          display: block;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }

        .plan-card {
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          background: rgba(255, 255, 255, 0.01);
        }

        .plan-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .plan-card.active {
          border-color: var(--accent-cyan);
          background: rgba(6, 182, 212, 0.04);
          box-shadow: 0 0 16px var(--accent-cyan-glow);
        }

        .plan-card h4 {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .plan-price {
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
        }

        .plan-price span {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-weight: 400;
        }

        .plan-card ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .plan-card li {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .plan-card li svg {
          color: var(--accent-cyan);
        }

        .plan-card li.disabled {
          color: var(--text-muted);
          text-decoration: line-through;
        }

        .plan-card .badge {
          position: absolute;
          top: -10px;
          right: 12px;
          background: linear-gradient(135deg, var(--accent-cyan), var(--success-emerald));
          color: #000;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
        }

        .signup-btn {
          width: 100%;
          font-size: 1rem;
          height: 48px;
        }

        @media (max-width: 600px) {
          .plans-grid {
            grid-template-columns: 1fr;
          }
          .signup-card {
            padding: 24px;
          }
        }
      `}} />
    </div>
  );
};
