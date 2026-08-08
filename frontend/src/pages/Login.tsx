import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Lock, User as UserIcon, AlertCircle, Globe } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, storeSettings } = useAuth();
  const navigate = useNavigate();
  const { subdomain: pathSubdomain } = useParams<{ subdomain?: string }>();
  const [searchParams] = useSearchParams();
  const querySubdomain = searchParams.get('subdomain');
  const activeSubdomain = pathSubdomain || querySubdomain;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [subdomain, setSubdomain] = useState(activeSubdomain || 'default');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync state if queryParam/pathParam loads or changes
  useEffect(() => {
    if (activeSubdomain) {
      setSubdomain(activeSubdomain);
    }
  }, [activeSubdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !subdomain.trim()) {
      setError('Please enter username, password, and shop subdomain.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await login(username, password, subdomain);
    setSubmitting(false);
    if (res.success) {
      navigate('/', { replace: true });
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-card">
        <div className="login-header">
          <div className="login-logo" style={{ overflow: 'hidden', padding: storeSettings.logo ? '4px' : '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {storeSettings.logo ? (
              <img src={storeSettings.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Store size={36} />
            )}
          </div>
          <h1>{storeSettings.name}</h1>
          <p>Inventory & POS Terminal Management</p>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {!activeSubdomain && (
            <div className="form-group">
              <label className="form-label" htmlFor="subdomain">Shop Subdomain</label>
              <div className="input-with-icon">
                <Globe size={18} className="input-icon" />
                <input
                  id="subdomain"
                  type="text"
                  className="form-input"
                  placeholder="e.g. default, merchant1"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <div className="input-with-icon">
              <UserIcon size={18} className="input-icon" />
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={submitting}>
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>New to POS? </span>
          <Link to="/signup" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>Register Business</Link>
        </div>

        <div className="login-footer">
          <p>Demo accounts (default shop):</p>
          <div className="demo-credentials">
            <span>admin / admin123</span>
            <span>cashier1 / cashier123</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          padding: 40px;
          animation: cardSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardSlideIn {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--accent-cyan), var(--success-emerald));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(6, 182, 212, 0.2);
        }

        .login-logo svg {
          color: #000;
        }

        .login-header h1 {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 8px;
        }

        .login-header p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .login-error-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--error-rose-glow);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: var(--border-radius-md);
          margin-bottom: 24px;
          color: var(--error-rose);
          font-size: 0.9rem;
        }

        .login-error-alert span {
          color: var(--error-rose);
        }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .input-with-icon .form-input {
          padding-left: 42px;
        }

        .login-btn {
          width: 100%;
          margin-top: 12px;
          font-size: 1rem;
          height: 48px;
        }

        .login-footer {
          margin-top: 32px;
          border-top: 1px solid var(--glass-border);
          padding-top: 20px;
          text-align: center;
        }

        .login-footer p {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .demo-credentials {
          display: flex;
          justify-content: center;
          gap: 12px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .demo-credentials span {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          padding: 4px 10px;
          border-radius: var(--border-radius-sm);
        }
      `}} />
    </div>
  );
};
