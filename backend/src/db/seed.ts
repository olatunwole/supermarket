import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

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
    console.log('✅ Categories seeded');

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
    console.log('✅ Suppliers seeded');

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
    console.log('✅ Users seeded');

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
    console.log('✅ Products seeded');

    console.log('\n✅ Database seeding completed!');
    console.log('\nDefault login credentials:');
    console.log('  Admin:       admin / admin123');
    console.log('  Manager:     manager1 / manager123');
    console.log('  Cashier:     cashier1 / cashier123');
    console.log('  Stock Clerk: stockclerk1 / stock123');
  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch(() => process.exit(1));
