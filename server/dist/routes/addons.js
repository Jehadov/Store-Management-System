import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
export const addonsRouter = Router();
// GET /api/addons
addonsRouter.get('/', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM addons ORDER BY name_en');
    res.json(rows);
});
// POST /api/addons (admin) - replaces ManageAddOns
addonsRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const { name_en, name_ar, extraPrice } = req.body;
    if (!name_en?.trim())
        return res.status(400).json({ error: 'name_en required' });
    const { rows } = await pool.query('INSERT INTO addons (name_en, name_ar, extra_price) VALUES ($1,$2,$3) RETURNING *', [name_en.trim(), name_ar?.trim() || '', Number(extraPrice) || 0]);
    res.status(201).json(rows[0]);
});
addonsRouter.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { name_en, name_ar, extraPrice } = req.body;
    const { rows } = await pool.query('UPDATE addons SET name_en=$1, name_ar=$2, extra_price=$3, updated_at=now() WHERE id=$4 RETURNING *', [name_en || '', name_ar || '', Number(extraPrice) || 0, req.params.id]);
    if (!rows[0])
        return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
});
addonsRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    await pool.query('DELETE FROM product_addons WHERE addon_id=$1', [req.params.id]);
    await pool.query('DELETE FROM addons WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});
// PUT /api/addons/link - assign addons to a product (replaces optionalAddOnIds)
addonsRouter.put('/link/product', requireAuth, requireRole('admin'), async (req, res) => {
    const { productId, addonIds } = req.body;
    if (!productId)
        return res.status(400).json({ error: 'productId required' });
    await pool.query('DELETE FROM product_addons WHERE product_id=$1', [productId]);
    for (const a of addonIds || []) {
        await pool.query('INSERT INTO product_addons (product_id, addon_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [productId, a]);
    }
    res.json({ ok: true });
});
