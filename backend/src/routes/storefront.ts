import { Router } from 'express';
import { getStoreCatalog, placeStoreOrder } from '../controllers/storefrontController';

const router = Router();

router.get('/:subdomain', getStoreCatalog);
router.get('/catalog/:subdomain', getStoreCatalog);
router.post('/checkout', placeStoreOrder);

export default router;
