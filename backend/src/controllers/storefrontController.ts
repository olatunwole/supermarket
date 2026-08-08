import { Request, Response } from 'express';
import { query, pool } from '../config/database';

export const getStoreCatalog = async (req: Request, res: Response): Promise<void> => {
  const { subdomain } = req.params;
  try {
    const tenantRes = await query('SELECT id, name, subdomain, subscription_status FROM tenants WHERE subdomain = $1', [subdomain]);
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    if (tenant.subscription_status !== 'active' && tenant.subscription_status !== 'granted') {
      res.status(403).json({ error: 'Store subscription is inactive' });
      return;
    }

    const categoriesRes = await query('SELECT * FROM categories WHERE tenant_id = $1 ORDER BY name', [tenant.id]);
    
    // Only return products in stock
    const productsRes = await query(
      `SELECT p.id, p.name, p.sku, p.barcode, p.unit_price, p.quantity_on_hand, p.category_id, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.tenant_id = $1 AND p.quantity_on_hand > 0
       ORDER BY p.name`,
      [tenant.id]
    );

    res.json({
      store: { name: tenant.name, subdomain: tenant.subdomain },
      categories: categoriesRes.rows,
      products: productsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error loading catalog' });
  }
};

export const placeStoreOrder = async (req: Request, res: Response): Promise<void> => {
  const { subdomain, cart, customerName, email, paymentMethod } = req.body;
  if (!subdomain || !cart || !Array.isArray(cart) || cart.length === 0) {
    res.status(400).json({ error: 'Subdomain and non-empty cart are required' });
    return;
  }

  const client = await pool.connect();
  try {
    // 1. Fetch Tenant
    const tenantRes = await client.query('SELECT * FROM tenants WHERE subdomain = $1', [subdomain]);
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    await client.query('BEGIN');

    // 2. Fetch account IDs for ledger mapping
    const accountsRes = await client.query('SELECT code, id FROM financial_accounts WHERE tenant_id = $1', [tenant.id]);
    const accountMap = new Map<string, number>();
    accountsRes.rows.forEach(acc => accountMap.set(acc.code, acc.id));

    let totalAmount = 0;
    let totalCogs = 0;
    const saleItemsList: any[] = [];

    // Create base sales entry (cashier_id = null for customer portal)
    const saleRes = await client.query(
      `INSERT INTO sales (tenant_id, cashier_id, sale_date, total_amount, tax_amount, discount_amount, payment_method, notes)
       VALUES ($1, NULL, NOW(), 0, 0, 0, $2, $3) RETURNING id`,
      [tenant.id, paymentMethod || 'card', `Customer Web Order: ${customerName} (${email})`]
    );
    const saleId = saleRes.rows[0].id;

    for (const item of cart) {
      const prodRes = await client.query(
        'SELECT * FROM products WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
        [item.product_id, tenant.id]
      );
      const prod = prodRes.rows[0];
      if (!prod) {
        throw new Error(`Product ID ${item.product_id} not found in store catalog`);
      }
      if (prod.quantity_on_hand < item.quantity) {
        throw new Error(`Insufficient stock for product ${prod.name}`);
      }

      const lineTotal = Number(prod.unit_price) * item.quantity;
      const lineCogs = Number(prod.cost_price) * item.quantity;
      totalAmount += lineTotal;
      totalCogs += lineCogs;

      // Update product quantity
      await client.query(
        'UPDATE products SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, prod.id]
      );

      // Create stock adjustment
      await client.query(
        `INSERT INTO stock_adjustments (tenant_id, product_id, quantity_changed, adjustment_type, reason, user_id)
         VALUES ($1, $2, $3, 'sale', $4, NULL)`,
        [tenant.id, prod.id, -item.quantity, `Customer Web Order #${saleId}`]
      );

      // Insert sale item
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, discount)
         VALUES ($1, $2, $3, $4, $5, 0)`,
        [saleId, prod.id, item.quantity, prod.unit_price, prod.cost_price]
      );

      saleItemsList.push({
        id: prod.id,
        name: prod.name,
        quantity: item.quantity,
        price: prod.unit_price
      });
    }

    // Update sales totals
    // Simulate standard tax: 5%
    const taxRate = 0.05;
    const taxAmount = Number((totalAmount * taxRate).toFixed(2));
    const finalTotal = Number((totalAmount + taxAmount).toFixed(2));

    await client.query(
      'UPDATE sales SET total_amount = $1, tax_amount = $2 WHERE id = $3',
      [finalTotal, taxAmount, saleId]
    );

    // 3. Post double-entry accounting journal
    const ref = `sale:${saleId}`;
    const jeRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
       VALUES ($1, NOW(), $2, $3, NULL) RETURNING id`,
      [tenant.id, `Automated entry for Web Customer Order #${saleId}`, ref]
    );
    const jeId = jeRes.rows[0].id;

    // Dr. Cash & Cash Equivalents (1010)
    await client.query(
      'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)',
      [jeId, accountMap.get('1010'), finalTotal]
    );

    // Cr. Sales Revenue (4010)
    await client.query(
      'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)',
      [jeId, accountMap.get('4010'), totalAmount]
    );

    // Cr. Sales Tax Payable (2020)
    if (taxAmount > 0) {
      await client.query(
        'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)',
        [jeId, accountMap.get('2020'), taxAmount]
      );
    }

    // Dr. Cost of Goods Sold (5010)
    if (totalCogs > 0) {
      await client.query(
        'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)',
        [jeId, accountMap.get('5010'), totalCogs]
      );
      // Cr. Inventory Asset (1030)
      await client.query(
        'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)',
        [jeId, accountMap.get('1030'), totalCogs]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Order placed and paid successfully',
      orderId: saleId,
      total: finalTotal,
      tax: taxAmount,
      items: saleItemsList
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Customer checkout failed:', err);
    res.status(500).json({ error: err.message || 'Server error during checkout' });
  } finally {
    client.release();
  }
};
