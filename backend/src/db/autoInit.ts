import { pool } from '../config/database';
import bcrypt from 'bcryptjs';

export const autoInitDatabase = async () => {
  let client: any;
  try {
    client = await pool.connect();
    console.log('[AutoInit] Checking database tables for multi-tenancy...');

    // 1. Create Tenants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        subdomain VARCHAR(100) UNIQUE NOT NULL,
        subscription_plan VARCHAR(20) DEFAULT 'starter',
        subscription_status VARCHAR(20) DEFAULT 'unpaid',
        subscription_expires_at TIMESTAMP,
        grace_period_ends_at TIMESTAMP,
        payment_gateway VARCHAR(50),
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Ensure the CHECK constraint on tenants.subscription_plan is dropped
    await client.query(`
      ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subscription_plan_check;
    `);

    // Ensure newer columns exist in case table was created previously
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
    `);

    // Create subscription_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        price_gbp NUMERIC(10, 2) NOT NULL,
        features JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed default subscription plans
    await client.query(`
      INSERT INTO subscription_plans (name, price_gbp, features) VALUES
      ('Starter', 19.00, '{"accounting": false, "advanced_reports": false, "max_products": 50, "max_users": 3}'),
      ('Pro', 49.00, '{"accounting": true, "advanced_reports": false, "max_products": 500, "max_users": 10}'),
      ('Ultra', 99.00, '{"accounting": true, "advanced_reports": true, "max_products": 99999, "max_users": 999}')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Create system_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        grace_period_days INTEGER DEFAULT 7,
        reminder_days_before INTEGER DEFAULT 3,
        paypal_client_id VARCHAR(255) DEFAULT 'mock_paypal_client_id',
        paystack_public_key VARCHAR(255) DEFAULT 'mock_paystack_public_key',
        flutterwave_public_key VARCHAR(255) DEFAULT 'mock_flutterwave_public_key',
        platform_name VARCHAR(150) DEFAULT 'Antigravity SaaS',
        platform_theme_color VARCHAR(50) DEFAULT 'purple',
        platform_theme_bg VARCHAR(50) DEFAULT 'obsidian',
        platform_logo TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Ensure newer platform branding columns exist
    await client.query(`
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS platform_name VARCHAR(150) DEFAULT 'Antigravity SaaS';
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS platform_theme_color VARCHAR(50) DEFAULT 'purple';
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS platform_theme_bg VARCHAR(50) DEFAULT 'obsidian';
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS platform_logo TEXT;
    `);

    // Create system_errors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_errors (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed default system settings
    await client.query(`
      INSERT INTO system_settings (id, grace_period_days, reminder_days_before, platform_name, platform_theme_color, platform_theme_bg)
      VALUES (1, 7, 3, 'Antigravity SaaS', 'purple', 'obsidian')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Insert default tenant if missing (default tenant starts active and on Ultra plan)
    await client.query(`
      INSERT INTO tenants (id, name, subdomain, subscription_plan, subscription_status)
      VALUES (1, 'Default Supermarket Store', 'default', 'Ultra', 'active')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Ensure default tenant remains active on updates
    await client.query(`
      UPDATE tenants SET subscription_status = 'active', subscription_plan = 'Ultra' WHERE id = 1;
    `);

    await client.query(`SELECT setval('tenants_id_seq', COALESCE((SELECT MAX(id)+1 FROM tenants), 1), false);`);

    // Helper to alter table to add tenant_id and migrate existing rows
    const ensureTenantColumn = async (tableName: string) => {
      // 1. Add column as nullable
      await client.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;`);
      // 2. Set default tenant (id = 1) for any existing rows that are null
      await client.query(`UPDATE ${tableName} SET tenant_id = 1 WHERE tenant_id IS NULL;`);
      // 3. Make column NOT NULL
      await client.query(`ALTER TABLE ${tableName} ALTER COLUMN tenant_id SET NOT NULL;`);
    };

    const tablesToMigrate = [
      'users',
      'categories',
      'suppliers',
      'products',
      'stock_adjustments',
      'purchase_orders',
      'sales',
      'audit_log',
      'financial_accounts',
      'journal_entries',
      'closed_periods',
      'rejected_transactions'
    ];

    // Drop old unique constraints before adding columns/indexes
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;`);
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;`);
    await client.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;`);
    await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;`);
    await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;`);
    await client.query(`ALTER TABLE financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_code_key;`);
    await client.query(`ALTER TABLE closed_periods DROP CONSTRAINT IF EXISTS closed_periods_period_name_key;`);
    await client.query(`ALTER TABLE rejected_transactions DROP CONSTRAINT IF EXISTS rejected_transactions_reference_key;`);

    for (const tbl of tablesToMigrate) {
      await ensureTenantColumn(tbl);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${tbl}_tenant ON ${tbl}(tenant_id);`);
    }

    // Add back the new tenant-scoped unique constraints
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS unique_tenant_username;`);
    await client.query(`ALTER TABLE users ADD CONSTRAINT unique_tenant_username UNIQUE (tenant_id, username);`);

    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS unique_tenant_email;`);
    await client.query(`ALTER TABLE users ADD CONSTRAINT unique_tenant_email UNIQUE (tenant_id, email);`);

    await client.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS unique_tenant_category;`);
    await client.query(`ALTER TABLE categories ADD CONSTRAINT unique_tenant_category UNIQUE (tenant_id, name);`);

    await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS unique_tenant_sku;`);
    await client.query(`ALTER TABLE products ADD CONSTRAINT unique_tenant_sku UNIQUE (tenant_id, sku);`);

    await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS unique_tenant_barcode;`);
    await client.query(`ALTER TABLE products ADD CONSTRAINT unique_tenant_barcode UNIQUE (tenant_id, barcode);`);

    await client.query(`ALTER TABLE financial_accounts DROP CONSTRAINT IF EXISTS unique_tenant_code;`);
    await client.query(`ALTER TABLE financial_accounts ADD CONSTRAINT unique_tenant_code UNIQUE (tenant_id, code);`);

    await client.query(`ALTER TABLE closed_periods DROP CONSTRAINT IF EXISTS unique_tenant_period_name;`);
    await client.query(`ALTER TABLE closed_periods ADD CONSTRAINT unique_tenant_period_name UNIQUE (tenant_id, period_name);`);

    await client.query(`ALTER TABLE rejected_transactions DROP CONSTRAINT IF EXISTS unique_tenant_rejection_ref;`);
    await client.query(`ALTER TABLE rejected_transactions ADD CONSTRAINT unique_tenant_rejection_ref UNIQUE (tenant_id, reference);`);

    // Alter users role constraint to support super_admin
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'cashier', 'stock_clerk', 'super_admin'));
    `);

    // 2. Create tables with tenant_id directly (in case of a fresh database deployment)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'stock_clerk', 'super_admin')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        sku VARCHAR(50) NOT NULL,
        barcode VARCHAR(50),
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
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Performance Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments(product_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);`);

    // 3. Financials Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_accounts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
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
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

    // 4. Closed Periods & Rejected Transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS closed_periods (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('month', 'year')),
        period_name VARCHAR(20) NOT NULL,
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
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        reference VARCHAR(100) NOT NULL,
        rejected_at TIMESTAMP DEFAULT NOW(),
        rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    console.log('[AutoInit] Multi-tenant database tables and indexes verified.');

    // 5. Seed Standard Accounts per Tenant
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

    const tenantsRes = await client.query('SELECT id FROM tenants');
    const tenantsList = tenantsRes.rows;
    const accountMap = new Map<string, number>(); // key: `tenantId:code` -> value: id

    for (const t of tenantsList) {
      for (const acc of defaultAccounts) {
        const res = await client.query(
          `INSERT INTO financial_accounts (tenant_id, code, name, type, is_system)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, code) DO UPDATE SET name = $3, type = $4, is_system = $5
           RETURNING id`,
          [t.id, acc.code, acc.name, acc.type, acc.is_system]
        );
        accountMap.set(`${t.id}:${acc.code}`, res.rows[0].id);
      }
    }
    console.log('[AutoInit] Chart of Accounts seeded for all tenants.');

    // Ensure superadmin user is seeded for tenant 1
    const superadminRes = await client.query("SELECT id FROM users WHERE tenant_id = 1 AND username = 'superadmin'");
    if (superadminRes.rows.length === 0) {
      console.log('[AutoInit] Seeding missing superadmin user for Tenant 1...');
      const hash = await bcrypt.hash('superadmin123', 10);
      await client.query(
        `INSERT INTO users (tenant_id, username, email, password_hash, role)
         VALUES (1, 'superadmin', 'super@supermarket.com', $1, 'super_admin')`,
        [hash]
      );
      console.log('[AutoInit] superadmin user seeded successfully.');
    }

    // 6. Check if database is empty (no users seeded for tenant 1)
    const userCountRes = await client.query('SELECT COUNT(*)::integer FROM users WHERE tenant_id = 1');
    const userCount = userCountRes.rows[0].count;

    if (userCount === 0) {
      console.log('[AutoInit] Seeding default store records for Tenant 1...');

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
          `INSERT INTO categories (tenant_id, name, description)
           VALUES (1, $1, $2)
           ON CONFLICT (tenant_id, name) DO UPDATE SET description=$2
           RETURNING id`,
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
          `INSERT INTO suppliers (tenant_id, name, contact_name, email, phone, address)
           VALUES (1, $1, $2, $3, $4, $5)
           RETURNING id`,
          [sup.name, sup.contact_name, sup.email, sup.phone, sup.address]
        );
        supIds.push(res.rows[0].id);
      }

      // Users (including super admin default account)
      const users = [
        { username: 'admin', email: 'admin@supermarket.com', password: 'admin123', role: 'admin' },
        { username: 'manager1', email: 'manager@supermarket.com', password: 'manager123', role: 'manager' },
        { username: 'cashier1', email: 'cashier1@supermarket.com', password: 'cashier123', role: 'cashier' },
        { username: 'cashier2', email: 'cashier2@supermarket.com', password: 'cashier123', role: 'cashier' },
        { username: 'stockclerk1', email: 'stock@supermarket.com', password: 'stock123', role: 'stock_clerk' },
        { username: 'superadmin', email: 'super@supermarket.com', password: 'superadmin123', role: 'super_admin' },
      ];

      for (const user of users) {
        const hash = await bcrypt.hash(user.password, 10);
        await client.query(
          `INSERT INTO users (tenant_id, username, email, password_hash, role)
           VALUES (1, $1, $2, $3, $4)
           ON CONFLICT (tenant_id, username) DO NOTHING`,
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
          `INSERT INTO products (tenant_id, name, sku, barcode, category_id, unit_price, cost_price, quantity_on_hand, reorder_threshold, supplier_id, expiry_date)
           VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (tenant_id, sku) DO NOTHING`,
          [p.name, p.sku, p.barcode, catIds[p.cat], p.price, p.cost, p.qty, p.reorder, supIds[p.sup], p.expiry || null]
        );
      }

      console.log('[AutoInit] Default database seeding completed.');
    }

    // 7. Backfill Historical Transactions (Idempotent)
    console.log('[AutoInit] Checking historical transactions to backfill journals...');

    // A. Sales backfill
    const sales = await client.query(`SELECT * FROM sales`);
    let salesCount = 0;
    for (const sale of sales.rows) {
      const ref = `sale:${sale.id}`;
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1 AND tenant_id = $2`, [ref, sale.tenant_id]);
      if (existing.rows.length > 0) continue;

      const items = await client.query(`SELECT * FROM sale_items WHERE sale_id = $1`, [sale.id]);
      let totalCogs = 0;
      for (const item of items.rows) {
        totalCogs += Number(item.quantity) * Number(item.cost_price);
      }

      await client.query('BEGIN');
      try {
        const jeRes = await client.query(
          `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [sale.tenant_id, sale.sale_date || sale.created_at, `Automated entry for Sale #${sale.id}`, ref, sale.cashier_id]
        );
        const jeId = jeRes.rows[0].id;

        const totalAmount = Number(sale.total_amount);
        const taxAmount = Number(sale.tax_amount);
        const discountAmount = Number(sale.discount_amount);
        const revenueAmount = totalAmount - taxAmount + discountAmount;

        // Cash / Bank
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [jeId, accountMap.get(`${sale.tenant_id}:1010`), totalAmount]
        );
        // Sales Discounts
        if (discountAmount > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get(`${sale.tenant_id}:5040`), discountAmount]
          );
        }
        // COGS
        if (totalCogs > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get(`${sale.tenant_id}:5010`), totalCogs]
          );
        }

        // Sales Revenue
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [jeId, accountMap.get(`${sale.tenant_id}:4010`), revenueAmount]
        );
        // Sales Tax Payable
        if (taxAmount > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get(`${sale.tenant_id}:2020`), taxAmount]
          );
        }
        // Inventory
        if (totalCogs > 0) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get(`${sale.tenant_id}:1030`), totalCogs]
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

    // B. Purchase Orders backfill
    const pos = await client.query(`SELECT * FROM purchase_orders WHERE status = 'received'`);
    let posCount = 0;
    for (const po of pos.rows) {
      const ref = `po:${po.id}`;
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1 AND tenant_id = $2`, [ref, po.tenant_id]);
      if (existing.rows.length > 0) continue;

      await client.query('BEGIN');
      try {
        const jeRes = await client.query(
          `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [po.tenant_id, po.received_date || po.updated_at || po.created_at, `Automated entry for Purchase Order #${po.id} Received`, ref, po.created_by]
        );
        const jeId = jeRes.rows[0].id;
        const totalAmount = Number(po.total_amount);

        // Debit Inventory
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [jeId, accountMap.get(`${po.tenant_id}:1030`), totalAmount]
        );

        // Credit Accounts Payable
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [jeId, accountMap.get(`${po.tenant_id}:2010`), totalAmount]
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

    // C. Stock Adjustments backfill
    const adjustments = await client.query(`SELECT * FROM stock_adjustments WHERE adjustment_type != 'sale'`);
    let adjCount = 0;
    for (const sa of adjustments.rows) {
      const ref = `adjustment:${sa.id}`;
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1 AND tenant_id = $2`, [ref, sa.tenant_id]);
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
          `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [sa.tenant_id, sa.created_at, `Automated entry for Stock Adjustment #${sa.id} (${sa.adjustment_type})`, ref, sa.user_id]
        );
        const jeId = jeRes.rows[0].id;

        if (qtyChanged < 0) {
          // Reduction: Debit Stock Adjustment Loss, Credit Inventory
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get(`${sa.tenant_id}:5020`), valueChange]
          );
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get(`${sa.tenant_id}:1030`), valueChange]
          );
        } else {
          // Addition: Debit Inventory, Credit Owner Equity or Other Revenue
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accountMap.get(`${sa.tenant_id}:1030`), valueChange]
          );

          const creditAccount = sa.adjustment_type === 'receiving' ? '3010' : '4020';
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accountMap.get(`${sa.tenant_id}:${creditAccount}`), valueChange]
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

    console.log('[AutoInit] Database multi-tenancy and data initialization completed successfully.');
  } catch (err) {
    console.error('[AutoInit] Initialization error:', err);
  } finally {
    if (client) {
      client.release();
    }
  }
};
