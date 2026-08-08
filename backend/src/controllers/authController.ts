import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password, subdomain } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  try {
    const tenantRes = await query('SELECT * FROM tenants WHERE subdomain = $1', [subdomain || 'default']);
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const result = await query(
      'SELECT * FROM users WHERE (username = $1 OR email = $1) AND tenant_id = $2 AND is_active = true',
      [username, tenant.id]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    let tenantStatus = tenant.subscription_status || 'unpaid';
    const expiresAt = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : null;
    const graceEndsAt = tenant.grace_period_ends_at ? new Date(tenant.grace_period_ends_at) : null;
    const now = new Date();

    if (tenantStatus === 'active') {
      if (expiresAt && expiresAt < now) {
        if (graceEndsAt && graceEndsAt > now) {
          tenantStatus = 'grace_period';
        } else {
          tenantStatus = 'expired';
        }
        await query('UPDATE tenants SET subscription_status = $1 WHERE id = $2', [tenantStatus, tenant.id]);
      }
    } else if (tenantStatus === 'grace_period') {
      if (graceEndsAt && graceEndsAt < now) {
        tenantStatus = 'expired';
        await query('UPDATE tenants SET subscription_status = $1 WHERE id = $2', [tenantStatus, tenant.id]);
      }
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        tenant_id: user.tenant_id, 
        subscription_plan: tenant.subscription_plan,
        subscription_status: tenantStatus,
        subscription_expires_at: tenant.subscription_expires_at,
        grace_period_ends_at: tenant.grace_period_ends_at
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any }
    );
    res.json({
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role, 
        tenant_id: user.tenant_id, 
        tenant_name: tenant.name, 
        subscription_plan: tenant.subscription_plan,
        subscription_status: tenantStatus,
        subscription_expires_at: tenant.subscription_expires_at,
        grace_period_ends_at: tenant.grace_period_ends_at
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error', stack: err.stack });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at, u.tenant_id, 
              t.name as tenant_name, t.subscription_plan, t.subscription_status, 
              t.subscription_expires_at, t.grace_period_ends_at, t.payment_status
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user?.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const row = result.rows[0];
    let tenantStatus = row.subscription_status || 'unpaid';
    const expiresAt = row.subscription_expires_at ? new Date(row.subscription_expires_at) : null;
    const graceEndsAt = row.grace_period_ends_at ? new Date(row.grace_period_ends_at) : null;
    const now = new Date();

    if (tenantStatus === 'active') {
      if (expiresAt && expiresAt < now) {
        if (graceEndsAt && graceEndsAt > now) {
          tenantStatus = 'grace_period';
        } else {
          tenantStatus = 'expired';
        }
        await query('UPDATE tenants SET subscription_status = $1 WHERE id = $2', [tenantStatus, row.tenant_id]);
        row.subscription_status = tenantStatus;
      }
    } else if (tenantStatus === 'grace_period') {
      if (graceEndsAt && graceEndsAt < now) {
        tenantStatus = 'expired';
        await query('UPDATE tenants SET subscription_status = $1 WHERE id = $2', [tenantStatus, row.tenant_id]);
        row.subscription_status = tenantStatus;
      }
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const changeOwnPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }
  try {
    const userId = req.user?.id;
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      res.status(400).json({ error: 'Incorrect current password' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, userId]);
    await logAudit(req, 'CHANGE_OWN_PASSWORD', `Changed own password for user username=${user.username}`);
    
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
