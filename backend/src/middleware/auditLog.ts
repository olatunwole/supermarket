import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const logAudit = async (
  req: AuthRequest,
  action: string,
  details: string
): Promise<void> => {
  try {
    const userId = req.user?.id || null;
    const tenantId = req.user?.tenant_id || 1;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    await query(
      'INSERT INTO audit_log (tenant_id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, userId, action, details, ip]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
};
