import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  SlidersHorizontal, 
  Layers, 
  Users as UsersIcon, 
  FileSpreadsheet, 
  AlertCircle, 
  Percent, 
  ShoppingCart,
  TrendingDown
} from 'lucide-react';

interface SalesPeriodData {
  period: string;
  transactions: string | number;
  revenue: string | number;
}

interface SalesCategoryData {
  category: string;
  units_sold: string | number;
  revenue: string | number;
}

interface SalesCashierData {
  cashier: string;
  transactions: string | number;
  revenue: string | number;
}

interface SalesReportResponse {
  period: { from: string; to: string };
  by_date: SalesPeriodData[];
  by_category: SalesCategoryData[];
  by_cashier: SalesCashierData[];
}

interface ProductPerformanceData {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  units_sold: string | number;
  revenue: string | number;
  profit: string | number;
}

interface ValuationItem {
  id: number;
  name: string;
  sku: string;
  quantity_on_hand: number;
  cost_price: string | number;
  unit_price: string | number;
  total_cost_value: string | number;
  total_retail_value: string | number;
  category_name: string | null;
}

interface InventoryValuationResponse {
  items: ValuationItem[];
  totals: {
    total_cost: string | number;
    total_retail: string | number;
  };
}

export const Reports: React.FC = () => {
  const { apiFetch, showNotification, formatCurrency, currency } = useAuth();
  const [activeTab, setActiveTab] = useState<'sales' | 'performance' | 'valuation'>('sales');
  const [loading, setLoading] = useState(true);

  // Filters state
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Reports data state
  const [salesData, setSalesData] = useState<SalesReportResponse | null>(null);
  const [performanceData, setPerformanceData] = useState<ProductPerformanceData[]>([]);
  const [valuationData, setValuationData] = useState<InventoryValuationResponse | null>(null);

  // Fetch functions
  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<SalesReportResponse>(
        `/api/reports/sales?from=${from}&to=${to}&group_by=${groupBy}`
      );
      setSalesData(res);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch sales report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformanceReport = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<ProductPerformanceData[]>(
        `/api/reports/performance?from=${from}&to=${to}`
      );
      setPerformanceData(res);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch product performance report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchValuationReport = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<InventoryValuationResponse>('/api/reports/valuation');
      setValuationData(res);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch inventory valuation', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesReport();
    } else if (activeTab === 'performance') {
      fetchPerformanceReport();
    } else if (activeTab === 'valuation') {
      fetchValuationReport();
    }
  }, [activeTab, from, to, groupBy]);


  const formatNumber = (val: number | string) => {
    const num = typeof val === 'string' ? parseInt(val) : val;
    return new Intl.NumberFormat('en-GB').format(num || 0);
  };

  // CSV Exports
  const exportValuationToCSV = () => {
    if (!valuationData || valuationData.items.length === 0) return;
    
    const headers = ['Product ID', 'Product Name', 'SKU', 'Category', 'Stock Qty', 'Cost Price (£)', 'Retail Price (£)', 'Total Cost Value (£)', 'Total Retail Value (£)'];
    const rows = valuationData.items.map(item => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.sku,
      item.category_name || 'N/A',
      item.quantity_on_hand,
      item.cost_price,
      item.unit_price,
      item.total_cost_value,
      item.total_retail_value
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_valuation_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Valuation report exported successfully!', 'success');
  };

  const exportPerformanceToCSV = () => {
    if (performanceData.length === 0) return;
    
    const headers = ['Product Name', 'SKU', 'Category', 'Units Sold', 'Revenue (£)', 'Profit (£)', 'Profit Margin (%)'];
    const rows = performanceData.map(item => {
      const rev = typeof item.revenue === 'string' ? parseFloat(item.revenue) : item.revenue;
      const profit = typeof item.profit === 'string' ? parseFloat(item.profit) : item.profit;
      const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        item.sku,
        item.category || 'N/A',
        item.units_sold,
        item.revenue,
        item.profit,
        margin
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `product_performance_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Performance report exported successfully!', 'success');
  };

  // Math totals for sales report
  const getSalesSummary = () => {
    if (!salesData) return { totalRevenue: 0, totalTransactions: 0, avgValue: 0 };
    const totalRevenue = salesData.by_date.reduce((sum, item) => sum + (typeof item.revenue === 'string' ? parseFloat(item.revenue) : item.revenue), 0);
    const totalTransactions = salesData.by_date.reduce((sum, item) => sum + (typeof item.transactions === 'string' ? parseInt(item.transactions) : item.transactions), 0);
    const avgValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    return { totalRevenue, totalTransactions, avgValue };
  };

  const salesSummary = getSalesSummary();

  return (
    <div className="reports-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header & Tabs Navigation */}
      <div className="reports-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div className="tabs-nav glass-card" style={{ display: 'flex', padding: '6px', gap: '4px', background: 'rgba(19, 26, 46, 0.4)' }}>
          <button 
            className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <ShoppingCart size={16} />
            <span>Sales Reports</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            <TrendingUp size={16} />
            <span>Product Performance</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'valuation' ? 'active' : ''}`}
            onClick={() => setActiveTab('valuation')}
          >
            <BarChart3 size={16} />
            <span>Inventory Valuation</span>
          </button>
        </div>

        {/* Global Date & Grouping Filters (Not applicable for Valuation tab) */}
        {activeTab !== 'valuation' && (
          <div className="filters-bar glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'rgba(19, 26, 46, 0.3)' }}>
            <div className="filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
              <input 
                type="date" 
                className="form-input text-sm" 
                value={from} 
                style={{ padding: '4px 8px', fontSize: '0.85rem', width: '130px' }}
                onChange={e => setFrom(e.target.value)} 
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>to</span>
              <input 
                type="date" 
                className="form-input text-sm" 
                value={to} 
                style={{ padding: '4px 8px', fontSize: '0.85rem', width: '130px' }}
                onChange={e => setTo(e.target.value)} 
              />
            </div>

            {activeTab === 'sales' && (
              <div className="filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--glass-border)', paddingLeft: '12px' }}>
                <SlidersHorizontal size={14} style={{ color: 'var(--text-secondary)' }} />
                <select 
                  className="form-select"
                  value={groupBy}
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  onChange={e => setGroupBy(e.target.value as any)}
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Compiling report details...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: SALES REPORT VIEW */}
          {activeTab === 'sales' && salesData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Sales Key Metrics Row */}
              <div className="grid-container grid-cols-3">
                <div className="glass-card metric-card" style={{ padding: '20px', background: 'rgba(19, 26, 46, 0.35)' }}>
                  <div className="metric-icon-wrapper cyan" style={{ width: '48px', height: '48px' }}>
                    <DollarSign size={20} />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Period Revenue</span>
                    <h2 className="metric-value" style={{ fontSize: '1.35rem' }}>{formatCurrency(salesSummary.totalRevenue)}</h2>
                  </div>
                </div>

                <div className="glass-card metric-card" style={{ padding: '20px', background: 'rgba(19, 26, 46, 0.35)' }}>
                  <div className="metric-icon-wrapper green" style={{ width: '48px', height: '48px' }}>
                    <ShoppingCart size={20} />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Total Transactions</span>
                    <h2 className="metric-value" style={{ fontSize: '1.35rem' }}>{formatNumber(salesSummary.totalTransactions)}</h2>
                  </div>
                </div>

                <div className="glass-card metric-card" style={{ padding: '20px', background: 'rgba(19, 26, 46, 0.35)' }}>
                  <div className="metric-icon-wrapper amber" style={{ width: '48px', height: '48px' }}>
                    <TrendingUp size={20} />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Average Ticket</span>
                    <h2 className="metric-value" style={{ fontSize: '1.35rem' }}>{formatCurrency(salesSummary.avgValue)}</h2>
                  </div>
                </div>
              </div>

              {/* Sales Sub Breakdowns */}
              <div className="grid-container grid-cols-2">
                
                {/* Left: Category Breakdown */}
                <div className="glass-card content-card" style={{ padding: '24px', background: 'rgba(19, 26, 46, 0.2)' }}>
                  <div className="card-header" style={{ marginBottom: '16px', paddingBottom: '12px' }}>
                    <Layers className="card-header-icon" size={20} />
                    <h3 style={{ fontSize: '1.05rem' }}>Sales by Category</h3>
                  </div>
                  
                  {salesData.by_category.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px' }}>No categories registered sales.</div>
                  ) : (
                    <div className="table-container" style={{ margin: 0, border: 'none', background: 'transparent' }}>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Units Sold</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesData.by_category.map((cat, idx) => (
                            <tr key={idx}>
                              <td><strong>{cat.category}</strong></td>
                              <td>{formatNumber(cat.units_sold)}</td>
                              <td><strong className="text-cyan">{formatCurrency(cat.revenue)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right: Cashier Breakdown */}
                <div className="glass-card content-card" style={{ padding: '24px', background: 'rgba(19, 26, 46, 0.2)' }}>
                  <div className="card-header" style={{ marginBottom: '16px', paddingBottom: '12px' }}>
                    <UsersIcon className="card-header-icon" size={20} />
                    <h3 style={{ fontSize: '1.05rem' }}>Sales by Cashier</h3>
                  </div>
                  
                  {salesData.by_cashier.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px' }}>No cashier logged sales.</div>
                  ) : (
                    <div className="table-container" style={{ margin: 0, border: 'none', background: 'transparent' }}>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Cashier</th>
                            <th>Transactions</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesData.by_cashier.map((cashier, idx) => (
                            <tr key={idx}>
                              <td><strong style={{ textTransform: 'capitalize' }}>{cashier.cashier}</strong></td>
                              <td>{formatNumber(cashier.transactions)}</td>
                              <td><strong className="text-cyan">{formatCurrency(cashier.revenue)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Sales Period Trends Table */}
              <div className="glass-card" style={{ padding: '24px', background: 'rgba(19, 26, 46, 0.2)' }}>
                <div className="card-header" style={{ marginBottom: '16px', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <BarChart3 className="card-header-icon" size={20} />
                    <h3 style={{ fontSize: '1.05rem' }}>Sales Trends</h3>
                  </div>
                </div>

                <div className="table-container" style={{ margin: 0, border: 'none', background: 'transparent' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Transactions Count</th>
                        <th>Period Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.by_date.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center" style={{ color: 'var(--text-muted)' }}>No data to show for chosen date range.</td>
                        </tr>
                      ) : (
                        salesData.by_date.map((trend, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>{groupBy === 'day' ? new Date(trend.period).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : trend.period}</strong>
                            </td>
                            <td>{formatNumber(trend.transactions)}</td>
                            <td><strong className="text-cyan">{formatCurrency(trend.revenue)}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT PERFORMANCE VIEW */}
          {activeTab === 'performance' && (
            <div className="glass-card" style={{ padding: '24px', background: 'rgba(19, 26, 46, 0.2)' }}>
              <div className="card-header" style={{ marginBottom: '16px', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <TrendingUp className="card-header-icon" size={20} />
                  <h3 style={{ fontSize: '1.05rem' }}>Product Sales Performance</h3>
                </div>
                {performanceData.length > 0 && (
                  <button className="btn btn-secondary text-sm" onClick={exportPerformanceToCSV} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                    <FileSpreadsheet size={16} />
                    <span>Export CSV</span>
                  </button>
                )}
              </div>

              <div className="table-container" style={{ margin: 0, border: 'none', background: 'transparent' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Units Sold</th>
                      <th>Revenue ({currency})</th>
                      <th>Profit ({currency})</th>
                      <th>Profit Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center" style={{ color: 'var(--text-muted)' }}>No units sold in this time frame.</td>
                      </tr>
                    ) : (
                      performanceData.map((item, idx) => {
                        const rev = typeof item.revenue === 'string' ? parseFloat(item.revenue) : item.revenue;
                        const profit = typeof item.profit === 'string' ? parseFloat(item.profit) : item.profit;
                        const marginPercent = rev > 0 ? (profit / rev) * 100 : 0;
                        
                        return (
                          <tr key={idx}>
                            <td><strong>{item.name}</strong></td>
                            <td><span className="sku-tag">{item.sku}</span></td>
                            <td>{item.category || 'N/A'}</td>
                            <td>{formatNumber(item.units_sold)}</td>
                            <td>{formatCurrency(item.revenue)}</td>
                            <td style={{ color: profit > 0 ? 'var(--success-emerald)' : 'var(--text-primary)' }}>{formatCurrency(item.profit)}</td>
                            <td>
                              <span className={`badge ${marginPercent > 40 ? 'badge-success' : marginPercent > 20 ? 'badge-info' : 'badge-warning'}`}>
                                {marginPercent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY VALUATION VIEW */}
          {activeTab === 'valuation' && valuationData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Valuation Stats Cards */}
              <div className="grid-container grid-cols-4">
                <div className="glass-card metric-card" style={{ padding: '20px', background: 'rgba(19, 26, 46, 0.35)' }}>
                  <div className="metric-icon-wrapper amber" style={{ width: '48px', height: '48px' }}>
                    <DollarSign size={20} />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Capital Invested (Cost)</span>
                    <h2 className="metric-value" style={{ fontSize: '1.25rem' }}>{formatCurrency(valuationData.totals.total_cost)}</h2>
                  </div>
                </div>

                <div className="glass-card metric-card" style={{ padding: '20px', background: 'rgba(19, 26, 46, 0.35)' }}>
                  <div className="metric-icon-wrapper cyan" style={{ width: '48px', height: '48px' }}>
                    <DollarSign size={20} />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Expected Retail Value</span>
                    <h2 className="metric-value text-cyan" style={{ fontSize: '1.25rem' }}>{formatCurrency(valuationData.totals.total_retail)}</h2>
                  </div>
                </div>

                <div className="glass-card metric-card" style={{ padding: '20px', background: 'rgba(19, 26, 46, 0.35)' }}>
                  <div className="metric-icon-wrapper green" style={{ width: '48px', height: '48px' }}>
                    <TrendingUp size={20} />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Potential Profit</span>
                    <h2 className="metric-value" style={{ fontSize: '1.25rem', color: 'var(--success-emerald)' }}>
                      {formatCurrency(
                        parseFloat(valuationData.totals.total_retail as string) - 
                        parseFloat(valuationData.totals.total_cost as string)
                      )}
                    </h2>
                  </div>
                </div>

                <div className="glass-card metric-card" style={{ padding: '20px', background: 'rgba(19, 26, 46, 0.35)' }}>
                  <div className="metric-icon-wrapper cyan" style={{ width: '48px', height: '48px' }}>
                    <Percent size={20} />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Projected Margin</span>
                    <h2 className="metric-value" style={{ fontSize: '1.25rem' }}>
                      {parseFloat(valuationData.totals.total_retail as string) > 0 ? (
                        ((parseFloat(valuationData.totals.total_retail as string) - parseFloat(valuationData.totals.total_cost as string)) / 
                        parseFloat(valuationData.totals.total_retail as string) * 100).toFixed(1)
                      ) : '0'}%
                    </h2>
                  </div>
                </div>
              </div>

              {/* Valuation Inventory Table */}
              <div className="glass-card" style={{ padding: '24px', background: 'rgba(19, 26, 46, 0.2)' }}>
                <div className="card-header" style={{ marginBottom: '16px', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Layers className="card-header-icon" size={20} />
                    <h3 style={{ fontSize: '1.05rem' }}>Valuation Breakdown</h3>
                  </div>
                  {valuationData.items.length > 0 && (
                    <button className="btn btn-secondary text-sm" onClick={exportValuationToCSV} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                      <FileSpreadsheet size={16} />
                      <span>Export Valuation CSV</span>
                    </button>
                  )}
                </div>

                <div className="table-container" style={{ margin: 0, border: 'none', background: 'transparent' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Product Info</th>
                        <th>Category</th>
                        <th>Stock Qty</th>
                        <th>Cost Price</th>
                        <th>Retail Price</th>
                        <th>Total Cost Value</th>
                        <th>Total Retail Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuationData.items.map(item => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong>{item.name}</strong>
                              <span className="sku-tag" style={{ width: 'fit-content', marginTop: '2px', padding: '2px 4px', fontSize: '0.7rem' }}>{item.sku}</span>
                            </div>
                          </td>
                          <td>{item.category_name || 'N/A'}</td>
                          <td>
                            <span className={`badge ${item.quantity_on_hand === 0 ? 'badge-danger' : 'badge-info'}`}>
                              {item.quantity_on_hand}
                            </span>
                          </td>
                          <td>{formatCurrency(item.cost_price)}</td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td>{formatCurrency(item.total_cost_value)}</td>
                          <td><strong className="text-cyan">{formatCurrency(item.total_retail_value)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Styled components styles override for Tabs */}
      <style dangerouslySetInnerHTML={{__html: `
        .tab-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: var(--border-radius-md);
          font-weight: 500;
          font-size: 0.9rem;
          color: var(--text-secondary);
          transition: var(--transition-smooth);
        }

        .tab-btn svg {
          color: var(--text-secondary);
          transition: var(--transition-smooth);
        }

        .tab-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
        }

        .tab-btn.active {
          background: var(--accent-cyan-glow);
          border: 1px solid rgba(6, 182, 212, 0.2);
          color: var(--accent-cyan);
          font-weight: 600;
        }

        .tab-btn.active svg {
          color: var(--accent-cyan);
        }

        .text-sm {
          font-size: 0.85rem !important;
        }
      `}} />
    </div>
  );
};
