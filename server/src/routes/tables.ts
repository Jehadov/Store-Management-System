import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const tablesRouter = Router();

// GET /api/tables - floor map with live occupancy (public for POS)
tablesRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.label, t.seats, t.sort_order, t.is_active,
            (SELECT json_agg(json_build_object(
               'id', o.id, 'order_number', o.order_number, 'status', o.status,
               'total_amount', o.total_amount, 'created_at', o.created_at))
             FROM orders o
             WHERE o.table_number = t.label AND o.status IN ('pending','preparing','ready')) AS active_orders
     FROM dining_tables t WHERE t.is_active ORDER BY t.sort_order, t.label`
  );
  res.json(
    rows.map((r: any) => ({
      ...r,
      active_orders: r.active_orders || [],
      occupied: (r.active_orders || []).length > 0,
    }))
  );
});

// POST /api/tables (admin) - add a table
tablesRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { label, seats, sort_order } = req.body || {};
  if (!label?.trim()) return res.status(400).json({ error: 'label required (e.g. T1)' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO dining_tables (label, seats, sort_order) VALUES ($1,$2,$3) RETURNING *`,
      [label.trim(), Math.max(1, Number(seats) || 4), Number(sort_order) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (String(e?.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'table label already exists' });
    }
    throw e;
  }
});

// PUT /api/tables/:id (admin) - rename / seats / reorder / deactivate
tablesRouter.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { label, seats, sort_order, is_active } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE dining_tables SET label=COALESCE($1,label), seats=COALESCE($2,seats),
        sort_order=COALESCE($3,sort_order), is_active=COALESCE($4,is_active)
       WHERE id=$5 RETURNING *`,
      [label ?? null, seats ?? null, sort_order ?? null, is_active ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e: any) {
    if (String(e?.message || '').includes('duplicate')) {
      return res.status(409).json({ error: 'table label already exists' });
    }
    throw e;
  }
});

// DELETE /api/tables/:id (admin) - blocked while occupied
tablesRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const t = await pool.query('SELECT label FROM dining_tables WHERE id=$1', [req.params.id]);
  if (!t.rows[0]) return res.status(404).json({ error: 'not found' });
  const busy = await pool.query(
    `SELECT 1 FROM orders WHERE table_number=$1 AND status IN ('pending','preparing','ready') LIMIT 1`,
    [t.rows[0].label]
  );
  if (busy.rowCount) return res.status(409).json({ error: 'table is occupied' });
  await pool.query('DELETE FROM dining_tables WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});
