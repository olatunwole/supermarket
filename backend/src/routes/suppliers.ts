import { Router } from 'express';
import { 
  getSuppliers, 
  createSupplier, 
  updateSupplier
} from '../controllers/supplierController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Standard CRUD
router.get('/', getSuppliers);
router.post('/', authorize('admin', 'manager'), createSupplier);
router.put('/:id', authorize('admin', 'manager'), updateSupplier);

export default router;
