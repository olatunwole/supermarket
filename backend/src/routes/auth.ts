import { Router } from 'express';
import { login, getMe, changeOwnPassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changeOwnPassword);
export default router;
