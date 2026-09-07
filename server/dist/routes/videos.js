import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
export const videosRouter = Router();
// GET /api/videos?active=true - public list for landing/home hero
videosRouter.get('/', async (req, res) => {
    const active = req.query.active;
    const { rows } = active === 'true'
        ? await pool.query('SELECT * FROM videos WHERE is_active ORDER BY sort_order, created_at DESC')
        : await pool.query('SELECT * FROM videos ORDER BY sort_order, created_at DESC');
    res.json(rows);
});
// GET /api/videos/:id - single video
videosRouter.get('/:id', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM videos WHERE id=$1', [req.params.id]);
    if (!rows[0])
        return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
});
// POST /api/videos (admin) - add promo/hero video
videosRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const b = req.body || {};
    if (!b.title_en?.trim())
        return res.status(400).json({ error: 'title_en required' });
    if (!b.url?.trim())
        return res.status(400).json({ error: 'url required' });
    const { rows } = await pool.query(`INSERT INTO videos (title_en, title_ar, description_en, description_ar, url, thumbnail, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [b.title_en.trim(), b.title_ar?.trim() || '', b.description_en || '', b.description_ar || '',
        b.url.trim(), b.thumbnail || '', b.is_active ?? b.isActive ?? true, Number(b.sort_order ?? b.sortOrder) || 0]);
    res.status(201).json(rows[0]);
});
// PUT /api/videos/:id (admin) - edit video
videosRouter.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const b = req.body || {};
    const { rows } = await pool.query(`UPDATE videos SET title_en=COALESCE($1,title_en), title_ar=COALESCE($2,title_ar),
      description_en=COALESCE($3,description_en), description_ar=COALESCE($4,description_ar),
      url=COALESCE($5,url), thumbnail=COALESCE($6,thumbnail),
      is_active=COALESCE($7,is_active), sort_order=COALESCE($8,sort_order),
      updated_at=now() WHERE id=$9 RETURNING *`, [b.title_en ?? null, b.title_ar ?? null, b.description_en ?? null, b.description_ar ?? null,
        b.url ?? null, b.thumbnail ?? null, b.is_active ?? b.isActive ?? null,
        b.sort_order ?? b.sortOrder ?? null, req.params.id]);
    if (!rows[0])
        return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
});
// DELETE /api/videos/:id (admin) - remove video
videosRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM videos WHERE id=$1', [req.params.id]);
    if (!rowCount)
        return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
});
