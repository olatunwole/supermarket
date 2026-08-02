import { Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLog';

// --- CHART OF ACCOUNTS (COA) ---

export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const sql = `
      SELECT
        fa.id,
        fa.code,
        fa.name,
        fa.type,
        fa.is_system,
        COALESCE(SUM(ji.debit), 0)::NUMERIC as total_debits,
        COALESCE(SUM(ji.credit), 0)::NUMERIC as total_credits,
        CASE
          WHEN fa.type IN ('asset', 'expense') THEN COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0)
          ELSE COALESCE(SUM(ji.credit), 0) - COALESCE(SUM(ji.debit), 0)
        END::NUMERIC as balance
      FROM financial_accounts fa
      LEFT JOIN journal_items ji ON fa.id = ji.account_id
      WHERE fa.tenant_id = $1
      GROUP BY fa.id
      ORDER BY fa.code ASC
    `;
    const result = await query(sql, [tenantId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { code, name, type } = req.body;
  if (!code || !name || !type) {
    res.status(400).json({ error: 'code, name and type are required' });
    return;
  }
  if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type)) {
    res.status(400).json({ error: 'type must be asset, liability, equity, revenue or expense' });
    return;
  }

  try {
    // Check if code exists
    const codeCheck = await query('SELECT id FROM financial_accounts WHERE code = $1 AND tenant_id = $2', [code, tenantId]);
    if (codeCheck.rows.length > 0) {
      res.status(400).json({ error: `Account code ${code} is already in use` });
      return;
    }

    const result = await query(
      `INSERT INTO financial_accounts (tenant_id, code, name, type, is_system) VALUES ($1, $2, $3, $4, false) RETURNING *`,
      [tenantId, code, name, type]
    );
    await logAudit(req, 'CREATE_ACCOUNT', `Created account ${code} - ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { name, type } = req.body;

  try {
    const acc = await query('SELECT * FROM financial_accounts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (acc.rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (acc.rows[0].is_system) {
      res.status(403).json({ error: 'System accounts cannot be modified' });
      return;
    }

    const result = await query(
      `UPDATE financial_accounts SET name = COALESCE($1, name), type = COALESCE($2, type), updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [name, type, id, tenantId]
    );

    await logAudit(req, 'UPDATE_ACCOUNT', `Updated account ID ${id}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;

  try {
    const acc = await query('SELECT * FROM financial_accounts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (acc.rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (acc.rows[0].is_system) {
      res.status(403).json({ error: 'System accounts cannot be deleted' });
      return;
    }

    // Check if account has journal entries
    const entriesCheck = await query(
      'SELECT ji.id FROM journal_items ji JOIN journal_entries je ON ji.journal_entry_id = je.id WHERE ji.account_id = $1 AND je.tenant_id = $2 LIMIT 1',
      [id, tenantId]
    );
    if (entriesCheck.rows.length > 0) {
      res.status(409).json({ error: 'Cannot delete account with existing transaction history. Clear transactions or keep it inactive.' });
      return;
    }

    await query('DELETE FROM financial_accounts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    await logAudit(req, 'DELETE_ACCOUNT', `Deleted account ID ${id} (${acc.rows[0].code})`);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- JOURNAL ENTRIES ---

export const getJournalEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const sql = `
      SELECT
        je.id,
        je.entry_date,
        je.description,
        je.reference,
        je.created_by,
        u.username as created_by_username,
        json_agg(
          json_build_object(
            'id', ji.id,
            'account_id', ji.account_id,
            'account_code', fa.code,
            'account_name', fa.name,
            'account_type', fa.type,
            'debit', ji.debit::NUMERIC,
            'credit', ji.credit::NUMERIC
          ) ORDER BY ji.debit DESC, fa.code ASC
        ) as items
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      LEFT JOIN journal_items ji ON je.id = ji.journal_entry_id
      LEFT JOIN financial_accounts fa ON ji.account_id = fa.id
      WHERE je.tenant_id = $1
      GROUP BY je.id, u.username
      ORDER BY je.entry_date DESC, je.id DESC
      LIMIT 200
    `;
    const result = await query(sql, [tenantId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createJournalEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { entry_date, description, reference, items } = req.body;

  if (!description || !items || !Array.isArray(items) || items.length < 2) {
    res.status(400).json({ error: 'description and at least two journal items are required' });
    return;
  }

  // Validate items and balance
  let totalDebits = 0;
  let totalCredits = 0;

  for (const item of items) {
    const debit = Number(item.debit || 0);
    const credit = Number(item.credit || 0);
    if (!item.account_id) {
      res.status(400).json({ error: 'Each item must specify an account_id' });
      return;
    }
    if (debit < 0 || credit < 0) {
      res.status(400).json({ error: 'Debit and credit values must be non-negative' });
      return;
    }
    if (debit > 0 && credit > 0) {
      res.status(400).json({ error: 'An item cannot have both a debit and a credit value' });
      return;
    }
    if (debit === 0 && credit === 0) {
      res.status(400).json({ error: 'Each item must have either a debit or a credit value greater than zero' });
      return;
    }
    totalDebits += debit;
    totalCredits += credit;
  }

  // Precision check for floating point mismatch
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    res.status(400).json({ error: `Journal entry is not balanced. Total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)}).` });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const entryDate = entry_date ? new Date(entry_date) : new Date();
    const ref = reference || 'manual';

    // Validate date against closed periods
    const closedCheck = await client.query(
      `SELECT period_name FROM closed_periods 
       WHERE tenant_id = $2 AND $1 BETWEEN start_date AND end_date`,
      [entryDate, tenantId]
    );
    if (closedCheck.rows.length > 0) {
      res.status(400).json({ error: `Cannot post journal entry: The transaction date falls within a closed financial period (${closedCheck.rows[0].period_name}).` });
      return;
    }

    const jeRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, entryDate, description, ref, req.user?.id]
    );
    const jeId = jeRes.rows[0].id;

    for (const item of items) {
      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);
      await client.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [jeId, item.account_id, debit, credit]
      );
    }

    await client.query('COMMIT');
    await logAudit(req, 'CREATE_JOURNAL_ENTRY', `Posted journal entry #${jeId}: ${description}`);
    res.status(201).json({ id: jeId, entry_date: entryDate, description, reference: ref, items });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// --- REPORT ENDPOINTS ---

