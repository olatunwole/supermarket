import { Router } from 'express';
import { signupTenant, getTenants, updateTenantSubscription } from '../controllers/tenantController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public onboarding
router.post('/signup', signupTenant);

// Super admin dashboard
router.get('/', authenticate, authorize('super_admin'), getTenants);
router.put('/:id', authenticate, authorize('super_admin'), updateTenantSubscription);

export default router;
