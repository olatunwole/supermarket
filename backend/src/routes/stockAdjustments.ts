import { Router } from 'express';
import { getStockAdjustments, createStockAdjustment } from '../controllers/stockAdjustmentController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'manager', 'stock_clerk'), getStockAdjustments);
router.post('/', authorize('admin', 'manager', 'stock_clerk'), createStockAdjustment);
export default router;
