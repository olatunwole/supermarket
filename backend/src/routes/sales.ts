import { Router } from 'express';
import { getSales, getSaleById, createSale } from '../controllers/salesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Sales CRUD
router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', authorize('admin', 'manager', 'cashier'), createSale);

export default router;
