import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

// Fetch all subscription plans
export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM subscription_plans ORDER BY price_gbp ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Update a subscription plan (Super Admin only)
export const updatePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { price_gbp, features, is_active } = req.body;
  try {
    const result = await query(
      `UPDATE subscription_plans
       SET price_gbp = COALESCE($1, price_gbp),
           features = COALESCE($2, features),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [price_gbp, features ? JSON.stringify(features) : null, is_active, id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    await logAudit(req, 'UPDATE_SUBSCRIPTION_PLAN', `Updated plan ID=${id} settings`);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Process successful payment and activate/renew subscription
export const paymentSuccess = async (req: AuthRequest, res: Response): Promise<void> => {
  const { planName, gateway, paymentId } = req.body;
  const tenantId = req.user?.tenant_id;

  if (!tenantId) {
    res.status(400).json({ error: 'Tenant context is missing.' });
    return;
  }

  try {
    // 1. Get system settings to read grace period duration
    const settingsRes = await query('SELECT grace_period_days FROM system_settings WHERE id = 1');
    const gracePeriodDays = settingsRes.rows[0]?.grace_period_days || 7;

    // 2. Set expiry dates: 30 days of active subscription
    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 30);

    const gracePeriodEndsAt = new Date(subscriptionExpiresAt);
    gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + gracePeriodDays);

    // 3. Update the tenant subscription state
    const result = await query(
      `UPDATE tenants
       SET subscription_plan = $1,
           subscription_status = 'active',
           subscription_expires_at = $2,
           grace_period_ends_at = $3,
           payment_gateway = $4,
           payment_status = 'paid',
           updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [planName, subscriptionExpiresAt, gracePeriodEndsAt, gateway, tenantId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    await logAudit(req, 'TENANT_PAYMENT_SUCCESS', `Paid for plan=${planName} via gateway=${gateway}, paymentId=${paymentId}`);

    res.json({
      success: true,
      message: 'Subscription active and paid successfully',
      tenant: result.rows[0]
    });
  } catch (err: any) {
    console.error('Payment callback processing failed:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Fetch global SaaS system settings
export const getSystemSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM system_settings WHERE id = 1');
    res.json(result.rows[0] || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Update global system settings (Super Admin only)
export const updateSystemSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const { 
    grace_period_days, 
    reminder_days_before, 
    paypal_client_id, 
    paystack_public_key, 
    flutterwave_public_key,
    platform_name,
    platform_theme_color,
    platform_theme_bg,
    platform_logo
  } = req.body;
  try {
    const result = await query(
      `UPDATE system_settings
       SET grace_period_days = COALESCE($1, grace_period_days),
           reminder_days_before = COALESCE($2, reminder_days_before),
           paypal_client_id = COALESCE($3, paypal_client_id),
           paystack_public_key = COALESCE($4, paystack_public_key),
           flutterwave_public_key = COALESCE($5, flutterwave_public_key),
           platform_name = COALESCE($6, platform_name),
           platform_theme_color = COALESCE($7, platform_theme_color),
           platform_theme_bg = COALESCE($8, platform_theme_bg),
           platform_logo = COALESCE($9, platform_logo),
           updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [
        grace_period_days, 
        reminder_days_before, 
        paypal_client_id, 
        paystack_public_key, 
        flutterwave_public_key,
        platform_name,
        platform_theme_color,
        platform_theme_bg,
        platform_logo
      ]
    );

    await logAudit(req, 'UPDATE_SYSTEM_SETTINGS', 'Updated SaaS licensing / gateway / branding parameters');
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Super Admin User Impersonation
export const impersonateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    // 1. Fetch user to impersonate
    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const targetUser = userRes.rows[0];
    if (!targetUser) {
      res.status(404).json({ error: 'Target user to impersonate not found' });
      return;
    }

    // 2. Fetch tenant profile of target user
    const tenantRes = await query('SELECT * FROM tenants WHERE id = $1', [targetUser.tenant_id]);
    const targetTenant = tenantRes.rows[0];
    if (!targetTenant) {
      res.status(404).json({ error: 'Tenant context for this user not found' });
      return;
    }

    // 3. Generate a JWT token for the target user, noting that it is an impersonated session
    const token = jwt.sign(
      { 
        id: targetUser.id, 
        username: targetUser.username, 
        role: targetUser.role, 
        tenant_id: targetUser.tenant_id, 
        subscription_plan: targetTenant.subscription_plan,
        subscription_status: targetTenant.subscription_status,
        subscription_expires_at: targetTenant.subscription_expires_at,
        grace_period_ends_at: targetTenant.grace_period_ends_at,
        impersonatedBy: req.user?.username
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '2h' } // shorter expiry for security
    );

    await logAudit(req, 'USER_IMPERSONATION_START', `Impersonating user username=${targetUser.username} in tenant subdomain=${targetTenant.subdomain}`);

    res.json({
      token,
      user: { 
        id: targetUser.id, 
        username: targetUser.username, 
        email: targetUser.email, 
        role: targetUser.role, 
        tenant_id: targetUser.tenant_id, 
        tenant_name: targetTenant.name, 
        subscription_plan: targetTenant.subscription_plan,
        subscription_status: targetTenant.subscription_status,
        subscription_expires_at: targetTenant.subscription_expires_at,
        grace_period_ends_at: targetTenant.grace_period_ends_at,
        impersonatedBy: req.user?.username
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Retrieve platform runtime errors (Super Admin only)
export const getPlatformErrors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT se.*, t.name as tenant_name
      FROM system_errors se
      LEFT JOIN tenants t ON se.tenant_id = t.id
      ORDER BY se.created_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Mark platform error log as resolved (Super Admin only)
export const resolvePlatformError = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await query(
      'UPDATE system_errors SET resolved = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Error log not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
