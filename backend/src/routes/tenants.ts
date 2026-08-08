import { Router } from 'express';
import { signupTenant, getTenants, updateTenantSubscription } from '../controllers/tenantController';
import { 
  getPlans, 
  updatePlan, 
  paymentSuccess, 
  getSystemSettings, 
  updateSystemSettings, 
  impersonateUser,
  getPlatformErrors,
  resolvePlatformError
} from '../controllers/subscriptionController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public onboarding
router.post('/signup', signupTenant);

// Subscription Plans (Public GET, Super Admin write)
router.get('/plans', getPlans);
router.put('/plans/:id', authenticate, authorize('super_admin'), updatePlan);

// Payment callback activation
router.post('/payment-success', authenticate, paymentSuccess);

// System SaaS Settings
router.get('/settings', authenticate, authorize('super_admin'), getSystemSettings);
router.put('/settings', authenticate, authorize('super_admin'), updateSystemSettings);

// System Platform Error Logs
router.get('/errors', authenticate, authorize('super_admin'), getPlatformErrors);
router.put('/errors/:id/resolve', authenticate, authorize('super_admin'), resolvePlatformError);

// Administrative User Impersonation
router.post('/impersonate/:userId', authenticate, authorize('super_admin'), impersonateUser);

// Super admin dashboard tenant management
router.get('/', authenticate, authorize('super_admin'), getTenants);
router.put('/:id', authenticate, authorize('super_admin'), updateTenantSubscription);

export default router;
