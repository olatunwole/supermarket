import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-layout-wrapper">
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

      <style dangerouslySetInnerHTML={{__html: `
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

