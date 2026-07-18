import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus } from '../controllers/supplierController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'manager', 'stock_clerk'), getPurchaseOrders);
router.post('/', authorize('admin', 'manager'), createPurchaseOrder);
router.put('/:id/status', authorize('admin', 'manager', 'stock_clerk'), updatePurchaseOrderStatus);
export default router;
