import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
export const productsRouter = Router();
// GET /api/products?categoryId=&search=&limit=50&offset=0
// Replaces Home.tsx onSnapshot + array-contains + limit(50)
// Each row also carries its cheapest option as price/original_price/option_image/option_value
// so cards can show a price without fetching every detail.
const CHEAPEST_OPTION = `LEFT JOIN LATERAL (
  SELECT vo.price, vo.original_price, vo.image_url AS option_image, vo.value_en AS option_value
  FROM variant_options vo JOIN variant_groups vg ON vg.id = vo.group_id
  WHERE vg.product_id = p.id ORDER BY vo.price ASC LIMIT 1
) o ON true`;
productsRouter.get('/', async (req, res) => {
    const categoryId = req.query.categoryId;
    const search = req.query.search?.toLowerCase() || '';
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    let rows;
    if (categoryId && categoryId !== 'all') {
        rows = await pool.query(`SELECT p.*, o.price, o.original_price, o.option_image, o.option_value FROM products p
       ${CHEAPEST_OPTION}
       JOIN product_categories pc ON pc.product_id = p.id
       WHERE pc.category_id = $1
       AND ($2 = '' OR lower(p.name_en) LIKE '%'||$2||'%' OR lower(p.name_ar) LIKE '%'||$2||'%')
       ORDER BY p.name_en LIMIT $3 OFFSET $4`, [categoryId, search, limit, offset]);
    }
    else {
        rows = await pool.query(`SELECT p.*, o.price, o.original_price, o.option_image, o.option_value FROM products p
       ${CHEAPEST_OPTION}
       WHERE ($1 = '' OR lower(p.name_en) LIKE '%'||$1||'%' OR lower(p.name_ar) LIKE '%'||$1||'%')
       ORDER BY p.name_en LIMIT $2 OFFSET $3`, [search, limit, offset]);
    }
    res.json(rows.rows);
});
// GET /api/products/:id - full detail with variants + addons
// Replaces ProductDetails.tsx transformFirestoreProductToProductData
productsRouter.get('/:id', async (req, res) => {
    const p = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    if (!p.rows[0])
        return res.status(404).json({ error: 'not found' });
    const groups = await pool.query('SELECT * FROM variant_groups WHERE product_id=$1 ORDER BY sort_order', [req.params.id]);
    for (const g of groups.rows) {
        const opts = await pool.query('SELECT * FROM variant_options WHERE group_id=$1', [g.id]);
        g.options = opts.rows;
    }
    const addons = await pool.query(`SELECT a.* FROM addons a JOIN product_addons pa ON pa.addon_id=a.id WHERE pa.product_id=$1`, [req.params.id]);
    const cats = await pool.query('SELECT category_id FROM product_categories WHERE product_id=$1', [req.params.id]);
    res.json({ ...p.rows[0], category: cats.rows.map((r) => r.category_id), variants: groups.rows, addons: addons.rows });
});
// POST /api/products - create with nested variants (admin)
// image is required (URL or /uploads/... path from POST /upload)
productsRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const client = await pool.connect();
    try {
        const b = req.body;
        if (!b.name_en?.trim()) {
            return res.status(400).json({ error: 'name_en required' });
        }
        if (!b.image?.trim()) {
            return res.status(400).json({ error: 'image required (upload via POST /upload first)' });
        }
        await client.query('BEGIN');
        const p = await client.query(`INSERT INTO products (name_en,name_ar,short_desc_en,short_desc_ar,long_desc_en,long_desc_ar,image,is_offer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [b.name_en.trim(), b.name_ar || '', b.shortDescription_en || '', b.shortDescription_ar || '',
            b.longDescription_en || '', b.longDescription_ar || '', b.image.trim(), !!b.isOffer]);
        const product = p.rows[0];
        for (const c of b.category || []) {
            await client.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [product.id, c]);
        }
        for (const [i, g] of (b.variants || []).entries()) {
            const gr = await client.query('INSERT INTO variant_groups (product_id, name_en, name_ar, sort_order) VALUES ($1,$2,$3,$4) RETURNING *', [product.id, g.name_en, g.name_ar || '', i]);
            for (const o of g.options || []) {
                await client.query(`INSERT INTO variant_options (group_id,value_en,value_ar,unit_label_en,unit_label_ar,price,original_price,quantity,image_url,offer_type,offer_value,offer_start,offer_end)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [gr.rows[0].id, o.value_en, o.value_ar || '', o.unitLabel_en || 'piece', o.unitLabel_ar || 'قطعة',
                    o.price || 0, o.originalPrice || null, o.quantity || 0, o.imageUrl || product.image,
                    o.offerType || 'none', o.offerValue || 0, o.offerStartDate || null, o.offerEndDate || null]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json(product);
    }
    catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ error: 'create failed' });
    }
    finally {
        client.release();
    }
});
// PUT /api/products/:id - update scalar fields + optionally replace categories/variants (admin)
productsRouter.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const client = await pool.connect();
    try {
        const b = req.body;
        await client.query('BEGIN');
        const existing = await client.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
        if (!existing.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'not found' });
        }
        const cur = existing.rows[0];
        const updated = await client.query(`UPDATE products SET
        name_en=COALESCE($1,name_en), name_ar=COALESCE($2,name_ar),
        short_desc_en=COALESCE($3,short_desc_en), short_desc_ar=COALESCE($4,short_desc_ar),
        long_desc_en=COALESCE($5,long_desc_en), long_desc_ar=COALESCE($6,long_desc_ar),
        image=COALESCE($7,image), is_offer=COALESCE($8,is_offer),
        manufactured_at=COALESCE($9,manufactured_at), expiration=COALESCE($10,expiration),
        updated_at=now()
       WHERE id=$11 RETURNING *`, [b.name_en ?? null, b.name_ar ?? null,
            b.shortDescription_en ?? b.short_desc_en ?? null, b.shortDescription_ar ?? b.short_desc_ar ?? null,
            b.longDescription_en ?? b.long_desc_en ?? null, b.longDescription_ar ?? b.long_desc_ar ?? null,
            b.image ?? null, b.isOffer ?? b.is_offer ?? null,
            b.manufactured_at || null, b.expiration || null, req.params.id]);
        void cur;
        // Replace category links only if `category` array provided
        if (Array.isArray(b.category)) {
            await client.query('DELETE FROM product_categories WHERE product_id=$1', [req.params.id]);
            for (const c of b.category) {
                await client.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, c]);
            }
        }
        // Replace variants only if `variants` array provided
        if (Array.isArray(b.variants)) {
            await client.query('DELETE FROM variant_groups WHERE product_id=$1', [req.params.id]);
            for (const [i, g] of b.variants.entries()) {
                const gr = await client.query('INSERT INTO variant_groups (product_id, name_en, name_ar, sort_order) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, g.name_en || 'Type', g.name_ar || '', i]);
                for (const o of g.options || []) {
                    await client.query(`INSERT INTO variant_options (group_id,value_en,value_ar,unit_label_en,unit_label_ar,price,original_price,quantity,image_url,offer_type,offer_value,offer_start,offer_end)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [gr.rows[0].id, o.value_en, o.value_ar || '', o.unitLabel_en || o.unit_label_en || 'piece',
                        o.unitLabel_ar || o.unit_label_ar || 'قطعة', o.price || 0, o.originalPrice ?? o.original_price ?? null,
                        o.quantity || 0, o.imageUrl || o.image_url || updated.rows[0].image,
                        o.offerType || o.offer_type || 'none', o.offerValue ?? o.offer_value ?? 0,
                        o.offerStartDate || o.offer_start || null, o.offerEndDate || o.offer_end || null]);
                }
            }
        }
        await client.query('COMMIT');
        res.json(updated.rows[0]);
    }
    catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ error: 'update failed' });
    }
    finally {
        client.release();
    }
});
// DELETE /api/products/:id - blocked if used in orders (admin)
productsRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const used = await pool.query('SELECT 1 FROM order_items WHERE product_id=$1 LIMIT 1', [req.params.id]);
    if (used.rowCount) {
        return res.status(409).json({ error: 'Product has orders. Disable it instead of deleting.' });
    }
    const { rowCount } = await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    if (!rowCount)
        return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
});
