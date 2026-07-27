import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Check, AlertCircle, X, Smartphone, List } from 'lucide-react';

export const ScanCompanion: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<{ time: string; barcode: string; status: 'sending' | 'sent' | 'error' }[]>([]);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (session) {
      setSessionId(session);
    } else {
      setStatus('error');
      setErrorMsg('No pairing session ID provided. Please scan the pairing QR code from the register screen.');
    }
  }, []);

  const playCompanionBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 1000;
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08);
      
      // Tactile haptic feedback if supported by browser/device
      if ('vibrate' in navigator) {
        navigator.vibrate(80);
      }
    } catch (err) {
      console.warn('Audio feedback failed:', err);
    }
  };

  const transmitScan = async (barcode: string) => {
    if (!sessionId) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const newEntry = { time: timestamp, barcode, status: 'sending' as const };
    setScanHistory(prev => [newEntry, ...prev]);

    try {
      const response = await fetch(`/api/sales/scan-session/${sessionId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode })
      });

      if (!response.ok) throw new Error('Transmission failed');
      
      setScanHistory(prev => 
        prev.map(item => item.barcode === barcode && item.time === timestamp ? { ...item, status: 'sent' as const } : item)
      );
      playCompanionBeep();
    } catch (err) {
      setScanHistory(prev => 
        prev.map(item => item.barcode === barcode && item.time === timestamp ? { ...item, status: 'error' as const } : item)
      );
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping companion scanner:', err);
      }
      scannerRef.current = null;
    }
    setStatus('idle');
  };

  const startCamera = () => {
    if (!sessionId) return;
    
    setStatus('scanning');
    setTimeout(() => {
      try {
        const html5Qrcode = new Html5Qrcode("companion-reader");
        scannerRef.current = html5Qrcode;

        html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: (width, height) => {
              // Target scanbox size for standard mobile screen widths
              const boxWidth = Math.min(width * 0.8, 280);
              const boxHeight = Math.min(height * 0.35, 90);
              return { width: boxWidth, height: boxHeight };
            },
            aspectRatio: 1.333333
          },
          (decodedText) => {
            transmitScan(decodedText);
          },
          () => {
            // Scan loop running
          }
        ).catch(err => {
          console.error("Camera start failure:", err);
          setErrorMsg("Camera access denied or busy. Check permissions.");
          setStatus('idle');
        });
      } catch (err: any) {
        console.error("Scanner initialization failed:", err);
        setErrorMsg("Failed to start camera feed.");
        setStatus('idle');
      }
    }, 200);
  };

  useEffect(() => {
    if (sessionId) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [sessionId]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #0f172a 0%, #020617 100%)',
      color: '#f8fafc',
      padding: '24px 16px',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* Branding Header */}
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(6,182,212,0.4)'
        }}>
          <Smartphone size={20} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Scan Companion</h2>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
            {sessionId ? `Register ID: ${sessionId}` : 'Register Link'}
          </p>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Error Notification */}
        {errorMsg && (
          <div style={{
            background: 'rgba(244,63,94,0.1)',
            border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            fontSize: '0.85rem',
            color: '#fda4af'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Camera Scanner Container */}
        {sessionId && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 30px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            <div id="companion-reader" style={{ width: '100%', background: '#000' }} />
            
            {status === 'scanning' && (
              <div style={{
                position: 'absolute',
                left: '10%',
                right: '10%',
                top: '50%',
                height: '2px',
                background: 'rgba(6,182,212,0.85)',
                boxShadow: '0 0 8px rgba(6,182,212,0.8)',
                zIndex: 10,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                animation: 'pulseGlow 1.5s infinite alternate'
              }} />
            )}

            {status !== 'scanning' && (
              <div style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '12px',
                color: '#94a3b8'
              }}>
                <Camera size={32} />
                <button 
                  onClick={startCamera} 
                  style={{
                    background: '#06b6d4',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Start Camera Scanner
                </button>
              </div>
            )}
            
            {status === 'scanning' && (
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={stopCamera} 
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f1f5f9',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Stop Camera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scan Log History */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
            <List size={16} style={{ color: '#06b6d4' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Scanned History</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {scanHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', padding: '20px 0' }}>
                No active scans yet. Start scanning to push items.
              </div>
            ) : (
              scanHistory.map((item, idx) => (
                <div 
                  key={idx} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    border: '1px solid rgba(255,255,255,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{item.barcode}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.time}</span>
                  </div>
                  <div>
                    {item.status === 'sending' && (
                      <span style={{ color: '#06b6d4', fontSize: '0.75rem' }}>Sending...</span>
                    )}
                    {item.status === 'sent' && (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                        <Check size={12} /> Sent
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                        <X size={12} /> Failed
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulseGlow {
          from { opacity: 0.3; }
          to { opacity: 1; }
        }
        #companion-reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
};

export default ScanCompanion;
