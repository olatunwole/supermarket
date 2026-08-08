import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '3px solid var(--glass-border)',
          borderTopColor: 'var(--accent-cyan)',
          animation: 'spin 1s linear infinite'
        }} />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // subscription state evaluation
  const isPaid = 
    user.role === 'super_admin' || 
    user.subscription_status === 'active' || 
    user.subscription_status === 'granted' || 
    user.subscription_status === 'grace_period';

  // If unpaid/expired and not on payment page, redirect
  if (!isPaid && location.pathname !== '/payment') {
    return <Navigate to="/payment" replace />;
  }

  // If paid and on payment page, redirect back to dashboard
  if (isPaid && location.pathname === '/payment') {
    return <Navigate to="/" replace />;
  }

  // If superadmin goes to root /, redirect to superadmin panel
  if (user.role === 'super_admin' && location.pathname === '/') {
    return <Navigate to="/super-admin" replace />;
  }

  // Enforce pricing plan feature routing locks
  if (user.role !== 'super_admin') {
    const plan = user.subscription_plan || 'Pro';
    if (location.pathname.startsWith('/financials') && plan === 'Starter') {
      return <Navigate to="/" replace />;
    }
    if (location.pathname.startsWith('/reports') && (plan === 'Starter' || plan === 'Pro')) {
      return <Navigate to="/" replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        textAlign: 'center',
        height: '80vh'
      }}>
        <div className="glass-card" style={{ padding: '40px', maxWidth: '480px' }}>
          <h2 style={{ color: 'var(--error-rose)', marginBottom: '16px' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Your role ({user.role}) does not have permission to access this page.
          </p>
          <Navigate to="/" replace />
        </div>
      </div>
    );
  }

  return <Outlet />;
};
