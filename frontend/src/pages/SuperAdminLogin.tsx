import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

export const SuperAdminLogin: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your administrator username and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    // Authenticate against the default subdomain implicitly
    const res = await login(username, password, 'default');
    setSubmitting(false);
    if (res.success) {
      navigate('/super-admin', { replace: true });
    } else {
      setError(res.error || 'Invalid administrator credentials');
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card glass-card">
        <div className="admin-login-header">
          <div className="admin-login-logo">
            <Shield size={36} />
          </div>
          <h1>Platform Administration</h1>
          <p>SaaS Operations & Tenant Licensing Panel</p>
        </div>

        {error && (
          <div className="admin-error-alert">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="username">Admin Username</label>
            <div className="input-with-icon">
              <UserIcon size={18} className="input-icon" />
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. superadmin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Security Password</label>
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
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary admin-login-btn" disabled={submitting}>
            {submitting ? 'Authenticating Gateway...' : 'Authorize Access'}
          </button>
        </form>

        <div className="admin-login-footer">
          <p>System Administrator Access Only</p>
          <span>Unauthorized access attempts are logged and audited.</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .admin-login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          background: radial-gradient(circle at 50% 50%, #170f2f 0%, #07030f 100%);
        }

        .admin-login-card {
          width: 100%;
          max-width: 440px;
          padding: 40px;
          border: 1px solid rgba(168, 85, 247, 0.2);
          box-shadow: 0 16px 40px rgba(124, 58, 237, 0.15);
          animation: cardSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardSlideIn {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .admin-login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .admin-login-logo {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(168, 85, 247, 0.3);
        }

        .admin-login-logo svg {
          color: #ffffff;
        }

        .admin-login-header h1 {
          font-size: 1.65rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 8px;
          color: #ffffff;
        }

        .admin-login-header p {
          color: #a78bfa;
          font-size: 0.88rem;
        }

        .admin-error-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: var(--border-radius-md);
          margin-bottom: 24px;
          color: var(--error-rose);
          font-size: 0.9rem;
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
          background: rgba(0, 0, 0, 0.2);
          border-color: rgba(168, 85, 247, 0.2);
        }

        .input-with-icon .form-input:focus {
          border-color: #a855f7;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.25);
        }

        .admin-login-btn {
          width: 100%;
          margin-top: 12px;
          font-size: 1rem;
          height: 48px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          border: none;
          color: #ffffff;
          font-weight: 700;
        }

        .admin-login-btn:hover {
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          transform: scale(1.02);
        }

        .admin-login-footer {
          margin-top: 32px;
          border-top: 1px solid rgba(168, 85, 247, 0.1);
          padding-top: 20px;
          text-align: center;
        }

        .admin-login-footer p {
          font-size: 0.75rem;
          color: #ef4444;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .admin-login-footer span {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
      `}} />
    </div>
  );
};
