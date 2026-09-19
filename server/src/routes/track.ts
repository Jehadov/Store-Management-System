import { Router } from 'express';
import { pool } from '../db/pool.js';

export const trackRouter = Router();

// GET /api/track/:phone - PUBLIC: customer's own orders (number, status, total, items)
trackRouter.get('/:phone', async (req, res) => {
  const digits = String(req.params.phone || '').replace(/\D/g, '');
  if (digits.length < 7) return res.status(400).json({ error: 'invalid phone' });
  const cond = `RIGHT(regexp_replace(o.phone_number, '\\D', '', 'g'), 9) = RIGHT($1, 9)
             OR RIGHT(regexp_replace(o.loyalty_phone, '\\D', '', 'g'), 9) = RIGHT($1, 9)`;
  const { rows } = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.service_method, o.table_number,
            o.total_amount, o.created_at, o.payment_method, o.payment_status
     FROM orders o WHERE (${cond}) ORDER BY o.created_at DESC LIMIT 20`,
    [digits]
  );
  const ids = rows.map((r: any) => r.id);
  let items: any[] = [];
  if (ids.length) {
    const r = await pool.query(
      `SELECT order_id, product_name_snapshot AS name, variant_value AS variant,
              quantity, unit_price FROM order_items WHERE order_id = ANY($1)`,
      [ids]
    );
    items = r.rows;
  }
  res.json(rows.map((o: any) => ({ ...o, items: items.filter((i) => i.order_id === o.id) })));
});
