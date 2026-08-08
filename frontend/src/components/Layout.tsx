import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../context/AuthContext';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const { user, isImpersonating, exitImpersonation } = useAuth();

  return (
    <div className="layout-root-container" style={{ display: 'flex', flexDirection: 'column', width: '100vw', minHeight: '100vh' }}>
      {isImpersonating && (
        <div className="impersonation-banner">
          <span>🕵️ <strong>Impersonation Mode Active</strong> &mdash; Viewing as user <strong style={{ color: '#67e8f9' }}>{user?.username}</strong> representing merchant <strong style={{ color: '#67e8f9' }}>{user?.tenant_name}</strong>.</span>
          <button className="exit-btn" onClick={exitImpersonation}>
            Exit Impersonation
          </button>
        </div>
      )}

      {user?.subscription_status === 'grace_period' && (
        <div className="grace-warning-banner">
          <span>⚠️ <strong>Subscription Expired!</strong> You are in a grace period. Upgrade or renew to ensure continued system access.</span>
          <button className="pay-btn" onClick={() => window.location.href = '/payment'}>
            Renew License
          </button>
        </div>
      )}

      <div className={`app-layout-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        {isSidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
        )}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="main-content-viewport">
          <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          <div className="page-content-area">
            <Outlet />
          </div>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .impersonation-banner {
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: #ffffff;
          padding: 10px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.88rem;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
          z-index: 1000;
        }

        .impersonation-banner .exit-btn {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .impersonation-banner .exit-btn:hover {
          background: #ffffff;
          color: #4f46e5;
          transform: scale(1.03);
        }

        .grace-warning-banner {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #0f172a;
          padding: 10px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.88rem;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
          z-index: 1000;
        }

        .grace-warning-banner .pay-btn {
          background: #0f172a;
          border: none;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .grace-warning-banner .pay-btn:hover {
          background: #1e293b;
          transform: scale(1.03);
        }

        .sidebar-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 99;
        }

        .app-layout-wrapper {
          display: flex;
          min-height: 100vh;
          flex-grow: 1;
        }

        .main-content-viewport {
          margin-left: 280px;
          flex-grow: 1;
          padding: 24px 32px 32px 32px;
          display: flex;
          flex-direction: column;
          width: calc(100% - 280px);
        }

        .page-content-area {
          flex-grow: 1;
          animation: pageFadeIn 0.3s ease-out;
        }

        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1024px) {
          .main-content-viewport {
            margin-left: 0;
            width: 100%;
            padding: 16px 16px 24px 16px;
          }
        }
      `}} />
    </div>
  );
};

