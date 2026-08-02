import { Router } from 'express';
import { getUsers, createUser, updateUser, changePassword } from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { checkPlanLimit } from '../middleware/planLimits';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/', getUsers);
router.post('/', checkPlanLimit('create_user'), createUser);
router.put('/:id', updateUser);
router.put('/:id/password', changePassword);
export default router;
