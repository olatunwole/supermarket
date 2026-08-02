import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

export const signupTenant = async (req: Request, res: Response): Promise<void> => {
  const { businessName, subdomain, email, password, plan } = req.body;
  if (!businessName || !subdomain || !email || !password) {
    res.status(400).json({ error: 'Business name, subdomain, email, and password are required' });
    return;
  }

  // Clean subdomain input
  const cleanSubdomain = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

  const client = await pool.connect();
  try {
    // 1. Check if subdomain exists
    const checkSub = await client.query('SELECT id FROM tenants WHERE subdomain = $1', [cleanSubdomain]);
    if (checkSub.rows[0]) {
      res.status(400).json({ error: 'Subdomain is already registered' });
      return;
    }

    await client.query('BEGIN');

    // 2. Create Tenant
    const tenantRes = await client.query(
      `INSERT INTO tenants (name, subdomain, subscription_plan, subscription_status)
       VALUES ($1, $2, $3, 'active') RETURNING *`,
      [businessName, cleanSubdomain, plan || 'starter']
    );
    const tenant = tenantRes.rows[0];

    // 3. Create Admin User
    const hash = await bcrypt.hash(password, 10);
    // Find username from email prefix or email directly
    const username = email.split('@')[0];

    const userRes = await client.query(
      `INSERT INTO users (tenant_id, username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'admin', true) RETURNING id, username, email, role`,
      [tenant.id, username, email, hash]
    );
    const user = userRes.rows[0];

    // 4. Seed Standard Chart of Accounts
    const defaultAccounts = [
      { code: '1010', name: 'Cash & Cash Equivalents', type: 'asset', is_system: true },
      { code: '1020', name: 'Accounts Receivable', type: 'asset', is_system: true },
      { code: '1030', name: 'Inventory Asset', type: 'asset', is_system: true },
      { code: '2010', name: 'Accounts Payable', type: 'liability', is_system: true },
      { code: '2020', name: 'Sales Tax Payable', type: 'liability', is_system: true },
      { code: '3010', name: 'Owner Equity', type: 'equity', is_system: true },
      { code: '3020', name: 'Retained Earnings', type: 'equity', is_system: true },
      { code: '4010', name: 'Sales Revenue', type: 'revenue', is_system: true },
      { code: '4020', name: 'Other Revenue', type: 'revenue', is_system: true },
      { code: '5010', name: 'Cost of Goods Sold', type: 'expense', is_system: true },
      { code: '5020', name: 'Stock Adjustment Loss', type: 'expense', is_system: true },
      { code: '5030', name: 'General & Administrative Expenses', type: 'expense', is_system: true },
      { code: '5040', name: 'Sales Discounts', type: 'expense', is_system: true }
    ];

    for (const acc of defaultAccounts) {
      await client.query(
        `INSERT INTO financial_accounts (tenant_id, code, name, type, is_system)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenant.id, acc.code, acc.name, acc.type, acc.is_system]
      );
    }

    // 5. Seed Standard Categories
    const defaultCategories = [
      { name: 'Fruits & Vegetables', description: 'Fresh produce' },
      { name: 'Dairy & Eggs', description: 'Milk, cheese, eggs, butter' },
      { name: 'Beverages', description: 'Soft drinks, juices, water' },
      { name: 'Snacks & Confectionery', description: 'Crisps, chocolates, sweets' },
      { name: 'Household & Cleaning', description: 'Cleaning products' }
    ];

    for (const cat of defaultCategories) {
      await client.query(
        `INSERT INTO categories (tenant_id, name, description)
         VALUES ($1, $2, $3)`,
        [tenant.id, cat.name, cat.description]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Tenant onboarded successfully',
      tenant,
      user
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Tenant onboarding failed:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    client.release();
  }
};

export const getTenants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT t.*, COUNT(u.id)::integer as user_count
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateTenantSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { subscription_plan, subscription_status } = req.body;
  try {
    const result = await query(
      `UPDATE tenants
       SET subscription_plan = COALESCE($1, subscription_plan),
           subscription_status = COALESCE($2, subscription_status),
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [subscription_plan, subscription_status, id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    await logAudit(req, 'UPDATE_TENANT_SUBSCRIPTION', `Updated tenant ID=${id} subscription to plan=${subscription_plan}, status=${subscription_status}`);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
