import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'stock_clerk';
}

export interface StoreSettings {
  name: string;
  address: string;
  phone: string;
  taxId: string;
  logo?: string;
  inactivityTimeout: number; // in minutes, 0 = disabled
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  showNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
  currency: string;
  setCurrency: (currency: string) => void;
  formatCurrency: (val: number | string) => string;
  rates: Record<string, number>;
  updateRate: (currency: string, value: number) => void;
  convertToBase: (val: number) => number;
  convertToActive: (val: number) => number;
  storeSettings: StoreSettings;
  updateStoreSettings: (settings: StoreSettings) => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  bgColor: string;
  setBgColor: (color: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [currency, setCurrencyState] = useState<string>(() => {
    return localStorage.getItem('pos_currency') || 'GBP';
  });

  const [rates, setRatesState] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('pos_exchange_rates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      GBP: 1.0,
      USD: 1.28,
      EUR: 1.18,
      NGN: 1950.0,
      GHS: 19.5,
    };
  });

  const [storeSettings, setStoreSettingsState] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem('pos_store_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      name: 'Antigravity Supermarket',
      address: '123 High Street, London',
      phone: '020 7946 0958',
      taxId: 'GB123456789',
      logo: '',
      inactivityTimeout: 15,
    };
  });

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.add('light-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [themeColor, setThemeColorState] = useState<string>(() => {
    return localStorage.getItem('pos_theme_color') || 'cyan';
  });

  const setThemeColor = (color: string) => {
    setThemeColorState(color);
    localStorage.setItem('pos_theme_color', color);
    showNotification(`Interface color theme set to ${color}`, 'success');
  };

  const [bgColor, setBgColorState] = useState<string>(() => {
    return localStorage.getItem('pos_bg_color') || 'midnight';
  });

  const setBgColor = (color: string) => {
    setBgColorState(color);
    localStorage.setItem('pos_bg_color', color);
    showNotification(`Background theme set to ${color}`, 'success');
  };

  useEffect(() => {
    const root = document.documentElement;
    const isLight = theme === 'light';
    const glow1Opacity = isLight ? '0.04' : '0.1';
    const glow2Opacity = isLight ? '0.02' : '0.05';

    if (themeColor === 'emerald') {
      root.style.setProperty('--accent-cyan', '#10b981');
      root.style.setProperty('--accent-cyan-hover', '#059669');
      root.style.setProperty('--accent-cyan-glow', 'rgba(16, 185, 129, 0.15)');
      root.style.setProperty('--background-glow-1', `rgba(16, 185, 129, ${glow1Opacity})`);
      root.style.setProperty('--background-glow-2', `rgba(6, 182, 212, ${glow2Opacity})`);
    } else if (themeColor === 'purple') {
      root.style.setProperty('--accent-cyan', '#a855f7');
      root.style.setProperty('--accent-cyan-hover', '#9333ea');
      root.style.setProperty('--accent-cyan-glow', 'rgba(168, 85, 247, 0.15)');
      root.style.setProperty('--background-glow-1', `rgba(168, 85, 247, ${glow1Opacity})`);
      root.style.setProperty('--background-glow-2', `rgba(59, 130, 246, ${glow2Opacity})`);
    } else if (themeColor === 'orange') {
      root.style.setProperty('--accent-cyan', '#f59e0b');
      root.style.setProperty('--accent-cyan-hover', '#d97706');
      root.style.setProperty('--accent-cyan-glow', 'rgba(245, 158, 11, 0.15)');
      root.style.setProperty('--background-glow-1', `rgba(245, 158, 11, ${glow1Opacity})`);
      root.style.setProperty('--background-glow-2', `rgba(244, 63, 94, ${glow2Opacity})`);
    } else if (themeColor === 'rose') {
      root.style.setProperty('--accent-cyan', '#f43f5e');
      root.style.setProperty('--accent-cyan-hover', '#e11d48');
      root.style.setProperty('--accent-cyan-glow', 'rgba(244, 63, 94, 0.15)');
      root.style.setProperty('--background-glow-1', `rgba(244, 63, 94, ${glow1Opacity})`);
      root.style.setProperty('--background-glow-2', `rgba(168, 85, 247, ${glow2Opacity})`);
    } else if (themeColor === 'blue') {
      root.style.setProperty('--accent-cyan', '#3b82f6');
      root.style.setProperty('--accent-cyan-hover', '#2563eb');
      root.style.setProperty('--accent-cyan-glow', 'rgba(59, 130, 246, 0.15)');
      root.style.setProperty('--background-glow-1', `rgba(59, 130, 246, ${glow1Opacity})`);
      root.style.setProperty('--background-glow-2', `rgba(6, 182, 212, ${glow2Opacity})`);
    } else {
      root.style.setProperty('--accent-cyan', '#06b6d4');
      root.style.setProperty('--accent-cyan-hover', '#0891b2');
      root.style.setProperty('--accent-cyan-glow', 'rgba(6, 182, 212, 0.15)');
      root.style.setProperty('--background-glow-1', `rgba(6, 182, 212, ${glow1Opacity})`);
      root.style.setProperty('--background-glow-2', `rgba(16, 185, 129, ${glow2Opacity})`);
    }
  }, [themeColor, theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (bgColor === 'obsidian') {
      root.style.setProperty('--bg-primary', '#000000');
      root.style.setProperty('--bg-secondary', '#0a0a0a');
      root.style.setProperty('--bg-tertiary', '#141414');
      root.style.setProperty('--glass-bg', 'rgba(15, 15, 15, 0.7)');
    } else if (bgColor === 'slate') {
      root.style.setProperty('--bg-primary', '#090d16');
      root.style.setProperty('--bg-secondary', '#0f172a');
      root.style.setProperty('--bg-tertiary', '#1e293b');
      root.style.setProperty('--glass-bg', 'rgba(15, 23, 42, 0.7)');
    } else if (bgColor === 'forest') {
      root.style.setProperty('--bg-primary', '#020f0c');
      root.style.setProperty('--bg-secondary', '#06201b');
      root.style.setProperty('--bg-tertiary', '#0d3830');
      root.style.setProperty('--glass-bg', 'rgba(6, 32, 27, 0.7)');
    } else if (bgColor === 'indigo') {
      root.style.setProperty('--bg-primary', '#050514');
      root.style.setProperty('--bg-secondary', '#0c0c24');
      root.style.setProperty('--bg-tertiary', '#14143a');
      root.style.setProperty('--glass-bg', 'rgba(12, 12, 36, 0.7)');
    } else { // midnight (default)
      root.style.setProperty('--bg-primary', '#0b0f19');
      root.style.setProperty('--bg-secondary', '#131a2e');
      root.style.setProperty('--bg-tertiary', '#1b2542');
      root.style.setProperty('--glass-bg', 'rgba(22, 30, 54, 0.65)');
    }
  }, [bgColor]);

  useEffect(() => {
    if (!user || !storeSettings.inactivityTimeout || storeSettings.inactivityTimeout <= 0) {
      return;
    }

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const ms = storeSettings.inactivityTimeout * 60 * 1000;
      timeoutId = setTimeout(() => {
        logout();
        showNotification('Logged out automatically due to inactivity.', 'error');
      }, ms);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, storeSettings.inactivityTimeout]);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('pos_currency', newCurrency);
    showNotification(`Store currency updated to ${newCurrency}`, 'success');
  };

  const updateRate = (targetCurrency: string, rateVal: number) => {
    if (targetCurrency === 'GBP') return;
    const newRates = { ...rates, [targetCurrency]: rateVal };
    setRatesState(newRates);
    localStorage.setItem('pos_exchange_rates', JSON.stringify(newRates));
    showNotification(`Rate for ${targetCurrency} updated to ${rateVal}`, 'success');
  };

  const updateStoreSettings = (newSettings: StoreSettings) => {
    setStoreSettingsState(newSettings);
    localStorage.setItem('pos_store_settings', JSON.stringify(newSettings));
    showNotification('Store settings updated successfully', 'success');
  };

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    const rate = rates[currency] || 1.0;
    const converted = num * rate;

    let locale = 'en-GB';
    if (currency === 'USD') locale = 'en-US';
    if (currency === 'EUR') locale = 'en-IE';
    if (currency === 'NGN') locale = 'en-NG';
    if (currency === 'GHS') locale = 'en-GH';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(converted || 0);
  };

  const convertToBase = (val: number) => {
    const rate = rates[currency] || 1.0;
    return val / rate;
  };

  const convertToActive = (val: number) => {
    const rate = rates[currency] || 1.0;
    return val * rate;
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('pos_token');
    const savedUser = localStorage.getItem('pos_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      localStorage.setItem('pos_token', data.token);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      showNotification(`Welcome back, ${data.user.username}!`, 'success');
      return { success: true };
    } catch {
      return { success: false, error: 'Network error connecting to server' };
    }
  };

  const logout = () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    setToken(null);
    setUser(null);
    showNotification('Logged out successfully', 'info' as any);
  };

  const apiFetch = async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const targetUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await fetch(targetUrl, config);
    
    if (response.status === 401) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }

    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { text: responseText };
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! Status: ${response.status}`);
    }

    return data as T;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, apiFetch, showNotification, currency, setCurrency, formatCurrency, rates, updateRate, convertToBase, convertToActive, storeSettings, updateStoreSettings, themeColor, setThemeColor, bgColor, setBgColor, theme, setTheme, toggleTheme }}>
      {children}
      {notification && (
        <div 
          className="notification glass-card" 
          style={{ 
            borderLeft: `4px solid ${
              notification.type === 'success' 
                ? 'var(--success-emerald)' 
                : notification.type === 'error' 
                ? 'var(--error-rose)' 
                : 'var(--warning-amber)'
            }`
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {notification.type === 'success' && '✅ '}
            {notification.type === 'error' && '❌ '}
            {notification.type === 'warning' && '⚠️ '}
            {notification.message}
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
