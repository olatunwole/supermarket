import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ArrowRightLeft,
  Camera,
  Smartphone
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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

const extractProductCode = (text: string): string => {
  if (!text) return '';
  let cleaned = text.trim();
  
  // Handle URL or path formats (e.g., http://.../5000112637922 or /products/PRD-001)
  try {
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.includes('/')) {
      const url = new URL(cleaned.startsWith('http') ? cleaned : `http://${cleaned}`);
      // Check query parameters first
      const queryVal = url.searchParams.get('barcode') || 
                       url.searchParams.get('sku') || 
                       url.searchParams.get('code') || 
                       url.searchParams.get('id') || 
                       url.searchParams.get('product');
      if (queryVal) {
        return queryVal.trim();
      }
      
      // Get the last non-empty path segment
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return segments[segments.length - 1].trim();
      }
    }
  } catch (err) {
    // URL parsing failed, fallback to manual splitting
  }
  
  if (cleaned.includes('/')) {
    const segments = cleaned.split('/').filter(Boolean);
    if (segments.length > 0) {
      return segments[segments.length - 1].trim();
    }
  }

  return cleaned;
};

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
  
  // Camera Barcode Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startTimeoutRef = useRef<any>(null);
  const activeStartPromiseRef = useRef<Promise<any> | null>(null);

  // Mobile Scanner pairing states
  const [sessionId] = useState(() => 'reg-' + Math.random().toString(36).substring(2, 11));
  const [isMobileLinkOpen, setIsMobileLinkOpen] = useState(false);

  // Synthesize scan audio confirmation (Web Audio API oscillator)
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 1200; // 1.2kHz high-pitch POS confirmation beep
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); // keep it subtle
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08); // 80ms beep
    } catch (err) {
      console.error("Audio beep playback error:", err);
    }
  };

  const stopScanner = async () => {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }

    if (scannerRef.current) {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        } else if (activeStartPromiseRef.current) {
          await activeStartPromiseRef.current;
          await scanner.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const startScanner = () => {
    // Detect secure context issue
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      showNotification("Camera access requires a secure connection (HTTPS) or localhost.", "error");
      setIsScannerOpen(false);
      return;
    }

    setIsScannerOpen(true);
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }

    startTimeoutRef.current = setTimeout(() => {
      try {
        const html5Qrcode = new Html5Qrcode("pos-camera-reader");
        scannerRef.current = html5Qrcode;
        
        const startCameraWithFallback = (facingMode: "environment" | "user") => {
          const startPromise = html5Qrcode.start(
            { facingMode: facingMode },
            {
              fps: 15,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.75;
                const boxSize = Math.max(Math.min(size, 260), 180);
                return { width: boxSize, height: boxSize };
              }
            },
            (decodedText) => {
              playScanBeep();
              
              const cleanedCode = extractProductCode(decodedText);
              // Look for matching product
              const targetProd = products.find(p => 
                (p.barcode && p.barcode === cleanedCode) || 
                p.sku.toLowerCase() === cleanedCode.toLowerCase() ||
                String(p.id) === cleanedCode
              );
              if (targetProd) {
                addToCart(targetProd);
                showNotification(`Scanned: ${targetProd.name}`, 'success');
              } else {
                showNotification(`Barcode ${decodedText} not found in inventory`, 'warning');
              }
              
              stopScanner();
              setIsScannerOpen(false);
            },
            () => {
              // Keep scanning silently
            }
          );

          activeStartPromiseRef.current = startPromise;

          startPromise.then(() => {
            activeStartPromiseRef.current = null;
            if (scannerRef.current !== html5Qrcode) {
              html5Qrcode.stop().catch(err => console.error("Error stopping late-started camera:", err));
            }
          }).catch(err => {
            activeStartPromiseRef.current = null;
            if (scannerRef.current !== html5Qrcode) return;

            // Fallback strategy if environment fails
            if (facingMode === "environment") {
              console.log("Environment camera failed, falling back to user camera...");
              startCameraWithFallback("user");
            } else {
              console.error("Camera start failure:", err);
              showNotification("Camera access denied or busy.", "error");
              setIsScannerOpen(false);
            }
          });
        };

        // Initialize with environment/back camera first
        startCameraWithFallback("environment");

      } catch (err: any) {
        if (scannerRef.current) scannerRef.current = null;
        console.error("Scanner initialization failed:", err);
        showNotification("Failed to boot camera scanner.", "error");
        setIsScannerOpen(false);
      }
    }, 300);
  };

  // Stop camera stream if the component unmounts
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

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

  const addToCart = useCallback((product: Product) => {
    if (product.quantity_on_hand <= 0) {
      showNotification(`${product.name} is out of stock`, 'warning');
      return;
    }

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity;
        if (currentQty >= product.quantity_on_hand) {
          showNotification(`Cannot add more. Only ${product.quantity_on_hand} available.`, 'warning');
          return prevCart;
        }
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        };
        return updated;
      } else {
        return [...prevCart, { product, quantity: 1, discount: 0 }];
      }
    });
  }, [showNotification]);

  // Background polling for mobile companion camera scans
  useEffect(() => {
    let intervalId: any;

    const pollPendingScans = async () => {
      try {
        const res = await apiFetch<{ scans: string[] }>(`/api/sales/scan-session/${sessionId}/pending`);
        if (res && res.scans && res.scans.length > 0) {
          res.scans.forEach(scannedText => {
            const cleanedCode = extractProductCode(scannedText);
            const targetProd = products.find(p => 
              (p.barcode && p.barcode === cleanedCode) || 
              p.sku.toLowerCase() === cleanedCode.toLowerCase() ||
              String(p.id) === cleanedCode
            );
            if (targetProd) {
              addToCart(targetProd);
              playScanBeep();
              showNotification(`Mobile Scanned: ${targetProd.name}`, 'success');
            } else {
              showNotification(`Scanned barcode ${scannedText} not found`, 'warning');
            }
          });
        }
      } catch (err) {
        console.error("Failed to poll mobile scans:", err);
      }
    };

    intervalId = setInterval(pollPendingScans, 1500);
    return () => clearInterval(intervalId);
  }, [sessionId, products, addToCart]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const queryStr = search.trim();
      if (!queryStr) return;

      const cleanedCode = extractProductCode(queryStr);
      const exactMatch = products.find(p => 
        (p.barcode && p.barcode === cleanedCode) || 
        p.sku.toLowerCase() === cleanedCode.toLowerCase() ||
        String(p.id) === cleanedCode
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

  const filteredProducts = products.filter(p => {
    const cleanedSearch = extractProductCode(search);
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)) ||
      (p.barcode && cleanedSearch && p.barcode.includes(cleanedSearch)) ||
      (p.sku && cleanedSearch && p.sku.toLowerCase().includes(cleanedSearch.toLowerCase()))
    );
  });

  const { subtotal, taxAmt, finalTotal } = calculateTotals();

  return (
    <div className="pos-layout">
      
      {/* Catalog & Search (Left side) */}
      <div className="pos-catalog-container">
        
        {/* POS Sub-header actions */}
        <div className="flex-space" style={{ flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Search & Camera Scan Row */}
          <div className="pos-actions-bar">
            <div className="pos-search-wrapper">
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
            
            <button 
              type="button" 
              onClick={startScanner}
              title="Scan Barcode via PC Webcam"
              style={{ 
                height: '40px', 
                padding: '0 16px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Camera size={16} />
              <span>Camera Scan</span>
            </button>

            <button 
              type="button" 
              onClick={() => setIsMobileLinkOpen(true)}
              title="Link Phone Scanner"
              style={{ 
                height: '40px', 
                padding: '0 16px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Smartphone size={16} />
              <span>Link Phone</span>
            </button>
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
      <div className="glass-card pos-cart-container">
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

      {isScannerOpen && (
        <div className="modal-backdrop flex-center" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '480px', width: '90%', padding: '24px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3>Scan Barcode</h3>
              <button type="button" className="btn-close" onClick={() => {
                stopScanner();
                setIsScannerOpen(false);
              }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Hold product barcode up to the camera
            </p>

            <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000000', border: '1px solid var(--glass-border)' }}>
              <div id="pos-camera-reader" style={{ width: '100%' }} />
              
              <div style={{
                position: 'absolute',
                left: '10%',
                right: '10%',
                top: '50%',
                height: '2px',
                background: 'rgba(244, 63, 94, 0.85)',
                boxShadow: '0 0 8px rgba(244, 63, 94, 0.8)',
                zIndex: 10,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                animation: 'pulseGlow 1.5s infinite alternate'
              }} />
            </div>

            <div style={{ marginTop: '20px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: '100%' }} 
                onClick={() => {
                  stopScanner();
                  setIsScannerOpen(false);
                }}
              >
                Cancel Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobileLinkOpen && (
        <div className="modal-backdrop flex-center" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '400px', width: '90%', padding: '24px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3>Link Phone Scanner</h3>
              <button type="button" className="btn-close" onClick={() => setIsMobileLinkOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Scan this QR code with your phone's camera to pair it as a barcode scanner.
            </p>

            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.origin + '/scan-companion?session=' + sessionId)}`}
                alt="Scanner Pairing QR Code"
                style={{ display: 'block', width: '220px', height: '220px' }}
              />
            </div>

            <div style={{ wordBreak: 'break-all', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
              URL: {window.location.origin}/scan-companion?session={sessionId}
            </div>

            {window.location.hostname === 'localhost' && (
              <p style={{ fontSize: '0.75rem', color: 'var(--warning-amber)', marginBottom: '20px', lineHeight: '1.4' }}>
                <strong>Tip for phone connection:</strong> Your mobile phone cannot connect to "localhost". Please access the POS Register using your computer's local IP address (e.g., <code>http://192.168.1.X:5173</code>) in your PC browser to generate a scannable network QR code.
              </p>
            )}

            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ width: '100%' }} 
              onClick={() => setIsMobileLinkOpen(false)}
            >
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .pos-layout {
          height: calc(100vh - 160px);
          display: grid;
          grid-template-columns: 1fr 350px;
          gap: 20px;
          padding: 0;
          width: 100%;
          box-sizing: border-box;
          min-height: 0;
        }
        .pos-catalog-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
          height: 100%;
        }
        .pos-cart-container {
          padding: 20px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }
        .pos-actions-bar {
          display: flex;
          gap: 8px;
          align-items: center;
          width: 100%;
          flex-wrap: wrap;
        }
        .pos-search-wrapper {
          position: relative;
          width: 320px;
          flex-grow: 1;
        }
        @media (max-width: 1024px) {
          .pos-layout {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100%;
            gap: 24px;
          }
          .pos-catalog-container {
            height: 500px;
          }
          .pos-cart-container {
            height: 600px;
          }
        }
        @media (max-width: 640px) {
          .pos-search-wrapper {
            width: 100%;
          }
          .pos-actions-bar button {
            flex: 1;
          }
        }
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
        @keyframes pulseGlow {
          from { opacity: 0.3; }
          to { opacity: 1; }
        }
        #pos-camera-reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}} />

    </div>
  );
};
export default POS;
