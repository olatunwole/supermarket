import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  RefreshCw, 
  Truck, 
  Users as UsersIcon, 
  LogOut,
  Store,
  BarChart3,
  Settings,
  Landmark
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout, storeSettings } = useAuth();

  if (!user) return null;

  const links = [
    {
      to: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      roles: ['admin', 'manager', 'cashier', 'stock_clerk']
    },
    {
      to: '/pos',
      label: 'POS Register',
      icon: <ShoppingBag size={20} />,
      roles: ['admin', 'manager', 'cashier']
    },
    {
      to: '/inventory',
      label: 'Inventory',
      icon: <Package size={20} />,
      roles: ['admin', 'manager', 'stock_clerk']
    },
    {
      to: '/stock-adjustments',
      label: 'Stock Adjustments',
      icon: <RefreshCw size={20} />,
      roles: ['admin', 'manager', 'stock_clerk']
    },
    {
      to: '/purchase-orders',
      label: 'Purchase Orders',
      icon: <Truck size={20} />,
      roles: ['admin', 'manager', 'stock_clerk']
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: <BarChart3 size={20} />,
      roles: ['admin', 'manager']
    },
    {
      to: '/financials',
      label: 'Financials',
      icon: <Landmark size={20} />,
      roles: ['admin', 'manager', 'stock_clerk']
    },
    {
      to: '/users',
      label: 'Staff Users',
      icon: <UsersIcon size={20} />,
      roles: ['admin']
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: <Settings size={20} />,
      roles: ['admin', 'manager', 'cashier', 'stock_clerk']
    }
  ];

  const filteredLinks = links.filter(link => link.roles.includes(user.role));

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      case 'cashier': return 'Cashier';
      case 'stock_clerk': return 'Stock Clerk';
      default: return role;
    }
  };

  return (
    <aside className="glass-card sidebar-container">
      <div className="sidebar-brand">
        {storeSettings.logo ? (
          <img src={storeSettings.logo} alt="Logo" className="brand-icon" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} />
        ) : (
          <Store size={28} className="brand-icon" />
        )}
        <div className="brand-text">
          <h2 style={{ fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={storeSettings.name}>
            {storeSettings.name}
          </h2>
          <span>Store POS Terminal</span>
        </div>
      </div>

      <div className="sidebar-profile">
        <div className="profile-avatar">
          {user.username.substring(0, 2).toUpperCase()}
        </div>
        <div className="profile-info">
          <p className="profile-name">{user.username}</p>
          <span className="profile-role badge badge-info">{roleLabel(user.role)}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="sidebar-logout" onClick={logout}>
        <LogOut size={20} />
        <span>Sign Out</span>
      </button>

      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-container {
          width: 280px;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          border-radius: 0;
          border-right: 1px solid var(--glass-border);
          border-top: none;
          border-bottom: none;
          border-left: none;
          background: var(--bg-secondary);
          padding: 24px 16px;
          z-index: 100;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px 24px;
          border-bottom: 1px solid var(--glass-border);
          margin-bottom: 24px;
        }

        .brand-icon {
          color: var(--accent-cyan);
        }

        .brand-text h2 {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .brand-text span {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .sidebar-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          margin-bottom: 24px;
        }

        .profile-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-cyan), var(--success-emerald));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #000;
          font-size: 1rem;
        }

        .profile-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow: hidden;
        }

        .profile-name {
          font-weight: 600;
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-role {
          font-size: 0.65rem;
          padding: 2px 8px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-grow: 1;
          overflow-y: auto;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          text-decoration: none;
          color: var(--text-secondary);
          border-radius: var(--border-radius-md);
          font-weight: 500;
          transition: var(--transition-smooth);
        }

        .sidebar-link svg {
          color: var(--text-secondary);
          transition: var(--transition-smooth);
        }

        .sidebar-link:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
        }

        .sidebar-link.active {
          color: #000;
          background: var(--accent-cyan);
          font-weight: 600;
        }

        .sidebar-link.active svg {
          color: #000;
        }

        .sidebar-logout {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          margin-top: auto;
          background: transparent;
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          font-weight: 600;
          color: var(--error-rose);
          transition: var(--transition-smooth);
        }

        .sidebar-logout:hover {
          background: var(--error-rose-glow);
          border-color: var(--error-rose);
        }
      `}} />
    </aside>
  );
};