export const getTrialBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { from, to } = req.query;
  const fromDate = from ? new Date(from as string) : new Date('2020-01-01');
  const toDate = to ? new Date(to as string) : new Date();

  try {
    // Return standard trial balance showing accumulative sums
    // For trial balance, we calculate the net debit/credit balance of each account
    const sql = `
      SELECT
        fa.id,
        fa.code,
        fa.name,
        fa.type,
        CASE 
          WHEN fa.type IN ('asset', 'expense') THEN 
            CASE WHEN (COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0)) > 0 
                 THEN (COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0))
                 ELSE 0 END
          ELSE 
            CASE WHEN (COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0)) > 0
                 THEN (COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0))
                 ELSE 0 END
        END::NUMERIC as debit_balance,
        CASE 
          WHEN fa.type IN ('liability', 'equity', 'revenue') THEN 
            CASE WHEN (COALESCE(SUM(ji.credit), 0) - COALESCE(SUM(ji.debit), 0)) > 0 
                 THEN (COALESCE(SUM(ji.credit), 0) - COALESCE(SUM(ji.debit), 0))
                 ELSE 0 END
          ELSE 
            CASE WHEN (COALESCE(SUM(ji.credit), 0) - COALESCE(SUM(ji.debit), 0)) > 0
                 THEN (COALESCE(SUM(ji.credit), 0) - COALESCE(SUM(ji.debit), 0))
                 ELSE 0 END
        END::NUMERIC as credit_balance
      FROM financial_accounts fa
      LEFT JOIN journal_items ji ON fa.id = ji.account_id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE fa.tenant_id = $3 AND (je.entry_date IS NULL OR (je.entry_date >= $1 AND je.entry_date <= $2))
      GROUP BY fa.id
      ORDER BY fa.code ASC
    `;
    const result = await query(sql, [fromDate, toDate, tenantId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getStatementOfOperations = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { from, to } = req.query;
  const fromDate = from ? new Date(from as string) : new Date('2020-01-01');
  const toDate = to ? new Date(to as string) : new Date();

  try {
    const sql = `
      SELECT
        fa.code,
        fa.name,
        fa.type,
        CASE
          WHEN fa.type = 'revenue' THEN COALESCE(SUM(ji.credit), 0) - COALESCE(SUM(ji.debit), 0)
          ELSE COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0)
        END::NUMERIC as balance
      FROM financial_accounts fa
      JOIN journal_items ji ON fa.id = ji.account_id
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE fa.tenant_id = $3 AND fa.type IN ('revenue', 'expense') AND je.entry_date >= $1 AND je.entry_date <= $2
      GROUP BY fa.id
      ORDER BY fa.code ASC
    `;
    const result = await query(sql, [fromDate, toDate, tenantId]);
    
    // Structure the income statement data
    const revenues = result.rows.filter(r => r.type === 'revenue');
    const expenses = result.rows.filter(r => r.type === 'expense');

    const totalRevenue = revenues.reduce((sum, r) => sum + Number(r.balance), 0);
    
    // Find Cost of Goods Sold specifically (usually code 5010)
    const cogsItem = expenses.find(e => e.code === '5010');
    const cogs = cogsItem ? Number(cogsItem.balance) : 0;
    
    const grossProfit = totalRevenue - cogs;
    
    const operatingExpenses = expenses.filter(e => e.code !== '5010');
    const totalOperatingExpenses = operatingExpenses.reduce((sum, e) => sum + Number(e.balance), 0);
    
    const netIncome = grossProfit - totalOperatingExpenses;

    res.json({
      period: { from: fromDate, to: toDate },
      revenues,
      totalRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      totalOperatingExpenses,
      netIncome
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getStatementOfFinancialPosition = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { to } = req.query;
  const toDate = to ? new Date(to as string) : new Date();

  try {
    // 1. Get balances of Assets, Liabilities, and Equity accounts up to date 'to'
    const sql = `
      SELECT
        fa.id,
        fa.code,
        fa.name,
        fa.type,
        CASE
          WHEN fa.type = 'asset' THEN COALESCE(SUM(ji.debit - ji.credit), 0)
          ELSE COALESCE(SUM(ji.credit - ji.debit), 0)
        END::NUMERIC as balance
      FROM financial_accounts fa
      LEFT JOIN journal_items ji ON fa.id = ji.account_id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE fa.tenant_id = $2 AND fa.type IN ('asset', 'liability', 'equity') AND (je.entry_date IS NULL OR je.entry_date <= $1)
      GROUP BY fa.id
      ORDER BY fa.code ASC
    `;
    const result = await query(sql, [toDate, tenantId]);

    // 2. Compute Net Income up to date 'to' to dynamically add to Retained Earnings
    // Net Income = (Revenue Credit - Debit) - (Expense Debit - Credit)
    const netIncomeSql = `
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
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE fa.tenant_id = $2 AND fa.type IN ('revenue', 'expense') AND je.entry_date <= $1
    `;
    const netIncomeRes = await query(netIncomeSql, [toDate, tenantId]);
    const cumulativeNetIncome = Number(netIncomeRes.rows[0].net_income || 0);

    const assets = result.rows.filter(r => r.type === 'asset');
    const liabilities = result.rows.filter(r => r.type === 'liability');
    const equityList = result.rows.filter(r => r.type === 'equity');

    const totalAssets = assets.reduce((sum, r) => sum + Number(r.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, r) => sum + Number(r.balance), 0);
    
    // Add cumulative net income to retained earnings dynamically
    // Look for system Retained Earnings (3020)
    let reFound = false;
    const equity = equityList.map(eq => {
      if (eq.code === '3020') {
        reFound = true;
        return {
          ...eq,
          balance: Number(eq.balance) + cumulativeNetIncome
        };
      }
      return { ...eq, balance: Number(eq.balance) };
    });

    if (!reFound) {
      equity.push({
        id: 0,
        code: '3020',
        name: 'Retained Earnings (Adjusted)',
        type: 'equity',
        balance: cumulativeNetIncome
      });
    }

    const totalEquity = equity.reduce((sum, r) => sum + Number(r.balance), 0);

    res.json({
      asOfDate: toDate,
      assets,
      totalAssets,
      liabilities,
      totalLiabilities,
      equity,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getStatementOfCashflow = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { from, to } = req.query;
  const fromDate = from ? new Date(from as string) : new Date('2020-01-01');
  const toDate = to ? new Date(to as string) : new Date();

  try {
    // Direct Cash Flow calculation: inspect entries affecting Cash Account (1010)
    // and categorize them based on the offset accounts in the same journal entry.
    // First, find Cash Account ID
    const cashAccRes = await query("SELECT id FROM financial_accounts WHERE code = '1010' AND tenant_id = $1", [tenantId]);
    if (cashAccRes.rows.length === 0) {
      res.status(404).json({ error: 'Cash account not found' });
      return;
    }
    const cashAccountId = cashAccRes.rows[0].id;

    // Fetch all journal items of Cash account for the date range
    const cashItemsSql = `
      SELECT
        ji.journal_entry_id,
        ji.debit::NUMERIC as cash_debit,
        ji.credit::NUMERIC as cash_credit,
        je.entry_date,
        je.description,
        je.reference
      FROM journal_items ji
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE ji.account_id = $1 AND je.entry_date >= $2 AND je.entry_date <= $3 AND je.tenant_id = $4
    `;
    const cashItemsRes = await query(cashItemsSql, [cashAccountId, fromDate, toDate, tenantId]);

    let cashFromSales = 0;
    let cashPaidToSuppliers = 0;
    let cashPaidForExpenses = 0;
    let cashFromEquity = 0;
    let otherInflows = 0;
    let otherOutflows = 0;

    // For each cash transaction, analyze the offset entries
    for (const item of cashItemsRes.rows) {
      const entryId = item.journal_entry_id;
      const isDebit = Number(item.cash_debit) > 0;
      const cashAmount = isDebit ? Number(item.cash_debit) : Number(item.cash_credit);

      // Fetch other items in the same journal entry
      const offsets = await query(
        `SELECT ji.*, fa.code, fa.type, fa.name 
         FROM journal_items ji 
         JOIN financial_accounts fa ON ji.account_id = fa.id
         WHERE ji.journal_entry_id = $1 AND ji.account_id != $2 AND fa.tenant_id = $3`,
        [entryId, cashAccountId, tenantId]
      );

      // Categorize based on offsets
      if (isDebit) {
        // Inflow
        const hasRevenueOffset = offsets.rows.some(o => o.type === 'revenue' || o.code === '4010');
        const hasArOffset = offsets.rows.some(o => o.code === '1020');
        const hasEquityOffset = offsets.rows.some(o => o.type === 'equity' || o.code === '3010');

        if (hasRevenueOffset || hasArOffset) {
          cashFromSales += cashAmount;
        } else if (hasEquityOffset) {
          cashFromEquity += cashAmount;
        } else {
          otherInflows += cashAmount;
        }
      } else {
        // Outflow
        const hasApOffset = offsets.rows.some(o => o.code === '2010');
        const hasInventoryOffset = offsets.rows.some(o => o.code === '1030');
        const hasExpenseOffset = offsets.rows.some(o => o.type === 'expense');

        if (hasApOffset || hasInventoryOffset) {
          cashPaidToSuppliers += cashAmount;
        } else if (hasExpenseOffset) {
          cashPaidForExpenses += cashAmount;
        } else {
          otherOutflows += cashAmount;
        }
      }
    }

    const netOperatingCash = (cashFromSales + otherInflows) - (cashPaidToSuppliers + cashPaidForExpenses + otherOutflows);
    const netCashFlow = netOperatingCash + cashFromEquity;

    res.json({
      period: { from: fromDate, to: toDate },
      cashInflows: {
        fromSales: cashFromSales,
        fromEquity: cashFromEquity,
        otherInflows,
        totalInflows: cashFromSales + cashFromEquity + otherInflows
      },
      cashOutflows: {
        paidToSuppliers: cashPaidToSuppliers,
        paidForExpenses: cashPaidForExpenses,
        otherOutflows,
        totalOutflows: cashPaidToSuppliers + cashPaidForExpenses + otherOutflows
      },
      netOperatingCash,
      netCashFlow
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get a single account's ledger transaction line details
export const getAccountLedger = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { from, to } = req.query;
  const fromDate = from ? new Date(from as string) : new Date('2020-01-01');
  const toDate = to ? new Date(to as string) : new Date();

  try {
    const accountCheck = await query('SELECT * FROM financial_accounts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (accountCheck.rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const account = accountCheck.rows[0];

    // Get lines
    const sql = `
      SELECT
        ji.id as item_id,
        ji.debit::NUMERIC,
        ji.credit::NUMERIC,
        je.id as entry_id,
        je.entry_date,
        je.description,
        je.reference
      FROM journal_items ji
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE ji.account_id = $1 AND je.entry_date >= $2 AND je.entry_date <= $3 AND je.tenant_id = $4
      ORDER BY je.entry_date ASC, je.id ASC
    `;
    const result = await query(sql, [id, fromDate, toDate, tenantId]);

    // Calculate running balance
    let runningBalance = 0;
    const lines = result.rows.map(line => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (account.type === 'asset' || account.type === 'expense') {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }
      return {
        ...line,
        debit,
        credit,
        running_balance: runningBalance
      };
    });

    res.json({
      account,
      period: { from: fromDate, to: toDate },
      lines
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- STAGING TRANSACTIONS QUEUE ---

export const getStagingTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    // 1. Get Unposted Sales
    const salesSql = `
      SELECT s.id, s.sale_date as date, s.total_amount as amount, 
             'sale' as type, 
             'Sale #' || s.id || ' via ' || s.payment_method || ' (' || u.username || ')' as description,
             'sale:' || s.id as reference
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.tenant_id = $1 AND NOT EXISTS (
        SELECT 1 FROM journal_entries je WHERE je.reference = 'sale:' || s.id AND je.tenant_id = $1
      ) AND NOT EXISTS (
        SELECT 1 FROM rejected_transactions rt WHERE rt.reference = 'sale:' || s.id AND rt.tenant_id = $1
      )
    `;
    const salesRes = await query(salesSql, [tenantId]);

    // 2. Get Unposted Purchase Orders (Received status)
    const posSql = `
      SELECT po.id, po.received_date as date, po.total_amount as amount, 
             'purchase' as type, 
             'Purchase PO #' || po.id || ' from ' || sup.name as description,
             'po:' || po.id as reference
      FROM purchase_orders po
      LEFT JOIN suppliers sup ON po.supplier_id = sup.id
      WHERE po.tenant_id = $1 AND po.status = 'received' AND NOT EXISTS (
        SELECT 1 FROM journal_entries je WHERE je.reference = 'po:' || po.id AND je.tenant_id = $1
      ) AND NOT EXISTS (
        SELECT 1 FROM rejected_transactions rt WHERE rt.reference = 'po:' || po.id AND rt.tenant_id = $1
      )
    `;
    const posRes = await query(posSql, [tenantId]);

    // 3. Get Unposted Stock Adjustments (excluding sale adjustments which are posted via Sales)
    const adjsSql = `
      SELECT sa.id, sa.created_at as date, 
             (ABS(sa.quantity_changed) * p.cost_price)::NUMERIC as amount,
             'adjustment' as type,
             'Stock Adjustment #' || sa.id || ' (' || sa.adjustment_type || ') for ' || p.name || ' (' || u.username || ')' as description,
             'adjustment:' || sa.id as reference
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE sa.tenant_id = $1 AND sa.adjustment_type != 'sale' AND NOT EXISTS (
        SELECT 1 FROM journal_entries je WHERE je.reference = 'adjustment:' || sa.id AND je.tenant_id = $1
      ) AND NOT EXISTS (
        SELECT 1 FROM rejected_transactions rt WHERE rt.reference = 'adjustment:' || sa.id AND rt.tenant_id = $1
      )
    `;
    const adjsRes = await query(adjsSql, [tenantId]);

    // Combine all and sort by date descending
    const allStaging = [
      ...salesRes.rows.map(r => ({ ...r, amount: Number(r.amount) })),
      ...posRes.rows.map(r => ({ ...r, amount: Number(r.amount) })),
      ...adjsRes.rows.map(r => ({ ...r, amount: Number(r.amount) }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(allStaging);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- BATCH POST STAGED TRANSACTIONS ---

export const postTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { transactions } = req.body; // Array of { type: 'sale'|'purchase'|'adjustment', id: number }

  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    res.status(400).json({ error: 'transactions array is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch accounts map
    const accRes = await client.query(
      "SELECT code, id FROM financial_accounts WHERE tenant_id = $1 AND code IN ('1010', '1030', '2010', '2020', '3010', '4010', '4020', '5010', '5020', '5040')",
      [tenantId]
    );
    const accMap: Record<string, number> = {};
    for (const r of accRes.rows) accMap[r.code] = r.id;

    let postedCount = 0;

    for (const tx of transactions) {
      const { type, id } = tx;

      if (type === 'sale') {
        const ref = `sale:${id}`;
        // Check if already posted
        const check = await client.query('SELECT id FROM journal_entries WHERE reference = $1 AND tenant_id = $2', [ref, tenantId]);
        if (check.rows.length > 0) continue;

        // Fetch Sale
        const saleRes = await client.query('SELECT * FROM sales WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (saleRes.rows.length === 0) continue;
        const sale = saleRes.rows[0];

        // Validate closed period
        const txDate = sale.sale_date || sale.created_at;
        const closedCheck = await client.query('SELECT period_name FROM closed_periods WHERE tenant_id = $1 AND $2 BETWEEN start_date AND end_date', [tenantId, txDate]);
        if (closedCheck.rows.length > 0) {
          throw new Error(`Cannot post: Sale date falls within closed period ${closedCheck.rows[0].period_name}`);
        }

        // Fetch Sale Items
        const itemsRes = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);
        let totalCogs = 0;
        for (const item of itemsRes.rows) {
          totalCogs += Number(item.quantity) * Number(item.cost_price);
        }

        const totalAmount = Number(sale.total_amount);
        const taxAmount = Number(sale.tax_amount);
        const discountAmt = Number(sale.discount_amount);
        const revenueAmt = totalAmount - taxAmount + discountAmt;

        // Create Journal Entry
        const jeRes = await client.query(
          `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [tenantId, sale.sale_date || sale.created_at, `Automated entry for Sale #${sale.id}`, ref, req.user?.id]
        );
        const jeId = jeRes.rows[0].id;

        // Debits
        // Cash / Bank
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [jeId, accMap['1010'], totalAmount]
        );
        // Sales Discounts
        if (discountAmt > 0 && accMap['5040']) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accMap['5040'], discountAmt]
          );
        }
        // COGS
        if (totalCogs > 0 && accMap['5010']) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accMap['5010'], totalCogs]
          );
        }

        // Credits
        // Sales Revenue
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [jeId, accMap['4010'], revenueAmt]
        );
        // Sales Tax
        if (taxAmount > 0 && accMap['2020']) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accMap['2020'], taxAmount]
          );
        }
        // Inventory
        if (totalCogs > 0 && accMap['1030']) {
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accMap['1030'], totalCogs]
          );
        }
        postedCount++;

      } else if (type === 'purchase') {
        const ref = `po:${id}`;
        // Check if already posted
        const check = await client.query('SELECT id FROM journal_entries WHERE reference = $1', [ref]);
        if (check.rows.length > 0) continue;

        // Fetch PO
        const poRes = await client.query("SELECT * FROM purchase_orders WHERE id = $1 AND status = 'received' AND tenant_id = $2", [id, tenantId]);
        if (poRes.rows.length === 0) continue;
        const po = poRes.rows[0];

        // Validate closed period
        const txDate = po.received_date || po.updated_at || po.created_at;
        const closedCheck = await client.query('SELECT period_name FROM closed_periods WHERE tenant_id = $1 AND $2 BETWEEN start_date AND end_date', [tenantId, txDate]);
        if (closedCheck.rows.length > 0) {
          throw new Error(`Cannot post: PO date falls within closed period ${closedCheck.rows[0].period_name}`);
        }

        // Create Journal Entry
        const jeRes = await client.query(
          `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [tenantId, po.received_date || po.updated_at || po.created_at, `Automated entry for Purchase Order #${po.id} Received`, ref, req.user?.id]
        );
        const jeId = jeRes.rows[0].id;
        const totalAmount = Number(po.total_amount);

        // Debit Inventory
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [jeId, accMap['1030'], totalAmount]
        );
        // Credit Accounts Payable
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [jeId, accMap['2010'], totalAmount]
        );
        postedCount++;

      } else if (type === 'adjustment') {
        const ref = `adjustment:${id}`;
        // Check if already posted
        const check = await client.query('SELECT id FROM journal_entries WHERE reference = $1', [ref]);
        if (check.rows.length > 0) continue;

        // Fetch Stock Adjustment
        const saRes = await client.query('SELECT * FROM stock_adjustments WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (saRes.rows.length === 0) continue;
        const sa = saRes.rows[0];

        // Validate closed period
        const txDate = sa.created_at;
        const closedCheck = await client.query('SELECT period_name FROM closed_periods WHERE tenant_id = $1 AND $2 BETWEEN start_date AND end_date', [tenantId, txDate]);
        if (closedCheck.rows.length > 0) {
          throw new Error(`Cannot post: Stock adjustment date falls within closed period ${closedCheck.rows[0].period_name}`);
        }

        // Get product cost price
        const prodRes = await client.query('SELECT cost_price FROM products WHERE id = $1', [sa.product_id]);
        if (prodRes.rows.length === 0) continue;
        const costPrice = Number(prodRes.rows[0].cost_price);
        const qtyChanged = Number(sa.quantity_changed);
        const valueChange = Math.abs(qtyChanged) * costPrice;

        if (valueChange <= 0) continue;

        // Create Journal Entry
        const jeRes = await client.query(
          `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [tenantId, sa.created_at, `Automated entry for Stock Adjustment #${sa.id} (${sa.adjustment_type})`, ref, req.user?.id]
        );
        const jeId = jeRes.rows[0].id;

        if (qtyChanged < 0) {
          // Reduction: Debit Stock Adjustment Loss (5020), Credit Inventory (1030)
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accMap['5020'], valueChange]
          );
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accMap['1030'], valueChange]
          );
        } else {
          // Addition: Debit Inventory (1030), Credit Owner Equity (3010) or Other Revenue (4020)
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [jeId, accMap['1030'], valueChange]
          );

          const creditAccount = sa.adjustment_type === 'receiving' ? '3010' : '4020';
          await client.query(
            `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [jeId, accMap[creditAccount], valueChange]
          );
        }
        postedCount++;
      }
    }

    await client.query('COMMIT');
    await logAudit(req, 'BATCH_POST_TRANSACTIONS', `Batch posted ${postedCount} staging transactions`);
    res.json({ message: `Successfully posted ${postedCount} transactions` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// --- DIRECT GENERAL TRANSACTION POST ---

export const postOtherTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { entry_date, description, reference, debit_account_id, credit_account_id, amount } = req.body;

  if (!description || !debit_account_id || !credit_account_id || !amount) {
    res.status(400).json({ error: 'description, debit_account_id, credit_account_id and amount are required' });
    return;
  }

  const amt = Number(amount);
  if (amt <= 0) {
    res.status(400).json({ error: 'Amount must be greater than zero' });
    return;
  }

  if (debit_account_id === credit_account_id) {
    res.status(400).json({ error: 'Debit and Credit accounts must be different' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate account existence
    const accountsCheck = await client.query('SELECT id FROM financial_accounts WHERE id IN ($1, $2) AND tenant_id = $3', [
      debit_account_id,
      credit_account_id,
      tenantId
    ]);
    if (accountsCheck.rows.length < 2) {
      res.status(404).json({ error: 'One or both selected accounts do not exist' });
      await client.query('ROLLBACK');
      return;
    }

    const entryDate = entry_date ? new Date(entry_date) : new Date();
    const ref = reference || 'bank-statement';

    // Validate date against closed periods
    const closedCheck = await client.query(
      `SELECT period_name FROM closed_periods 
       WHERE tenant_id = $2 AND $1 BETWEEN start_date AND end_date`,
      [entryDate, tenantId]
    );
    if (closedCheck.rows.length > 0) {
      res.status(400).json({ error: `Cannot post transaction: The transaction date falls within a closed financial period (${closedCheck.rows[0].period_name}).` });
      await client.query('ROLLBACK');
      return;
    }

    const jeRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, entryDate, description, ref, req.user?.id]
    );
    const jeId = jeRes.rows[0].id;

    // Insert Debit item
    await client.query(
      `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
      [jeId, debit_account_id, amt]
    );

    // Insert Credit item
    await client.query(
      `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
      [jeId, credit_account_id, amt]
    );

    await client.query('COMMIT');
    await logAudit(req, 'POST_OTHER_TRANSACTION', `Posted custom bank/misc transaction: ${description} (${amt})`);
    res.status(201).json({ id: jeId, description, amount: amt });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// --- REJECT TRANSACTIONS ---
export const rejectTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { transactions } = req.body; // Array of { reference: string }
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    res.status(400).json({ error: 'transactions array is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const tx of transactions) {
      const { reference } = tx;
      if (!reference) continue;
      await client.query(
        `INSERT INTO rejected_transactions (tenant_id, reference, rejected_by)
         VALUES ($1, $2, $3) ON CONFLICT (tenant_id, reference) DO NOTHING`,
        [tenantId, reference, req.user?.id]
      );
    }
    await client.query('COMMIT');
    await logAudit(req, 'REJECT_TRANSACTIONS', `Rejected ${transactions.length} staged transactions`);
    res.json({ success: true, message: `Rejected ${transactions.length} transaction(s) successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// --- GET CLOSED PERIODS ---
export const getClosedPeriods = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await query(
      `SELECT cp.*, u.username as closed_by_username, je.description as je_description
       FROM closed_periods cp
       LEFT JOIN users u ON cp.closed_by = u.id
       LEFT JOIN journal_entries je ON cp.journal_entry_id = je.id
       WHERE cp.tenant_id = $1
       ORDER BY cp.end_date DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- CLOSE PERIOD (MONTHLY/YEARLY) ---
export const closePeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { period_type, period_name } = req.body;

  if (!period_type || !['month', 'year'].includes(period_type)) {
    res.status(400).json({ error: 'period_type must be month or year' });
    return;
  }

  if (!period_name) {
    res.status(400).json({ error: 'period_name is required' });
    return;
  }

  let start_date: string;
  let end_date: string;

  if (period_type === 'month') {
    const match = period_name.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      res.status(400).json({ error: 'period_name must be in YYYY-MM format' });
      return;
    }
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    start_date = `${period_name}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    end_date = `${period_name}-${lastDay}`;
  } else {
    const match = period_name.match(/^(\d{4})$/);
    if (!match) {
      res.status(400).json({ error: 'period_name must be in YYYY format' });
      return;
    }
    start_date = `${period_name}-01-01`;
    end_date = `${period_name}-12-31`;
  }

  const client = await pool.connect();
  try {
    const dupCheck = await client.query('SELECT id FROM closed_periods WHERE period_name = $1 AND tenant_id = $2', [period_name, tenantId]);
    if (dupCheck.rows.length > 0) {
      res.status(400).json({ error: `Period ${period_name} is already closed` });
      return;
    }

    await client.query('BEGIN');

    // Calculate balances for revenue and expense accounts
    const balancesQuery = `
      SELECT fa.id as account_id, fa.code, fa.name, fa.type,
             COALESCE(SUM(ji.debit), 0) as total_debit,
             COALESCE(SUM(ji.credit), 0) as total_credit
      FROM financial_accounts fa
      LEFT JOIN journal_items ji ON fa.id = ji.account_id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE fa.tenant_id = $3 AND fa.type IN ('revenue', 'expense')
        AND je.entry_date BETWEEN $1 AND $2
      GROUP BY fa.id, fa.code, fa.name, fa.type
    `;
    const balancesRes = await client.query(balancesQuery, [start_date, end_date, tenantId]);

    // Retained Earnings account check
    const reRes = await client.query("SELECT id FROM financial_accounts WHERE code = '3020'");
    if (reRes.rows.length === 0) {
      throw new Error("System account '3020' (Retained Earnings) not found");
    }
    const retainedEarningsAccountId = reRes.rows[0].id;

    const journalItems: { account_id: number; debit: number; credit: number }[] = [];
    let netProfit = 0;

    for (const row of balancesRes.rows) {
      const debitSum = Number(row.total_debit);
      const creditSum = Number(row.total_credit);
      const type = row.type;

      if (type === 'revenue') {
        const balance = creditSum - debitSum;
        netProfit += balance;
        if (balance > 0) {
          journalItems.push({
            account_id: row.account_id,
            debit: balance,
            credit: 0
          });
        }
      } else if (type === 'expense') {
        const balance = debitSum - creditSum;
        netProfit -= balance;
        if (balance > 0) {
          journalItems.push({
            account_id: row.account_id,
            debit: 0,
            credit: balance
          });
        }
      }
    }

    let jeId: number | null = null;

    if (journalItems.length > 0) {
      if (netProfit > 0) {
        journalItems.push({
          account_id: retainedEarningsAccountId,
          debit: 0,
          credit: netProfit
        });
      } else if (netProfit < 0) {
        journalItems.push({
          account_id: retainedEarningsAccountId,
          debit: Math.abs(netProfit),
          credit: 0
        });
      }

      const jeRes = await client.query(
        `INSERT INTO journal_entries (tenant_id, entry_date, description, reference, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, end_date, `Closing entry for period ${period_name}`, `close:${period_type}:${period_name}`, req.user?.id]
      );
      jeId = jeRes.rows[0].id;

      for (const item of journalItems) {
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [jeId, item.account_id, item.debit, item.credit]
        );
      }
    }

    await client.query(
      `INSERT INTO closed_periods (tenant_id, period_type, period_name, start_date, end_date, closed_by, journal_entry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, period_type, period_name, start_date, end_date, req.user?.id, jeId]
    );

    await client.query('COMMIT');
    await logAudit(req, 'CLOSE_PERIOD', `Closed period ${period_name} (${period_type})`);
    res.status(201).json({ success: true, message: `Period ${period_name} closed successfully`, journal_entry_id: jeId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    client.release();
  }
};


