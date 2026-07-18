import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  return (
    <div className="app-layout-wrapper">
      <Sidebar />
      <main className="main-content-viewport">
        <Header />
        <div className="page-content-area">
          <Outlet />
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
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
            margin-left: 240px;
            width: calc(100% - 240px);
            padding: 16px 20px 24px 20px;
          }
        }
      `}} />
    </div>
  );
};
