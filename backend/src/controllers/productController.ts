import { Response } from 'express';
import { query, pool } from '../config/database';
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

export const bulkCreateProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  const productsList = req.body;
  if (!Array.isArray(productsList)) {
    res.status(400).json({ error: 'Body must be an array of products' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch categories and suppliers to map name -> id
    const categoriesRes = await client.query('SELECT id, name FROM categories');
    const categoryMap = new Map<string, number>(
      categoriesRes.rows.map((c: any) => [c.name.toLowerCase().trim(), c.id])
    );

    const suppliersRes = await client.query('SELECT id, name FROM suppliers');
    const supplierMap = new Map<string, number>(
      suppliersRes.rows.map((s: any) => [s.name.toLowerCase().trim(), s.id])
    );

    const results: any[] = [];
    const generatedBarcodes = new Set<string>();
    const generatedSkus = new Set<string>();

    for (const item of productsList) {
      const {
        name,
        sku,
        barcode,
        category,
        unit_price,
        cost_price,
        quantity_on_hand,
        reorder_threshold,
        supplier,
        expiry_date
      } = item;

      let finalSku = sku ? String(sku).trim() : '';
      let finalBarcode = barcode ? String(barcode).trim() : '';

      // 1. Resolve barcode (generate one if missing, just like single creation)
      if (!finalBarcode) {
        const prefix = '200';
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 100) {
          const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
          const tempBarcode = prefix + randomPart;
          
          const checkResult = await client.query('SELECT id FROM products WHERE barcode = $1 OR sku = $1', [tempBarcode]);
          if (checkResult.rows.length === 0 && !generatedBarcodes.has(tempBarcode) && !generatedSkus.has(tempBarcode)) {
            finalBarcode = tempBarcode;
            generatedBarcodes.add(tempBarcode);
            isUnique = true;
          }
          attempts++;
        }
      }

      // 2. If SKU is missing, link it to the barcode
      if (!finalSku) {
        finalSku = finalBarcode;
      }

      // Record the SKU to prevent any duplicates in this batch
      generatedSkus.add(finalSku);

      if (!name || !finalSku || unit_price == null || cost_price == null) {
        throw new Error(`Product ${name || 'unknown'} is missing required fields (name, unit_price, cost_price)`);
      }

      // Resolve category
      let categoryId: number | null = null;
      if (category && category.trim()) {
        const catName = category.trim();
        const catKey = catName.toLowerCase();
        if (categoryMap.has(catKey)) {
          categoryId = categoryMap.get(catKey)!;
        } else {
          const newCat = await client.query(
            'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id',
            [catName, 'Imported category']
          );
          categoryId = newCat.rows[0].id;
          categoryMap.set(catKey, categoryId!);
        }
      }

      // Resolve supplier
      let supplierId: number | null = null;
      if (supplier && supplier.trim()) {
        const supName = supplier.trim();
        const supKey = supName.toLowerCase();
        if (supplierMap.has(supKey)) {
          supplierId = supplierMap.get(supKey)!;
        } else {
          const newSup = await client.query(
            'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
            [supName]
          );
          supplierId = newSup.rows[0].id;
          supplierMap.set(supKey, supplierId!);
        }
      }

      // Upsert product
      const upsertRes = await client.query(
        `INSERT INTO products (name, sku, barcode, category_id, unit_price, cost_price, quantity_on_hand, reorder_threshold, supplier_id, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (sku) DO UPDATE SET
           name = EXCLUDED.name,
           barcode = COALESCE(EXCLUDED.barcode, products.barcode),
           category_id = COALESCE(EXCLUDED.category_id, products.category_id),
           unit_price = EXCLUDED.unit_price,
           cost_price = EXCLUDED.cost_price,
           quantity_on_hand = EXCLUDED.quantity_on_hand,
           reorder_threshold = EXCLUDED.reorder_threshold,
           supplier_id = COALESCE(EXCLUDED.supplier_id, products.supplier_id),
           expiry_date = EXCLUDED.expiry_date,
           updated_at = NOW()
         RETURNING *`,
        [
          name,
          finalSku,
          finalBarcode || null,
          categoryId,
          unit_price,
          cost_price,
          quantity_on_hand || 0,
          reorder_threshold || 10,
          supplierId,
          expiry_date || null
        ]
      );

      // Create stock adjustment log if inserting stock
      if (quantity_on_hand > 0) {
        await client.query(
          `INSERT INTO stock_adjustments (product_id, quantity_changed, adjustment_type, reason, user_id)
           VALUES ($1, $2, 'receiving', 'Bulk Inventory Excel Upload', $3)`,
          [upsertRes.rows[0].id, quantity_on_hand, req.user?.id]
        );
      }

      results.push(upsertRes.rows[0]);
    }

    await client.query('COMMIT');
    await logAudit(req, 'BULK_IMPORT_PRODUCTS', `Successfully imported/updated ${results.length} products`);
    res.status(200).json({ success: true, count: results.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Bulk import failed:', err);
    res.status(500).json({ error: err.message || 'Server error during bulk import' });
  } finally {
    client.release();
  }
};
