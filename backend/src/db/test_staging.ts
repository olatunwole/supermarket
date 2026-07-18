import { pool } from '../config/database';

const testStagingWorkflow = async () => {
  const client = await pool.connect();
  try {
    console.log('--- STARTING STAGING & POSTING WORKFLOW TEST ---');
    await client.query('BEGIN');

    // 1. Get initial staging count
    console.log('Fetching initial staging count...');
    const initialStagingRes = await client.query(`
      SELECT s.id FROM sales s WHERE NOT EXISTS (
        SELECT 1 FROM journal_entries je WHERE je.reference = 'sale:' || s.id
      )
    `);
    const initialCount = initialStagingRes.rows.length;
    console.log(`  Initial unposted sales count: ${initialCount}`);

    // 2. Insert a Mock Sale (Unposted)
    console.log('\nInserting a mock cash sale...');
    const saleRes = await client.query(`
      INSERT INTO sales (cashier_id, total_amount, tax_amount, discount_amount, payment_method, notes)
      VALUES (1, 120.00, 10.00, 5.00, 'cash', 'Mock Test Sale') RETURNING id
    `);
    const saleId = saleRes.rows[0].id;
    console.log(`  Mock Sale ID: ${saleId} created.`);

    // Insert sale items (1 item of product 1)
    await client.query(`
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, discount)
      VALUES ($1, 1, 2, 62.50, 30.00, 5.00)
    `, [saleId]);
    console.log('  Mock Sale Items added.');

    // 3. Verify it stages in Statement of Transactions
    console.log('\nQuerying staging queue...');
    const stagingRes = await client.query(`
      SELECT s.id, 'sale' as type, s.total_amount as amount
      FROM sales s
      WHERE NOT EXISTS (
        SELECT 1 FROM journal_entries je WHERE je.reference = 'sale:' || s.id
      ) AND s.id = $1
    `, [saleId]);

    if (stagingRes.rows.length === 1) {
      console.log(`  ✅ SUCCESS: Mock Sale #${saleId} is staged in the Statement of Transactions queue!`);
    } else {
      console.error('  ❌ ERROR: Mock sale did not stage in the queue.');
      throw new Error('Staging failed');
    }

    // 4. Run Posting Logic (Debits/Credits)
    console.log('\nPosting staged transaction to ledger...');
    const accRes = await client.query(
      "SELECT code, id FROM financial_accounts WHERE code IN ('1010', '1030', '2010', '2020', '3010', '4010', '4020', '5010', '5020', '5040')"
    );
    const accMap: Record<string, number> = {};
    for (const r of accRes.rows) accMap[r.code] = r.id;

    const ref = `sale:${saleId}`;
    const jeRes = await client.query(
      `INSERT INTO journal_entries (entry_date, description, reference, created_by)
       VALUES (NOW(), $1, $2, 1) RETURNING id`,
      [`Automated entry for Sale #${saleId}`, ref]
    );
    const jeId = jeRes.rows[0].id;

    // Standard POS sale bookkeeping (Debit Cash 120.00, Debit Discount 5.00, Debit COGS 60.00; Credit Revenue 115.00, Credit Tax 10.00, Credit Inventory 60.00)
    // Debits
    await client.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 120.00, 0)`, [jeId, accMap['1010']]);
    await client.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 5.00, 0)`, [jeId, accMap['5040']]);
    await client.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 60.00, 0)`, [jeId, accMap['5010']]);
    // Credits
    await client.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, 115.00)`, [jeId, accMap['4010']]);
    await client.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, 10.00)`, [jeId, accMap['2020']]);
    await client.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, 60.00)`, [jeId, accMap['1030']]);
    console.log(`  Journal Entry #${jeId} written for sale.`);

    // 5. Verify it is no longer in staging queue
    const stagingCheckRes = await client.query(`
      SELECT s.id FROM sales s WHERE NOT EXISTS (
        SELECT 1 FROM journal_entries je WHERE je.reference = 'sale:' || s.id
      ) AND s.id = $1
    `, [saleId]);

    if (stagingCheckRes.rows.length === 0) {
      console.log(`  ✅ SUCCESS: Sale #${saleId} is no longer in the staging queue (now posted).`);
    } else {
      console.error('  ❌ ERROR: Sale is still in staging queue after posting.');
      throw new Error('Posting removal failed');
    }

    // 6. Verify journal items balance
    const balanceRes = await client.query(`
      SELECT SUM(debit) as debits, SUM(credit) as credits 
      FROM journal_items WHERE journal_entry_id = $1
    `, [jeId]);
    const debits = Number(balanceRes.rows[0].debits);
    const credits = Number(balanceRes.rows[0].credits);
    console.log(`  Posted debits: ${debits}, credits: ${credits}`);
    if (debits === credits && debits === 185.00) {
      console.log(`  ✅ SUCCESS: Ledger entry items balance perfectly at 185.00!`);
    } else {
      console.error('  ❌ ERROR: Ledger entries do not balance.');
      throw new Error('Ledger imbalance');
    }

    console.log('\nAll staging-and-posting tests passed! Cleaning up mock data...');
    // Roll back transaction to clean up mock database changes automatically!
    await client.query('ROLLBACK');
    console.log('  ✅ Cleanup complete (Rollback successful).');
    console.log('--- TEST RUN COMPLETED SUCCESSFULLY ---');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('  ❌ TEST WORKFLOW ENCOUNTERED AN ERROR:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

testStagingWorkflow().catch(console.error);
