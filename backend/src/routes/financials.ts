import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getJournalEntries,
  createJournalEntry,
  getTrialBalance,
  getStatementOfOperations,
  getStatementOfFinancialPosition,
  getStatementOfCashflow,
  getAccountLedger,
  getStagingTransactions,
  postTransactions,
  postOtherTransaction,
  rejectTransactions,
  getClosedPeriods,
  closePeriod
} from '../controllers/financialsController';

const router = Router();

// Apply auth middleware to all financials endpoints
router.use(authenticate);
router.use(authorize('admin', 'manager', 'stock_clerk'));

// Chart of accounts CRUD
router.get('/accounts', getAccounts);
router.post('/accounts', createAccount);
router.put('/accounts/:id', updateAccount);
router.delete('/accounts/:id', deleteAccount);
router.get('/accounts/:id/ledger', getAccountLedger);

// Journal entries
router.get('/journal-entries', getJournalEntries);
router.post('/journal-entries', createJournalEntry);

// Reports
router.get('/trial-balance', getTrialBalance);
router.get('/statement-of-operations', getStatementOfOperations);
router.get('/statement-of-financial-position', getStatementOfFinancialPosition);
router.get('/statement-of-cashflow', getStatementOfCashflow);

// Staging & General Transaction Posting
router.get('/staging-transactions', getStagingTransactions);
router.post('/post-transactions', postTransactions);
router.post('/post-other', postOtherTransaction);
router.post('/reject-transactions', rejectTransactions);

// Closings and locking
router.get('/closed-periods', getClosedPeriods);
router.post('/close-period', closePeriod);

export default router;
