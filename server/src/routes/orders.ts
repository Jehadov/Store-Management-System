import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const ordersRouter = Router();

type CartItemInput = {
  id: string;
  optionId?: string;
  quantity: unknown;
  variant?: { name?: string; value?: string; unitLabel?: string; optionId?: string };
  addOns?: { id: string }[];
};

type ResolvedLine = {
  productId: string;
  productName: string;
  optionId: string;
  groupName: string;
  variantValue: string;
  unitLabel: string;
  unitPrice: number;
  quantity: number;
  addonIds: string[];
  addonsSnapshot: { id: string; name_en: string; extraPrice: number }[];
  addonPerUnit: number;
  lineSubtotal: number;
};

const money = (n: number) => Math.round(Number(n) * 100) / 100;

// Canonical phone: digits only (frontend sends +<code><number>).
// Old rows may hold local formats, so matching compares the last 9 digits.
function phoneDigits(p: unknown): string {
  return String(p || '').replace(/\D/g, '');
}
function phoneMatchSQL(col: string): string {
  return `RIGHT(regexp_replace(${col}, '\\D', '', 'g'), 9) = RIGHT($1, 9)`;
}

// Lock + resolve one variant option for a cart line. Throws {status,message} on error.
async function resolveLine(client: any, item: CartItemInput): Promise<ResolvedLine> {
  const productId = item.id;
  if (!productId) throw { status: 400, message: 'cart item missing product id' };
  const qty = Math.floor(Number(item.quantity));
  if (!qty || qty < 1) throw { status: 400, message: 'quantity must be >= 1' };

  const prod = await client.query('SELECT id, name_en FROM products WHERE id=$1', [productId]);
  if (!prod.rows[0]) throw { status: 400, message: `product not found: ${productId}` };

  const wantedOptionId = item.optionId || item.variant?.optionId;
  let opt: any = null;

  if (wantedOptionId) {
    const r = await client.query(
      `SELECT vo.*, vg.name_en AS group_name FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vo.id=$1 FOR UPDATE`,
      [wantedOptionId]
    );
    opt = r.rows[0] || null;
    if (!opt) throw { status: 400, message: 'invalid optionId' };
    const owner = await client.query('SELECT product_id FROM variant_groups WHERE id=$1', [opt.group_id]);
    if (owner.rows[0]?.product_id !== productId) {
      throw { status: 400, message: 'option does not belong to product' };
    }
  } else if (item.variant?.value) {
    const idRow = await client.query(
      `SELECT vo.id FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vg.product_id=$1 AND (vo.value_en=$2 OR vo.value_ar=$2) LIMIT 1`,
      [productId, item.variant.value]
    );
    if (!idRow.rows[0]) throw { status: 400, message: `variant '${item.variant.value}' not found` };
    const r = await client.query(
      `SELECT vo.*, vg.name_en AS group_name FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vo.id=$1 FOR UPDATE`,
      [idRow.rows[0].id]
    );
    opt = r.rows[0];
  } else {
    const idRow = await client.query(
      `SELECT vo.id FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vg.product_id=$1 ORDER BY vo.price ASC LIMIT 1`,
      [productId]
    );
    if (!idRow.rows[0]) throw { status: 400, message: 'product has no variants (admin must add price/stock)' };
    const r = await client.query(
      `SELECT vo.*, vg.name_en AS group_name FROM variant_options vo
       JOIN variant_groups vg ON vg.id = vo.group_id
       WHERE vo.id=$1 FOR UPDATE`,
      [idRow.rows[0].id]
    );
    opt = r.rows[0];
  }

  // NULL stock = unlimited (made-to-order); only finite stock can run out
  if (opt.quantity !== null && opt.quantity !== undefined && Number(opt.quantity) < qty) {
    throw {
      status: 409,
      message: `insufficient stock for ${prod.rows[0].name_en} / ${opt.value_en}: available ${opt.quantity}, wanted ${qty}`,
    };
  }

  // Server-side addon prices (never trust client extraPrice)
  const addonIds: string[] = Array.isArray(item.addOns) ? item.addOns.map((a: any) => a.id).filter(Boolean) : [];
  const addonsSnapshot: ResolvedLine['addonsSnapshot'] = [];
  let addonPerUnit = 0;
  for (const aid of addonIds) {
    const ar = await client.query('SELECT id, name_en, extra_price FROM addons WHERE id=$1', [aid]);
    if (!ar.rows[0]) throw { status: 400, message: `addon not found: ${aid}` };
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

async function cheapestOptionPrice(client: any, productId: string): Promise<number> {
  const r = await client.query(
    `SELECT vo.price FROM variant_options vo
     JOIN variant_groups vg ON vg.id = vo.group_id
     WHERE vg.product_id=$1 ORDER BY vo.price ASC LIMIT 1`,
    [productId]
  );
  return r.rows[0] ? Number(r.rows[0].price) || 0 : 0;
}

// Returns { discount, appliedOfferId }. Throws {status,message} for bad coupon.
async function computeDiscount(
  client: any,
  lines: ResolvedLine[],
  subtotal: number,
  couponCode?: string
): Promise<{ discount: number; appliedOfferId: string | null; appliedCoupon: string | null }> {
  const { rows: offers } = await client.query(
    `SELECT * FROM offers WHERE is_active AND CURRENT_DATE BETWEEN start_date AND end_date`
  );
  // Validate the coupon against ALL in-date offers first, so exhausted/expired
  // codes report a clear error instead of silently ordering without discount.
  let couponMatch: any = null;
  if (couponCode) {
    const code = String(couponCode).trim().toLowerCase();
    couponMatch = offers.find((o: any) => (o.coupon_code || '').toLowerCase() === code);
    if (!couponMatch) throw { status: 400, message: 'invalid or expired coupon' };
    if (couponMatch.usage_limit != null && Number(couponMatch.used_count || 0) >= Number(couponMatch.usage_limit)) {
      throw { status: 400, message: 'coupon usage limit reached' };
    }
  }
  // Drop exhausted offers from auto-apply consideration
  const live = offers.filter((o: any) => o.usage_limit == null || Number(o.used_count || 0) < Number(o.usage_limit));
  if (!live.length) return { discount: 0, appliedOfferId: null, appliedCoupon: null };
  const ids = live.map((o: any) => o.id);
  const { rows: links } = await client.query('SELECT offer_id, product_id FROM offer_products WHERE offer_id = ANY($1)', [ids]);
  const targets = new Map<string, Set<string>>();
  for (const l of links) {
    if (!targets.has(l.offer_id)) targets.set(l.offer_id, new Set());
    targets.get(l.offer_id)!.add(l.product_id);
  }
  const applicableSubtotal = (offerId: string): number => {
    const set = targets.get(offerId);
    if (!set || set.size === 0) return subtotal;
    return money(lines.filter((l) => set.has(l.productId)).reduce((s, l) => s + l.lineSubtotal, 0));
  };

  if (couponCode) {
    const match = couponMatch;
    const base = match.type === 'bogo' ? subtotal : applicableSubtotal(match.id);
    const min = Number(match.min_purchase_amount || 0);
    if (min > 0 && base < min) throw { status: 400, message: `coupon needs minimum purchase of ${min}` };
    if (base <= 0) throw { status: 400, message: 'coupon does not apply to these products' };
    let d = 0;
    if (match.type === 'bogo') {
      d = await bogoDiscount(client, lines, match);
    } else if ((match.discount_nature || 'fixed') === 'percentage') {
      d = (base * Number(match.discount_value || 0)) / 100;
    } else {
      d = Math.min(Number(match.discount_value || 0), base);
    }
    return { discount: money(Math.min(d, subtotal)), appliedOfferId: match.id, appliedCoupon: match.coupon_code };
  }

  // Auto-apply best non-coupon offer (percentage / fixed / bogo without coupon_code)
  let best = 0;
  let bestId: string | null = null;
  for (const o of live) {
    if (o.coupon_code) continue; // coupon-only
    if (o.type === 'coupon') continue;
    const base = o.type === 'bogo' ? subtotal : applicableSubtotal(o.id);
    const min = Number(o.min_purchase_amount || 0);
    if (min > 0 && base < min) continue; // minimum purchase not met
    let d = 0;
    if (o.type === 'bogo') {
      d = await bogoDiscount(client, lines, o);
    } else if (o.type === 'percentage_discount' || (o.discount_nature === 'percentage' && Number(o.discount_value) > 0)) {
      d = (base * Number(o.discount_value || 0)) / 100;
    } else {
      d = Math.min(Number(o.discount_value || 0), base);
    }
    if (d > best) {
      best = d;
      bestId = o.id;
    }
  }
  return { discount: money(Math.min(best, subtotal)), appliedOfferId: bestId, appliedCoupon: null };
}

async function bogoDiscount(client: any, lines: ResolvedLine[], offer: any): Promise<number> {
  const buyId = offer.bogo_buy_product_id;
  const getId = offer.bogo_get_product_id;
  if (!buyId || !getId) return 0;
  const buyQty = Number(offer.bogo_buy_qty) || 1;
  const getQty = Number(offer.bogo_get_qty) || 1;
  const bought = lines.filter((l) => l.productId === buyId).reduce((s, l) => s + l.quantity, 0);
  if (bought < buyQty) return 0;
  const freeUnits = Math.floor(bought / buyQty) * getQty;
  if (freeUnits <= 0) return 0;
  const getPrice = await cheapestOptionPrice(client, getId);
  return money(freeUnits * getPrice);
}

function sendOrderError(res: any, e: any, fallback: string) {
  if (e?.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: fallback });
}

// +1 redemption when an offer is consumed by an order
async function bumpUsage(client: any, offerId: string | null) {
  if (!offerId) return;
  await client.query('UPDATE offers SET used_count = used_count + 1 WHERE id=$1', [offerId]);
}

// -1 redemption (order edited/cancelled before completion releases it back)
async function releaseUsage(client: any, couponCode: string | null) {
  if (!couponCode) return;
  const r = await client.query('SELECT id FROM offers WHERE lower(coupon_code)=lower($1)', [couponCode]);
  if (!r.rows[0]) return;
  await client.query('UPDATE offers SET used_count = GREATEST(used_count - 1, 0) WHERE id=$1', [r.rows[0].id]);
}

// Re-consume on re-activate (only if the offer still has room)
async function bumpUsageIfRoom(client: any, couponCode: string | null) {
  if (!couponCode) return;
  const r = await client.query('SELECT id, usage_limit, used_count FROM offers WHERE lower(coupon_code)=lower($1)', [couponCode]);
  const o = r.rows[0];
  if (!o) return;
  if (o.usage_limit == null || Number(o.used_count || 0) < Number(o.usage_limit)) {
    await client.query('UPDATE offers SET used_count = used_count + 1 WHERE id=$1', [o.id]);
  }
}

// Loyalty: earn points on what the customer pays, redeem points as discount.
// Throws {status,message} when redeeming more than the wallet holds.
async function applyLoyalty(
  client: any, phoneRaw: unknown, redeemRaw: unknown, baseTotal: number
): Promise<{ phone: string | null; redeemed: number; redeemDiscount: number; earned: number }> {
  const phone = String(phoneRaw || '').trim();
  if (!phone) return { phone: null, redeemed: 0, redeemDiscount: 0, earned: 0 };
  const digits = phoneDigits(phone);
  if (digits.length < 7) throw { status: 400, message: 'invalid phone number' };
  const s = await client.query('SELECT loyalty_earn_per_jd, loyalty_jd_per_point FROM settings WHERE id=1');
  const earnRate = Number(s.rows[0]?.loyalty_earn_per_jd) || 0;
  const pointValue = Number(s.rows[0]?.loyalty_jd_per_point) || 0;
  // Tolerant wallet match (old rows may hold local formats); create canonical if missing
  let w = await client.query(
    `SELECT phone, points FROM loyalty WHERE RIGHT(regexp_replace(phone, '\\D', '', 'g'), 9) = RIGHT($1, 9) FOR UPDATE`,
    [digits]
  );
  let key: string = w.rows[0]?.phone;
  if (!key) {
    key = '+' + digits;
    await client.query('INSERT INTO loyalty (phone, points) VALUES ($1, 0) ON CONFLICT (phone) DO NOTHING', [key]);
    w = await client.query('SELECT phone, points FROM loyalty WHERE phone=$1 FOR UPDATE', [key]);
  }
  const balance = Number(w.rows[0]?.points) || 0;
  const wanted = Math.max(0, Math.floor(Number(redeemRaw) || 0));
  let redeemed = 0;
  let redeemDiscount = 0;
  if (wanted > 0) {
    if (pointValue <= 0) throw { status: 400, message: 'loyalty redemption is disabled' };
    if (wanted > balance) throw { status: 400, message: `insufficient loyalty points (have ${balance})` };
    redeemed = Math.min(wanted, Math.floor(money(Math.max(0, baseTotal)) / pointValue));
    redeemDiscount = money(redeemed * pointValue);
    if (redeemed > 0) {
      await client.query('UPDATE loyalty SET points = points - $1, updated_at=now() WHERE phone=$2', [redeemed, key]);
    }
  }
  const earned = earnRate > 0 ? Math.floor(money(Math.max(0, baseTotal - redeemDiscount)) * earnRate) : 0;
  if (earned > 0) {
    await client.query('UPDATE loyalty SET points = points + $1, updated_at=now() WHERE phone=$2', [earned, key]);
  }
  return { phone: key, redeemed, redeemDiscount, earned };
}

// Undo loyalty movement (edit re-calc, cancel)
async function releaseLoyalty(client: any, row: any) {
  const digits = phoneDigits(row?.loyalty_phone);
  if (!digits) return;
  const w = await client.query(
    `SELECT phone FROM loyalty WHERE RIGHT(regexp_replace(phone, '\\D', '', 'g'), 9) = RIGHT($1, 9)`,
    [digits]
  );
  const key = w.rows[0]?.phone;
  if (!key) return;
  if (Number(row?.loyalty_redeemed) > 0) {
    await client.query('UPDATE loyalty SET points = points + $1, updated_at=now() WHERE phone=$2', [Number(row.loyalty_redeemed), key]);
  }
  if (Number(row?.loyalty_earned) > 0) {
    await client.query('UPDATE loyalty SET points = GREATEST(points - $1, 0), updated_at=now() WHERE phone=$2', [Number(row.loyalty_earned), key]);
  }
}

// POST /api/orders - server prices, stock check + decrement, coupon/offers, loyalty
// body: { serviceMethod, tableNumber, payment:{method}, paid?, shipping, deliveryMeta, cartItems[], languageAtOrder, couponCode?, loyaltyPhone?, redeemPoints? }
ordersRouter.post('/', async (req, res) => {
  const b = req.body;
  if (!b.cartItems?.length) return res.status(400).json({ error: 'empty cart' });
  if (!['delivery', 'pickup', 'inRestaurant'].includes(b.serviceMethod)) {
    return res.status(400).json({ error: 'invalid serviceMethod' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lines: ResolvedLine[] = [];
    for (const it of b.cartItems) {
      lines.push(await resolveLine(client, it));
    }
    const subtotal = money(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const { discount, appliedOfferId, appliedCoupon } = await computeDiscount(client, lines, subtotal, b.couponCode);
    const afterOffers = money(subtotal - discount);
    const loy = await applyLoyalty(client, b.loyaltyPhone, b.redeemPoints, afterOffers);
    const total = money(afterOffers - loy.redeemDiscount);

    const o = await client.query(
      `INSERT INTO orders (service_method, table_number, payment_method, payment_status, first_name, last_name, phone_number,
        address, city, country, delivery_location, delivery_lat, delivery_lng, total_amount,
        subtotal_amount, discount_amount, coupon_code, language_at_order,
        loyalty_phone, loyalty_earned, loyalty_redeemed, loyalty_discount,
        payment_bill_number, payment_transaction_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
      [b.serviceMethod, b.tableNumber || null, b.payment?.method || 'cash', b.paid === true ? 'paid' : 'unpaid',
       b.shipping?.firstName || '', b.shipping?.lastName || '', b.shipping?.phoneNumber || '',
       b.shipping?.address || '', b.shipping?.city || 'Amman', b.shipping?.country || 'Jordan',
       b.deliveryMeta?.location || '', b.deliveryMeta?.coordinates?.lat || null, b.deliveryMeta?.coordinates?.lng || null,
       total, subtotal, discount, appliedCoupon || b.couponCode?.trim() || null,
       b.languageAtOrder || 'en', loy.phone, loy.earned, loy.redeemed, loy.redeemDiscount,
       b.paymentDetails?.billNumber || null, b.paymentDetails?.transactionId || null]
    );
    const order = o.rows[0];
      for (const l of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, variant_option_id, product_name_snapshot, variant_group_name, variant_value, unit_label, unit_price, quantity, line_total, addons_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [order.id, l.productId, l.optionId, l.productName, l.groupName, l.variantValue, l.unitLabel,
           l.unitPrice, l.quantity, l.lineSubtotal, JSON.stringify(l.addonsSnapshot)]
        );
        await client.query('UPDATE variant_options SET quantity = quantity - $1 WHERE id=$2 AND quantity IS NOT NULL', [l.quantity, l.optionId]);
      }
      await bumpUsage(client, appliedOfferId);
      await client.query('COMMIT');
    res.status(201).json({
      orderId: order.id, order_number: order.order_number, subtotal, discount, total,
      loyalty: loy.phone ? { phone: loy.phone, earned: loy.earned, redeemed: loy.redeemed, discount: loy.redeemDiscount } : null,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    sendOrderError(res, e, 'order failed');
  } finally {
    client.release();
  }
});

// GET /api/orders?status=pending - for kitchen / admin dashboard (replaces TODO in AdminDashboard.tsx)
ordersRouter.get('/', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
  const status = req.query.status as string | undefined;
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
    let loyPhone: string | null = cur.rows[0].loyalty_phone || null;
    let loyEarned = Number(cur.rows[0].loyalty_earned ?? 0);
    let loyRedeemed = Number(cur.rows[0].loyalty_redeemed ?? 0);
    let loyDiscount = Number(cur.rows[0].loyalty_discount ?? 0);

    if (Array.isArray(b.cartItems)) {
      // Return previous stock first so the re-check sees true availability
      const oldItems = await client.query('SELECT quantity, variant_option_id FROM order_items WHERE order_id=$1', [req.params.id]);
      for (const it of oldItems.rows) {
        if (it.variant_option_id) {
          await client.query('UPDATE variant_options SET quantity = quantity + $1 WHERE id=$2 AND quantity IS NOT NULL', [it.quantity, it.variant_option_id]);
        }
      }
      await client.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id]);
      await releaseLoyalty(client, cur.rows[0]);

      const lines: ResolvedLine[] = [];
      try {
        for (const it of b.cartItems) {
          lines.push(await resolveLine(client, it));
        }
      } catch (e) {
        await client.query('ROLLBACK');
        return sendOrderError(res, e, 'order update failed');
      }
      subtotal = money(lines.reduce((s, l) => s + l.lineSubtotal, 0));
      await releaseUsage(client, coupon);
      const computed = await computeDiscount(client, lines, subtotal, b.couponCode ?? coupon ?? undefined);
      discount = computed.discount;
      coupon = computed.appliedCoupon || (b.couponCode !== undefined ? b.couponCode?.trim() || null : coupon);
      await bumpUsage(client, computed.appliedOfferId);
      try {
        const loy = await applyLoyalty(
          client,
          b.loyaltyPhone !== undefined ? b.loyaltyPhone : loyPhone,
          b.redeemPoints ?? 0,
          money(subtotal - discount)
        );
        loyPhone = loy.phone; loyEarned = loy.earned; loyRedeemed = loy.redeemed; loyDiscount = loy.redeemDiscount;
      } catch (e) {
        await client.query('ROLLBACK');
        return sendOrderError(res, e, 'order update failed');
      }

      for (const l of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, variant_option_id, product_name_snapshot, variant_group_name, variant_value, unit_label, unit_price, quantity, line_total, addons_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [req.params.id, l.productId, l.optionId, l.productName, l.groupName, l.variantValue, l.unitLabel,
           l.unitPrice, l.quantity, l.lineSubtotal, JSON.stringify(l.addonsSnapshot)]
        );
        await client.query('UPDATE variant_options SET quantity = quantity - $1 WHERE id=$2 AND quantity IS NOT NULL', [l.quantity, l.optionId]);
      }
    } else if (b.couponCode !== undefined || b.loyaltyPhone !== undefined || b.redeemPoints !== undefined) {
      // Coupon/loyalty-only change: recompute against existing items (no stock movement)
      const existing = await client.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
      const lines: ResolvedLine[] = existing.rows.map((r: any) => ({
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
        lineSubtotal: money(
          (Number(r.unit_price) +
            (typeof r.addons_snapshot === 'string' ? JSON.parse(r.addons_snapshot) : r.addons_snapshot || []).reduce(
              (s: number, a: any) => s + Number(a.extraPrice ?? a.extra_price ?? 0), 0)) *
            Number(r.quantity)
        ),
      }));
      const base = money(lines.reduce((s, l) => s + l.lineSubtotal, 0));
      subtotal = base;
      await releaseUsage(client, coupon);
      await releaseLoyalty(client, cur.rows[0]);
      try {
        const computed = await computeDiscount(client, lines, base, b.couponCode ?? coupon ?? undefined);
        discount = computed.discount;
        coupon = computed.appliedCoupon || (b.couponCode !== undefined ? b.couponCode?.trim() || null : coupon);
        await bumpUsage(client, computed.appliedOfferId);
        const loy = await applyLoyalty(
          client,
          b.loyaltyPhone !== undefined ? b.loyaltyPhone : loyPhone,
          b.redeemPoints ?? 0,
          money(base - discount)
        );
        loyPhone = loy.phone; loyEarned = loy.earned; loyRedeemed = loy.redeemed; loyDiscount = loy.redeemDiscount;
      } catch (e) {
        await client.query('ROLLBACK');
        return sendOrderError(res, e, 'order update failed');
      }
    }
    const total = money(subtotal - discount - loyDiscount);

    const { rows } = await client.query(
      `UPDATE orders SET service_method=COALESCE($1,service_method), table_number=COALESCE($2,table_number),
        payment_method=COALESCE($3,payment_method), first_name=COALESCE($4,first_name), last_name=COALESCE($5,last_name),
        phone_number=COALESCE($6,phone_number), address=COALESCE($7,address), city=COALESCE($8,city),
        country=COALESCE($9,country), delivery_location=COALESCE($10,delivery_location),
        delivery_lat=COALESCE($11,delivery_lat), delivery_lng=COALESCE($12,delivery_lng),
        total_amount=$13, subtotal_amount=$14, discount_amount=$15, coupon_code=$16,
        loyalty_phone=$17, loyalty_earned=$18, loyalty_redeemed=$19, loyalty_discount=$20 WHERE id=$21 RETURNING *`,
      [b.serviceMethod || null, b.tableNumber ?? null, b.payment?.method || null,
       b.shipping?.firstName ?? null, b.shipping?.lastName ?? null, b.shipping?.phoneNumber ?? null,
       b.shipping?.address ?? null, b.shipping?.city ?? null, b.shipping?.country ?? null,
       b.deliveryMeta?.location ?? null, b.deliveryMeta?.coordinates?.lat ?? null, b.deliveryMeta?.coordinates?.lng ?? null,
       total, subtotal, discount, coupon, loyPhone, loyEarned, loyRedeemed, loyDiscount, req.params.id]
    );
    await client.query('COMMIT');
    const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
    res.json({ ...rows[0], items: items.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    sendOrderError(res, e, 'order update failed');
  } finally {
    client.release();
  }
});

// GET /api/orders/loyalty/:phone - wallet balance + earn/redeem rates (staff)
ordersRouter.get('/loyalty/:phone', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
  const digits = phoneDigits(req.params.phone);
  if (digits.length < 7) return res.status(400).json({ error: 'invalid phone' });
  const w = await pool.query(
    `SELECT phone, points FROM loyalty WHERE RIGHT(regexp_replace(phone, '\\D', '', 'g'), 9) = RIGHT($1, 9)`,
    [digits]
  );
  const s = await pool.query('SELECT loyalty_earn_per_jd AS earn, loyalty_jd_per_point AS value FROM settings WHERE id=1');
  res.json({
    phone: w.rows[0]?.phone || '+' + digits,
    points: w.rows[0] ? Number(w.rows[0].points) : 0,
    earn_per_jd: Number(s.rows[0]?.earn) || 0,
    jd_per_point: Number(s.rows[0]?.value) || 0,
  });
});

// GET /api/orders/:id - order + items for employee detail view
ordersRouter.get('/:id', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
  const o = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!o.rows[0]) return res.status(404).json({ error: 'not found' });
  const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
  res.json({ ...o.rows[0], items: items.rows });
});

// PATCH /api/orders/:id/status - cancelling restores stock
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'on_the_way', 'completed', 'cancelled'];
ordersRouter.patch('/:id/status', requireAuth, requireRole('admin', 'cashier', 'kitchen'), async (req, res) => {
  const { status } = req.body || {};
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      'SELECT status, coupon_code, loyalty_phone, loyalty_earned, loyalty_redeemed, subtotal_amount, discount_amount FROM orders WHERE id=$1',
      [req.params.id]
    );
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
            await client.query('UPDATE variant_options SET quantity = quantity + $1 WHERE id=$2 AND quantity IS NOT NULL', [it.quantity, it.variant_option_id]);
          }
        }
        await releaseUsage(client, cur.rows[0].coupon_code);
        await releaseLoyalty(client, cur.rows[0]);
      } else if (prev === 'cancelled' && status !== 'cancelled') {
        // Re-activating: re-check + decrement (unlimited stock needs neither)
        for (const it of items.rows) {
          if (!it.variant_option_id) continue;
          const r = await client.query('SELECT quantity FROM variant_options WHERE id=$1 FOR UPDATE', [it.variant_option_id]);
          if (!r.rows[0] || (r.rows[0].quantity !== null && Number(r.rows[0].quantity) < Number(it.quantity))) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'insufficient stock to re-activate order' });
          }
          await client.query('UPDATE variant_options SET quantity = quantity - $1 WHERE id=$2 AND quantity IS NOT NULL', [it.quantity, it.variant_option_id]);
        }
        await bumpUsageIfRoom(client, cur.rows[0].coupon_code);
        // Re-apply loyalty exactly as stored (base unchanged while cancelled)
        if (cur.rows[0].loyalty_phone && (Number(cur.rows[0].loyalty_earned) > 0 || Number(cur.rows[0].loyalty_redeemed) > 0)) {
          try {
            const base = money(Number(cur.rows[0].subtotal_amount) - Number(cur.rows[0].discount_amount || 0));
            await applyLoyalty(client, cur.rows[0].loyalty_phone, Number(cur.rows[0].loyalty_redeemed) || 0, base);
          } catch (e) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'insufficient loyalty points to re-activate order' });
          }
        }
      }
    }
    const { rows } = await client.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    sendOrderError(res, e, 'status update failed');
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/payment - cashier marks paid by order ID (cash now, cliq auto later)
// body: { payment_status: 'paid'|'unpaid', method?: 'cash'|'cliq' }
ordersRouter.patch('/:id/payment', requireAuth, requireRole('admin', 'cashier'), async (req, res) => {
  const { payment_status, method } = req.body || {};
  if (!['paid', 'unpaid'].includes(payment_status)) {
    return res.status(400).json({ error: 'payment_status must be paid|unpaid' });
  }
  if (method !== undefined && !['cash', 'cliq'].includes(method)) {
    return res.status(400).json({ error: 'method must be cash|cliq' });
  }
  const { rows } = await pool.query(
    `UPDATE orders SET payment_status=$1, payment_method=COALESCE($2,payment_method) WHERE id=$3 RETURNING *`,
    [payment_status, method || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// PATCH /api/orders/:id/assign - kitchen staff claim an order as their task
// body: { assigned_to: userId }
ordersRouter.patch('/:id/assign', requireAuth, requireRole('kitchen'), async (req, res) => {
  const { assigned_to } = req.body || {};
  if (!assigned_to) return res.status(400).json({ error: 'assigned_to required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const o = await client.query('SELECT status FROM orders WHERE id=$1', [req.params.id]);
    if (!o.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    if (o.rows[0].status === 'cancelled' || o.rows[0].status === 'completed') {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'cannot assign cancelled/completed order' });
    }
    const { rows } = await client.query(
      `UPDATE orders SET assigned_to=$1, assigned_at=now() WHERE id=$2 RETURNING *`,
      [assigned_to, req.params.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    sendOrderError(res, e, 'assign failed');
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/unassign - remove assignment from an order
ordersRouter.patch('/:id/unassign', requireAuth, requireRole('kitchen', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE orders SET assigned_to=NULL, assigned_at=NULL WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    await client.query('COMMIT');
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    sendOrderError(res, e, 'unassign failed');
  } finally {
    client.release();
  }
});
