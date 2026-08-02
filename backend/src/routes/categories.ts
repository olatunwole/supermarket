import { Router } from 'express';
import { query } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await query('SELECT * FROM categories WHERE tenant_id = $1 ORDER BY name', [tenantId]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  const tenantId = req.user?.tenant_id;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const result = await query('INSERT INTO categories (tenant_id, name, description) VALUES ($1,$2,$3) RETURNING *', [tenantId, name, description||null]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'Category already exists' }); return; }
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await query(
      'UPDATE categories SET name=COALESCE($1,name),description=COALESCE($2,description),updated_at=NOW() WHERE id=$3 AND tenant_id=$4 RETURNING *',
      [name, description, req.params.id, tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Category not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
