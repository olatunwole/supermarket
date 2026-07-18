import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, X, Sun, Moon } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, storeSettings, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard Overview';
      case '/pos': return 'POS Register';
      case '/inventory': return 'Inventory Management';
      case '/stock-adjustments': return 'Stock Adjustments Audit';
      case '/purchase-orders': return 'Supplier Purchase Orders';
      case '/reports': return 'Sales & Inventory Reports';
      case '/users': return 'Staff User Management';
      case '/settings': return 'System Settings & Profile';
      default: return storeSettings.name;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!user) return null;

  return (
    <header className="glass-card header-container">
      <div className="header-title-section">
        <h1>{getPageTitle()}</h1>
        <p className="header-subtitle">Welcome back, {user.username}</p>
      </div>

      <div className="header-right-section" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={toggleTheme} 
          className="theme-toggle-btn"
          aria-label="Toggle light/dark theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="header-meta-section">
          <div className="header-meta-item">
            <Calendar size={16} className="meta-icon" />
            <span>{formatDate(time)}</span>
          </div>
          <div className="header-meta-item">
            <Clock size={16} className="meta-icon" />
            <span>{formatTime(time)}</span>
          </div>
        </div>
        
        {location.pathname !== '/' && (
          <Link to="/" className="btn btn-secondary header-close-btn" style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', height: '38px' }}>
            <X size={16} />
            <span>Close</span>
          </Link>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .header-container {
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          margin-bottom: 24px;
          border-radius: var(--border-radius-md);
          background: var(--glass-bg);
        }

        .header-title-section h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .header-subtitle {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .header-meta-section {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-sm);
        }

        .meta-icon {
          color: var(--accent-cyan);
        }

        .theme-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: var(--border-radius-sm);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .theme-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--glass-border-hover);
          color: var(--accent-cyan);
          transform: scale(1.05);
        }

        .theme-toggle-btn svg {
          color: inherit;
        }

        :root[data-theme='light'] .theme-toggle-btn {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.08);
        }

        :root[data-theme='light'] .theme-toggle-btn:hover {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.15);
        }

        @media (max-width: 768px) {
          .header-meta-section {
            display: none;
          }
        }
      `}} />
    </header>
  );
};
