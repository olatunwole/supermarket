import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Landmark,
  Coins,
  Scale,
  Receipt,
  BookOpen,
  Plus,
  Eye,
  Calendar,
  X,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
  ListRestart,
  DollarSign
} from 'lucide-react';

interface Account {
  id: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  is_system: boolean;
  total_debits: string | number;
  total_credits: string | number;
  balance: string | number;
}

interface JournalItem {
  id?: number;
  account_id: number;
  account_code?: string;
  account_name?: string;
  account_type?: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: number;
  entry_date: string;
  description: string;
  reference: string;
  created_by: number | null;
  created_by_username: string | null;
  items: JournalItem[];
}

interface LedgerLine {
  item_id: number;
  debit: number;
  credit: number;
  entry_id: number;
  entry_date: string;
  description: string;
  reference: string;
  running_balance: number;
}

interface StagedTransaction {
  id: number;
  date: string;
  amount: number;
  type: 'sale' | 'purchase' | 'adjustment';
  description: string;
  reference: string;
}

interface OperationsResponse {
  period: { from: string; to: string };
  revenues: { code: string; name: string; balance: string | number }[];
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: { code: string; name: string; balance: string | number }[];
  totalOperatingExpenses: number;
  netIncome: number;
}

interface PositionResponse {
  asOfDate: string;
  assets: { code: string; name: string; balance: string | number }[];
  totalAssets: number;
  liabilities: { code: string; name: string; balance: string | number }[];
  totalLiabilities: number;
  equity: { code: string; name: string; balance: string | number }[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
}

interface CashflowResponse {
  period: { from: string; to: string };
  cashInflows: {
    fromSales: number;
    fromEquity: number;
    otherInflows: number;
    totalInflows: number;
  };
  cashOutflows: {
    paidToSuppliers: number;
    paidForExpenses: number;
    otherOutflows: number;
    totalOutflows: number;
  };
  netOperatingCash: number;
  netCashFlow: number;
}

export const Financials: React.FC = () => {
  const { apiFetch, showNotification, formatCurrency } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'staging' | 'post-other' | 'accounts' | 'trial' | 'operations' | 'position' | 'cashflow' | 'journal' | 'closings'>('overview');
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<{ id: number; code: string; name: string; type: string; debit_balance: string | number; credit_balance: string | number }[]>([]);
  const [operationsData, setOperationsData] = useState<OperationsResponse | null>(null);
  const [positionData, setPositionData] = useState<PositionResponse | null>(null);
  const [cashflowData, setCashflowData] = useState<CashflowResponse | null>(null);
  const [stagingTransactions, setStagingTransactions] = useState<StagedTransaction[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<any[]>([]);
  const [closePeriodType, setClosePeriodType] = useState<'month' | 'year'>('month');
  const [closePeriodName, setClosePeriodName] = useState<string>('');
  const [closingPreview, setClosingPreview] = useState<{ revenues: any[]; expenses: any[]; totalRevenue: number; totalExpense: number; netProfit: number } | null>(null);
  const [closingPreviewLoading, setClosingPreviewLoading] = useState<boolean>(false);

  // Modals state
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false);
  const [showNewJEModal, setShowNewJEModal] = useState<boolean>(false);

  // Expanded Journal Entry items IDs
  const [expandedJE, setExpandedJE] = useState<Record<number, boolean>>({});

  // Ledger details view state
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<Account | null>(null);
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);

