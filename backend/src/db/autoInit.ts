import { pool } from '../config/database';
import bcrypt from 'bcryptjs';

export const autoInitDatabase = async () => {
  const client = await pool.connect();
  try {
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

    console.log('[AutoInit] Tables and indexes checked/created.');

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
    client.release();
  }
};
