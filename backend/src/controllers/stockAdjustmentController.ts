import { Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

export const getStockAdjustments = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { product_id } = req.query;
  try {
    let sql = `
      SELECT sa.*, p.name as product_name, p.sku, u.username as adjusted_by
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id=p.id
      LEFT JOIN users u ON sa.user_id=u.id
      WHERE sa.tenant_id = $1 AND sa.adjustment_type != 'sale'
    `;
    const params: any[] = [tenantId];
    if (product_id) { sql += ` AND sa.product_id=$2`; params.push(product_id); }
    sql += ' ORDER BY sa.created_at DESC LIMIT 200';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const createStockAdjustment = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { product_id, quantity_changed, adjustment_type, reason } = req.body;
  if (!product_id || quantity_changed == null || !adjustment_type) {
    res.status(400).json({ error: 'product_id, quantity_changed and adjustment_type are required' }); return;
  }
  const validTypes = ['receiving', 'damage_loss', 'manual_correction'];
  if (!validTypes.includes(adjustment_type)) {
    res.status(400).json({ error: `adjustment_type must be one of: ${validTypes.join(', ')}` }); return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prod = await client.query('SELECT * FROM products WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [product_id, tenantId]);
    if (!prod.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Product not found' }); return; }

    const newQty = prod.rows[0].quantity_on_hand + quantity_changed;
    if (newQty < 0) { await client.query('ROLLBACK'); res.status(409).json({ error: 'Adjustment would result in negative stock' }); return; }

    await client.query('UPDATE products SET quantity_on_hand=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3', [newQty, product_id, tenantId]);
    const adj = await client.query(
      `INSERT INTO stock_adjustments (tenant_id, product_id, quantity_changed, adjustment_type, reason, user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, product_id, quantity_changed, adjustment_type, reason || null, req.user?.id]
    );

    await client.query('COMMIT');
    await logAudit(req, 'STOCK_ADJUSTMENT', `${adjustment_type} on product ${product_id}: ${quantity_changed > 0 ? '+' : ''}${quantity_changed}`);
    res.status(201).json({ adjustment: adj.rows[0], new_quantity: newQty });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
