import { Request, Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

// In-memory queue to pair POS register sessions with mobile camera scanners
const pendingScans: Record<string, string[]> = {};

export const submitScanForSession = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const { barcode } = req.body;
  
  if (!barcode) {
    res.status(400).json({ error: 'barcode is required' });
    return;
  }
  
  if (!pendingScans[sessionId]) {
    pendingScans[sessionId] = [];
  }
  
  pendingScans[sessionId].push(barcode);
  res.json({ success: true, message: `Barcode queued for session ${sessionId}` });
};

export const getPendingScansForSession = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const scans = pendingScans[sessionId] || [];
  pendingScans[sessionId] = []; // Clear queue on retrieval
  res.json({ scans });
};

export const getSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let sql = `
      SELECT s.*, u.username as cashier_name,
        json_agg(json_build_object('id',si.id,'product_id',si.product_id,'product_name',p.name,'quantity',si.quantity,'unit_price',si.unit_price,'discount',si.discount)) as items
      FROM sales s
      LEFT JOIN users u ON s.cashier_id=u.id
      LEFT JOIN sale_items si ON s.id=si.sale_id
      LEFT JOIN products p ON si.product_id=p.id
    `;
    const params: any[] = [];
    if (req.user?.role === 'cashier') {
      sql += ` WHERE s.cashier_id=$1`; params.push(req.user.id);
    }
    sql += ' GROUP BY s.id, u.username ORDER BY s.sale_date DESC';
    if (req.query.limit) { sql += ` LIMIT $${params.length+1}`; params.push(req.query.limit); }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
};

export const getSaleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = await query(`
      SELECT s.*, u.username as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id=u.id WHERE s.id=$1`, [req.params.id]);
    if (!sale.rows[0]) { res.status(404).json({ error: 'Sale not found' }); return; }
    if (req.user?.role === 'cashier' && sale.rows[0].cashier_id !== req.user.id) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const items = await query(`
      SELECT si.*, p.name as product_name, p.sku FROM sale_items si JOIN products p ON si.product_id=p.id WHERE si.sale_id=$1`, [req.params.id]);
    res.json({ ...sale.rows[0], items: items.rows });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const createSale = async (req: AuthRequest, res: Response): Promise<void> => {
  const { items, payment_method, discount_amount, tax_rate, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items array is required' }); return;
  }
  if (!['cash', 'card', 'transfer'].includes(payment_method)) {
    res.status(400).json({ error: 'payment_method must be cash, card or transfer' }); return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate stock and get prices
    let subtotal = 0;
    const enrichedItems: any[] = [];
    for (const item of items) {
      const prod = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [item.product_id]);
      if (!prod.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: `Product ${item.product_id} not found` }); return; }
      if (prod.rows[0].quantity_on_hand < item.quantity) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: `Insufficient stock for ${prod.rows[0].name}. Available: ${prod.rows[0].quantity_on_hand}` }); return;
      }
      const lineTotal = prod.rows[0].unit_price * item.quantity - (item.discount || 0);
      subtotal += lineTotal;
      enrichedItems.push({ ...item, unit_price: prod.rows[0].unit_price, cost_price: prod.rows[0].cost_price });
    }

    const taxAmount = subtotal * (tax_rate || 0);
    const discountAmt = discount_amount || 0;
    const totalAmount = subtotal + taxAmount - discountAmt;

    // Insert sale
    const sale = await client.query(
      `INSERT INTO sales (cashier_id, total_amount, tax_amount, discount_amount, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user?.id, totalAmount, taxAmount, discountAmt, payment_method, notes || null]
    );
    const saleId = sale.rows[0].id;

    // Insert items & deduct stock
    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, discount) VALUES ($1,$2,$3,$4,$5,$6)`,
        [saleId, item.product_id, item.quantity, item.unit_price, item.cost_price, item.discount || 0]
      );
      await client.query(
        'UPDATE products SET quantity_on_hand=quantity_on_hand-$1, updated_at=NOW() WHERE id=$2',
        [item.quantity, item.product_id]
      );
      await client.query(
        `INSERT INTO stock_adjustments (product_id, quantity_changed, adjustment_type, reason, user_id) VALUES ($1,$2,'sale',$3,$4)`,
        [item.product_id, -item.quantity, `Sale #${saleId}`, req.user?.id]
      );
    }

    await client.query('COMMIT');
    await logAudit(req, 'CREATE_SALE', `Sale #${saleId} total=${totalAmount}`);
    res.status(201).json({ ...sale.rows[0], items: enrichedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
