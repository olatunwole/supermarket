import { pool } from '../config/database';
import bcrypt from 'bcryptjs';

export const autoInitDatabase = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('[AutoInit] Checking database tables...');

    // 1. Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'stock_clerk')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        contact_name VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(30),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        sku VARCHAR(50) UNIQUE NOT NULL,
        barcode VARCHAR(50) UNIQUE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        quantity_on_hand INTEGER NOT NULL DEFAULT 0,
        reorder_threshold INTEGER NOT NULL DEFAULT 10,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        expiry_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity_changed INTEGER NOT NULL,
        adjustment_type VARCHAR(30) NOT NULL CHECK (adjustment_type IN ('receiving', 'damage_loss', 'manual_correction', 'sale')),
        reason TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'cancelled')),
        order_date TIMESTAMP,
        received_date TIMESTAMP,
        total_amount NUMERIC(12,2) DEFAULT 0,
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        sale_date TIMESTAMP DEFAULT NOW(),
        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount NUMERIC(12,2) NOT NULL DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments(product_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);`);

    // 3. Financials Migration
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_accounts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id SERIAL PRIMARY KEY,
        entry_date TIMESTAMP NOT NULL DEFAULT NOW(),
        description TEXT NOT NULL,
        reference VARCHAR(100),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_items (
        id SERIAL PRIMARY KEY,
        journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
        debit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
        credit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
        CONSTRAINT chk_debit_credit CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_items_entry ON journal_items(journal_entry_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_items_account ON journal_items(account_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_ref ON journal_entries(reference);`);

    console.log('[AutoInit] Financials tables and indexes checked/created.');

    // 4. Closed Periods & Rejected Transactions Migration
    await client.query(`
      CREATE TABLE IF NOT EXISTS closed_periods (
        id SERIAL PRIMARY KEY,
        period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('month', 'year')),
        period_name VARCHAR(20) UNIQUE NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        closed_at TIMESTAMP DEFAULT NOW(),
        closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS rejected_transactions (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(100) UNIQUE NOT NULL,
        rejected_at TIMESTAMP DEFAULT NOW(),
        rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    console.log('[AutoInit] Closed periods and rejected transactions tables checked/created.');

    // 5. Seed Standard Accounts
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

    const accountMap = new Map<string, number>();

    for (const acc of defaultAccounts) {
      const res = await client.query(
        `INSERT INTO financial_accounts (code, name, type, is_system)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = $2, type = $3, is_system = $4
         RETURNING id`,
        [acc.code, acc.name, acc.type, acc.is_system]
      );
      accountMap.set(acc.code, res.rows[0].id);
    }
    console.log('[AutoInit] Chart of Accounts seeded.');

    // 6. Backfill Historical Transactions (Idempotent)
    console.log('[AutoInit] Checking historical transactions to backfill...');

    // A. Sales
    const sales = await client.query(`SELECT * FROM sales`);
    let salesCount = 0;
    for (const sale of sales.rows) {
      const ref = `sale:${sale.id}`;
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1`, [ref]);
      if (existing.rows.length > 0) continue;

      const items = await client.query(`SELECT * FROM sale_items WHERE sale_id = $1`, [sale.id]);
      let totalCogs = 0;
      for (const item of items.rows) {
        totalCogs += Number(item.quantity) * Number(item.cost_price);
      }

      await client.query('BEGIN');
      try {
        const jeRes = await client.query(
          `INSERT INTO journal_entries (entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [sale.sale_date || sale.created_at, `Automated entry for Sale #${sale.id}`, ref, sale.cashier_id]
        );
        const jeId = jeRes.rows[0].id;

        const totalAmount = Number(sale.total_amount);
        const taxAmount = Number(sale.tax_amount);
        const discountAmount = Number(sale.discount_amount);
        const revenueAmount = totalAmount - taxAmount + discountAmount;

        // Cash / Bank
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [jeId, accountMap.get('1010'), totalAmount]
        );
        // Sales Discounts
        if (discountAmount > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get('5040'), discountAmount]
          );
        }
        // COGS
        if (totalCogs > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get('5010'), totalCogs]
          );
        }

        // Sales Revenue
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [jeId, accountMap.get('4010'), revenueAmount]
        );
        // Sales Tax Payable
        if (taxAmount > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get('2020'), taxAmount]
          );
        }
        // Inventory
        if (totalCogs > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get('1030'), totalCogs]
          );
        }
        await client.query('COMMIT');
        salesCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[AutoInit] Failed backfilling Sale #${sale.id}:`, err);
      }
    }
    if (salesCount > 0) {
      console.log(`[AutoInit] Backfilled ${salesCount} sales.`);
    }

    // B. Purchase Orders
    const pos = await client.query(`SELECT * FROM purchase_orders WHERE status = 'received'`);
    let posCount = 0;
    for (const po of pos.rows) {
      const ref = `po:${po.id}`;
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1`, [ref]);
      if (existing.rows.length > 0) continue;

      await client.query('BEGIN');
      try {
        const jeRes = await client.query(
          `INSERT INTO journal_entries (entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [po.received_date || po.updated_at || po.created_at, `Automated entry for Purchase Order #${po.id} Received`, ref, po.created_by]
        );
        const jeId = jeRes.rows[0].id;
        const totalAmount = Number(po.total_amount);

        // Debit Inventory
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [jeId, accountMap.get('1030'), totalAmount]
        );

        // Credit Accounts Payable
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [jeId, accountMap.get('2010'), totalAmount]
        );
        await client.query('COMMIT');
        posCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[AutoInit] Failed backfilling PO #${po.id}:`, err);
      }
    }
    if (posCount > 0) {
      console.log(`[AutoInit] Backfilled ${posCount} received purchase orders.`);
    }

    // C. Stock Adjustments
    const adjustments = await client.query(`SELECT * FROM stock_adjustments WHERE adjustment_type != 'sale'`);
    let adjCount = 0;
    for (const sa of adjustments.rows) {
      const ref = `adjustment:${sa.id}`;
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1`, [ref]);
      if (existing.rows.length > 0) continue;

      const prodRes = await client.query(`SELECT cost_price FROM products WHERE id = $1`, [sa.product_id]);
      if (prodRes.rows.length === 0) continue;
      const costPrice = Number(prodRes.rows[0].cost_price);
      const qtyChanged = Number(sa.quantity_changed);
      const valueChange = Math.abs(qtyChanged) * costPrice;

      if (valueChange <= 0) continue;

      await client.query('BEGIN');
      try {
        const jeRes = await client.query(
          `INSERT INTO journal_entries (entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [sa.created_at, `Automated entry for Stock Adjustment #${sa.id} (${sa.adjustment_type})`, ref, sa.user_id]
        );
        const jeId = jeRes.rows[0].id;

        if (qtyChanged < 0) {
          // Reduction: Debit Stock Adjustment Loss, Credit Inventory
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get('5020'), valueChange]
          );
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get('1030'), valueChange]
          );
        } else {
          // Addition: Debit Inventory, Credit Owner Equity or Other Revenue
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get('1030'), valueChange]
          );

          const creditAccount = sa.adjustment_type === 'receiving' ? '3010' : '4020';
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get(creditAccount), valueChange]
          );
        }
        await client.query('COMMIT');
        adjCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[AutoInit] Failed backfilling Stock Adjustment #${sa.id}:`, err);
      }
    }
    if (adjCount > 0) {
      console.log(`[AutoInit] Backfilled ${adjCount} stock adjustments.`);
    }

    console.log('[AutoInit] Tables, indexes, seeding, and transaction backfills checked/created.');

    // 2. Check if database is empty (no users seeded)
    const userCountRes = await client.query('SELECT COUNT(*)::integer FROM users');
    const userCount = userCountRes.rows[0].count;

    if (userCount === 0) {
      console.log('[AutoInit] Database is empty. Seeding default data...');

      // Categories
      const categories = [
        { name: 'Fruits & Vegetables', description: 'Fresh produce' },
        { name: 'Dairy & Eggs', description: 'Milk, cheese, eggs, butter' },
        { name: 'Meat & Seafood', description: 'Fresh and frozen meats' },
        { name: 'Bakery', description: 'Bread, pastries, cakes' },
        { name: 'Beverages', description: 'Soft drinks, juices, water' },
        { name: 'Snacks & Confectionery', description: 'Crisps, chocolates, sweets' },
        { name: 'Household & Cleaning', description: 'Cleaning products' },
        { name: 'Frozen Foods', description: 'Frozen meals and vegetables' },
        { name: 'Canned & Packaged', description: 'Tinned and dry goods' },
        { name: 'Health & Beauty', description: 'Personal care products' },
      ];

      const catIds: number[] = [];
      for (const cat of categories) {
        const res = await client.query(
          `INSERT INTO categories (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description=$2 RETURNING id`,
          [cat.name, cat.description]
        );
        catIds.push(res.rows[0].id);
      }

      // Suppliers
      const suppliers = [
        { name: 'Fresh Farms Ltd', contact_name: 'Alice Green', email: 'alice@freshfarms.co.uk', phone: '07700 900111', address: '12 Farm Lane, Bristol, BS1 2AB' },
        { name: 'Metro Wholesale', contact_name: 'Bob Smith', email: 'bob@metrowholesale.co.uk', phone: '07700 900222', address: '45 Trade Park, Birmingham, B2 4CD' },
        { name: 'Sunrise Beverages', contact_name: 'Carol White', email: 'carol@sunrisebev.co.uk', phone: '07700 900333', address: '78 Drink St, Manchester, M3 5EF' },
        { name: 'Global Imports', contact_name: 'David Lee', email: 'david@globalimports.co.uk', phone: '07700 900444', address: '90 Port Road, London, E1 6GH' },
      ];

      const supIds: number[] = [];
      for (const sup of suppliers) {
        const res = await client.query(
          `INSERT INTO suppliers (name, contact_name, email, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [sup.name, sup.contact_name, sup.email, sup.phone, sup.address]
        );
        supIds.push(res.rows[0].id);
      }

      // Users
      const users = [
        { username: 'admin', email: 'admin@supermarket.com', password: 'admin123', role: 'admin' },
        { username: 'manager1', email: 'manager@supermarket.com', password: 'manager123', role: 'manager' },
        { username: 'cashier1', email: 'cashier1@supermarket.com', password: 'cashier123', role: 'cashier' },
        { username: 'cashier2', email: 'cashier2@supermarket.com', password: 'cashier123', role: 'cashier' },
        { username: 'stockclerk1', email: 'stock@supermarket.com', password: 'stock123', role: 'stock_clerk' },
      ];

      for (const user of users) {
        const hash = await bcrypt.hash(user.password, 10);
        await client.query(
          `INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT (username) DO NOTHING`,
          [user.username, user.email, hash, user.role]
        );
      }

      // Products
      const products = [
        { name: 'Bananas (bunch)', sku: 'PRD-001', barcode: '5000112637922', cat: 0, sup: 0, price: 0.89, cost: 0.45, qty: 150, reorder: 30, expiry: '2026-07-12' },
        { name: 'Whole Milk 2L', sku: 'PRD-002', barcode: '5000112637923', cat: 1, sup: 1, price: 1.49, cost: 0.80, qty: 80, reorder: 20, expiry: '2026-07-10' },
        { name: 'Free Range Eggs x12', sku: 'PRD-003', barcode: '5000112637924', cat: 1, sup: 0, price: 2.99, cost: 1.60, qty: 60, reorder: 15, expiry: '2026-07-18' },
        { name: 'White Sliced Bread', sku: 'PRD-004', barcode: '5000112637925', cat: 3, sup: 1, price: 1.15, cost: 0.60, qty: 45, reorder: 20, expiry: '2026-07-08' },
        { name: 'Coca-Cola 330ml Can', sku: 'PRD-005', barcode: '5000112637926', cat: 4, sup: 2, price: 1.10, cost: 0.55, qty: 200, reorder: 50, expiry: null },
        { name: 'Orange Juice 1L', sku: 'PRD-006', barcode: '5000112637927', cat: 4, sup: 2, price: 1.79, cost: 0.90, qty: 70, reorder: 25, expiry: '2026-07-20' },
        { name: 'Cheddar Cheese 400g', sku: 'PRD-007', barcode: '5000112637928', cat: 1, sup: 1, price: 2.75, cost: 1.50, qty: 40, reorder: 10, expiry: '2026-08-01' },
        { name: 'Chicken Breast 500g', sku: 'PRD-008', barcode: '5000112637929', cat: 2, sup: 1, price: 4.50, cost: 2.80, qty: 35, reorder: 10, expiry: '2026-07-07' },
        { name: 'Salted Crisps 150g', sku: 'PRD-009', barcode: '5000112637930', cat: 5, sup: 3, price: 1.35, cost: 0.65, qty: 120, reorder: 40, expiry: null },
        { name: 'Chocolate Digestives', sku: 'PRD-010', barcode: '5000112637931', cat: 5, sup: 3, price: 1.85, cost: 0.90, qty: 90, reorder: 30, expiry: null },
        { name: 'Washing Up Liquid 500ml', sku: 'PRD-011', barcode: '5000112637932', cat: 6, sup: 3, price: 1.29, cost: 0.60, qty: 55, reorder: 15, expiry: null },
        { name: 'Frozen Peas 900g', sku: 'PRD-012', barcode: '5000112637933', cat: 7, sup: 1, price: 1.89, cost: 0.95, qty: 65, reorder: 20, expiry: null },
        { name: 'Baked Beans 400g', sku: 'PRD-013', barcode: '5000112637934', cat: 8, sup: 3, price: 0.75, cost: 0.35, qty: 180, reorder: 50, expiry: null },
        { name: 'Pasta Fusilli 500g', sku: 'PRD-014', barcode: '5000112637935', cat: 8, sup: 3, price: 1.05, cost: 0.48, qty: 130, reorder: 40, expiry: null },
        { name: 'Tomato Ketchup 500g', sku: 'PRD-015', barcode: '5000112637936', cat: 8, sup: 3, price: 1.55, cost: 0.75, qty: 75, reorder: 20, expiry: null },
        { name: 'Shampoo 400ml', sku: 'PRD-016', barcode: '5000112637937', cat: 9, sup: 3, price: 2.99, cost: 1.40, qty: 8, reorder: 15, expiry: null },
        { name: 'Sparkling Water 1.5L', sku: 'PRD-017', barcode: '5000112637938', cat: 4, sup: 2, price: 0.65, cost: 0.30, qty: 160, reorder: 50, expiry: null },
        { name: 'Butter 250g', sku: 'PRD-018', barcode: '5000112637939', cat: 1, sup: 1, price: 2.20, cost: 1.10, qty: 50, reorder: 15, expiry: '2026-08-15' },
        { name: 'Carrots 1kg', sku: 'PRD-019', barcode: '5000112637940', cat: 0, sup: 0, price: 0.79, cost: 0.38, qty: 100, reorder: 25, expiry: '2026-07-14' },
        { name: 'Apples Gala 6pk', sku: 'PRD-020', barcode: '5000112637941', cat: 0, sup: 0, price: 1.39, cost: 0.70, qty: 85, reorder: 20, expiry: '2026-07-16' },
      ];

      for (const p of products) {
        await client.query(
          `INSERT INTO products (name, sku, barcode, category_id, unit_price, cost_price, quantity_on_hand, reorder_threshold, supplier_id, expiry_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (sku) DO NOTHING`,
          [p.name, p.sku, p.barcode, catIds[p.cat], p.price, p.cost, p.qty, p.reorder, supIds[p.sup], p.expiry || null]
        );
      }

      console.log('[AutoInit] Database seeding completed successfully.');
    } else {
      console.log('[AutoInit] Database already contains records. Skipping seed.');
    }
  } catch (err) {
    console.error('[AutoInit] Initialization error:', err);
  } finally {
    if (client) {
      client.release();
    }
  }
};
