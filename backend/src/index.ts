import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import supplierRoutes from './routes/suppliers';
import stockAdjustmentRoutes from './routes/stockAdjustments';
import salesRoutes from './routes/sales';
import purchaseOrderRoutes from './routes/purchaseOrders';
import reportRoutes from './routes/reports';
import financialsRoutes from './routes/financials';
import auditLogRoutes from './routes/auditLogs';
import tenantRoutes from './routes/tenants';
import storefrontRoutes from './routes/storefront';
import { errorHandler } from './middleware/errorHandler';
import { autoInitDatabase } from './db/autoInit';

dotenv.config();

// Auto-run DB migrations and seeds on launch
autoInitDatabase()
  .then(() => {
    console.log('[AutoInit] DB initialization flow finished.');
  })
  .catch((err) => {
    console.error('[AutoInit] DB initialization flow failed:', err);
  });

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.railway.app') || origin.endsWith('.netlify.app') || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/stock-adjustments', stockAdjustmentRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/financials', financialsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/storefront', storefrontRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
// Force deployment trigger
