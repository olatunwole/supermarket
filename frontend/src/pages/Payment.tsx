import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CreditCard, ShieldCheck, ChevronRight, CheckCircle2, Lock, ArrowRight, Smartphone, Landmark, AlertTriangle } from 'lucide-react';

interface Plan {
  id: number;
  name: string;
  price_gbp: string;
  features: {
    accounting: boolean;
    advanced_reports: boolean;
    max_products: number;
    max_users: number;
  };
}

export const Payment: React.FC = () => {
  const { user, apiFetch, showNotification, formatCurrency } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [gateway, setGateway] = useState<'paypal' | 'paystack' | 'flutterwave'>('paypal');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'plan' | 'pay' | 'success'>('plan');
  
  // Custom billing inputs
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await apiFetch('/api/tenants/plans');
        setPlans(data);
        if (data.length > 0) {
          // preselect current plan or the middle plan
          const match = data.find((p: Plan) => p.name.toLowerCase() === (user?.subscription_plan || '').toLowerCase());
          setSelectedPlan(match || data[1] || data[0]);
        }
      } catch (err) {
        showNotification('Failed to load plans.', 'error');
      }
    };
    fetchPlans();
  }, [user]);

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setIsProcessing(true);
    // Simulate API connection & payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      await apiFetch('/api/tenants/payment-success', {
        method: 'POST',
        body: JSON.stringify({
          planName: selectedPlan.name,
          gateway,
          paymentId: `tx_${Math.random().toString(36).substring(2, 11).toUpperCase()}`
        })
      });
      
      setIsProcessing(false);
      setStep('success');
      showNotification('Payment successful! Your license is now active.', 'success');

      // Auto redirect to dashboard
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (err: any) {
      setIsProcessing(false);
      showNotification(err.message || 'Payment activation failed.', 'error');
    }
  };

  if (!user) return null;

  return (
    <div className="payment-page-container">
      <div className="payment-layout glass-card">
        
        {/* Header */}
        <div className="payment-header">
          <div className="security-badge">
            <ShieldCheck size={20} /> Secure Checkout
          </div>
          <h1>Billing & Merchant License Activation</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Store: <strong style={{ color: 'var(--accent-cyan)' }}>{user.tenant_name}</strong> ({user.username})
          </p>
        </div>

        {/* Steps Breadcrumbs */}
        <div className="steps-breadcrumbs">
          <div className={`step-item ${step === 'plan' ? 'active' : ''}`} onClick={() => step !== 'success' && setStep('plan')}>
            <span className="num">1</span> Choose Plan
          </div>
          <ChevronRight size={16} className="arrow" />
          <div className={`step-item ${step === 'pay' ? 'active' : ''}`} onClick={() => step !== 'success' && setStep('pay')}>
            <span className="num">2</span> Payment Method
          </div>
          <ChevronRight size={16} className="arrow" />
          <div className={`step-item ${step === 'success' ? 'active' : ''}`}>
            <span className="num">3</span> Complete
          </div>
        </div>

        {/* Step 1: Select Plan */}
        {step === 'plan' && (
          <div className="plan-selection-view">
            <h2 className="section-title">Select Subscriptions Package</h2>
            <div className="plans-list">
              {plans.map((p) => {
                const isActivePlan = selectedPlan?.id === p.id;
                return (
                  <div 
                    key={p.id} 
                    className={`plan-item-card ${isActivePlan ? 'active' : ''}`}
                    onClick={() => setSelectedPlan(p)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{p.name}</h3>
                      <div className="plan-price-label">{formatCurrency(p.price_gbp)}<span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/mo</span></div>
                    </div>
                    
                    <ul className="features-list">
                      <li>• Accounting Module: {p.features.accounting ? 'Enabled ✅' : 'Disabled ❌'}</li>
                      <li>• Advanced Performance Reports: {p.features.advanced_reports ? 'Enabled ✅' : 'Disabled ❌'}</li>
                      <li>• Max Catalog Products: {p.features.max_products >= 99999 ? 'Unlimited' : p.features.max_products} items</li>
                      <li>• Max Registered Users: {p.features.max_users >= 999 ? 'Unlimited' : p.features.max_users} staff members</li>
                    </ul>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={() => setStep('pay')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
                Proceed to Payment <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Payment Details */}
        {step === 'pay' && selectedPlan && (
          <form onSubmit={handleProcessPayment} className="payment-checkout-view">
            <div className="order-summary-box">
              <h3>Order Summary</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: 'var(--text-secondary)' }}>
                <span>{selectedPlan.name} Subscription License</span>
                <span>{formatCurrency(selectedPlan.price_gbp)} / mo</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px', fontWeight: 700, fontSize: '1.1rem' }}>
                <span>Total Due Today</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{formatCurrency(selectedPlan.price_gbp)}</span>
              </div>
            </div>

            <h2 className="section-title" style={{ marginTop: '24px' }}>Select Payment Provider</h2>
            <div className="gateways-selector">
              <div className={`gateway-option ${gateway === 'paypal' ? 'selected' : ''}`} onClick={() => setGateway('paypal')}>
                <span className="dot"></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>PayPal</strong>
                  <span className="muted">Worldwide Credit Card / PayPal Wallet</span>
                </div>
              </div>

              <div className={`gateway-option ${gateway === 'paystack' ? 'selected' : ''}`} onClick={() => setGateway('paystack')}>
                <span className="dot"></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>Paystack</strong>
                  <span className="muted">African local cards, bank apps, and USSD</span>
                </div>
              </div>

              <div className={`gateway-option ${gateway === 'flutterwave' ? 'selected' : ''}`} onClick={() => setGateway('flutterwave')}>
                <span className="dot"></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>Flutterwave</strong>
                  <span className="muted">Global & Mobile Money options</span>
                </div>
              </div>
            </div>

            {/* Simulated Gateway Forms */}
            <div className="gateway-inputs-box">
              {gateway === 'paypal' && (
                <div className="paypal-inputs">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                    You will be redirected to PayPal's secure login panel to authorize this monthly billing agreement.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px' }}>
                    <Lock size={16} style={{ color: 'var(--warning-amber)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--warning-amber)' }}>PayPal Merchant sandbox connection is active.</span>
                  </div>
                </div>
              )}

              {gateway === 'paystack' && (
                <div className="paystack-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Debit Card Number</label>
                    <div className="input-with-icon">
                      <CreditCard size={18} className="input-icon" />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="4000 1234 5678 9010" 
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Expiry Date</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="MM/YY" 
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        maxLength={5}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CVV / Security Code</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="123" 
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        maxLength={3}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {gateway === 'flutterwave' && (
                <div className="flutterwave-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Mobile Money Phone Number (GHS / NGN / UGX)</label>
                    <div className="input-with-icon">
                      <Smartphone size={18} className="input-icon" />
                      <input 
                        type="tel" 
                        className="form-input" 
                        placeholder="+233 24 000 0000" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '6px' }}>
                    <Landmark size={16} style={{ color: 'var(--accent-cyan)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Flutterwave mobile wallet prompt will trigger instantly.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('plan')} disabled={isProcessing}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'var(--success-emerald)' }}>
                {isProcessing ? (
                  <>
                    <div className="spinner-btn" /> Authorizing Transaction...
                  </>
                ) : (
                  <>
                    Pay & Activate License
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success */}
        {step === 'success' && selectedPlan && (
          <div className="payment-success-view">
            <div className="success-icon-wrapper">
              <CheckCircle2 size={64} className="success-tick" />
            </div>
            <h2>Payment Authorized Successfully!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Your merchant license for the <strong style={{ color: 'var(--accent-cyan)' }}>{selectedPlan.name}</strong> package is now active.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Redirecting you to your POS & inventory workspace in a few seconds...
            </p>
            
            <div style={{ marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Go to Dashboard Now
              </button>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .payment-page-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 40px 20px;
          background: var(--bg-primary);
        }

        .payment-layout {
          width: 100%;
          max-width: 720px;
          padding: 40px;
          animation: cardSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .payment-header {
          text-align: center;
          margin-bottom: 32px;
          position: relative;
        }

        .security-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: var(--success-emerald);
          font-size: 0.75rem;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .payment-header h1 {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .steps-breadcrumbs {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 12px;
          margin-bottom: 32px;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: color 0.2s;
        }

        .step-item:hover {
          color: var(--text-secondary);
        }

        .step-item.active {
          color: var(--accent-cyan);
          font-weight: 700;
        }

        .step-item .num {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          font-size: 0.75rem;
          border: 1px solid var(--glass-border);
        }

        .step-item.active .num {
          background: var(--accent-cyan);
          color: #000;
          border-color: var(--accent-cyan);
        }

        .arrow {
          color: var(--text-muted);
        }

        .section-title {
          font-size: 1.15rem;
          font-weight: 700;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .plans-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .plan-item-card {
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.01);
          border-radius: var(--border-radius-md);
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .plan-item-card:hover {
          background: rgba(255,255,255,0.02);
          border-color: rgba(255,255,255,0.15);
        }

        .plan-item-card.active {
          border-color: var(--accent-cyan);
          background: rgba(6, 182, 212, 0.03);
          box-shadow: 0 0 16px var(--accent-cyan-glow);
        }

        .plan-price-label {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .order-summary-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 16px;
          margin-bottom: 24px;
        }

        .order-summary-box h3 {
          font-size: 0.95rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--text-primary);
        }

        .gateways-selector {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .gateway-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          background: rgba(255, 255, 255, 0.01);
          cursor: pointer;
          transition: all 0.2s;
        }

        .gateway-option:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .gateway-option.selected {
          border-color: var(--accent-cyan);
          background: rgba(6, 182, 212, 0.02);
        }

        .gateway-option .dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid var(--text-muted);
          display: inline-block;
          position: relative;
        }

        .gateway-option.selected .dot {
          border-color: var(--accent-cyan);
        }

        .gateway-option.selected .dot::after {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-cyan);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .gateway-option .muted {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .gateway-inputs-box {
          background: rgba(0, 0, 0, 0.1);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 20px;
        }

        .spinner-btn {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .payment-success-view {
          text-align: center;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .success-icon-wrapper {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .success-tick {
          color: var(--success-emerald);
          animation: scalePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes scalePop {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes cardSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}} />
    </div>
  );
};
