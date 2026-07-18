import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const logAudit = async (
  req: AuthRequest,
  action: string,
  details: string
): Promise<void> => {
  try {
    const userId = req.user?.id || null;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    await query(
      'INSERT INTO audit_log (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, action, details, ip]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
};
