import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const [todaySales, totalProducts, lowStock, topProducts, valuation] = await Promise.all([
      query(`SELECT COALESCE(SUM(total_amount),0) as today_revenue, COUNT(*) as today_transactions FROM sales WHERE tenant_id = $1 AND sale_date::date = CURRENT_DATE`, [tenantId]),
      query(`SELECT COUNT(*) as total_products FROM products WHERE tenant_id = $1`, [tenantId]),
      query(`SELECT COUNT(*) as low_stock_count FROM products WHERE quantity_on_hand <= reorder_threshold AND tenant_id = $1`, [tenantId]),
      query(`SELECT p.name, SUM(si.quantity) as total_sold, SUM(si.quantity*si.unit_price) as revenue
             FROM sale_items si JOIN products p ON si.product_id=p.id
             WHERE p.tenant_id = $1
             GROUP BY p.id, p.name ORDER BY total_sold DESC LIMIT 5`, [tenantId]),
      query(`SELECT COALESCE(SUM(quantity_on_hand * cost_price),0) as cost_value, COALESCE(SUM(quantity_on_hand * unit_price),0) as retail_value FROM products WHERE tenant_id = $1`, [tenantId]),
    ]);
    res.json({
      today: { revenue: todaySales.rows[0].today_revenue, transactions: todaySales.rows[0].today_transactions },
      inventory: { total_products: totalProducts.rows[0].total_products, low_stock_count: lowStock.rows[0].low_stock_count },
      valuation: valuation.rows[0],
      top_products: topProducts.rows,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
};

export const getSalesReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { from, to, group_by } = req.query;
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];
  try {
    let dateGroup = `sale_date::date`;
    if (group_by === 'week') dateGroup = `date_trunc('week', sale_date)`;
    if (group_by === 'month') dateGroup = `date_trunc('month', sale_date)`;

    const [byDate, byCategory, byCashier] = await Promise.all([
      query(`SELECT ${dateGroup} as period, COUNT(*) as transactions, SUM(total_amount) as revenue
             FROM sales WHERE tenant_id = $3 AND sale_date::date BETWEEN $1 AND $2 GROUP BY period ORDER BY period`, [fromDate, toDate, tenantId]),
      query(`SELECT c.name as category, SUM(si.quantity) as units_sold, SUM(si.quantity*si.unit_price) as revenue
             FROM sale_items si JOIN products p ON si.product_id=p.id JOIN categories c ON p.category_id=c.id
             JOIN sales s ON si.sale_id=s.id WHERE s.tenant_id = $3 AND s.sale_date::date BETWEEN $1 AND $2
             GROUP BY c.name ORDER BY revenue DESC`, [fromDate, toDate, tenantId]),
      query(`SELECT u.username as cashier, COUNT(DISTINCT s.id) as transactions, SUM(s.total_amount) as revenue
             FROM sales s JOIN users u ON s.cashier_id=u.id
             WHERE s.tenant_id = $3 AND s.sale_date::date BETWEEN $1 AND $2
             GROUP BY u.username ORDER BY revenue DESC`, [fromDate, toDate, tenantId]),
    ]);
    res.json({ period: { from: fromDate, to: toDate }, by_date: byDate.rows, by_category: byCategory.rows, by_cashier: byCashier.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
};

export const getInventoryValuation = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await query(`
      SELECT p.id, p.name, p.sku, p.quantity_on_hand, p.cost_price, p.unit_price,
        (p.quantity_on_hand * p.cost_price) as total_cost_value,
        (p.quantity_on_hand * p.unit_price) as total_retail_value,
        c.name as category_name
      FROM products p LEFT JOIN categories c ON p.category_id=c.id
      WHERE p.tenant_id = $1
      ORDER BY total_cost_value DESC
    `, [tenantId]);
    const totals = await query(`SELECT COALESCE(SUM(quantity_on_hand*cost_price),0) as total_cost, COALESCE(SUM(quantity_on_hand*unit_price),0) as total_retail FROM products WHERE tenant_id = $1`, [tenantId]);
    res.json({ items: result.rows, totals: totals.rows[0] });
  } catch { res.status(500).json({ error: 'Server error' }); }
};

export const getProductPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { from, to } = req.query;
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];
  try {
    const result = await query(`
      SELECT p.id, p.name, p.sku, c.name as category,
        COALESCE(SUM(si.quantity),0) as units_sold,
        COALESCE(SUM(si.quantity*si.unit_price),0) as revenue,
        COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price)),0) as profit
      FROM products p
      LEFT JOIN categories c ON p.category_id=c.id
      LEFT JOIN sale_items si ON p.id=si.product_id
      LEFT JOIN sales s ON si.sale_id=s.id AND s.sale_date::date BETWEEN $1 AND $2
      WHERE p.tenant_id = $3
      GROUP BY p.id, p.name, p.sku, c.name
      ORDER BY units_sold DESC
    `, [fromDate, toDate, tenantId]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
};
