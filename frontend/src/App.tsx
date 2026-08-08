import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { POS } from './pages/POS';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { StockAdjustments } from './pages/StockAdjustments';
import { Users } from './pages/Users';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Financials } from './pages/Financials';
import { ScanCompanion } from './pages/ScanCompanion';
import { Signup } from './pages/Signup';
import { Storefront } from './pages/Storefront';
import { SuperAdmin } from './pages/SuperAdmin';
import { Payment } from './pages/Payment';
import { SuperAdminLogin } from './pages/SuperAdminLogin';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          <Route path="/scan-companion" element={<ScanCompanion />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            {/* Out-of-layout standalone pages */}
            <Route path="/payment" element={<Payment />} />

            {/* Layout-wrapped pages */}
            <Route element={<Layout />}>
              {/* Common dashboard access for all staff */}
              <Route path="/" element={<Dashboard />} />
              
              {/* POS Sales Register Access (Cashiers, Managers, Admins) */}
              <Route path="/pos" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']} />}>
                <Route index element={<POS />} />
              </Route>
              
              {/* Inventory Management Access (Stock Clerks, Managers, Admins) */}
              <Route path="/inventory" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'stock_clerk']} />}>
                <Route index element={<Inventory />} />
              </Route>
              
              {/* Stock Adjustments Audit Access (Stock Clerks, Managers, Admins) */}
              <Route path="/stock-adjustments" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'stock_clerk']} />}>
                <Route index element={<StockAdjustments />} />
              </Route>
              
              {/* Supplier Purchase Orders Access (Stock Clerks, Managers, Admins) */}
              <Route path="/purchase-orders" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'stock_clerk']} />}>
                <Route index element={<PurchaseOrders />} />
              </Route>
              
              {/* Reports Dashboard Access (Managers, Admins) */}
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
                <Route index element={<Reports />} />
              </Route>

              {/* Financials Accounting Module Access (Admins, Managers, Stock Clerks) */}
              <Route path="/financials" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'stock_clerk']} />}>
                <Route index element={<Financials />} />
              </Route>

              {/* Staff Accounts Management Access (Admins only) */}
              <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route index element={<Users />} />
              </Route>
              
              {/* Super Admin Access */}
              <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']} />}>
                <Route index element={<SuperAdmin />} />
              </Route>

              {/* Settings Configuration Access (All logged-in staff users) */}
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Suffix/Path-based Storefront Catalog Router */}
          <Route path="/:subdomain" element={<Storefront />} />

          {/* Wildcard Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
