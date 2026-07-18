import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const migrateFinancials = async () => {
  const client = await pool.connect();
  try {
    console.log('Running Financials database migrations...');

    // 1. Create Tables
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

    // Create indexes for financials
    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_items_entry ON journal_items(journal_entry_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_items_account ON journal_items(account_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_ref ON journal_entries(reference);`);

    console.log('✅ Financials tables and indexes created.');

    // 2. Seed Standard Accounts
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
    console.log('✅ Standard Chart of Accounts seeded.');

    // 3. Backfill Historical Transactions
    console.log('Backfilling historical journal entries...');

    // A. Backfill Sales
    const sales = await client.query(`SELECT * FROM sales`);
    let salesCount = 0;
    for (const sale of sales.rows) {
      const ref = `sale:${sale.id}`;
      // Check if entry already exists
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1`, [ref]);
      if (existing.rows.length > 0) continue;

      // Calculate COGS
      const items = await client.query(`SELECT * FROM sale_items WHERE sale_id = $1`, [sale.id]);
      let totalCogs = 0;
      for (const item of items.rows) {
        totalCogs += Number(item.quantity) * Number(item.cost_price);
      }

      // Start transaction for this sale backfill
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
        const revenueAmount = totalAmount - taxAmount + discountAmount; // Subtotal before tax and discount

        // Debits
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

        // Credits
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
        console.error(`Failed backfilling Sale #${sale.id}:`, err);
      }
    }
    console.log(`✅ Backfilled ${salesCount} sales.`);

    // B. Backfill Purchase Orders
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
        console.error(`Failed backfilling PO #${po.id}:`, err);
      }
    }
    console.log(`✅ Backfilled ${posCount} received purchase orders.`);

    // C. Backfill Stock Adjustments (excluding sales which are already backfilled by sales)
    const adjustments = await client.query(`SELECT * FROM stock_adjustments WHERE adjustment_type != 'sale'`);
    let adjCount = 0;
    for (const sa of adjustments.rows) {
      const ref = `adjustment:${sa.id}`;
      const existing = await client.query(`SELECT id FROM journal_entries WHERE reference = $1`, [ref]);
      if (existing.rows.length > 0) continue;

      // Get product cost price
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
          // Addition: Debit Inventory, Credit Owner Equity (for receiving) or Other Revenue
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
        console.error(`Failed backfilling Stock Adjustment #${sa.id}:`, err);
      }
    }
    console.log(`✅ Backfilled ${adjCount} stock adjustments.`);

    console.log('✅ Financials migration and backfill completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrateFinancials().catch((err) => {
  console.error(err);
  process.exit(1);
});
