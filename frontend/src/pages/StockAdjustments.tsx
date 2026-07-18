import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  RefreshCw, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Package, 
  ClipboardList
} from 'lucide-react';

interface StockAdjustment {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity_changed: number;
  adjustment_type: 'receiving' | 'damage_loss' | 'manual_correction';
  reason: string | null;
  adjusted_by: string | null;
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  quantity_on_hand: number;
}

export const StockAdjustments: React.FC = () => {
  const { apiFetch, showNotification } = useAuth();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New adjustment modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [qtyChanged, setQtyChanged] = useState('');
  const [adjType, setAdjType] = useState<'receiving' | 'damage_loss' | 'manual_correction'>('manual_correction');
  const [reason, setReason] = useState('');

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<StockAdjustment[]>('/api/stock-adjustments');
      setAdjustments(res);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load stock adjustments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
    const fetchProducts = async () => {
      try {
        const res = await apiFetch<Product[]>('/api/products');
        setProducts(res);
      } catch {}
    };
    fetchProducts();
  }, []);

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !qtyChanged || !adjType) {
      showNotification('Please fill in all required fields', 'warning');
      return;
    }

    const qty = parseInt(qtyChanged);
    if (qty === 0) {
      showNotification('Quantity changed cannot be zero', 'warning');
      return;
    }

    try {
      const payload = {
        product_id: parseInt(productId),
        quantity_changed: qty,
        adjustment_type: adjType,
        reason
      };

      await apiFetch('/api/stock-adjustments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showNotification('Stock adjusted successfully!', 'success');
      setIsModalOpen(false);
      setProductId('');
      setQtyChanged('');
      setReason('');
      fetchAdjustments();
      
      // Update local product stocks representation
      const res = await apiFetch<Product[]>('/api/products');
      setProducts(res);
    } catch (err: any) {
      showNotification(err.message || 'Stock adjustment failed', 'error');
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'receiving': 
        return <span className="badge badge-success">Receiving</span>;
      case 'damage_loss': 
        return <span className="badge badge-danger">Damage/Loss</span>;
      case 'manual_correction': 
        return <span className="badge badge-info">Correction</span>;
      default: 
        return <span className="badge">{type}</span>;
    }
  };

  const getStockCurrentText = () => {
    if (!productId) return '';
    const p = products.find(prod => prod.id === parseInt(productId));
    return p ? `Current stock: ${p.quantity_on_hand}` : '';
  };

  return (
    <div className="adjustments-wrapper">
      {/* Controls */}
      <div className="adjustments-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Stock Adjustment Logs</h3>
        {!isModalOpen && (
          <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <Plus size={18} />
            <span>New Stock Adjustment</span>
          </button>
        )}
      </div>

      {/* Inline Form Card */}
      {isModalOpen && (
        <div className="glass-card inline-form-card" style={{ padding: '24px', marginBottom: '24px', background: 'rgba(19, 26, 46, 0.45)' }}>
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}><Plus size={20} className="text-cyan" /> Manual Stock Adjustment</h3>
            <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreateAdjustment} className="modal-form">
            <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Select Product *</label>
                <select 
                  className="form-select"
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">Choose product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
                {productId && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                    {getStockCurrentText()}
                  </span>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Adjustment Type *</label>
                <select 
                  className="form-select"
                  required
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as any)}
                >
                  <option value="manual_correction">Manual Correction</option>
                  <option value="receiving">Receiving Stock</option>
                  <option value="damage_loss">Damage / Loss / Write-off</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quantity Changed *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  required
                  placeholder="e.g. 5 or -3"
                  value={qtyChanged}
                  onChange={(e) => setQtyChanged(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Use positive numbers to add stock, negative numbers to subtract.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reason Notes</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Damaged during unloading / stock take correction"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Apply Adjustment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Adjustments List */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading audit logs...</p>
        </div>
      ) : adjustments.length === 0 ? (
        <div className="glass-card empty-state">
          <ClipboardList size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p>No stock adjustments logged.</p>
        </div>
      ) : (
        <div className="table-container glass-card">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Product Info</th>
                <th>SKU</th>
                <th>Qty Change</th>
                <th>Type</th>
                <th>Reason Notes</th>
                <th>Adjusted By</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map(adj => (
                <tr key={adj.id}>
                  <td>
                    <strong>#{adj.id}</strong>
                  </td>
                  <td>{adj.product_name}</td>
                  <td><span className="sku-tag">{adj.sku}</span></td>
                  <td>
                    <strong style={{ color: adj.quantity_changed > 0 ? 'var(--success-emerald)' : 'var(--error-rose)' }}>
                      {adj.quantity_changed > 0 ? `+${adj.quantity_changed}` : adj.quantity_changed}
                    </strong>
                  </td>
                  <td>{getTypeBadge(adj.adjustment_type)}</td>
                  <td>{adj.reason || <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No details</span>}</td>
                  <td>
                    <span className="badge badge-info">{adj.adjusted_by || 'system'}</span>
                  </td>
                  <td>{new Date(adj.created_at).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
