import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
export const ordersRouter = Router();
const money = (n) => Math.round(Number(n) * 100) / 100;
// Lock + resolve one variant option for a cart line. Throws {status,message} on error.
async function resolveLine(client, item) {
    const productId = item.id;
    if (!productId)
        throw { status: 400, message: 'cart item missing product id' };
    const qty = Math.floor(Number(item.quantity));
    if (!qty || qty < 1)
        throw { status: 400, message: 'quantity must be >= 1' };
    const prod = await client.query('SELECT id, name_en FROM products WHERE id=$1', [productId]);
    if (!prod.rows[0])
        throw { status: 400, message: `product not found: ${productId}` };
    const wantedOptionId = item.optionId || item.variant?.optionId;
    let opt = null;
    if (wantedOptionId) {
        const r = await client.query(`SELECT vo.*, vg.name_en AS group_name FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vo.id=$1 FOR UPDATE`, [wantedOptionId]);
        opt = r.rows[0] || null;
        if (!opt)
            throw { status: 400, message: 'invalid optionId' };
        const owner = await client.query('SELECT product_id FROM variant_groups WHERE id=$1', [opt.group_id]);
        if (owner.rows[0]?.product_id !== productId) {
            throw { status: 400, message: 'option does not belong to product' };
        }
    }
    else if (item.variant?.value) {
        const idRow = await client.query(`SELECT vo.id FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vg.product_id=$1 AND (vo.value_en=$2 OR vo.value_ar=$2) LIMIT 1`, [productId, item.variant.value]);
        if (!idRow.rows[0])
            throw { status: 400, message: `variant '${item.variant.value}' not found` };
        const r = await client.query(`SELECT vo.*, vg.name_en AS group_name FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vo.id=$1 FOR UPDATE`, [idRow.rows[0].id]);
        opt = r.rows[0];
    }
    else {
        const idRow = await client.query(`SELECT vo.id FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vg.product_id=$1 ORDER BY vo.price ASC LIMIT 1`, [productId]);
        if (!idRow.rows[0])
            throw { status: 400, message: 'product has no variants (admin must add price/stock)' };
        const r = await client.query(`SELECT vo.*, vg.name_en AS group_name FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vo.id=$1 FOR UPDATE`, [idRow.rows[0].id]);
        opt = r.rows[0];
    }
    if (Number(opt.quantity) < qty) {
        throw {
            status: 409,
            message: `insufficient stock for ${prod.rows[0].name_en} / ${opt.value_en}: available ${opt.quantity}, wanted ${qty}`,
        };
    }
    // Server-side addon prices (never trust client extraPrice)
    const addonIds = Array.isArray(item.addOns) ? item.addOns.map((a) => a.id).filter(Boolean) : [];
    const addonsSnapshot = [];
    let addonPerUnit = 0;
    for (const aid of addonIds) {
        const ar = await client.query('SELECT id, name_en, extra_price FROM addons WHERE id=$1', [aid]);
        if (!ar.rows[0])
            throw { status: 400, message: `addon not found: ${aid}` };
        const price = Number(ar.rows[0].extra_price) || 0;
        addonPerUnit += price;
        addonsSnapshot.push({ id: ar.rows[0].id, name_en: ar.rows[0].name_en, extraPrice: price });
    }
    const unitPrice = Number(opt.price) || 0;
    const lineSubtotal = money((unitPrice + addonPerUnit) * qty);
    return {
        productId,
        productName: prod.rows[0].name_en,
        optionId: opt.id,
        groupName: opt.group_name || item.variant?.name || '',
        variantValue: opt.value_en || '',
        unitLabel: opt.unit_label_en || item.variant?.unitLabel || '',
        unitPrice: money(unitPrice),
        quantity: qty,
        addonIds,
        addonsSnapshot,
        addonPerUnit: money(addonPerUnit),
        lineSubtotal,
    };
}
async function cheapestOptionPrice(client, productId) {
    const r = await client.query(`SELECT vo.price FROM variant_options vo
     JOIN variant_groups vg ON vg.id = vo.group_id
     WHERE vg.product_id=$1 ORDER BY vo.price ASC LIMIT 1`, [productId]);
    return r.rows[0] ? Number(r.rows[0].price) || 0 : 0;
}
// Returns { discount, appliedOfferId }. Throws {status,message} for bad coupon.
async function computeDiscount(client, lines, subtotal, couponCode) {
    const { rows: offers } = await client.query(`SELECT * FROM offers WHERE is_active AND CURRENT_DATE BETWEEN start_date AND end_date`);
    if (!offers.length)
        return { discount: 0, appliedOfferId: null, appliedCoupon: null };
    const ids = offers.map((o) => o.id);
    const { rows: links } = await client.query('SELECT offer_id, product_id FROM offer_products WHERE offer_id = ANY($1)', [ids]);
    const targets = new Map();
    for (const l of links) {
        if (!targets.has(l.offer_id))
            targets.set(l.offer_id, new Set());
        targets.get(l.offer_id).add(l.product_id);
    }
    const applicableSubtotal = (offerId) => {
        const set = targets.get(offerId);
        if (!set || set.size === 0)
            return subtotal;
        return money(lines.filter((l) => set.has(l.productId)).reduce((s, l) => s + l.lineSubtotal, 0));
    };
    if (couponCode) {
        const code = String(couponCode).trim().toLowerCase();
        const match = offers.find((o) => (o.coupon_code || '').toLowerCase() === code);
        if (!match)
            throw { status: 400, message: 'invalid or expired coupon' };
        const base = applicableSubtotal(match.id);
        if (base <= 0)
            throw { status: 400, message: 'coupon does not apply to these products' };
        let d = 0;
        if (match.type === 'bogo') {
            d = await bogoDiscount(client, lines, match);
        }
        else if ((match.discount_nature || 'fixed') === 'percentage') {
            d = (base * Number(match.discount_value || 0)) / 100;
        }
        else {
            d = Math.min(Number(match.discount_value || 0), base);
        }
        return { discount: money(Math.min(d, subtotal)), appliedOfferId: match.id, appliedCoupon: match.coupon_code };
    }
    // Auto-apply best non-coupon offer (percentage / fixed / bogo without coupon_code)
    let best = 0;
    let bestId = null;
    for (const o of offers) {
        if (o.coupon_code)
            continue; // coupon-only
        if (o.type === 'coupon')
            continue;
        let d = 0;
        if (o.type === 'bogo') {
            d = await bogoDiscount(client, lines, o);
        }
        else if (o.type === 'percentage_discount' || (o.discount_nature === 'percentage' && Number(o.discount_value) > 0)) {
            d = (applicableSubtotal(o.id) * Number(o.discount_value || 0)) / 100;
        }
        else {
            d = Math.min(Number(o.discount_value || 0), applicableSubtotal(o.id));
        }
        if (d > best) {
            best = d;
            bestId = o.id;
        }
    }
    return { discount: money(Math.min(best, subtotal)), appliedOfferId: bestId, appliedCoupon: null };
}
async function bogoDiscount(client, lines, offer) {
    const buyId = offer.bogo_buy_product_id;
    const getId = offer.bogo_get_product_id;
    if (!buyId || !getId)
        return 0;
    const buyQty = Number(offer.bogo_buy_qty) || 1;
    const getQty = Number(offer.bogo_get_qty) || 1;
    const bought = lines.filter((l) => l.productId === buyId).reduce((s, l) => s + l.quantity, 0);
    if (bought < buyQty)
        return 0;
    const freeUnits = Math.floor(bought / buyQty) * getQty;
    if (freeUnits <= 0)
        return 0;
    const getPrice = await cheapestOptionPrice(client, getId);
    return money(freeUnits * getPrice);
}
function sendOrderError(res, e, fallback) {
    if (e?.status)
        return res.status(e.status).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: fallback });
}
// POST /api/orders - server prices, stock check + decrement, coupon/offers
// body: { serviceMethod, tableNumber, payment:{method}, shipping, deliveryMeta, cartItems[], languageAtOrder, couponCode? }
ordersRouter.post('/', async (req, res) => {
    const b = req.body;
    if (!b.cartItems?.length)
        return res.status(400).json({ error: 'empty cart' });
    if (!['delivery', 'pickup', 'inRestaurant'].includes(b.serviceMethod)) {
        return res.status(400).json({ error: 'invalid serviceMethod' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const lines = [];
        for (const it of b.cartItems) {
            lines.push(await resolveLine(client, it));
        }
        const subtotal = money(lines.reduce((s, l) => s + l.lineSubtotal, 0));
        const { discount, appliedCoupon } = await computeDiscount(client, lines, subtotal, b.couponCode);
        const total = money(subtotal - discount);
        const o = await client.query(`INSERT INTO orders (service_method, table_number, payment_method, first_name, last_name, phone_number,
        address, city, country, delivery_location, delivery_lat, delivery_lng, total_amount,
        subtotal_amount, discount_amount, coupon_code, language_at_order,
        payment_bill_number, payment_transaction_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`, [b.serviceMethod, b.tableNumber || null, b.payment?.method || 'cash',
            b.shipping?.firstName || '', b.shipping?.lastName || '', b.shipping?.phoneNumber || '',
            b.shipping?.address || '', b.shipping?.city || 'Amman', b.shipping?.country || 'Jordan',
            b.deliveryMeta?.location || '', b.deliveryMeta?.coordinates?.lat || null, b.deliveryMeta?.coordinates?.lng || null,
            total, subtotal, discount, appliedCoupon || b.couponCode?.trim() || null,
            b.languageAtOrder || 'en', b.paymentDetails?.billNumber || null, b.paymentDetails?.transactionId || null]);
        const order = o.rows[0];
        for (const l of lines) {
            await client.query(`INSERT INTO order_items (order_id, product_id, variant_option_id, product_name_snapshot, variant_group_name, variant_value, unit_label, unit_price, quantity, addons_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [order.id, l.productId, l.optionId, l.productName, l.groupName, l.variantValue, l.unitLabel,
                l.unitPrice, l.quantity, JSON.stringify(l.addonsSnapshot)]);
            await client.query('UPDATE variant_options SET quantity = quantity - $1 WHERE id=$2', [l.quantity, l.optionId]);
        }
        await client.query('COMMIT');
        res.status(201).json({ orderId: order.id, order_number: order.order_number, subtotal, discount, total });
    }
    catch (e) {
        await client.query('ROLLBACK');
        sendOrderError(res, e, 'order failed');
    }
    finally {
        client.release();
    }
});
// GET /api/orders?status=pending - for kitchen / admin dashboard (replaces TODO in AdminDashboard.tsx)
ordersRouter.get('/', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
    const status = req.query.status;
    const { rows } = status
        ? await pool.query('SELECT * FROM orders WHERE status=$1 ORDER BY created_at DESC LIMIT 100', [status])
        : await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
});
// PUT /api/orders/:id - edit a PENDING order (locked once kitchen starts it)
// Restores old stock, then re-validates + decrements for the new cart.
ordersRouter.put('/:id', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
    const b = req.body || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cur = await client.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
        if (!cur.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'not found' });
        }
        if (cur.rows[0].status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `order is ${cur.rows[0].status} - too late to edit` });
        }
        if (b.serviceMethod && !['delivery', 'pickup', 'inRestaurant'].includes(b.serviceMethod)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'invalid serviceMethod' });
        }
        if (b.payment?.method && !['cash', 'cliq'].includes(b.payment.method)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'invalid payment method' });
        }
        if (b.cartItems !== undefined && !b.cartItems?.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'order must keep at least one item (cancel it instead)' });
        }
        let subtotal = Number(cur.rows[0].subtotal_amount ?? cur.rows[0].total_amount);
        let discount = Number(cur.rows[0].discount_amount ?? 0);
        let coupon = cur.rows[0].coupon_code || null;
        if (Array.isArray(b.cartItems)) {
            // Return previous stock first so the re-check sees true availability
            const oldItems = await client.query('SELECT quantity, variant_option_id FROM order_items WHERE order_id=$1', [req.params.id]);
            for (const it of oldItems.rows) {
                if (it.variant_option_id) {
                    await client.query('UPDATE variant_options SET quantity = quantity + $1 WHERE id=$2', [it.quantity, it.variant_option_id]);
                }
            }
            await client.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id]);
            const lines = [];
            try {
                for (const it of b.cartItems) {
                    lines.push(await resolveLine(client, it));
                }
            }
            catch (e) {
                await client.query('ROLLBACK');
                return sendOrderError(res, e, 'order update failed');
            }
            subtotal = money(lines.reduce((s, l) => s + l.lineSubtotal, 0));
            const computed = await computeDiscount(client, lines, subtotal, b.couponCode ?? coupon ?? undefined);
            discount = computed.discount;
            coupon = computed.appliedCoupon || (b.couponCode !== undefined ? b.couponCode?.trim() || null : coupon);
            for (const l of lines) {
                await client.query(`INSERT INTO order_items (order_id, product_id, variant_option_id, product_name_snapshot, variant_group_name, variant_value, unit_label, unit_price, quantity, addons_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [req.params.id, l.productId, l.optionId, l.productName, l.groupName, l.variantValue, l.unitLabel,
                    l.unitPrice, l.quantity, JSON.stringify(l.addonsSnapshot)]);
                await client.query('UPDATE variant_options SET quantity = quantity - $1 WHERE id=$2', [l.quantity, l.optionId]);
            }
        }
        else if (b.couponCode !== undefined) {
            // Coupon-only change: recompute discount against existing items
            const existing = await client.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
            const lines = existing.rows.map((r) => ({
                productId: r.product_id,
                productName: r.product_name_snapshot,
                optionId: r.variant_option_id,
                groupName: r.variant_group_name,
                variantValue: r.variant_value,
                unitLabel: r.unit_label,
                unitPrice: Number(r.unit_price),
                quantity: Number(r.quantity),
                addonIds: [],
                addonsSnapshot: typeof r.addons_snapshot === 'string' ? JSON.parse(r.addons_snapshot) : r.addons_snapshot || [],
                addonPerUnit: 0,
                lineSubtotal: money((Number(r.unit_price) +
                    (typeof r.addons_snapshot === 'string' ? JSON.parse(r.addons_snapshot) : r.addons_snapshot || []).reduce((s, a) => s + Number(a.extraPrice ?? a.extra_price ?? 0), 0)) *
                    Number(r.quantity)),
            }));
            const base = money(lines.reduce((s, l) => s + l.lineSubtotal, 0));
            subtotal = base;
            try {
                const computed = await computeDiscount(client, lines, base, b.couponCode || undefined);
                discount = computed.discount;
                coupon = computed.appliedCoupon || b.couponCode?.trim() || null;
            }
            catch (e) {
                await client.query('ROLLBACK');
                return sendOrderError(res, e, 'order update failed');
            }
        }
        const total = money(subtotal - discount);
        const { rows } = await client.query(`UPDATE orders SET service_method=COALESCE($1,service_method), table_number=COALESCE($2,table_number),
        payment_method=COALESCE($3,payment_method), first_name=COALESCE($4,first_name), last_name=COALESCE($5,last_name),
        phone_number=COALESCE($6,phone_number), address=COALESCE($7,address), city=COALESCE($8,city),
        country=COALESCE($9,country), delivery_location=COALESCE($10,delivery_location),
        delivery_lat=COALESCE($11,delivery_lat), delivery_lng=COALESCE($12,delivery_lng),
        total_amount=$13, subtotal_amount=$14, discount_amount=$15, coupon_code=$16 WHERE id=$17 RETURNING *`, [b.serviceMethod || null, b.tableNumber ?? null, b.payment?.method || null,
            b.shipping?.firstName ?? null, b.shipping?.lastName ?? null, b.shipping?.phoneNumber ?? null,
            b.shipping?.address ?? null, b.shipping?.city ?? null, b.shipping?.country ?? null,
            b.deliveryMeta?.location ?? null, b.deliveryMeta?.coordinates?.lat ?? null, b.deliveryMeta?.coordinates?.lng ?? null,
            total, subtotal, discount, coupon, req.params.id]);
        await client.query('COMMIT');
        const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
        res.json({ ...rows[0], items: items.rows });
    }
    catch (e) {
        await client.query('ROLLBACK');
        sendOrderError(res, e, 'order update failed');
    }
    finally {
        client.release();
    }
});
// GET /api/orders/:id - order + items for employee detail view
ordersRouter.get('/:id', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
    const o = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!o.rows[0])
        return res.status(404).json({ error: 'not found' });
    const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
    res.json({ ...o.rows[0], items: items.rows });
});
// PATCH /api/orders/:id/status - cancelling restores stock
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
ordersRouter.patch('/:id/status', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
    const { status } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cur = await client.query('SELECT status FROM orders WHERE id=$1', [req.params.id]);
        if (!cur.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'not found' });
        }
        const prev = cur.rows[0].status;
        if (prev !== status) {
            const items = await client.query('SELECT quantity, variant_option_id FROM order_items WHERE order_id=$1', [req.params.id]);
            if (status === 'cancelled' && prev !== 'cancelled') {
                for (const it of items.rows) {
                    if (it.variant_option_id) {
                        await client.query('UPDATE variant_options SET quantity = quantity + $1 WHERE id=$2', [it.quantity, it.variant_option_id]);
                    }
                }
            }
            else if (prev === 'cancelled' && status !== 'cancelled') {
                // Re-activating: re-check + decrement
                for (const it of items.rows) {
                    if (!it.variant_option_id)
                        continue;
                    const r = await client.query('SELECT quantity FROM variant_options WHERE id=$1 FOR UPDATE', [it.variant_option_id]);
                    if (!r.rows[0] || Number(r.rows[0].quantity) < Number(it.quantity)) {
                        await client.query('ROLLBACK');
                        return res.status(409).json({ error: 'insufficient stock to re-activate order' });
                    }
                    await client.query('UPDATE variant_options SET quantity = quantity - $1 WHERE id=$2', [it.quantity, it.variant_option_id]);
                }
            }
        }
        const { rows } = await client.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
        await client.query('COMMIT');
        res.json(rows[0]);
    }
    catch (e) {
        await client.query('ROLLBACK');
        sendOrderError(res, e, 'status update failed');
    }
    finally {
        client.release();
    }
});
