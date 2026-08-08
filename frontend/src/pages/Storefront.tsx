import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Store, ShoppingCart, Search, Trash2, CreditCard, ChevronRight, CheckCircle, Globe, Phone, MapPin, Shield } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  unit_price: number;
  quantity_on_hand: number;
  category_name: string;
}

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  subscription_plan: string;
}

export const Storefront: React.FC = () => {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Cart state
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = (import.meta.env.VITE_APP_API_URL || '').replace(/\/$/, '');

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/storefront/catalog/${subdomain}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch store catalog');
        }
        setTenant(data.tenant);
        setProducts(data.products);
      } catch (err: any) {
        setError(err.message || 'Store not found');
      } finally {
        setLoading(false);
      }
    };
    if (subdomain) {
      fetchCatalog();
    }
  }, [subdomain]);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.qty >= product.quantity_on_hand) {
        alert(`Cannot add more. Only ${product.quantity_on_hand} items available in stock.`);
        return;
      }
      setCart(cart.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { product, qty: 1 }]);
    }
  };

  const updateCartQty = (productId: number, newQty: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    if (newQty > item.product.quantity_on_hand) {
      alert(`Only ${item.product.quantity_on_hand} items available in stock.`);
      return;
    }
    if (newQty <= 0) {
      setCart(cart.filter(i => i.product.id !== productId));
    } else {
      setCart(cart.map(i => i.product.id === productId ? { ...i, qty: newQty } : i));
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(i => i.product.id !== productId));
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !cardName.trim() || !cardNumber.trim()) {
      alert('Please fill out email and credit card details.');
      return;
    }
    setSubmittingOrder(true);
    try {
      const payload = {
        customer_email: email,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.qty
        }))
      };
      const res = await fetch(`${apiBaseUrl}/api/storefront/order/${subdomain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }
      setOrderSuccess(data.order_id);
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to process order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category_name || 'Uncategorized')))];
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || (p.category_name || 'Uncategorized') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.unit_price * item.qty), 0);

  if (loading) {
    return (
      <div className="store-loading">
        <div className="spinner"></div>
        <p>Loading digital catalog...</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="store-error">
        <Store size={48} />
        <h2>Shop Not Found</h2>
        <p>{error || 'The requested store subdomain does not exist.'}</p>
        <a href="/login" className="btn btn-primary">Go to Admin Login</a>
      </div>
    );
  }

  return (
    <div className="store-container">
      {/* Header Banner */}
      <header className="store-header glass-card">
        <div className="store-identity">
          <div className="store-avatar">
            <Store size={30} />
          </div>
          <div>
            <h1>{tenant.name}</h1>
            <div className="store-meta">
              <span><Globe size={14} /> {tenant.subdomain}.pos-system.com</span>
              <span><Phone size={14} /> Active Web Storefront</span>
            </div>
          </div>
        </div>
        <div>
          <a href={`/login?subdomain=${tenant.subdomain}`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', padding: '8px 16px' }}>
            <Shield size={16} /> Staff Portal
          </a>
        </div>
      </header>

      {/* Main Grid */}
      <div className="store-main-layout">
        {/* Products Grid & Catalog */}
        <div className="store-catalog-section">
          {/* Filters Bar */}
          <div className="store-filter-bar glass-card">
            <div className="store-search">
              <Search size={18} />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="category-tags">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`category-tag ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Success Checkmark View */}
          {orderSuccess && (
            <div className="order-success-banner glass-card">
              <CheckCircle size={48} className="success-icon" />
              <h2>Payment Received Successfully!</h2>
              <p>Your order <strong>#{orderSuccess}</strong> has been received and stock levels have been updated.</p>
              <button className="btn btn-primary" onClick={() => setOrderSuccess(null)}>Continue Shopping</button>
            </div>
          )}

          {/* Products Grid */}
          <div className="products-grid">
            {filteredProducts.map(prod => (
              <div key={prod.id} className="product-card glass-card">
                <div className="product-card-body">
                  <span className="product-category">{prod.category_name || 'General'}</span>
                  <h3>{prod.name}</h3>
                  <div className="product-sku">SKU: {prod.sku}</div>
                  
                  <div className="product-inventory-info">
                    {prod.quantity_on_hand <= 0 ? (
                      <span className="stock-badge out-of-stock">Out of Stock</span>
                    ) : prod.quantity_on_hand <= 5 ? (
                      <span className="stock-badge low-stock">Only {prod.quantity_on_hand} left</span>
                    ) : (
                      <span className="stock-badge in-stock">{prod.quantity_on_hand} Available</span>
                    )}
                  </div>
                </div>

                <div className="product-card-footer">
                  <span className="product-price">£{Number(prod.unit_price).toFixed(2)}</span>
                  <button 
                    className="btn btn-primary add-to-cart-btn"
                    onClick={() => addToCart(prod)}
                    disabled={prod.quantity_on_hand <= 0}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="empty-catalog glass-card">
                <p>No products found matching your filter selection.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Shopping Cart */}
        <aside className="store-cart-aside glass-card">
          <div className="cart-header">
            <h2><ShoppingCart size={20} /> Your Cart</h2>
            <span className="cart-count">{cart.reduce((sum, item) => sum + item.qty, 0)} Items</span>
          </div>

          <div className="cart-items">
            {cart.map(item => (
              <div key={item.product.id} className="cart-item">
                <div className="cart-item-details">
                  <h4>{item.product.name}</h4>
                  <div className="cart-item-price">£{Number(item.product.unit_price).toFixed(2)}</div>
                </div>
                <div className="cart-item-controls">
                  <div className="qty-controls">
                    <button onClick={() => updateCartQty(item.product.id, item.qty - 1)}>-</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateCartQty(item.product.id, item.qty + 1)}>+</button>
                  </div>
                  <button className="delete-btn" onClick={() => removeFromCart(item.product.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="empty-cart-message">
                <ShoppingCart size={32} />
                <p>Your shopping cart is empty.</p>
              </div>
            )}
          </div>

          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>£{cartTotal.toFixed(2)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>£{cartTotal.toFixed(2)}</span>
            </div>
            
            <button 
              className="btn btn-primary checkout-btn" 
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
            >
              Checkout Order <ChevronRight size={16} />
            </button>
          </div>
        </aside>
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2><CreditCard size={20} /> Checkout Payment</h2>
              <button className="close-modal-btn" onClick={() => setIsCheckoutOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">Customer Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="payment-simulation-alert">
                <Shield size={18} />
                <span>Simulated Secure Checkout. Card numbers will not be debited.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Name on Card</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="John Doe" 
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Card Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="4000 1234 5678 9010" 
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Expiry</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="MM/YY" 
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CVV</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="123" 
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="checkout-payment-total">
                <span>Amount to Pay</span>
                <span>£{cartTotal.toFixed(2)}</span>
              </div>

              <button type="submit" className="btn btn-primary modal-pay-btn" disabled={submittingOrder}>
                {submittingOrder ? 'Processing secure payment...' : `Submit Payment & Order`}
              </button>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .store-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 100vh;
        }

        .store-loading, .store-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          gap: 16px;
          color: var(--text-secondary);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--glass-border);
          border-top-color: var(--accent-cyan);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .store-header {
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .store-identity {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .store-avatar {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--accent-cyan), var(--success-emerald));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px var(--accent-cyan-glow);
        }

        .store-avatar svg {
          color: #000;
        }

        .store-identity h1 {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }

        .store-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .store-meta span {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .store-main-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          align-items: start;
        }

        .store-filter-bar {
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .store-search {
          position: relative;
        }

        .store-search svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .store-search input {
          width: 100%;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 10px 16px 10px 42px;
          color: #fff;
          outline: none;
        }

        .category-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .category-tag {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 4px 14px;
          font-size: 0.75rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-tag:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }

        .category-tag.active {
          background: var(--accent-cyan);
          color: #000;
          border-color: var(--accent-cyan);
          font-weight: 600;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }

        .product-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px;
          height: 220px;
          transition: transform 0.2s;
        }

        .product-card:hover {
          transform: translateY(-4px);
        }

        .product-category {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--accent-cyan);
          font-weight: 700;
        }

        .product-card h3 {
          font-size: 1rem;
          font-weight: 700;
          margin: 6px 0;
          color: #fff;
        }

        .product-sku {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .stock-badge {
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 12px;
          display: inline-block;
          font-weight: 600;
        }

        .stock-badge.in-stock {
          background: rgba(16, 185, 129, 0.1);
          color: var(--success-emerald);
        }

        .stock-badge.low-stock {
          background: rgba(245, 158, 11, 0.1);
          color: var(--warning-amber);
        }

        .stock-badge.out-of-stock {
          background: rgba(244, 63, 94, 0.1);
          color: var(--error-rose);
        }

        .product-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--glass-border);
          padding-top: 12px;
          margin-top: auto;
        }

        .product-price {
          font-size: 1.15rem;
          font-weight: 800;
          color: #fff;
        }

        .add-to-cart-btn {
          font-size: 0.75rem;
          padding: 6px 12px;
          height: 32px;
        }

        .store-cart-aside {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 480px;
        }

        .cart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .cart-header h2 {
          font-size: 1.1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cart-count {
          font-size: 0.75rem;
          background: var(--glass-border);
          padding: 2px 8px;
          border-radius: 12px;
        }

        .cart-items {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 320px;
          overflow-y: auto;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-sm);
        }

        .cart-item-details h4 {
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .cart-item-price {
          font-size: 0.8rem;
          color: var(--accent-cyan);
          font-weight: 700;
        }

        .cart-item-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .qty-controls {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 4px;
        }

        .qty-controls button {
          background: none;
          border: none;
          color: #fff;
          width: 24px;
          height: 24px;
          cursor: pointer;
        }

        .qty-controls span {
          width: 20px;
          text-align: center;
          font-size: 0.75rem;
        }

        .delete-btn {
          background: none;
          border: none;
          color: var(--error-rose);
          cursor: pointer;
          padding: 4px;
        }

        .empty-cart-message {
          text-align: center;
          color: var(--text-muted);
          padding: 40px 0;
        }

        .cart-summary {
          border-top: 1px solid var(--glass-border);
          padding-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .summary-row.total {
          font-size: 1.1rem;
          font-weight: 800;
          color: #fff;
        }

        .checkout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .order-success-banner {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px;
          gap: 16px;
          margin-bottom: 24px;
          border-color: var(--success-emerald);
        }

        .success-icon {
          color: var(--success-emerald);
        }

        /* Modal Settings */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          width: 100%;
          max-width: 460px;
          padding: 32px;
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-header h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.15rem;
        }

        .close-modal-btn {
          background: none;
          border: none;
          font-size: 2rem;
          color: var(--text-muted);
          cursor: pointer;
        }

        .payment-simulation-alert {
          background: rgba(6,182,212,0.05);
          border: 1px solid rgba(6,182,212,0.2);
          border-radius: var(--border-radius-sm);
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
          color: var(--accent-cyan);
          margin-bottom: 16px;
        }

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .checkout-payment-total {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-between;
          font-weight: 800;
          font-size: 1.15rem;
          color: #fff;
        }

        .modal-pay-btn {
          width: 100%;
          margin-top: 16px;
          height: 48px;
        }

        @media (max-width: 860px) {
          .store-main-layout {
            grid-template-columns: 1fr;
          }
        }
      `}} />
    </div>
  );
};
