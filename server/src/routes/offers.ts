import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const offersRouter = Router();

// GET /api/offers?active=true - replaces ManageOffers list
offersRouter.get('/', async (req, res) => {
  const active = req.query.active;
  const { rows } = active === 'true'
    ? await pool.query("SELECT * FROM offers WHERE is_active AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE ORDER BY end_date")
    : await pool.query('SELECT * FROM offers ORDER BY end_date DESC');
  res.json(rows);
});

offersRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const b = req.body;
  if (!b.title_en?.trim()) return res.status(400).json({ error: 'title_en required' });
  const { rows } = await pool.query(
    `INSERT INTO offers (title_en,title_ar,description_en,description_ar,type,discount_value,start_date,end_date,is_active,coupon_code,discount_nature,bogo_buy_product_id,bogo_buy_qty,bogo_get_product_id,bogo_get_qty,bogo_get_type,min_purchase_amount,usage_limit,image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [b.title_en.trim(), b.title_ar || '', b.description_en || '', b.description_ar || '',
     b.type || 'percentage_discount', Number(b.discountValue ?? b.discount_value) || 0, b.startDate, b.endDate,
     b.isActive ?? true, b.couponCode || null, b.discountNature || 'fixed',
     b.bogoBuyProductId || null, b.bogoBuyQuantity || 1, b.bogoGetProductId || null,
     b.bogoGetQuantity || 1, b.bogoGetType || 'free',
     Number(b.minPurchase ?? b.min_purchase_amount) || 0, b.usageLimit ?? b.usage_limit ?? null,
     b.image || '']
  );
  const offer = rows[0];
  for (const pid of b.targetProductIds || []) {
    await pool.query('INSERT INTO offer_products (offer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [offer.id, pid]);
  }
  res.status(201).json(offer);
});

offersRouter.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `UPDATE offers SET title_en=$1,title_ar=$2,description_en=$3,description_ar=$4,type=$5,discount_value=$6,
     start_date=$7,end_date=$8,is_active=$9,coupon_code=$10,discount_nature=$11,
     min_purchase_amount=$12,usage_limit=$13,image=$14 WHERE id=$15 RETURNING *`,
    [b.title_en, b.title_ar || '', b.description_en || '', b.description_ar || '', b.type,
     Number(b.discountValue ?? b.discount_value) || 0, b.startDate, b.endDate, b.isActive ?? true,
     b.couponCode || null, b.discountNature || 'fixed',
     Number(b.minPurchase ?? b.min_purchase_amount) || 0, b.usageLimit ?? b.usage_limit ?? null,
     b.image ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (Array.isArray(b.targetProductIds)) {
    await pool.query('DELETE FROM offer_products WHERE offer_id=$1', [req.params.id]);
    for (const pid of b.targetProductIds) {
      await pool.query('INSERT INTO offer_products (offer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, pid]);
    }
  }
  res.json(rows[0]);
});

offersRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM offers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// GET /api/offers/:id - single offer with target product ids (for admin edit form)
offersRouter.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM offers WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  const targets = await pool.query('SELECT product_id FROM offer_products WHERE offer_id=$1', [req.params.id]);
  res.json({ ...rows[0], targetProductIds: targets.rows.map((r) => r.product_id) });
});