  // Add Account form state
  const [newAccountCode, setNewAccountCode] = useState<string>('');
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newAccountType, setNewAccountType] = useState<'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>('expense');

  // New Journal Entry form state
  const [newJeDate, setNewJeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newJeDesc, setNewJeDesc] = useState<string>('');
  const [newJeRef, setNewJeRef] = useState<string>('');
  const [newJeItems, setNewJeItems] = useState<{ account_id: number; debit: string; credit: string }[]>([
    { account_id: 0, debit: '', credit: '' },
    { account_id: 0, debit: '', credit: '' }
  ]);

  // Post Other Transactions form state
  const [otherDate, setOtherDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [otherDesc, setOtherDesc] = useState<string>('');
  const [otherRef, setOtherRef] = useState<string>('');
  const [otherDebitAcc, setOtherDebitAcc] = useState<number>(0);
  const [otherCreditAcc, setOtherCreditAcc] = useState<number>(0);
  const [otherAmount, setOtherAmount] = useState<string>('');
  const [postingOther, setPostingOther] = useState<boolean>(false);

  // Excel & PDF Export Helpers
  const exportToExcel = (headers: string[], rows: any[][], fileName: string) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => {
        const cellVal = val === null || val === undefined ? '' : String(val);
        if (cellVal.includes(',') || cellVal.includes('"') || cellVal.includes('\n')) {
          return `"${cellVal.replace(/"/g, '""')}"`;
        }
        return cellVal;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`${fileName} exported to Excel format successfully!`, 'success');
  };

  const exportToPDF = (title: string, subtitle: string, headers: string[], rows: any[][], totals?: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotification('Popup blocked! Please allow popups to export PDF.', 'warning');
      return;
    }
    
    const headerHtml = headers.map(h => `<th style="padding: 10px; border: 1px solid #ddd; background: #1e3a8a; color: #fff; text-align: left; font-size: 13px;">${h}</th>`).join('');
    const rowsHtml = rows.map((r, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#f9f9f9' : '#fff'}; border-bottom: 1px solid #ddd;">
        ${r.map(cell => `<td style="padding: 8px 10px; border: 1px solid #ddd; font-size: 12px;">${cell}</td>`).join('')}
      </tr>
    `).join('');
    
    let totalsHtml = '';
    if (totals) {
      totalsHtml = `
        <tr style="font-weight: bold; background: #e0f2fe; border-top: 2px solid #0284c7; border-bottom: 4px double #0284c7;">
          ${totals.map(cell => `<td style="padding: 10px; border: 1px solid #ddd; font-size: 13px;">${cell}</td>`).join('')}
        </tr>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #333; margin: 30px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 24px; color: #1e3a8a; }
            .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>${subtitle}</p>
            <p style="font-size: 12px; margin-top: 10px;">Exported on ${new Date().toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>${headerHtml}</tr>
            </thead>
            <tbody>
              ${rowsHtml}
              ${totalsHtml}
            </tbody>
          </table>
          <div class="footer">
            Antigravity Supermarket Management System © 2026
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // General Account/Transaction Export Handlers
  const exportAccountsExcel = () => {
    const headers = ['Account Code', 'Account Name', 'Account Type', 'Debit Sum (£)', 'Credit Sum (£)', 'Current Balance (£)'];
    const rows = accounts.map(a => [a.code, a.name, a.type, a.total_debits, a.total_credits, a.balance]);
    exportToExcel(headers, rows, 'Chart_of_Accounts');
  };

  const exportAccountsPDF = () => {
    const headers = ['Code', 'Name', 'Type', 'Debit Sum', 'Credit Sum', 'Current Balance'];
    const rows = accounts.map(a => [a.code, a.name, a.type, formatCurrency(a.total_debits), formatCurrency(a.total_credits), formatCurrency(a.balance)]);
    exportToPDF('Chart of Accounts', 'Antigravity Supermarket System', headers, rows);
  };

  const exportStagingExcel = () => {
    const headers = ['Transaction Date', 'Type', 'Description', 'Reference Ref', 'Amount (£)'];
    const rows = stagingTransactions.map(t => [t.date.split('T')[0], t.type, t.description, t.reference, t.amount]);
    exportToExcel(headers, rows, 'Staged_Transactions_Registry');
  };

  const exportStagingPDF = () => {
    const headers = ['Transaction Date', 'Type', 'Description', 'Reference Ref', 'Amount'];
    const rows = stagingTransactions.map(t => [new Date(t.date).toLocaleDateString(), t.type, t.description, t.reference, formatCurrency(t.amount)]);
    exportToPDF('Staged Transactions Registry', 'Statement of Transactions (Staging Area)', headers, rows);
  };

  const exportJournalExcel = () => {
    const headers = ['Entry Date', 'Description', 'Reference Ref', 'Account Code & Name', 'Debit (£)', 'Credit (£)'];
    const rows: any[][] = [];
    journalEntries.forEach(entry => {
      entry.items.forEach(item => {
        rows.push([
          entry.entry_date.split('T')[0],
          entry.description,
          entry.reference,
          `${item.account_code} - ${item.account_name}`,
          item.debit || 0,
          item.credit || 0
        ]);
      });
    });
    exportToExcel(headers, rows, 'Journal_Entries_Ledger');
  };

  const exportJournalPDF = () => {
    const headers = ['Entry Date', 'Description', 'Reference Ref', 'Account Code & Name', 'Debit', 'Credit'];
    const rows: any[][] = [];
    journalEntries.forEach(entry => {
      entry.items.forEach(item => {
        rows.push([
          new Date(entry.entry_date).toLocaleDateString(),
          entry.description,
          entry.reference,
          `${item.account_code} - ${item.account_name}`,
          item.debit > 0 ? formatCurrency(item.debit) : '-',
          item.credit > 0 ? formatCurrency(item.credit) : '-'
        ]);
      });
    });
    exportToPDF('Journal Entries Ledger', 'Chronological feed of ledger postings', headers, rows);
  };

  // Report Export Handlers
  const exportTrialBalanceExcel = () => {
    const headers = ['Account Code', 'Account Name', 'Account Type', 'Debit Balance (£)', 'Credit Balance (£)'];
    const rows = trialBalance
      .filter(r => Number(r.debit_balance) > 0 || Number(r.credit_balance) > 0)
      .map(r => [r.code, r.name, r.type, Number(r.debit_balance) || 0, Number(r.credit_balance) || 0]);
    const totalDeb = trialBalance.reduce((sum, r) => sum + Number(r.debit_balance), 0);
    const totalCred = trialBalance.reduce((sum, r) => sum + Number(r.credit_balance), 0);
    rows.push(['Total', '-', '-', totalDeb, totalCred]);
    exportToExcel(headers, rows, `Trial_Balance_${fromDate}_to_${toDate}`);
  };

  const exportTrialBalancePDF = () => {
    const headers = ['Account Code', 'Account Name', 'Account Type', 'Debit Balance', 'Credit Balance'];
    const rows = trialBalance
      .filter(r => Number(r.debit_balance) > 0 || Number(r.credit_balance) > 0)
      .map(r => [
        r.code, 
        r.name, 
        r.type, 
        Number(r.debit_balance) > 0 ? formatCurrency(r.debit_balance) : '-', 
        Number(r.credit_balance) > 0 ? formatCurrency(r.credit_balance) : '-'
      ]);
    const totalDeb = trialBalance.reduce((sum, r) => sum + Number(r.debit_balance), 0);
    const totalCred = trialBalance.reduce((sum, r) => sum + Number(r.credit_balance), 0);
    exportToPDF(
      'Trial Balance',
      `For the period: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`,
      headers,
      rows,
      ['Total', '-', '-', formatCurrency(totalDeb), formatCurrency(totalCred)]
    );
  };

  const exportOperationsExcel = () => {
    if (!operationsData) return;
    const headers = ['Category / Account', 'Account Code', 'Amount (£)'];
    const rows: any[][] = [];
    rows.push(['REVENUE', '', '']);
    operationsData.revenues.forEach(r => rows.push([r.name, r.code, Number(r.balance)]));
    rows.push(['Total Net Revenue', '', Number(operationsData.totalRevenue)]);
    rows.push(['Cost of Goods Sold (COGS)', '5010', Number(operationsData.cogs)]);
    rows.push(['Gross Operating Profit', '', Number(operationsData.grossProfit)]);
    rows.push(['OPERATING EXPENSES', '', '']);
    operationsData.operatingExpenses.forEach(e => rows.push([e.name, e.code, Number(e.balance)]));
    rows.push(['Total Operating Expenses', '', Number(operationsData.totalOperatingExpenses)]);
    rows.push(['Net Operating Income', '', Number(operationsData.netIncome)]);
    exportToExcel(headers, rows, `Income_Statement_${fromDate}_to_${toDate}`);
  };

  const exportOperationsPDF = () => {
    if (!operationsData) return;
    const headers = ['Category / Account', 'Account Code', 'Amount'];
    const rows: any[][] = [];
    rows.push(['REVENUE', '', '']);
    operationsData.revenues.forEach(r => rows.push([r.name, r.code, formatCurrency(r.balance)]));
    rows.push(['Total Net Revenue', '', formatCurrency(operationsData.totalRevenue)]);
    rows.push(['Cost of Goods Sold (COGS)', '5010', formatCurrency(operationsData.cogs)]);
    rows.push(['Gross Operating Profit', '', formatCurrency(operationsData.grossProfit)]);
    rows.push(['OPERATING EXPENSES', '', '']);
    operationsData.operatingExpenses.forEach(e => rows.push([e.name, e.code, formatCurrency(e.balance)]));
    rows.push(['Total Operating Expenses', '', formatCurrency(operationsData.totalOperatingExpenses)]);
    exportToPDF(
      'Statement of Operations (Income Statement)',
      `For the period: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`,
      headers,
      rows,
      ['Net Operating Income', '', formatCurrency(operationsData.netIncome)]
    );
  };

  const exportPositionExcel = () => {
    if (!positionData) return;
    const headers = ['Category / Account', 'Account Code', 'Amount (£)'];
    const rows: any[][] = [];
    rows.push(['ASSETS', '', '']);
    positionData.assets.forEach(a => rows.push([a.name, a.code, Number(a.balance)]));
    rows.push(['Total Assets', '', Number(positionData.totalAssets)]);
    rows.push(['LIABILITIES', '', '']);
    positionData.liabilities.forEach(l => rows.push([l.name, l.code, Number(l.balance)]));
    rows.push(['Total Liabilities', '', Number(positionData.totalLiabilities)]);
    rows.push(['EQUITY', '', '']);
    positionData.equity.forEach(eq => rows.push([eq.name, eq.code, Number(eq.balance)]));
    rows.push(['Total Equity', '', Number(positionData.totalEquity)]);
    rows.push(['Total Liabilities & Equity', '', Number(positionData.totalLiabilitiesAndEquity)]);
    exportToExcel(headers, rows, `Balance_Sheet_as_of_${asOfDate}`);
  };

  const exportPositionPDF = () => {
    if (!positionData) return;
    const headers = ['Category / Account', 'Account Code', 'Amount'];
    const rows: any[][] = [];
    rows.push(['ASSETS', '', '']);
    positionData.assets.forEach(a => rows.push([a.name, a.code, formatCurrency(a.balance)]));
    rows.push(['Total Assets', '', formatCurrency(positionData.totalAssets)]);
    rows.push(['LIABILITIES', '', '']);
    positionData.liabilities.forEach(l => rows.push([l.name, l.code, formatCurrency(l.balance)]));
    rows.push(['Total Liabilities', '', formatCurrency(positionData.totalLiabilities)]);
    rows.push(['EQUITY', '', '']);
    positionData.equity.forEach(eq => rows.push([eq.name, eq.code, formatCurrency(eq.balance)]));
    rows.push(['Total Equity', '', formatCurrency(positionData.totalEquity)]);
    exportToPDF(
      'Statement of Financial Position (Balance Sheet)',
      `As of Date: ${new Date(asOfDate).toLocaleDateString()}`,
      headers,
      rows,
      ['Total Liabilities & Equity', '', formatCurrency(positionData.totalLiabilitiesAndEquity)]
    );
  };

  const exportCashflowExcel = () => {
    if (!cashflowData) return;
    const headers = ['Cash Flow Category / Activity', 'Amount (£)'];
    const rows: any[][] = [];
    rows.push(['CASH INFLOWS', '']);
    rows.push(['Cash Received from Customers (Sales)', Number(cashflowData.cashInflows.fromSales)]);
    rows.push(['Cash Received from Equity Contributions', Number(cashflowData.cashInflows.fromEquity)]);
    rows.push(['Other Cash Inflows', Number(cashflowData.cashInflows.otherInflows)]);
    rows.push(['Total Cash Inflows', Number(cashflowData.cashInflows.totalInflows)]);
    rows.push(['CASH OUTFLOWS', '']);
    rows.push(['Cash Paid to Suppliers', Number(cashflowData.cashOutflows.paidToSuppliers)]);
    rows.push(['Cash Paid for Expenses', Number(cashflowData.cashOutflows.paidForExpenses)]);
    rows.push(['Other Cash Outflows', Number(cashflowData.cashOutflows.otherOutflows)]);
    rows.push(['Total Cash Outflows', Number(cashflowData.cashOutflows.totalOutflows)]);
    rows.push(['Net Cash Flow', Number(cashflowData.netCashFlow)]);
    exportToExcel(headers, rows, `Cash_Flow_Statement_${fromDate}_to_${toDate}`);
  };

  const exportCashflowPDF = () => {
    if (!cashflowData) return;
    const headers = ['Cash Flow Category / Activity', 'Amount'];
    const rows: any[][] = [];
    rows.push(['CASH INFLOWS', '']);
    rows.push(['Cash Received from Customers (Sales)', formatCurrency(cashflowData.cashInflows.fromSales)]);
    rows.push(['Cash Received from Equity Contributions', formatCurrency(cashflowData.cashInflows.fromEquity)]);
    rows.push(['Other Cash Inflows', formatCurrency(cashflowData.cashInflows.otherInflows)]);
    rows.push(['Total Cash Inflows', formatCurrency(cashflowData.cashInflows.totalInflows)]);
    rows.push(['CASH OUTFLOWS', '']);
    rows.push(['Cash Paid to Suppliers', formatCurrency(cashflowData.cashOutflows.paidToSuppliers)]);
    rows.push(['Cash Paid for Expenses', formatCurrency(cashflowData.cashOutflows.paidForExpenses)]);
    rows.push(['Other Cash Outflows', formatCurrency(cashflowData.cashOutflows.otherOutflows)]);
    rows.push(['Total Cash Outflows', formatCurrency(cashflowData.cashOutflows.totalOutflows)]);
    exportToPDF(
      'Statement of Cashflows (Direct Method)',
      `For the period: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`,
      headers,
      rows,
      ['Net Change in Cash (Net Cash Flow)', formatCurrency(cashflowData.netCashFlow)]
    );
  };

  // Fetch Accounts
  const fetchAccounts = async () => {
    try {
      const data = await apiFetch<Account[]>('/api/financials/accounts');
      setAccounts(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch Chart of Accounts', 'error');
    }
  };

  // Fetch Journal Entries
  const fetchJournalEntries = async () => {
    try {
      const data = await apiFetch<JournalEntry[]>('/api/financials/journal-entries');
      setJournalEntries(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch journal entries', 'error');
    }
  };

  // Fetch Trial Balance
  const fetchTrialBalance = async () => {
    try {
      const data = await apiFetch<any[]>(`/api/financials/trial-balance?from=${fromDate}&to=${toDate}`);
      setTrialBalance(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch Trial Balance', 'error');
    }
  };

  // Fetch Operations Statement
  const fetchOperationsStatement = async () => {
    try {
      const data = await apiFetch<OperationsResponse>(`/api/financials/statement-of-operations?from=${fromDate}&to=${toDate}`);
      setOperationsData(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch Statement of Operations', 'error');
    }
  };

  // Fetch Balance Sheet
  const fetchBalanceSheet = async () => {
    try {
      const data = await apiFetch<PositionResponse>(`/api/financials/statement-of-financial-position?to=${asOfDate}`);
      setPositionData(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch Statement of Financial Position', 'error');
    }
  };

  // Fetch Cash Flow
  const fetchCashFlow = async () => {
    try {
      const data = await apiFetch<CashflowResponse>(`/api/financials/statement-of-cashflow?from=${fromDate}&to=${toDate}`);
      setCashflowData(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch Statement of Cashflow', 'error');
    }
  };

  // Fetch Staging Transactions
  const fetchStagingTransactions = async () => {
    try {
      const data = await apiFetch<StagedTransaction[]>('/api/financials/staging-transactions');
      setStagingTransactions(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch staging transactions', 'error');
    }
  };

  // Fetch Closed Periods
  const fetchClosedPeriods = async () => {
    try {
      const data = await apiFetch<any[]>('/api/financials/closed-periods');
      setClosedPeriods(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch closed periods', 'error');
    }
  };

  // Fetch single Account Ledger
  const fetchAccountLedger = async (account: Account) => {
    setSelectedLedgerAccount(account);
    setShowLedgerModal(true);
    setLedgerLoading(true);
    try {
      const data = await apiFetch<{ lines: LedgerLine[] }>(
        `/api/financials/accounts/${account.id}/ledger?from=${fromDate}&to=${toDate}`
      );
      setLedgerLines(data.lines);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch ledger details', 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAccounts(),
      fetchJournalEntries(),
      fetchTrialBalance(),
      fetchOperationsStatement(),
      fetchBalanceSheet(),
      fetchCashFlow(),
      fetchStagingTransactions(),
      fetchClosedPeriods()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, asOfDate, activeTab]);

  // Form handlers
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountCode || !newAccountName) {
      showNotification('Please fill in all account fields', 'warning');
      return;
    }
    try {
      await apiFetch('/api/financials/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newAccountCode,
          name: newAccountName,
          type: newAccountType
        })
      });
      showNotification(`Account ${newAccountCode} - ${newAccountName} created`, 'success');
      setShowAddAccountModal(false);
      setNewAccountCode('');
      setNewAccountName('');
      fetchAccounts();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create account', 'error');
    }
  };

  // Staged Posting Trigger
  const handlePostStagedTransactions = async (txList: { type: string; id: number }[]) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/financials/post-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: txList })
      });
      showNotification(res.message || 'Posted staged transactions successfully', 'success');
      await loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to post transaction(s)', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectStagedTransactions = async (txList: { reference: string }[]) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/financials/reject-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: txList })
      });
      showNotification(res.message || 'Rejected staged transactions successfully', 'success');
      await loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to reject transaction(s)', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodDates = (type: 'month' | 'year', name: string) => {
    if (type === 'month') {
      const match = name.match(/^(\d{4})-(\d{2})$/);
      if (!match) return null;
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const lastDay = new Date(year, month, 0).getDate();
      return {
        from: `${name}-01`,
        to: `${name}-${lastDay}`
      };
    } else {
      const match = name.match(/^(\d{4})$/);
      if (!match) return null;
      return {
        from: `${name}-01-01`,
        to: `${name}-12-31`
      };
    }
  };

  const handleCalculatePreview = async () => {
    if (!closePeriodName) {
      showNotification('Please select a period to calculate', 'warning');
      return;
    }
    const dates = getPeriodDates(closePeriodType, closePeriodName);
    if (!dates) {
      showNotification('Invalid period format. Use YYYY-MM for month or YYYY for year.', 'warning');
      return;
    }
    setClosingPreviewLoading(true);
    try {
      const data = await apiFetch<OperationsResponse>(`/api/financials/statement-of-operations?from=${dates.from}&to=${dates.to}`);
      
      const revenues = data.revenues.map(r => ({ ...r, balance: Number(r.balance) }));
      const expenses = [
        { code: '5010', name: 'Cost of Goods Sold (COGS)', balance: Number(data.cogs) },
        ...data.operatingExpenses.map(e => ({ ...e, balance: Number(e.balance) }))
      ].filter(e => e.balance > 0);

      const totalRevenue = Number(data.totalRevenue);
      const totalExpense = Number(data.cogs) + Number(data.totalOperatingExpenses);
      const netProfit = Number(data.netIncome);

      setClosingPreview({
        revenues,
        expenses,
        totalRevenue,
        totalExpense,
        netProfit
      });
    } catch (err: any) {
      showNotification(err.message || 'Failed to calculate closing preview', 'error');
    } finally {
      setClosingPreviewLoading(false);
    }
  };

  const handleClosePeriod = async () => {
    if (!closePeriodName) return;
    if (!window.confirm(`Are you sure you want to close the period ${closePeriodName}? This will post a closing journal entry and lock the period against future entries.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/financials/close-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_type: closePeriodType,
          period_name: closePeriodName
        })
      });
      showNotification(res.message || 'Period closed successfully!', 'success');
      setClosingPreview(null);
      setClosePeriodName('');
      await loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to close period', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Direct Bank statement / general postings
  const handlePostOtherTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherDesc || !otherDebitAcc || !otherCreditAcc || !otherAmount) {
      showNotification('Please fill in all transaction fields', 'warning');
      return;
    }
    if (otherDebitAcc === otherCreditAcc) {
      showNotification('Debit and credit accounts must be different', 'warning');
      return;
    }
    if (Number(otherAmount) <= 0) {
      showNotification('Amount must be greater than zero', 'warning');
      return;
    }

    setPostingOther(true);
    try {
      await apiFetch('/api/financials/post-other', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: otherDate,
          description: otherDesc,
          reference: otherRef || 'bank-statement',
          debit_account_id: otherDebitAcc,
          credit_account_id: otherCreditAcc,
          amount: Number(otherAmount)
        })
      });

      showNotification('Transaction posted to general ledger successfully!', 'success');
      setOtherDesc('');
      setOtherRef('');
      setOtherAmount('');
      setOtherDebitAcc(0);
      setOtherCreditAcc(0);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to post transaction', 'error');
    } finally {
      setPostingOther(false);
    }
  };

  const handleAddJeItem = () => {
    setNewJeItems([...newJeItems, { account_id: 0, debit: '', credit: '' }]);
  };

  const handleRemoveJeItem = (index: number) => {
    if (newJeItems.length <= 2) {
      showNotification('A journal entry must contain at least 2 items', 'warning');
      return;
    }
    setNewJeItems(newJeItems.filter((_, i) => i !== index));
  };

  const handleJeItemChange = (index: number, field: 'account_id' | 'debit' | 'credit', value: any) => {
    const updated = [...newJeItems];
    if (field === 'account_id') {
      updated[index].account_id = Number(value);
    } else {
      updated[index][field] = value;
    }
    setNewJeItems(updated);
  };

  // Sum up new JE Debits and Credits
  const jeSums = () => {
    let debits = 0;
    let credits = 0;
    for (const item of newJeItems) {
      debits += Number(item.debit || 0);
      credits += Number(item.credit || 0);
    }
    return { debits, credits, difference: Math.abs(debits - credits) };
  };

  const handlePostJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const { debits, credits, difference } = jeSums();
    
    if (!newJeDesc) {
      showNotification('Description is required', 'warning');
      return;
    }
    if (newJeItems.some(item => !item.account_id)) {
      showNotification('All lines must have a selected account', 'warning');
      return;
    }
    if (newJeItems.some(item => !item.debit && !item.credit)) {
      showNotification('Every line must have either a debit or credit value', 'warning');
      return;
    }
    if (difference > 0.01) {
      showNotification(`Journal entry is out of balance by {formatCurrency(difference)}. Debits must equal credits.`, 'warning');
      return;
    }

    try {
      const formattedItems = newJeItems.map(item => ({
        account_id: item.account_id,
        debit: Number(item.debit || 0),
        credit: Number(item.credit || 0)
      }));

      await apiFetch('/api/financials/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: newJeDate,
          description: newJeDesc,
          reference: newJeRef || 'manual',
          items: formattedItems
        })
      });

      showNotification('Journal entry posted successfully', 'success');
      setShowNewJEModal(false);
      setNewJeDesc('');
      setNewJeRef('');
      setNewJeItems([
        { account_id: 0, debit: '', credit: '' },
        { account_id: 0, debit: '', credit: '' }
      ]);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to post journal entry', 'error');
    }
  };

  // Helper values
  const totalAssets = positionData?.totalAssets || 0;
  const totalLiabilities = positionData?.totalLiabilities || 0;
  const totalEquity = positionData?.totalEquity || 0;
  const netIncomeVal = operationsData?.netIncome || 0;

  // Toggle JE expand
  const toggleJE = (id: number) => {
    setExpandedJE(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading financial staging ledgers & reports...</p>
      </div>
    );
  }

  return (
    <div className="financials-page" style={{ padding: '8px 0 24px' }}>
      
      {/* Top Header */}
      <div className="flex-space" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Landmark size={28} className="text-accent" /> Financials Module
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Stage operational records, audit statements, and run ledger audits.
          </p>
        </div>

        {/* Global Statement Period Filter */}
        <div className="glass-card flex-center" style={{ padding: '8px 16px', gap: '12px', flexWrap: 'wrap' }}>
          <div className="flex-center" style={{ gap: '6px' }}>
            <Calendar size={16} className="text-muted" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</span>
          </div>
          <input
            type="date"
            className="form-input"
            style={{ width: '130px', padding: '6px 8px', fontSize: '0.8rem', margin: 0 }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            className="form-input"
            style={{ width: '130px', padding: '6px 8px', fontSize: '0.8rem', margin: 0 }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="tabs-container glass-card" style={{ display: 'flex', gap: '4px', padding: '6px', borderRadius: '12px', marginBottom: '24px', overflowX: 'auto' }}>
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview Dashboard
        </button>
        <button className={`tab-btn ${activeTab === 'staging' ? 'active' : ''}`} onClick={() => setActiveTab('staging')}>
          Statement of Transaction ({stagingTransactions.length})
        </button>
        <button className={`tab-btn ${activeTab === 'post-other' ? 'active' : ''}`} onClick={() => setActiveTab('post-other')}>
          Post Other Transactions
        </button>
        <button className={`tab-btn ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}>
          Chart of Accounts
        </button>
        <button className={`tab-btn ${activeTab === 'trial' ? 'active' : ''}`} onClick={() => setActiveTab('trial')}>
          Trial Balance
        </button>
        <button className={`tab-btn ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => setActiveTab('operations')}>
          Income Statement
        </button>
        <button className={`tab-btn ${activeTab === 'position' ? 'active' : ''}`} onClick={() => setActiveTab('position')}>
          Balance Sheet
        </button>
        <button className={`tab-btn ${activeTab === 'cashflow' ? 'active' : ''}`} onClick={() => setActiveTab('cashflow')}>
          Cash Flow
        </button>
        <button className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`} onClick={() => setActiveTab('journal')}>
          Journal Log
        </button>
        <button className={`tab-btn ${activeTab === 'closings' ? 'active' : ''}`} onClick={() => setActiveTab('closings')}>
          Period Closings
        </button>
      </div>

      {/* Loading Bar Overlay */}
      {loading && (
        <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', marginBottom: '12px' }}>
          <div className="spinner-bar" style={{ position: 'absolute', height: '100%', background: 'var(--accent-cyan)', width: '30%', borderRadius: '2px' }}></div>
        </div>
      )}

      {/* Tab: Overview Dashboard */}
      {activeTab === 'overview' && (
        <div className="tab-pane animation-fade">
          
          {/* Main cards grid */}
          <div className="grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            
            {/* Total Assets */}
            <div className="glass-card card-stat">
              <div className="flex-space">
                <div>
                  <span className="stat-label">Total Assets</span>
                  <h3 className="stat-value text-cyan">{formatCurrency(totalAssets)}</h3>
                </div>
                <div className="icon-wrapper bg-cyan-glow">
                  <Coins className="text-accent" size={24} />
                </div>
              </div>
              <p className="stat-desc">Cash + Inventory + Receivables (Posted Only)</p>
            </div>

            {/* Total Liabilities */}
            <div className="glass-card card-stat">
              <div className="flex-space">
                <div>
                  <span className="stat-label">Total Liabilities</span>
                  <h3 className="stat-value text-rose">{formatCurrency(totalLiabilities)}</h3>
                </div>
                <div className="icon-wrapper bg-rose-glow">
                  <TrendingDown className="text-rose" size={24} />
                </div>
              </div>
              <p className="stat-desc">Accounts Payable & Sales Taxes (Posted)</p>
            </div>

            {/* Total Equity */}
            <div className="glass-card card-stat">
              <div className="flex-space">
                <div>
                  <span className="stat-label">Total Equity</span>
                  <h3 className="stat-value text-emerald">{formatCurrency(totalEquity)}</h3>
                </div>
                <div className="icon-wrapper bg-emerald-glow">
                  <Scale className="text-emerald" size={24} />
                </div>
              </div>
              <p className="stat-desc">Contribution & Dynamic Retained Income</p>
            </div>

            {/* Net Income */}
            <div className="glass-card card-stat">
              <div className="flex-space">
                <div>
                  <span className="stat-label">Net Profit / Loss</span>
                  <h3 className={`stat-value ${netIncomeVal >= 0 ? 'text-emerald' : 'text-rose'}`}>
                    {formatCurrency(netIncomeVal)}
                  </h3>
                </div>
                <div className={`icon-wrapper ${netIncomeVal >= 0 ? 'bg-emerald-glow' : 'bg-rose-glow'}`}>
                  <TrendingUp className={netIncomeVal >= 0 ? 'text-emerald' : 'text-rose'} size={24} />
                </div>
              </div>
              <p className="stat-desc">For selected statement period</p>
            </div>
          </div>

          {/* Quick Info & Balance Equations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
            
            {/* Accounting Equation Check */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={20} className="text-accent" /> Balance Sheet Audit
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Assets</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{formatCurrency(totalAssets)}</p>
                  </div>
                  <span style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--text-muted)' }}>=</span>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Liabilities + Equity</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-emerald)' }}>
                      {formatCurrency(totalLiabilities + totalEquity)}
                    </p>
                  </div>
                </div>

                {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05 ? (
                  <div className="badge badge-success flex-center" style={{ padding: '10px 16px', gap: '8px', fontSize: '0.9rem', width: '100%', justifyContent: 'center' }}>
                    <Scale size={18} /> Posted Ledgers in Perfect Balance
                  </div>
                ) : (
                  <div className="badge badge-danger flex-center" style={{ padding: '10px 16px', gap: '8px', fontSize: '0.9rem', width: '100%', justifyContent: 'center' }}>
                    <AlertCircle size={18} /> Mismatch! Ledgers Out of Balance by {formatCurrency(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions & Info */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '12px', fontWeight: 600 }}>Unposted Statement Items</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '16px' }}>
                  There are currently <strong className="text-cyan">{stagingTransactions.length} pending transactions</strong> waiting to be reviewed and posted. Navigating to the statement ledger lets you post them as general ledger entries.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => setActiveTab('staging')}>
                  <ListRestart size={18} /> View Statement Queue
                </button>
                <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }} onClick={() => setActiveTab('post-other')}>
                  <Plus size={18} /> Post Direct Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Statement of Transaction (Staging Area) */}
      {activeTab === 'staging' && (
        <div className="tab-pane animation-fade">
          <div className="flex-space" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListRestart className="text-accent" size={20} /> Statement of Transaction Staging Queue
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Sales, Purchases, and Inventory items currently pending bank or audit confirmation. Click "Post" to commit them to the ledger.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportStagingExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download Excel
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportStagingPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download PDF
              </button>
              {stagingTransactions.length > 0 && (
                <>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const items = stagingTransactions.map(tx => ({ type: tx.type, id: tx.id }));
                      handlePostStagedTransactions(items);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--success-emerald)', borderColor: 'var(--success-emerald)' }}
                  >
                    <CheckCircle2 size={16} /> Post All Staged ({stagingTransactions.length})
                  </button>
                  <button
                    className="btn btn-secondary btn-sm text-danger"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to reject all ${stagingTransactions.length} pending transactions?`)) {
                        const items = stagingTransactions.map(tx => ({ reference: tx.reference }));
                        handleRejectStagedTransactions(items);
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--error-rose)' }}
                  >
                    <X size={16} /> Reject All Staged ({stagingTransactions.length})
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="excel-table">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '16px' }}>Date</th>
                  <th style={{ padding: '16px' }}>Type</th>
                  <th style={{ padding: '16px' }}>Description</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Pending Value</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {stagingTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <CheckCircle2 size={40} className="text-emerald" style={{ marginBottom: '12px' }} />
                      <p>All statement transactions are posted! The staging queue is empty.</p>
                    </td>
                  </tr>
                ) : (
                  stagingTransactions.map(tx => (
                    <tr key={tx.reference} className="table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                        {new Date(tx.date).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span className={`badge ${
                          tx.type === 'sale' ? 'badge-info' :
                          tx.type === 'purchase' ? 'badge-warning' : 'badge-danger'
                        }`} style={{ textTransform: 'uppercase' }}>
                          {tx.type === 'purchase' ? 'PO Purchase' : tx.type}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{tx.description}</td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--success-emerald)', borderColor: 'var(--success-emerald)' }}
                          onClick={() => handlePostStagedTransactions([{ type: tx.type, id: tx.id }])}
                        >
                          Post
                        </button>
                        <button
                          className="btn btn-secondary btn-sm text-danger"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--error-rose)' }}
                          onClick={() => handleRejectStagedTransactions([{ reference: tx.reference }])}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Post Other Transactions */}
      {activeTab === 'post-other' && (
        <div className="tab-pane animation-fade" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <FileText size={22} className="text-accent" /> Post Miscellaneous Transactions
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                Record non-inventory general transactions such as store rents, bank charges, or owner investments directly.
              </p>
            </div>

            <form onSubmit={handlePostOtherTransaction}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Transaction Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={otherDate}
                    onChange={(e) => setOtherDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference ID (e.g. Bank Ref)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. rent-2024-07"
                    value={otherRef}
                    onChange={(e) => setOtherRef(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Description / Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Payment for monthly warehouse rent"
                  value={otherDesc}
                  onChange={(e) => setOtherDesc(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Debit Account (Increase Assets / Expenses)</label>
                  <select
                    className="form-select"
                    value={otherDebitAcc}
                    onChange={(e) => setOtherDebitAcc(Number(e.target.value))}
                    required
                  >
                    <option value={0}>-- Select Account --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Account (Increase Liab / Equity / Revenue)</label>
                  <select
                    className="form-select"
                    value={otherCreditAcc}
                    onChange={(e) => setOtherCreditAcc(Number(e.target.value))}
                    required
                  >
                    <option value={0}>-- Select Account --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Transaction Amount</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{ paddingLeft: '32px', textAlign: 'right' }}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    value={otherAmount}
                    onChange={(e) => setOtherAmount(e.target.value)}
                    required
                  />
                  <DollarSign size={16} className="text-muted" style={{ position: 'absolute', left: '12px', top: '15px' }} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={postingOther}>
                {postingOther ? 'Posting Transaction...' : 'Post General Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Chart of Accounts (COA) */}
      {activeTab === 'accounts' && (
        <div className="tab-pane animation-fade">
          <div className="flex-space" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Chart of Accounts (COA)</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportAccountsExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download Excel
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportAccountsPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddAccountModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Add Custom Account
              </button>
            </div>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="excel-table">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '16px' }}>Code</th>
                  <th style={{ padding: '16px' }}>Name</th>
                  <th style={{ padding: '16px' }}>Type</th>
                  <th style={{ padding: '16px' }}>Debits</th>
                  <th style={{ padding: '16px' }}>Credits</th>
                  <th style={{ padding: '16px' }}>Balance</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => {
                  const balanceNum = Number(acc.balance);
                  const isNegative = balanceNum < 0;
                  return (
                    <tr key={acc.id} className="table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '16px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{acc.code}</td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{acc.name}</td>
                      <td style={{ padding: '16px' }}>
                        <span className={`badge ${
                          acc.type === 'asset' ? 'badge-info' :
                          acc.type === 'liability' ? 'badge-danger' :
                          acc.type === 'equity' ? 'badge-success' :
                          acc.type === 'revenue' ? 'badge-success' : 'badge-warning'
                        }`} style={{ textTransform: 'capitalize' }}>
                          {acc.type}
                        </span>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{formatCurrency(acc.total_debits)}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{formatCurrency(acc.total_credits)}</td>
                      <td style={{ padding: '16px', fontWeight: 700, color: isNegative ? 'var(--error-rose)' : 'var(--text-primary)' }}>
                        {isNegative ? `(${formatCurrency(Math.abs(balanceNum))})` : formatCurrency(balanceNum)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }} onClick={() => fetchAccountLedger(acc)}>
                          <Eye size={14} /> Ledger Audit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Trial Balance */}
      {activeTab === 'trial' && (
        <div className="tab-pane animation-fade">
          <div className="flex-space" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Trial Balance</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Listing net balance of each account code. Debits must equal credits.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportTrialBalanceExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download Excel
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportTrialBalancePDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download PDF
              </button>

              {/* Status indicator */}
              {(() => {
                const totalDeb = trialBalance.reduce((sum, r) => sum + Number(r.debit_balance), 0);
                const totalCred = trialBalance.reduce((sum, r) => sum + Number(r.credit_balance), 0);
                const balanced = Math.abs(totalDeb - totalCred) < 0.05;
                return (
                  <div className={`badge ${balanced ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 16px', fontSize: '0.9rem', marginLeft: '10px' }}>
                    {balanced ? 'Balanced' : `Out of Balance: ${formatCurrency(Math.abs(totalDeb - totalCred))}`}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Account Type</th>
                  <th style={{ textAlign: 'right' }}>Debit Balance</th>
                  <th style={{ textAlign: 'right' }}>Credit Balance</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.map(row => {
                  const debVal = Number(row.debit_balance);
                  const credVal = Number(row.credit_balance);
                  if (debVal === 0 && credVal === 0) return null; // Skip accounts with no values
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{row.code}</td>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{row.type}</td>
                      <td style={{ textAlign: 'right', fontWeight: debVal > 0 ? 700 : 400 }}>
                        {debVal > 0 ? formatCurrency(debVal) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: credVal > 0 ? 700 : 400 }}>
                        {credVal > 0 ? formatCurrency(credVal) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="excel-table-totals">
                  <td>Total</td>
                  <td>-</td>
                  <td>-</td>
                  <td style={{ textAlign: 'right', fontSize: '1.05rem', color: 'var(--accent-cyan)' }}>
                    {formatCurrency(trialBalance.reduce((sum, r) => sum + Number(r.debit_balance), 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '1.05rem', color: 'var(--accent-cyan)' }}>
                    {formatCurrency(trialBalance.reduce((sum, r) => sum + Number(r.credit_balance), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Income Statement (Operations) */}
      {activeTab === 'operations' && (
        <div className="tab-pane animation-fade" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            {/* Report Header */}
            <div className="flex-space" style={{ marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px' }}>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Statement of Operations</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Antigravity Supermarket Ledger</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  For the period: {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={exportOperationsExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Download Excel
                </button>
                <button className="btn btn-secondary btn-sm" onClick={exportOperationsPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Download PDF
                </button>
              </div>
            </div>

            {operationsData ? (
              <div className="table-responsive">
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th>Account / Category</th>
                      <th>Account Code</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Revenue Row Category Header */}
                    <tr style={{ background: 'rgba(6, 182, 212, 0.08)' }}>
                      <td style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Revenue</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                    {operationsData.revenues.map(rev => (
                      <tr key={rev.code}>
                        <td style={{ paddingLeft: '24px' }}>{rev.name}</td>
                        <td>{rev.code}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(rev.balance)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ paddingLeft: '16px' }}>Total Net Revenue</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(operationsData.totalRevenue)}</td>
                    </tr>

                    {/* COGS */}
                    <tr style={{ borderTop: '1px dashed var(--glass-border)', borderBottom: '1px dashed var(--glass-border)' }}>
                      <td style={{ fontWeight: 700, color: 'var(--error-rose)' }}>Cost of Goods Sold (COGS)</td>
                      <td>5010</td>
                      <td style={{ textAlign: 'right', color: 'var(--error-rose)', fontWeight: 700 }}>{formatCurrency(operationsData.cogs)}</td>
                    </tr>

                    {/* Gross Profit */}
                    <tr className="excel-table-totals">
                      <td style={{ fontWeight: 700 }}>Gross Operating Profit</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>{formatCurrency(operationsData.grossProfit)}</td>
                    </tr>

                    {/* Expenses Row Category Header */}
                    <tr style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
                      <td style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning-amber)' }}>Operating Expenses</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                    {operationsData.operatingExpenses.map(exp => (
                      <tr key={exp.code}>
                        <td style={{ paddingLeft: '24px' }}>{exp.name}</td>
                        <td>{exp.code}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(exp.balance)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ paddingLeft: '16px' }}>Total Operating Expenses</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(operationsData.totalOperatingExpenses)}</td>
                    </tr>

                    {/* Net Income */}
                    <tr className="excel-table-totals" style={{ borderTop: '2px solid var(--success-emerald)', borderBottom: '3px double var(--success-emerald)' }}>
                      <td style={{ fontWeight: 800 }}>Net Operating Income</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', color: 'var(--success-emerald)', fontSize: '1.15rem' }}>{formatCurrency(operationsData.netIncome)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-center" style={{ minHeight: '20vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No financial operational data loaded.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Balance Sheet (Position) */}
      {activeTab === 'position' && (
        <div className="tab-pane animation-fade" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            
            {/* Filter As Of Date & Exports */}
            <div className="flex-space" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Statement of Financial Position</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Balance Sheet</p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>As Of Date:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '140px', padding: '6px 8px', fontSize: '0.85rem', margin: 0 }}
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={exportPositionExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} /> Download Excel
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={exportPositionPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} /> Download PDF
                  </button>
                </div>
              </div>
            </div>

            {positionData ? (
              <div className="table-responsive">
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th>Account Name / Category</th>
                      <th>Account Code</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ASSETS */}
                    <tr style={{ background: 'rgba(6, 182, 212, 0.08)' }}>
                      <td style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Assets</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                    {positionData.assets.map(asset => (
                      <tr key={asset.code}>
                        <td style={{ paddingLeft: '24px' }}>{asset.name}</td>
                        <td>{asset.code}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(asset.balance)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ paddingLeft: '16px' }}>Total Assets</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #fff' }}>{formatCurrency(positionData.totalAssets)}</td>
                    </tr>

                    {/* LIABILITIES */}
                    <tr style={{ background: 'rgba(244, 63, 94, 0.08)' }}>
                      <td style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--error-rose)' }}>Liabilities</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                    {positionData.liabilities.length > 0 ? (
                      positionData.liabilities.map(liab => (
                        <tr key={liab.code}>
                          <td style={{ paddingLeft: '24px' }}>{liab.name}</td>
                          <td>{liab.code}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(liab.balance)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ paddingLeft: '24px', fontStyle: 'italic', color: 'var(--text-muted)' }}>No liabilities recorded</td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ paddingLeft: '16px' }}>Total Liabilities</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(positionData.totalLiabilities)}</td>
                    </tr>

                    {/* EQUITY */}
                    <tr style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                      <td style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--success-emerald)' }}>Equity</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                    {positionData.equity.map(eq => (
                      <tr key={eq.code}>
                        <td style={{ paddingLeft: '24px' }}>{eq.name}</td>
                        <td>{eq.code}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(eq.balance)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ paddingLeft: '16px' }}>Total Equity</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(positionData.totalEquity)}</td>
                    </tr>

                    {/* Grand totals row */}
                    <tr className="excel-table-totals" style={{ borderTop: '2px solid var(--success-emerald)', borderBottom: '3px double var(--success-emerald)' }}>
                      <td style={{ fontWeight: 800 }}>Total Liabilities & Equity</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right', color: 'var(--success-emerald)', fontSize: '1.15rem' }}>{formatCurrency(positionData.totalLiabilitiesAndEquity)}</td>
                    </tr>
                  </tbody>
                </table>
                
                {/* Verification Check */}
                <div style={{ marginTop: '16px' }}>
                  {Math.abs(positionData.totalAssets - positionData.totalLiabilitiesAndEquity) < 0.05 ? (
                    <div className="badge badge-success flex-center" style={{ padding: '8px 16px', gap: '8px', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}>
                      <Scale size={16} /> Asset & Equity/Liability sides are in Balance.
                    </div>
                  ) : (
                    <div className="badge badge-danger flex-center" style={{ padding: '8px 16px', gap: '8px', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}>
                      <AlertCircle size={16} /> Warning: Out of Balance by {formatCurrency(Math.abs(positionData.totalAssets - positionData.totalLiabilitiesAndEquity))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-center" style={{ minHeight: '20vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No balance sheet data loaded.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Statement of Cashflow */}
      {activeTab === 'cashflow' && (
        <div className="tab-pane animation-fade" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            {/* Report Header */}
            <div className="flex-space" style={{ marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px' }}>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Statement of Cashflows</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Direct Method Analysis</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  For the period: {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={exportCashflowExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Download Excel
                </button>
                <button className="btn btn-secondary btn-sm" onClick={exportCashflowPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Download PDF
                </button>
              </div>
            </div>

            {cashflowData ? (
              <div className="table-responsive">
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th>Cash Flow Category / Activity</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* CASH INFLOWS */}
                    <tr style={{ background: 'rgba(6, 182, 212, 0.08)' }}>
                      <td style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Cash Inflows</td>
                      <td>-</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '24px' }}>Cash Received from Customers (Sales)</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(cashflowData.cashInflows.fromSales)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '24px' }}>Cash Received from Equity Contributions</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(cashflowData.cashInflows.fromEquity)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '24px' }}>Other Cash Inflows</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(cashflowData.cashInflows.otherInflows)}</td>
                    </tr>
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ paddingLeft: '16px' }}>Total Cash Inflows</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(cashflowData.cashInflows.totalInflows)}</td>
                    </tr>

                    {/* CASH OUTFLOWS */}
                    <tr style={{ background: 'rgba(244, 63, 94, 0.08)' }}>
                      <td style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--error-rose)' }}>Cash Outflows</td>
                      <td>-</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '24px' }}>Cash Paid to Suppliers</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(cashflowData.cashOutflows.paidToSuppliers)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '24px' }}>Cash Paid for Expenses</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(cashflowData.cashOutflows.paidForExpenses)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '24px' }}>Other Cash Outflows</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(cashflowData.cashOutflows.otherOutflows)}</td>
                    </tr>
                    <tr style={{ fontWeight: 600 }}>
                      <td style={{ paddingLeft: '16px' }}>Total Cash Outflows</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(cashflowData.cashOutflows.totalOutflows)}</td>
                    </tr>

                    {/* NET SUMMARY */}
                    <tr style={{ background: 'rgba(255,255,255,0.02)', fontWeight: 700 }}>
                      <td>Net Operating Cash Flow</td>
                      <td style={{ textAlign: 'right', color: cashflowData.netOperatingCash >= 0 ? 'var(--success-emerald)' : 'var(--error-rose)' }}>
                        {formatCurrency(cashflowData.netOperatingCash)}
                      </td>
                    </tr>
                    <tr className="excel-table-totals">
                      <td style={{ fontWeight: 800 }}>Net Cash Increase / (Decrease)</td>
                      <td style={{ textAlign: 'right', color: cashflowData.netCashFlow >= 0 ? 'var(--accent-cyan)' : 'var(--error-rose)', fontSize: '1.15rem' }}>
                        {formatCurrency(cashflowData.netCashFlow)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-center" style={{ minHeight: '20vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No cash flow statement data loaded.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Journal Entry Log */}
      {activeTab === 'journal' && (
        <div className="tab-pane animation-fade">
          <div className="flex-space" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Journal Entries (Ledger Log)</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Chronological feed of all automated and manual double-entry transactions.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportJournalExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download Excel
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportJournalPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Download PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewJEModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Post Journal Entry
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {journalEntries.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: '40px', flexDirection: 'column', gap: '12px' }}>
                <BookOpen size={48} className="text-muted" />
                <p style={{ color: 'var(--text-secondary)' }}>No journal entries have been recorded yet.</p>
              </div>
            ) : (
              journalEntries.map(entry => {
                const isExpanded = !!expandedJE[entry.id];
                const totalDeb = entry.items.reduce((sum, item) => sum + Number(item.debit), 0);
                return (
                  <div className="glass-card" key={entry.id} style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid var(--accent-cyan)' }}>
                    
                    {/* Entry Header row */}
                    <div className="flex-space" style={{ cursor: 'pointer', flexWrap: 'wrap', gap: '12px' }} onClick={() => toggleJE(entry.id)}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID</span>
                          <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>#{entry.id}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date</span>
                          <p style={{ fontSize: '0.9rem' }}>{new Date(entry.entry_date).toLocaleDateString()} {new Date(entry.entry_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Description</span>
                          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{entry.description}</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Reference</span>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            <span className="badge badge-info">{entry.reference}</span>
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Value</span>
                          <p style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{formatCurrency(totalDeb)}</p>
                        </div>
                        {isExpanded ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
                      </div>
                    </div>

                    {/* Collapsible Details */}
                    {isExpanded && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <th style={{ padding: '8px' }}>Code</th>
                              <th style={{ padding: '8px' }}>Account</th>
                              <th style={{ padding: '8px', textAlign: 'right' }}>Debit</th>
                              <th style={{ padding: '8px', textAlign: 'right' }}>Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.items.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.account_code}</td>
                                <td style={{ padding: '8px', paddingLeft: Number(item.credit) > 0 ? '24px' : '8px', fontWeight: 600 }}>
                                  {item.account_name}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', color: Number(item.debit) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  {Number(item.debit) > 0 ? formatCurrency(item.debit) : '-'}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', color: Number(item.credit) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  {Number(item.credit) > 0 ? formatCurrency(item.credit) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Audited: Ledger Entry Posted Successfully</span>
                          <span>Posted by: {entry.created_by_username || 'system'}</span>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Period Closings */}
      {activeTab === 'closings' && (
        <div className="tab-pane animation-fade">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', alignItems: 'start' }}>
            
            {/* Action Card: Close a Period */}
            <div className="glass-card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar className="text-accent" size={22} /> Close Financial Period
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Closing temporary accounts transfers their net balance (profit/loss) to Retained Earnings and locks the period.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Period Type</label>
                <select
                  className="form-select"
                  value={closePeriodType}
                  onChange={(e) => {
                    setClosePeriodType(e.target.value as 'month' | 'year');
                    setClosePeriodName('');
                    setClosingPreview(null);
                  }}
                >
                  <option value="month">Monthly Close</option>
                  <option value="year">Yearly Close</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">
                  {closePeriodType === 'month' ? 'Select Month (YYYY-MM)' : 'Select Year (YYYY)'}
                </label>
                {closePeriodType === 'month' ? (
                  <input
                    type="month"
                    className="form-input"
                    value={closePeriodName}
                    onChange={(e) => {
                      setClosePeriodName(e.target.value);
                      setClosingPreview(null);
                    }}
                    required
                  />
                ) : (
                  <select
                    className="form-select"
                    value={closePeriodName}
                    onChange={(e) => {
                      setClosePeriodName(e.target.value);
                      setClosingPreview(null);
                    }}
                    required
                  >
                    <option value="">-- Select Year --</option>
                    {(() => {
                      const currentYear = new Date().getFullYear();
                      const years = [];
                      for (let y = currentYear - 5; y <= currentYear + 1; y++) {
                        years.push(y);
                      }
                      return years.map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                      ));
                    })()}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)' }}
                  onClick={handleCalculatePreview}
                  disabled={closingPreviewLoading || !closePeriodName}
                >
                  {closingPreviewLoading ? 'Calculating...' : 'Preview Closing Summary'}
                </button>
                {closingPreview && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, backgroundColor: 'var(--success-emerald)', borderColor: 'var(--success-emerald)' }}
                    onClick={handleClosePeriod}
                  >
                    Close Period
                  </button>
                )}
              </div>

              {/* Preview Section */}
              {closingPreview && (
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                    Closing Summary Preview
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                    <div className="flex-space">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Projected Revenues:</span>
                      <span style={{ fontWeight: 600, color: 'var(--success-emerald)' }}>{formatCurrency(closingPreview.totalRevenue)}</span>
                    </div>
                    <div className="flex-space">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Projected Expenses:</span>
                      <span style={{ fontWeight: 600, color: 'var(--error-rose)' }}>{formatCurrency(closingPreview.totalExpense)}</span>
                    </div>
                    <div className="flex-space" style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Projected Net Profit / (Loss):</span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: closingPreview.netProfit >= 0 ? 'var(--success-emerald)' : 'var(--error-rose)' }}>
                        {formatCurrency(closingPreview.netProfit)}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      ⚠️ <strong>Warning:</strong> Closing this period will post a dynamic Journal Entry matching revenue & expense balances, bringing their respective ledger feeds to 0.00 and recording the net income to owner retained earnings.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* List Table Card: Closed Periods */}
            <div className="glass-card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px' }}>
                Closed Periods History
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Historical closed accounting logs and locks.
              </p>

              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="excel-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Type</th>
                      <th>End Date (Closed)</th>
                      <th>Closed By</th>
                      <th style={{ textAlign: 'right' }}>Journal Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedPeriods.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No closed periods on record.
                        </td>
                      </tr>
                    ) : (
                      closedPeriods.map(cp => (
                        <tr key={cp.id} className="table-row">
                          <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{cp.period_name}</td>
                          <td style={{ textTransform: 'capitalize' }}>{cp.period_type}</td>
                          <td>{new Date(cp.closed_at).toLocaleDateString()}</td>
                          <td>{cp.closed_by_username || 'system'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => {
                              setActiveTab('journal');
                              setNewJeRef(`close:${cp.period_type}:${cp.period_name}`);
                            }}>
                              {cp.journal_entry_id ? `#${cp.journal_entry_id}` : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* MODAL: ADD ACCOUNT */}
      {showAddAccountModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '450px', padding: '24px' }}>
            <div className="flex-space" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Add Custom Account</h2>
              <button className="btn-close" onClick={() => setShowAddAccountModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddAccount}>
              <div className="form-group">
                <label className="form-label">Account Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 5050"
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose a unique identifier (Asset: 1xxx, Liab: 2xxx, Equity: 3xxx, Rev: 4xxx, Exp: 5xxx)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Store Rent Expense"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select
                  className="form-select"
                  value={newAccountType}
                  onChange={(e: any) => setNewAccountType(e.target.value)}
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddAccountModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW LEDGER */}
      {showLedgerModal && selectedLedgerAccount && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '800px', width: '90%', padding: '24px' }}>
            <div className="flex-space" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                  Ledger: {selectedLedgerAccount.code} - {selectedLedgerAccount.name}
                </h2>
                <span className="badge badge-info" style={{ textTransform: 'capitalize', marginTop: '4px' }}>
                  {selectedLedgerAccount.type}
                </span>
              </div>
              <button className="btn-close" onClick={() => setShowLedgerModal(false)}>
                <X size={20} />
              </button>
            </div>

            {ledgerLoading ? (
              <div className="flex-center" style={{ minHeight: '30vh' }}>
                <div className="spinner"></div>
              </div>
            ) : ledgerLines.length === 0 ? (
              <div className="flex-center" style={{ minHeight: '30vh', flexDirection: 'column', gap: '8px' }}>
                <AlertCircle size={32} className="text-muted" />
                <p style={{ color: 'var(--text-secondary)' }}>No transactions found for this account in the selected period.</p>
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ padding: '12px' }}>Date</th>
                      <th style={{ padding: '12px' }}>Journal Entry</th>
                      <th style={{ padding: '12px' }}>Reference</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Debit</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Credit</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLines.map(line => {
                      return (
                        <tr key={line.item_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                            {new Date(line.entry_date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{line.description}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="badge badge-info">{line.reference}</span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: line.debit > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: line.credit > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(line.running_balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowLedgerModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW JOURNAL ENTRY */}
      {showNewJEModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '750px', width: '90%', padding: '24px' }}>
            <div className="flex-space" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Post Manual Journal Entry</h2>
              <button className="btn-close" onClick={() => setShowNewJEModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePostJournalEntry}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Entry Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newJeDate}
                    onChange={(e) => setNewJeDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference ID (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. rent:2024-07"
                    value={newJeRef}
                    onChange={(e) => setNewJeRef(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Entry Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Describe the adjustment/transaction..."
                  value={newJeDesc}
                  onChange={(e) => setNewJeDesc(e.target.value)}
                  required
                />
              </div>

              {/* JE items editor list */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Journal Entry Items (Debits & Credits)</label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {newJeItems.map((item, index) => (
                    <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      
                      {/* Account selection */}
                      <select
                        className="form-select"
                        style={{ flex: 2, padding: '8px 12px', fontSize: '0.85rem' }}
                        value={item.account_id}
                        onChange={(e) => handleJeItemChange(index, 'account_id', e.target.value)}
                        required
                      >
                        <option value={0}>-- Select Account --</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>

                      {/* Debit amount */}
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Debit"
                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', textAlign: 'right', margin: 0 }}
                        value={item.debit}
                        onChange={(e) => handleJeItemChange(index, 'debit', e.target.value)}
                        disabled={!!item.credit}
                        step="0.01"
                        min="0"
                      />

                      {/* Credit amount */}
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Credit"
                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', textAlign: 'right', margin: 0 }}
                        value={item.credit}
                        onChange={(e) => handleJeItemChange(index, 'credit', e.target.value)}
                        disabled={!!item.debit}
                        step="0.01"
                        min="0"
                      />

                      {/* Remove button */}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '8px', color: 'var(--error-rose)' }}
                        onClick={() => handleRemoveJeItem(index)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '12px', padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}
                  onClick={handleAddJeItem}
                >
                  <Plus size={14} /> Add Debit/Credit Line
                </button>
              </div>

              {/* Live sums row */}
              {(() => {
                const { debits, credits, difference } = jeSums();
                const isBalanced = difference < 0.01;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)', marginTop: '20px' }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Total Debits: <strong style={{ color: '#fff' }}>{formatCurrency(debits)}</strong>
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Total Credits: <strong style={{ color: '#fff' }}>{formatCurrency(credits)}</strong>
                      </span>
                    </div>

                    <div>
                      {isBalanced ? (
                        <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>Balanced</span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontSize: '0.8rem' }}>
                          Out of balance: {formatCurrency(difference)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewJEModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={jeSums().difference > 0.01}>
                  Post Ledger Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled JSX/CSS Specific to Financials Layout */}
      <style dangerouslySetInnerHTML={{__html: `
        .financials-page .tab-btn {
          padding: 10px 18px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 0.9rem;
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition-smooth);
          white-space: nowrap;
        }

        .financials-page .tab-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
        }

        .financials-page .tab-btn.active {
          color: #000;
          background: var(--accent-cyan);
          font-weight: 600;
        }

        .financials-page .card-stat {
          padding: 20px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: rgba(22, 30, 54, 0.5);
          height: 140px;
        }

        .financials-page .stat-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .financials-page .stat-value {
          font-size: 1.6rem;
          font-weight: 700;
          margin-top: 8px;
          line-height: 1.2;
        }

        .financials-page .stat-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: auto;
        }

        .financials-page .icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .financials-page .bg-cyan-glow { background: var(--accent-cyan-glow); }
        .financials-page .bg-rose-glow { background: var(--error-rose-glow); }
        .financials-page .bg-emerald-glow { background: var(--success-emerald-glow); }

        .financials-page .text-cyan { color: var(--accent-cyan); }
        .financials-page .text-rose { color: var(--error-rose); }
        .financials-page .text-emerald { color: var(--success-emerald); }

        /* Modal classes styling */
        .financials-page .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(11, 15, 25, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .financials-page .modal-content {
          width: 100%;
          border-radius: 16px;
          background: rgba(22, 30, 54, 0.95);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          position: relative;
        }

        .financials-page .btn-close {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          transition: var(--transition-smooth);
        }

        .financials-page .btn-close:hover {
          color: var(--text-primary);
        }

        .financials-page .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          line-height: 1;
        }

        .financials-page .badge-info {
          background: var(--accent-cyan-glow);
          color: var(--accent-cyan);
          border: 1px solid rgba(6, 182, 212, 0.1);
        }

        .financials-page .badge-success {
          background: var(--success-emerald-glow);
          color: var(--success-emerald);
          border: 1px solid rgba(16, 185, 129, 0.1);
        }

        .financials-page .badge-danger {
          background: var(--error-rose-glow);
          color: var(--error-rose);
          border: 1px solid rgba(244, 63, 94, 0.1);
        }

        .financials-page .badge-warning {
          background: var(--warning-amber-glow);
          color: var(--warning-amber);
          border: 1px solid rgba(245, 158, 11, 0.1);
        }

        /* Animation class */
        .financials-page .animation-fade {
          animation: fadeEffect 0.3s ease-in-out;
        }

        @keyframes fadeEffect {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .financials-page .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.05);
          border-radius: 50%;
          border-top-color: var(--accent-cyan);
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .financials-page .spinner-bar {
          animation: slideProgress 1.5s ease-in-out infinite;
        }

        @keyframes slideProgress {
          0% { left: -30%; }
          50% { left: 50%; width: 40%; }
          100% { left: 110%; }
        }

        /* Excel Table Styles */
        .excel-table {
          width: 100%;
          border-collapse: collapse;
          font-family: inherit;
          color: var(--text-primary);
          margin-top: 16px;
          background: rgba(10, 15, 30, 0.4);
          border: 1px solid var(--glass-border);
          border-radius: 4px;
        }
        .excel-table th {
          background: rgba(30, 58, 138, 0.85); /* Navy blue header matching Excel theme */
          color: #ffffff;
          font-weight: 600;
          padding: 12px 16px;
          border: 1px solid var(--glass-border);
          font-size: 0.85rem;
          text-align: left;
        }
        .excel-table td {
          padding: 10px 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.9rem;
        }
        .excel-table tr:nth-child(even) td {
          background: rgba(255, 255, 255, 0.01);
        }
        .excel-table tr:hover td {
          background: rgba(6, 182, 212, 0.05);
        }
        .excel-table-totals td {
          font-weight: bold !important;
          background: rgba(6, 182, 212, 0.08) !important;
          border-top: 1.5px solid var(--accent-cyan) !important;
          border-bottom: 3px double var(--accent-cyan) !important; /* Excel totals underline */
        }
      `}} />

    </div>
  );
};
export default Financials;
