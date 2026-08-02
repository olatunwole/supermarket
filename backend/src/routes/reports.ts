import { Router } from 'express';
import { getDashboard, getSalesReport, getInventoryValuation, getProductPerformance } from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth';
import { checkPlanLimit } from '../middleware/planLimits';

const router = Router();
router.use(authenticate);

// Dashboard is accessible to all staff members
router.get('/dashboard', authorize('admin', 'manager', 'cashier', 'stock_clerk'), getDashboard);

// Analytics reports are restricted to admins and managers
router.get('/sales', authorize('admin', 'manager'), getSalesReport);
router.get('/valuation', authorize('admin', 'manager'), checkPlanLimit('advanced_reports'), getInventoryValuation);
router.get('/performance', authorize('admin', 'manager'), checkPlanLimit('advanced_reports'), getProductPerformance);

export default router;
