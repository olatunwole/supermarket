import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await query(
      'SELECT id, username, email, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    res.status(400).json({ error: 'All fields required' }); return;
  }
  const validRoles = ['admin', 'manager', 'cashier', 'stock_clerk'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' }); return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (tenant_id, username, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, email, role, is_active, created_at',
      [tenantId, username, email, hash, role]
    );
    await logAudit(req, 'CREATE_USER', `Created user ${username} with role ${role}`);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'Username or email already exists' }); return; }
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { email, role, is_active } = req.body;
  try {
    const result = await query(
      'UPDATE users SET email=COALESCE($1,email), role=COALESCE($2,role), is_active=COALESCE($3,is_active), updated_at=NOW() WHERE id=$4 AND tenant_id=$5 RETURNING id, username, email, role, is_active',
      [email, role, is_active, id, tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'User not found' }); return; }
    await logAudit(req, 'UPDATE_USER', `Updated user id=${id}`);
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: 'Password required' }); return; }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id', [hash, id, tenantId]);
    if (!result.rows[0]) { res.status(404).json({ error: 'User not found' }); return; }
    await logAudit(req, 'CHANGE_PASSWORD', `Changed password for user id=${id}`);
    res.json({ message: 'Password updated' });
  } catch { res.status(500).json({ error: 'Server error' }); }
};
