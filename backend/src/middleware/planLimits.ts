import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { query } from '../config/database';

export const checkPlanLimit = (action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const planName = req.user?.subscription_plan || 'Starter';
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context is missing.' });
      return;
    }

    try {
      // Fetch plan features dynamically
      const planRes = await query('SELECT features FROM subscription_plans WHERE LOWER(name) = LOWER($1) AND is_active = true', [planName]);
      let features = planRes.rows[0]?.features || {};

      // If database plan not found, fallback to defaults
      if (!planRes.rows[0]) {
        if (planName.toLowerCase() === 'ultra' || planName.toLowerCase() === 'advanced') {
          features = { accounting: true, advanced_reports: true, max_products: 99999, max_users: 999 };
        } else if (planName.toLowerCase() === 'pro') {
          features = { accounting: true, advanced_reports: false, max_products: 500, max_users: 10 };
        } else {
          features = { accounting: false, advanced_reports: false, max_products: 50, max_users: 3 };
        }
      }

      if (action === 'accounting') {
        if (!features.accounting) {
          res.status(403).json({ error: 'Financial accounting is not available on your plan. Please upgrade to Pro or Ultra.' });
          return;
        }
      }

      if (action === 'advanced_reports') {
        if (!features.advanced_reports) {
          res.status(403).json({ error: 'Advanced performance analytics is not available on your current plan. Please upgrade to Ultra.' });
          return;
        }
      }

      if (action === 'create_product') {
        const prodCountRes = await query('SELECT COUNT(*) as count FROM products WHERE tenant_id = $1', [tenantId]);
        const count = parseInt(prodCountRes.rows[0].count);
        const limit = features.max_products || 50;
        if (count >= limit) {
          res.status(403).json({ error: `Product limit reached (${count}/${limit}). Please upgrade your plan to list more items.` });
          return;
        }
      }

      if (action === 'create_user') {
        const userCountRes = await query('SELECT COUNT(*) as count FROM users WHERE tenant_id = $1', [tenantId]);
        const count = parseInt(userCountRes.rows[0].count);
        const limit = features.max_users || 3;
        if (count >= limit) {
          res.status(403).json({ error: `Staff limit reached (${count}/${limit}). Please upgrade your plan to register more users.` });
          return;
        }
      }

      next();
    } catch (err) {
      console.error('Plan limit check error:', err);
      res.status(500).json({ error: 'Failed to verify plan limits' });
    }
  };
};
