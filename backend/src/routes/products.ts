import { Router } from 'express';
import { 
  getProducts, 
  getProductById, 
  getProductByBarcode, 
  createProduct, 
  bulkCreateProducts, 
  updateProduct, 
  deleteProduct, 
  getLowStockProducts 
} from '../controllers/productController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/barcode/:code', getProductByBarcode);
router.get('/:id', getProductById);
router.post('/bulk', authorize('admin', 'manager'), bulkCreateProducts);
router.post('/', authorize('admin', 'manager'), createProduct);
router.put('/:id', authorize('admin', 'manager'), updateProduct);
router.delete('/:id', authorize('admin'), deleteProduct);
export default router;
