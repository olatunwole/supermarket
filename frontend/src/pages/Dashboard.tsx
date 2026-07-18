import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  BarChart2 
} from 'lucide-react';

interface DashboardData {
  today: {
    revenue: number | string;
    transactions: number | string;
  };
  inventory: {
    total_products: number | string;
    low_stock_count: number | string;
  };
  valuation: {
    cost_value: number | string;
    retail_value: number | string;
  };
  top_products: Array<{
    name: string;
    total_sold: number | string;
    revenue: number | string;
  }>;
}

export const Dashboard: React.FC = () => {
  const { apiFetch, formatCurrency } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await apiFetch<DashboardData>('/api/reports/dashboard');
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const formatNumber = (val: number | string) => {
    const num = typeof val === 'string' ? parseInt(val) : val;
    return new Intl.NumberFormat('en-GB').format(num || 0);
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="error-state glass-card">
        <h3>Unable to load dashboard</h3>
        <p>{error || 'An unexpected error occurred.'}</p>
      </div>
    );
  }

  // Calculate profit margin
  const cost = parseFloat(data.valuation.cost_value as string) || 0;
  const retail = parseFloat(data.valuation.retail_value as string) || 0;
  const potentialProfit = retail - cost;
  const profitMarginPercent = retail > 0 ? (potentialProfit / retail) * 100 : 0;

  return (
    <div className="dashboard-wrapper">
      {/* 4 Cards Row */}
      <div className="grid-container grid-cols-4 metrics-row">
        <div className="glass-card metric-card">
          <div className="metric-icon-wrapper cyan">
            <DollarSign size={24} />
          </div>
          <div className="metric-details">
            <span className="metric-label">Today's Revenue</span>
            <h2 className="metric-value">{formatCurrency(data.today.revenue)}</h2>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon-wrapper green">
            <ShoppingCart size={24} />
          </div>
          <div className="metric-details">
            <span className="metric-label">Today's Sales</span>
            <h2 className="metric-value">{formatNumber(data.today.transactions)}</h2>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon-wrapper amber">
            <Package size={24} />
          </div>
          <div className="metric-details">
            <span className="metric-label">Total Products</span>
            <h2 className="metric-value">{formatNumber(data.inventory.total_products)}</h2>
          </div>
        </div>

        <div className="glass-card metric-card" style={parseInt(data.inventory.low_stock_count as string) > 0 ? { border: '1px solid var(--warning-amber-glow)' } : {}}>
          <div className={`metric-icon-wrapper ${parseInt(data.inventory.low_stock_count as string) > 0 ? 'rose' : 'cyan'}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="metric-details">
            <span className="metric-label">Low Stock Alerts</span>
            <h2 className="metric-value">{formatNumber(data.inventory.low_stock_count)}</h2>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid-container grid-cols-2 main-row">
        {/* Left: Inventory Valuation Details */}
        <div className="glass-card content-card">
          <div className="card-header">
            <BarChart2 className="card-header-icon" />
            <h3>Inventory Valuation</h3>
          </div>
          <div className="valuation-details">
            <div className="valuation-stat">
              <span className="valuation-label">Cost Value (Capital Invested)</span>
              <h3 className="valuation-value">{formatCurrency(data.valuation.cost_value)}</h3>
            </div>
            <div className="valuation-stat">
              <span className="valuation-label">Retail Value (Expected Revenue)</span>
              <h3 className="valuation-value text-cyan">{formatCurrency(data.valuation.retail_value)}</h3>
            </div>
            
            <hr className="divider" />
            
            <div className="valuation-summary">
              <div className="summary-item">
                <span>Potential Profit</span>
                <strong>{formatCurrency(potentialProfit)}</strong>
              </div>
              <div className="summary-item">
                <span>Expected Margin</span>
                <span className="badge badge-success">{profitMarginPercent.toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="margin-bar-wrapper">
              <div className="margin-bar-fill" style={{ width: `${Math.min(profitMarginPercent, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Top Performing Products */}
        <div className="glass-card content-card">
          <div className="card-header">
            <TrendingUp className="card-header-icon" />
            <h3>Top 5 Selling Products</h3>
          </div>
          
          {data.top_products.length === 0 ? (
            <div className="empty-state">
              <p>No sales registered yet.</p>
            </div>
          ) : (
            <div className="top-products-list">
              {data.top_products.map((prod, index) => (
                <div key={index} className="top-product-item">
                  <div className="top-product-index">#{index + 1}</div>
                  <div className="top-product-name">
                    <h4>{prod.name}</h4>
                    <span>{formatNumber(prod.total_sold)} units sold</span>
                  </div>
                  <div className="top-product-revenue">
                    {formatCurrency(prod.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .loading-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 60vh;
          gap: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid var(--glass-border);
          border-top-color: var(--accent-cyan);
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .dashboard-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .metric-card {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(19, 26, 46, 0.35);
        }

        .metric-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: var(--border-radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-icon-wrapper.cyan {
          background: var(--accent-cyan-glow);
          border: 1px solid rgba(6, 182, 212, 0.2);
          color: var(--accent-cyan);
        }

        .metric-icon-wrapper.green {
          background: var(--success-emerald-glow);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: var(--success-emerald);
        }

        .metric-icon-wrapper.amber {
          background: var(--warning-amber-glow);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: var(--warning-amber);
        }

        .metric-icon-wrapper.rose {
          background: var(--error-rose-glow);
          border: 1px solid rgba(244, 63, 94, 0.2);
          color: var(--error-rose);
        }

        .metric-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-family: var(--font-display);
        }

        .content-card {
          padding: 28px;
          background: rgba(19, 26, 46, 0.25);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 16px;
        }

        .card-header-icon {
          color: var(--accent-cyan);
        }

        .card-header h3 {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .valuation-details {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .valuation-stat {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .valuation-label {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .valuation-value {
          font-size: 1.75rem;
          font-weight: 700;
          font-family: var(--font-display);
        }

        .text-cyan {
          color: var(--accent-cyan);
        }

        .divider {
          border: 0;
          border-top: 1px solid var(--glass-border);
          margin: 8px 0;
        }

        .valuation-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .summary-item span {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .summary-item strong {
          font-size: 1.25rem;
          font-family: var(--font-display);
        }

        .margin-bar-wrapper {
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 9999px;
          overflow: hidden;
          margin-top: 8px;
        }

        .margin-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-cyan), var(--success-emerald));
          border-radius: 9999px;
        }

        .top-products-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .top-product-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          transition: var(--transition-smooth);
        }

        .top-product-item:hover {
          border-color: var(--glass-border-hover);
          background: rgba(255, 255, 255, 0.03);
        }

        .top-product-index {
          width: 32px;
          font-weight: 800;
          color: var(--accent-cyan);
          font-family: var(--font-display);
        }

        .top-product-name {
          flex-grow: 1;
        }

        .top-product-name h4 {
          font-size: 0.95rem;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .top-product-name span {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .top-product-revenue {
          font-weight: 700;
          font-family: var(--font-display);
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
        }
      `}} />
    </div>
  );
};
