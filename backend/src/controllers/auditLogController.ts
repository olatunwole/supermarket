import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    // Retrieve the 200 most recent logs, joining users to get username
    const result = await query(`
      SELECT al.*, u.username 
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.tenant_id = $1
      ORDER BY al.created_at DESC
      LIMIT 200
    `, [tenantId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
