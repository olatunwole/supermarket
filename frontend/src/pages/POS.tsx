import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  CreditCard, 
  Banknote,
  Percent,
  Receipt,
  X,
  ArrowRightLeft
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  unit_price: string | number;
  quantity_on_hand: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // custom flat discount for this line item in GBP
}

export const POS: React.FC = () => {
  const { apiFetch, showNotification, formatCurrency, convertToBase, convertToActive, currency, storeSettings } = useAuth();
  
  // Products & Cart
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  
  // Checkout Configuration
  const [taxRate, setTaxRate] = useState(0.2); // Default 20%
  const [cartDiscount, setCartDiscount] = useState(0); // Flat discount on whole cart
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [notes, setNotes] = useState('');
  const [checkoutResult, setCheckoutResult] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Inventory Products
  const loadProducts = async () => {
    try {
      const res = await apiFetch<Product[]>('/api/products');
      setProducts(res);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load products', 'error');
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const queryStr = search.trim();
      if (!queryStr) return;

      const exactMatch = products.find(p => 
        (p.barcode && p.barcode === queryStr) || 
        p.sku.toLowerCase() === queryStr.toLowerCase()
      );

      if (exactMatch) {
        addToCart(exactMatch);
        setSearch('');
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearch('');
      }
    }
  };

  const addToCart = (product: Product) => {
    if (product.quantity_on_hand <= 0) {
      showNotification(`${product.name} is out of stock`, 'warning');
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.quantity_on_hand) {
        showNotification(`Cannot add more. Only ${product.quantity_on_hand} available.`, 'warning');
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1, discount: 0 }]);
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    const existingIndex = cart.findIndex(item => item.product.id === productId);
    if (existingIndex === -1) return;

    const item = cart[existingIndex];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > item.product.quantity_on_hand) {
      showNotification(`Only ${item.product.quantity_on_hand} items available in stock`, 'warning');
      return;
    }

    const updated = [...cart];
    updated[existingIndex].quantity = newQty;
    setCart(updated);
  };

  const updateLineDiscount = (productId: number, discountStr: string) => {
    const val = parseFloat(discountStr) || 0;
    const existingIndex = cart.findIndex(item => item.product.id === productId);
    if (existingIndex === -1) return;

    const updated = [...cart];
    updated[existingIndex].discount = val;
    setCart(updated);
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Totals calculations
  const calculateTotals = () => {
    let subtotal = 0;
    for (const item of cart) {
      const price = parseFloat(item.product.unit_price as string);
      subtotal += (price * item.quantity) - item.discount;
    }
    const taxAmt = subtotal * taxRate;
    const finalTotal = subtotal + taxAmt - cartDiscount;
    return {
      subtotal,
      taxAmt,
      finalTotal: Math.max(finalTotal, 0)
    };
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      showNotification('Cart is empty', 'warning');
      return;
    }

    const { subtotal, taxAmt, finalTotal } = calculateTotals();
    const payload = {
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        discount: item.discount
      })),
      payment_method: paymentMethod,
      discount_amount: cartDiscount,
      tax_rate: taxRate,
      notes: notes
    };

    setSubmitting(true);
    try {
      const res = await apiFetch<any>('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setCheckoutResult(res);
      setIsReceiptOpen(true);
      setCart([]);
      setNotes('');
      setCartDiscount(0);
      showNotification('POS Checkout completed successfully!', 'success');

      // Refresh product quantities from DB
      loadProducts();
    } catch (err: any) {
      showNotification(err.message || 'Failed to complete checkout', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  );

  const { subtotal, taxAmt, finalTotal } = calculateTotals();

  return (
    <div className="pos-layout" style={{ height: 'calc(100vh - 100px)', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', padding: '8px 0' }}>
      
      {/* Catalog & Search (Left side) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
        
        {/* POS Sub-header actions */}
        <div className="flex-space" style={{ flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', height: '40px', margin: 0 }}
              placeholder="Scan barcode or type SKU/name..."
              value={search}
              onKeyDown={handleSearchKeyDown}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

        </div>

        {/* Product Catalog Grid */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', paddingRight: '4px' }}>
          {filteredProducts.length === 0 ? (
            <div className="flex-center" style={{ gridColumn: '1 / -1', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
              <ShoppingCart size={40} />
              <p>No products match your search query.</p>
            </div>
          ) : (
            filteredProducts.map(prod => {
              const inStock = prod.quantity_on_hand > 0;
              return (
                <div 
                  key={prod.id} 
                  className={`glass-card pos-prod-card ${inStock ? '' : 'out-of-stock'}`} 
                  onClick={() => inStock && addToCart(prod)}
                  style={{ 
                    padding: '16px', 
                    borderRadius: '12px', 
                    cursor: inStock ? 'pointer' : 'not-allowed', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    height: '140px',
                    opacity: inStock ? 1 : 0.5,
                    border: '1px solid var(--glass-border)',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{prod.sku}</span>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={prod.name}>
                      {prod.name}
                    </h4>
                  </div>
                  <div className="flex-space" style={{ marginTop: 'auto' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{formatCurrency(prod.unit_price)}</span>
                    <span style={{ fontSize: '0.75rem', color: inStock ? 'var(--success-emerald)' : 'var(--error-rose)', fontWeight: 600 }}>
                      {inStock ? `${prod.quantity_on_hand} left` : 'Out of Stock'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Cart & Checkout panel (Right side) */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingCart size={18} className="text-accent" /> Checkout Terminal Cart
        </h2>

        {/* Cart Item rows */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', paddingRight: '4px' }}>
          {cart.length === 0 ? (
            <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', textAlign: 'center' }}>
              <ShoppingCart size={32} />
              <p style={{ fontSize: '0.85rem' }}>Scan a barcode or click items to fill checkout cart.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="glass-card" style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <div className="flex-space">
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</span>
                  <button className="btn-icon text-danger" style={{ padding: '2px' }} onClick={() => removeFromCart(item.product.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="flex-space" style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {formatCurrency((parseFloat(item.product.unit_price as string) * item.quantity) - item.discount)}
                  </span>
                  
                  {/* Quantity Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '2px 4px' }}>
                    <button type="button" className="btn-icon" style={{ padding: '2px' }} onClick={() => updateQuantity(item.product.id, -1)}><Minus size={12} /></button>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
                    <button type="button" className="btn-icon" style={{ padding: '2px' }} onClick={() => updateQuantity(item.product.id, 1)}><Plus size={12} /></button>
                  </div>
                </div>

                {/* Line Item Discount */}
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Item Discount (£):</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ height: '24px', width: '70px', padding: '0 6px', fontSize: '0.75rem', textAlign: 'right', margin: 0 }}
                    value={item.discount || ''}
                    placeholder="0.00"
                    onChange={e => updateLineDiscount(item.product.id, e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pricing Summary & Checkout */}
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <div className="flex-space" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex-space" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>Sales Tax (20%):</span>
            <span>{formatCurrency(taxAmt)}</span>
          </div>

          <div className="flex-space" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
            <span>Flat Discount (£):</span>
            <input
              type="number"
              className="form-input"
              style={{ height: '28px', width: '90px', padding: '0 8px', fontSize: '0.8rem', textAlign: 'right', margin: 0 }}
              value={cartDiscount || ''}
              placeholder="0.00"
              onChange={e => setCartDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex-space" style={{ fontWeight: 800, fontSize: '1.2rem', margin: '4px 0', borderTop: '1px dashed var(--glass-border)', paddingTop: '10px' }}>
            <span>Total Payable:</span>
            <span className="text-cyan">{formatCurrency(finalTotal)}</span>
          </div>

          {/* Payment Method Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', margin: '6px 0' }}>
            <button className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`} style={{ height: '36px', padding: 0, fontSize: '0.75rem' }} onClick={() => setPaymentMethod('cash')}>
              <Banknote size={14} /> Cash
            </button>
            <button className={`btn ${paymentMethod === 'card' ? 'btn-primary' : 'btn-secondary'}`} style={{ height: '36px', padding: 0, fontSize: '0.75rem' }} onClick={() => setPaymentMethod('card')}>
              <CreditCard size={14} /> Card
            </button>
            <button className={`btn ${paymentMethod === 'transfer' ? 'btn-primary' : 'btn-secondary'}`} style={{ height: '36px', padding: 0, fontSize: '0.75rem' }} onClick={() => setPaymentMethod('transfer')}>
              <ArrowRightLeft size={14} /> Bank
            </button>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', height: '48px', fontWeight: 700 }} disabled={submitting || cart.length === 0} onClick={handleCheckoutSubmit}>
            {submitting ? 'Processing Checkout...' : `Complete Checkout (${formatCurrency(finalTotal)})`}
          </button>
        </div>

      </div>

      {/* RECEIPT / CHECKOUT INVOICE MODAL */}
      {isReceiptOpen && checkoutResult && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '400px', padding: '24px', borderRadius: '16px' }}>
            <div className="modal-header" style={{ borderBottom: 'none', marginBottom: '12px', paddingBottom: 0 }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt className="text-cyan" /> POS Receipt Invoice
              </h2>
              <button className="btn-close" onClick={() => setIsReceiptOpen(false)}><X size={20} /></button>
            </div>

            {/* Receipt specs layout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
              <h3>{storeSettings.name}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{storeSettings.address}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Phone: {storeSettings.phone}</p>
              <p style={{ color: 'var(--text-muted)' }}>Tax ID: {storeSettings.taxId}</p>
            </div>

            <div style={{ borderTop: '1px dashed var(--glass-border)', borderBottom: '1px dashed var(--glass-border)', padding: '12px 0', margin: '12px 0', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="flex-space">
                <span>Receipt Number:</span>
                <span style={{ fontWeight: 600 }}>#{checkoutResult.id}</span>
              </div>
              <div className="flex-space">
                <span>Date:</span>
                <span>{new Date(checkoutResult.sale_date).toLocaleString()}</span>
              </div>
              <div className="flex-space">
                <span>Payment Method:</span>
                <span style={{ textTransform: 'capitalize' }}>{checkoutResult.payment_method}</span>
              </div>
            </div>

            {/* Items table list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              {checkoutResult.items.map((it: any, idx: number) => (
                <div key={idx} className="flex-space" style={{ padding: '2px 0' }}>
                  <span>
                    {it.product_name} <strong style={{ color: 'var(--text-secondary)' }}>x{it.quantity}</strong>
                  </span>
                  <span>{formatCurrency(Number(it.unit_price) * it.quantity - Number(it.discount || 0))}</span>
                </div>
              ))}
            </div>

            {/* Invoiced financial tallies */}
            <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '16px', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
              <div className="flex-space" style={{ color: 'var(--text-secondary)' }}>
                <span>Subtotal:</span>
                <span>{formatCurrency(Number(checkoutResult.total_amount) - Number(checkoutResult.tax_amount) + Number(checkoutResult.discount_amount))}</span>
              </div>
              <div className="flex-space" style={{ color: 'var(--text-secondary)' }}>
                <span>Sales Tax Collected:</span>
                <span>{formatCurrency(checkoutResult.tax_amount)}</span>
              </div>
              {Number(checkoutResult.discount_amount) > 0 && (
                <div className="flex-space" style={{ color: 'var(--error-rose)' }}>
                  <span>Discounts Applied:</span>
                  <span>-{formatCurrency(checkoutResult.discount_amount)}</span>
                </div>
              )}
              <div className="flex-space" style={{ fontWeight: 800, fontSize: '1.05rem', borderTop: '1px dashed var(--glass-border)', paddingTop: '6px' }}>
                <span>Final Total Paid:</span>
                <span className="text-cyan">{formatCurrency(checkoutResult.total_amount)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setIsReceiptOpen(false)}>
                Done / Print receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .pos-prod-card:hover {
          border-color: var(--accent-cyan) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(6, 182, 212, 0.15);
        }
        .pos-prod-card.out-of-stock {
          cursor: not-allowed !important;
        }
        .spinner-bar {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />

    </div>
  );
};
export default POS;
