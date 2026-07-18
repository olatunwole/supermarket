import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Truck, 
  X, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  AlertCircle,
  FileText,
  Calendar,
  ClipboardList
} from 'lucide-react';

interface PurchaseOrderItem {
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_cost: number;
}

interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name?: string;
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  order_date: string | null;
  received_date: string | null;
  total_amount: string | number;
  notes: string | null;
  created_at: string;
  items?: PurchaseOrderItem[];
}

interface Supplier {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  cost_price: string | number;
}

export const PurchaseOrders: React.FC = () => {
  const { apiFetch, showNotification, user, formatCurrency, currency } = useAuth();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New PO creation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);

  // Expanded PO details ID state
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  
  // Active item adding fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [unitCost, setUnitCost] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<PurchaseOrder[]>('/api/purchase-orders');
      setOrders(res.sort((a, b) => b.id - a.id));
    } catch (err: any) {
      showNotification(err.message || 'Failed to load purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const fetchMetadata = async () => {
      try {
        const [sups, prods] = await Promise.all([
          apiFetch<Supplier[]>('/api/suppliers'),
          apiFetch<Product[]>('/api/products')
        ]);
        setSuppliers(sups);
        setProducts(prods);
      } catch {}
    };
    fetchMetadata();
  }, []);

  const handleProductChange = (idStr: string) => {
    setSelectedProductId(idStr);
    const prod = products.find(p => p.id === parseInt(idStr));
    if (prod) {
      setUnitCost(prod.cost_price.toString());
    }
  };

  const addPoItem = () => {
    if (!selectedProductId || !quantity || !unitCost) {
      showNotification('Please fill in all item fields', 'warning');
      return;
    }
    const pid = parseInt(selectedProductId);
    const qty = parseInt(quantity);
    const cost = parseFloat(unitCost);

    const existingIndex = poItems.findIndex(i => i.product_id === pid);
    if (existingIndex > -1) {
      const updated = [...poItems];
      updated[existingIndex].quantity += qty;
      setPoItems(updated);
    } else {
      const prod = products.find(p => p.id === pid);
      setPoItems([...poItems, {
        product_id: pid,
        product_name: prod?.name || `Product #${pid}`,
        quantity: qty,
        unit_cost: cost
      }]);
    }

    setSelectedProductId('');
    setQuantity('10');
    setUnitCost('');
  };

  const removePoItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    try {
      await apiFetch(`/api/purchase-orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      showNotification(`Order status updated to ${newStatus}`, 'success');
      fetchOrders();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update order status', 'error');
    }
  };

  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      showNotification('Please select a supplier', 'warning');
      return;
    }
    if (poItems.length === 0) {
      showNotification('Please add at least one product item to the order list', 'warning');
      return;
    }

    try {
      await apiFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: parseInt(supplierId),
          notes,
          items: poItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost
          }))
        })
      });

      showNotification('Purchase order created successfully', 'success');
      setIsModalOpen(false);
      setSupplierId('');
      setNotes('');
      setPoItems([]);
      fetchOrders();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create purchase order', 'error');
    }
  };

  const toggleDetails = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }

    try {
      const details = await apiFetch<PurchaseOrder>(`/api/purchase-orders/${orderId}`);
      setOrders(orders.map(o => o.id === orderId ? { ...o, items: details.items } : o));
      setExpandedOrderId(orderId);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load PO details', 'error');
    }
  };

  return (
    <div className="pos-layout-wrapper" style={{ padding: '8px 0 24px' }}>
      
      {/* Top action header */}
      <div className="flex-space" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={28} className="text-accent" /> Procurement & Suppliers
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage supplier purchase orders, track replenishment logs, and audit deliveries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Create PO Draft
          </button>
        </div>
      </div>

      {/* PO List */}
      <div className="tab-pane animation-fade">
        {loading && orders.length === 0 ? (
          <div className="flex-center" style={{ minHeight: '30vh' }}><div className="spinner"></div></div>
        ) : (
          <div className="table-responsive">
            {orders.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: '40px', flexDirection: 'column', gap: '12px' }}>
                <ClipboardList size={48} className="text-muted" />
                <p style={{ color: 'var(--text-secondary)' }}>No purchase orders recorded.</p>
              </div>
            ) : (
              <table className="excel-table">
                <thead>
                  <tr>
                    <th>PO ID</th>
                    <th>Supplier</th>
                    <th>Date Placed</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total Value</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const isExpanded = expandedOrderId === order.id;
                    const total = Number(order.total_amount);
                    return (
                      <React.Fragment key={order.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => toggleDetails(order.id)}>
                          <td style={{ fontWeight: 700 }}>#{order.id}</td>
                          <td style={{ fontWeight: 600 }}>{order.supplier_name}</td>
                          <td>{new Date(order.created_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${
                              order.status === 'received' ? 'badge-success' :
                              order.status === 'ordered' ? 'badge-info' :
                              order.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
                            }`} style={{ textTransform: 'uppercase' }}>
                              {order.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(total)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); toggleDetails(order.id); }}>
                              {isExpanded ? 'Hide Details' : 'View Details'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ background: '#f8fafc', padding: '16px' }}>
                              <h4 style={{ color: '#000000', marginBottom: '10px', fontSize: '0.95rem', fontWeight: 700 }}>Order Items Details</h4>
                              <table className="excel-table" style={{ marginTop: 0, background: '#ffffff', width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th>Product SKU/Name</th>
                                    <th style={{ textAlign: 'right' }}>Quantity</th>
                                    <th style={{ textAlign: 'right' }}>Unit Cost</th>
                                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.items?.map((item, idx) => (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                                      <td style={{ textAlign: 'right' }}>{item.quantity} units</td>
                                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_cost)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.quantity * item.unit_cost)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {order.notes && (
                                <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '10px', fontStyle: 'italic' }}>
                                  Notes: {order.notes}
                                </p>
                              )}
                              {user && ['admin', 'manager'].includes(user.role) && (
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                  {order.status === 'pending' && (
                                    <>
                                      <button className="btn btn-secondary btn-sm" onClick={() => handleStatusUpdate(order.id, 'cancelled')}>
                                        Cancel Draft
                                      </button>
                                      <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(order.id, 'ordered')}>
                                        Mark Ordered / Dispatched
                                      </button>
                                    </>
                                  )}
                                  {order.status === 'ordered' && (
                                    <button className="btn btn-primary btn-sm" style={{ background: 'var(--success-emerald)', color: '#fff' }} onClick={() => handleStatusUpdate(order.id, 'received')}>
                                      Mark Received / Add Stock
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CREATE PO */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '650px', borderRadius: '16px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Draft Purchase Order</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreatePoSubmit}>
              <div className="modal-form-grid" style={{ marginBottom: '16px' }}>
                <div className="form-group span-cols">
                  <label className="form-label">Assign Supplier *</label>
                  <select className="form-select" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Add items panel */}
              <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', marginBottom: '16px', border: '1px solid var(--glass-border)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>Add Products</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Product</label>
                    <select className="form-select" style={{ padding: '8px 12px', fontSize: '0.85rem' }} value={selectedProductId} onChange={e => handleProductChange(e.target.value)}>
                      <option value="">-- Choose Product --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Quantity</label>
                    <input type="number" className="form-input" style={{ padding: '8px 12px', fontSize: '0.85rem' }} value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Cost Price (£)</label>
                    <input type="number" step="0.01" className="form-input" style={{ padding: '8px 12px', fontSize: '0.85rem' }} value={unitCost} onChange={e => setUnitCost(e.target.value)} />
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '12px', width: '100%', fontSize: '0.8rem' }} onClick={addPoItem}>
                  Add to Purchase Order Items
                </button>
              </div>

              {/* PO Items queue */}
              {poItems.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Order Items Queue</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                    {poItems.map((item, idx) => (
                      <div key={idx} className="glass-card flex-space" style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <span>{item.product_name} <strong style={{ color: 'var(--text-secondary)' }}>x{item.quantity}</strong></span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span>{formatCurrency(item.quantity * item.unit_cost)}</span>
                          <button type="button" className="btn-icon text-danger" style={{ padding: 0 }} onClick={() => removePoItem(idx)}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Total running sum */}
                  <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '0.9rem', fontWeight: 700 }}>
                    Total Draft Cost: <span className="text-cyan">{formatCurrency(poItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0))}</span>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Order Notes / Supplier Remarks</label>
                <input type="text" className="form-input" placeholder="e.g. Standard monthly replenishment" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create PO Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default PurchaseOrders;
