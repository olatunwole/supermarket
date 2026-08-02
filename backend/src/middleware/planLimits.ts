import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { query } from '../config/database';

export const checkPlanLimit = (action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const plan = req.user?.subscription_plan || 'Starter';
    const tenantId = req.user?.tenant_id;

    if (plan === 'Advanced') {
      return next();
    }

    if (action === 'accounting') {
      if (plan === 'Starter') {
        res.status(403).json({ error: 'Financial accounting is not available on the Starter plan. Please upgrade to Pro or Advanced.' });
        return;
      }
    }

    if (action === 'advanced_reports') {
      if (plan === 'Starter' || plan === 'Pro') {
        res.status(403).json({ error: 'Advanced performance analytics is not available on your current plan. Please upgrade to Advanced.' });
        return;
      }
    }

    if (action === 'create_product') {
      try {
        const prodCountRes = await query('SELECT COUNT(*) as count FROM products WHERE tenant_id = $1', [tenantId]);
        const count = parseInt(prodCountRes.rows[0].count);
        const limit = plan === 'Starter' ? 50 : 500;
        if (count >= limit) {
          res.status(403).json({ error: `Product limit reached (${count}/${limit}). Please upgrade your plan to list more items.` });
          return;
        }
      } catch {
        res.status(500).json({ error: 'Failed to verify product usage limit' });
        return;
      }
    }

    if (action === 'create_user') {
      try {
        const userCountRes = await query('SELECT COUNT(*) as count FROM users WHERE tenant_id = $1', [tenantId]);
        const count = parseInt(userCountRes.rows[0].count);
        const limit = plan === 'Starter' ? 3 : 10;
        if (count >= limit) {
          res.status(403).json({ error: `Staff limit reached (${count}/${limit}). Please upgrade your plan to register more users.` });
          return;
        }
      } catch {
        res.status(500).json({ error: 'Failed to verify user usage limit' });
        return;
      }
    }

    next();
  };
};
