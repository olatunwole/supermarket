import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getAuditLogs } from '../controllers/auditLogController';

const router = Router();
router.get('/', authenticate, authorize('admin'), getAuditLogs);

export default router;
