import { pool } from '../config/database';

const verifyLedgers = async () => {
  const client = await pool.connect();
  try {
    console.log('--- STARTING FINANCIAL LEDGER AUDIT & VERIFICATION ---');

    // 1. Chart of Accounts Check
    console.log('\nChecking Chart of Accounts balances...');
    const accountsRes = await client.query(`
      SELECT
        fa.code,
        fa.name,
        fa.type,
        COALESCE(SUM(ji.debit), 0)::NUMERIC as total_debits,
        COALESCE(SUM(ji.credit), 0)::NUMERIC as total_credits,
        CASE
          WHEN fa.type IN ('asset', 'expense') THEN COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0)
          ELSE COALESCE(SUM(ji.credit), 0) - COALESCE(SUM(ji.debit), 0)
        END::NUMERIC as balance
      FROM financial_accounts fa
      LEFT JOIN journal_items ji ON fa.id = ji.account_id
      GROUP BY fa.id
      ORDER BY fa.code ASC
    `);

    for (const acc of accountsRes.rows) {
      console.log(`  Account ${acc.code} [${acc.type}] - ${acc.name}: Balance = ${acc.balance} (D: ${acc.total_debits}, C: ${acc.total_credits})`);
    }

    // 2. Trial Balance Validation
    console.log('\nValidating Trial Balance (Total Debits vs Total Credits)...');
    const tbRes = await client.query(`
      SELECT
        COALESCE(SUM(debit), 0)::NUMERIC as total_debits,
        COALESCE(SUM(credit), 0)::NUMERIC as total_credits
      FROM journal_items
    `);
    const totalDebits = Number(tbRes.rows[0].total_debits);
    const totalCredits = Number(tbRes.rows[0].total_credits);
    console.log(`  Total Debits in System:  ${totalDebits}`);
    console.log(`  Total Credits in System: ${totalCredits}`);
    if (Math.abs(totalDebits - totalCredits) < 0.05) {
      console.log('  ✅ SUCCESS: System journal debits and credits match perfectly!');
    } else {
      console.error(`  ❌ ERROR: System is out of balance by ${Math.abs(totalDebits - totalCredits)}!`);
    }

    // 3. Balance Sheet Verification (Assets = Liabilities + Equity)
    console.log('\nVerifying Balance Sheet Equation (Assets = Liabilities + Equity)...');
    // Get cumulative balances of Assets, Liabilities, and Equity
    const balanceSheetRes = await client.query(`
      SELECT
        fa.type,
        SUM(
          CASE
            WHEN fa.type = 'asset' THEN ji.debit - ji.credit
            WHEN fa.type IN ('liability', 'equity') THEN ji.credit - ji.debit
            ELSE 0
          END
        )::NUMERIC as balance
      FROM financial_accounts fa
      JOIN journal_items ji ON fa.id = ji.account_id
      WHERE fa.type IN ('asset', 'liability', 'equity')
      GROUP BY fa.type
    `);

    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    for (const row of balanceSheetRes.rows) {
      if (row.type === 'asset') assets = Number(row.balance);
      if (row.type === 'liability') liabilities = Number(row.balance);
      if (row.type === 'equity') equity = Number(row.balance);
    }

    // Include Net Income from revenue & expenses up to date
    const netIncomeRes = await client.query(`
      SELECT
        COALESCE(
          SUM(
            CASE 
              WHEN fa.type = 'revenue' THEN ji.credit - ji.debit
              WHEN fa.type = 'expense' THEN -(ji.debit - ji.credit)
              ELSE 0 
            END
          ), 0
        )::NUMERIC as net_income
      FROM financial_accounts fa
      JOIN journal_items ji ON fa.id = ji.account_id
    `);
    const netIncome = Number(netIncomeRes.rows[0].net_income);

    const adjustedEquity = equity + netIncome;
    const lAndE = liabilities + adjustedEquity;

    console.log(`  Total Assets:                        ${assets}`);
    console.log(`  Total Liabilities:                   ${liabilities}`);
    console.log(`  Owner Equity (Before Income):        ${equity}`);
    console.log(`  Cumulative Net Income:               ${netIncome}`);
    console.log(`  Adjusted Equity (Including Income):  ${adjustedEquity}`);
    console.log(`  Total Liabilities & Equity (L+E):    ${lAndE}`);

    if (Math.abs(assets - lAndE) < 0.05) {
      console.log('  ✅ SUCCESS: Balance Sheet holds: Assets = Liabilities + Equity!');
    } else {
      console.error(`  ❌ ERROR: Balance Sheet does not hold! Difference: ${Math.abs(assets - lAndE)}`);
    }

    console.log('\n--- VERIFICATION COMPLETED ---');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

verifyLedgers().catch(console.error);
