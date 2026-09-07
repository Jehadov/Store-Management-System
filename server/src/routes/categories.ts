import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const categoriesRouter = Router();

// GET /api/categories
categoriesRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY name_en');
  res.json(rows);
});

// POST /api/categories (admin) - fixes open /admin bug from App.tsx:71
// image is required (URL or /uploads/... path from POST /upload)
categoriesRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name_en, name_ar, image } = req.body;
  if (!name_en?.trim() && !name_ar?.trim()) {
    return res.status(400).json({ error: 'name_en or name_ar required' });
  }
  if (!image?.trim()) {
    return res.status(400).json({ error: 'image required (upload via POST /upload first)' });
  }
  const { rows } = await pool.query(
    'INSERT INTO categories (name_en, name_ar, image) VALUES ($1,$2,$3) RETURNING *',
    [name_en?.trim() || '', name_ar?.trim() || '', image || '']
  );
  res.status(201).json(rows[0]);
});

// PUT /api/categories/:id (admin)
categoriesRouter.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { name_en, name_ar, image } = req.body;
  const { rows } = await pool.query(
    'UPDATE categories SET name_en=$1, name_ar=$2, image=$3, updated_at=now() WHERE id=$4 RETURNING *',
    [name_en || '', name_ar || '', image || '', req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// DELETE /api/categories/:id - blocked if products use it (fixes Firestore orphan bug)
categoriesRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const used = await pool.query('SELECT 1 FROM product_categories WHERE category_id=$1 LIMIT 1', [req.params.id]);
  if (used.rowCount) {
    return res.status(409).json({ error: 'Category in use by products. Reassign products first.' });
  }
  await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});
