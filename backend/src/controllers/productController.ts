import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, category_id, low_stock } = req.query;
  try {
    let sql = `
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let i = 1;
    if (search) { sql += ` AND (p.name ILIKE $${i} OR p.sku ILIKE $${i} OR p.barcode ILIKE $${i})`; params.push(`%${search}%`); i++; }
    if (category_id) { sql += ` AND p.category_id = $${i}`; params.push(category_id); i++; }
    if (low_stock === 'true') { sql += ` AND p.quantity_on_hand <= p.reorder_threshold`; }
    sql += ' ORDER BY p.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const getProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT p.*, c.name as category_name, s.name as supplier_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Product not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const getProductByBarcode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.barcode=$1 OR p.sku=$1`,
      [req.params.code]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Product not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, sku, barcode, category_id, unit_price, cost_price, quantity_on_hand, reorder_threshold, supplier_id, expiry_date } = req.body;
  if (!name || !sku || unit_price == null || cost_price == null) {
    res.status(400).json({ error: 'name, sku, unit_price and cost_price are required' }); return;
  }
  try {
    let finalBarcode = barcode;
    if (!finalBarcode) {
      const prefix = '200';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 100) {
        const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
        const tempBarcode = prefix + randomPart;
        const checkResult = await query('SELECT id FROM products WHERE barcode = $1', [tempBarcode]);
        if (checkResult.rows.length === 0) {
          finalBarcode = tempBarcode;
          isUnique = true;
        }
        attempts++;
      }
    }

    const result = await query(
      `INSERT INTO products (name, sku, barcode, category_id, unit_price, cost_price, quantity_on_hand, reorder_threshold, supplier_id, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, sku, finalBarcode||null, category_id||null, unit_price, cost_price, quantity_on_hand||0, reorder_threshold||10, supplier_id||null, expiry_date||null]
    );
    await logAudit(req, 'CREATE_PRODUCT', `Created product ${name} (${sku})`);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'SKU or barcode already exists' }); return; }
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, barcode, category_id, unit_price, cost_price, reorder_threshold, supplier_id, expiry_date } = req.body;
  try {
    const result = await query(
      `UPDATE products SET
        name=COALESCE($1,name), barcode=COALESCE($2,barcode), category_id=COALESCE($3,category_id),
        unit_price=COALESCE($4,unit_price), cost_price=COALESCE($5,cost_price),
        reorder_threshold=COALESCE($6,reorder_threshold), supplier_id=COALESCE($7,supplier_id),
        expiry_date=COALESCE($8,expiry_date), updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, barcode, category_id, unit_price, cost_price, reorder_threshold, supplier_id, expiry_date, id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Product not found' }); return; }
    await logAudit(req, 'UPDATE_PRODUCT', `Updated product id=${id}`);
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) { res.status(404).json({ error: 'Product not found' }); return; }
    await logAudit(req, 'DELETE_PRODUCT', `Deleted product id=${req.params.id}`);
    res.json({ message: 'Product deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const getLowStockProducts = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT p.*, c.name as category_name, s.name as supplier_name
       FROM products p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN suppliers s ON p.supplier_id=s.id
       WHERE p.quantity_on_hand <= p.reorder_threshold ORDER BY p.quantity_on_hand ASC`
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
};
