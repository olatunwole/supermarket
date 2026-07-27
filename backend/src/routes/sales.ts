import { Router } from 'express';
import { getSales, getSaleById, createSale, submitScanForSession, getPendingScansForSession } from '../controllers/salesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public pairing routes for mobile phone barcode scanning integration
router.post('/scan-session/:sessionId/scan', submitScanForSession);
router.get('/scan-session/:sessionId/pending', getPendingScansForSession);

router.use(authenticate);

// Sales CRUD
router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', authorize('admin', 'manager', 'cashier'), createSale);

export default router;
