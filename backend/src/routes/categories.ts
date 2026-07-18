import { Router } from 'express';
import { query } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const result = await query('INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING *', [name, description||null]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'Category already exists' }); return; }
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await query(
      'UPDATE categories SET name=COALESCE($1,name),description=COALESCE($2,description),updated_at=NOW() WHERE id=$3 RETURNING *',
      [name, description, req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Category not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
