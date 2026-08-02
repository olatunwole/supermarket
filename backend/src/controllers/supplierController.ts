import { Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

export const getSuppliers = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await query('SELECT * FROM suppliers WHERE tenant_id = $1 ORDER BY name', [tenantId]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const createSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { name, contact_name, email, phone, address } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const result = await query(
      'INSERT INTO suppliers (tenant_id, name, contact_name, email, phone, address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [tenantId, name, contact_name||null, email||null, phone||null, address||null]
    );
    await logAudit(req, 'CREATE_SUPPLIER', `Created supplier ${name}`);
    res.status(201).json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { name, contact_name, email, phone, address } = req.body;
  try {
    const result = await query(
      'UPDATE suppliers SET name=COALESCE($1,name),contact_name=COALESCE($2,contact_name),email=COALESCE($3,email),phone=COALESCE($4,phone),address=COALESCE($5,address),updated_at=NOW() WHERE id=$6 AND tenant_id=$7 RETURNING *',
      [name, contact_name, email, phone, address, id, tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Supplier not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const getPurchaseOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await query(`
      SELECT po.*, s.name as supplier_name,
        json_agg(json_build_object('id',poi.id,'product_id',poi.product_id,'product_name',p.name,'quantity',poi.quantity,'unit_cost',poi.unit_cost)) as items
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id=s.id
      LEFT JOIN purchase_order_items poi ON po.id=poi.purchase_order_id
      LEFT JOIN products p ON poi.product_id=p.id
      WHERE po.tenant_id = $1
      GROUP BY po.id, s.name
      ORDER BY po.created_at DESC
    `, [tenantId]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { supplier_id, items, notes } = req.body;
  if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'supplier_id and items are required' }); return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = items.reduce((sum: number, i: any) => sum + i.quantity * i.unit_cost, 0);
    const po = await client.query(
      'INSERT INTO purchase_orders (tenant_id, supplier_id, total_amount, notes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [tenantId, supplier_id, total, notes||null, req.user?.id]
    );
    const poId = po.rows[0].id;
    for (const item of items) {
      await client.query(
        'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) VALUES ($1,$2,$3,$4)',
        [poId, item.product_id, item.quantity, item.unit_cost]
      );
    }
    await client.query('COMMIT');
    await logAudit(req, 'CREATE_PO', `Created PO #${poId} for supplier ${supplier_id}`);
    res.status(201).json(po.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

export const updatePurchaseOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'ordered', 'received', 'cancelled'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` }); return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updateFields: any = { status };
    if (status === 'ordered') updateFields.order_date = new Date();
    if (status === 'received') updateFields.received_date = new Date();

    const po = await client.query(
      `UPDATE purchase_orders SET status=$1, order_date=COALESCE($2,order_date), received_date=COALESCE($3,received_date), updated_at=NOW() WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [status, updateFields.order_date||null, updateFields.received_date||null, id, tenantId]
    );
    if (!po.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: 'PO not found' }); return; }

    // If received, add stock
    if (status === 'received') {
      const items = await client.query('SELECT * FROM purchase_order_items WHERE purchase_order_id=$1', [id]);
      for (const item of items.rows) {
        await client.query('UPDATE products SET quantity_on_hand=quantity_on_hand+$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3', [item.quantity, item.product_id, tenantId]);
        await client.query(
          `INSERT INTO stock_adjustments (tenant_id, product_id, quantity_changed, adjustment_type, reason, user_id) VALUES ($1,$2,$3,'receiving',$4,$5)`,
          [tenantId, item.product_id, item.quantity, `PO #${id} received`, req.user?.id]
        );
      }
    }

    await client.query('COMMIT');
    await logAudit(req, 'UPDATE_PO_STATUS', `PO #${id} status -> ${status}`);
    res.json(po.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
