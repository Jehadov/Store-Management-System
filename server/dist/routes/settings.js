import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
export const settingsRouter = Router();
// GET /api/settings - public shop identity (name EN/AR + logo for header)
settingsRouter.get('/', async (_req, res) => {
    const { rows } = await pool.query('SELECT name_en, name_ar, logo_url FROM settings WHERE id=1');
    res.json(rows[0] || { name_en: 'My Restaurant', name_ar: 'مطعمي', logo_url: '' });
});
// PUT /api/settings (admin) - update shop identity
settingsRouter.put('/', requireAuth, requireRole('admin'), async (req, res) => {
    const b = req.body || {};
    const { rows } = await pool.query(`UPDATE settings SET name_en=COALESCE($1,name_en), name_ar=COALESCE($2,name_ar),
      logo_url=COALESCE($3,logo_url), updated_at=now() WHERE id=1 RETURNING name_en, name_ar, logo_url`, [b.name_en ?? null, b.name_ar ?? null, b.logo_url ?? b.logoUrl ?? null]);
    res.json(rows[0]);
});
