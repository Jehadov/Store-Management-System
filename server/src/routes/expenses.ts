import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const expensesRouter = Router();

export const EXPENSE_CATS = ['rent', 'salaries', 'food-cost', 'waste', 'utilities', 'marketing', 'other'];

// Build a date-range WHERE fragment shared by list + total.
// Supports the same range params as revenue stats.
function rangeCond(q: any): { sql: string; params: any[] } {
  const year = Number(q.year);
  const month = Number(q.month);
  const preset = String(q.preset || '');
  if (year && month >= 1 && month <= 12) {
    return {
      sql: `spent_at >= make_date($1, $2, 1) AND spent_at < make_date($1, $2, 1) + interval '1 month'`,
      params: [year, month],
    };
  }
  if (year) {
    return { sql: `EXTRACT(YEAR FROM spent_at) = $1`, params: [year] };
  }
  if (preset === 'last-week') {
    return { sql: `spent_at > CURRENT_DATE - interval '7 days'`, params: [] };
  }
  if (preset === 'last-month') {
    return { sql: `spent_at > CURRENT_DATE - interval '30 days'`, params: [] };
  }
  const days = Math.min(Math.max(Number(q.days) || 30, 1), 365);
  return { sql: `spent_at > CURRENT_DATE - ($1 || ' days')::interval`, params: [days] };
}

// GET /api/expenses?days=&preset=&year=&month= (admin) - list + total
expensesRouter.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { sql, params } = rangeCond(req.query);
  const list = await pool.query(`SELECT * FROM expenses WHERE ${sql} ORDER BY spent_at DESC, created_at DESC`, params);
  const tot = await pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM expenses WHERE ${sql}`, params);
  const byCat = await pool.query(
    `SELECT category, COALESCE(SUM(amount),0)::float AS total FROM expenses WHERE ${sql} GROUP BY category ORDER BY total DESC`,
    params
  );
  res.json({ items: list.rows, total: tot.rows[0].total, byCategory: byCat.rows });
});

// POST /api/expenses (admin)
expensesRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  if (!b.title?.trim()) return res.status(400).json({ error: 'title required' });
  const amount = Number(b.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'amount must be greater than 0' });
  const { rows } = await pool.query(
    `INSERT INTO expenses (title, amount, category, spent_at, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.title.trim(), amount, EXPENSE_CATS.includes(b.category) ? b.category : 'other',
     b.spentAt || b.spent_at || new Date().toISOString().slice(0, 10), b.notes || '']
  );
  res.status(201).json(rows[0]);
});

// PUT /api/expenses/:id (admin)
expensesRouter.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  if (b.amount !== undefined && !(Number(b.amount) > 0)) {
    return res.status(400).json({ error: 'amount must be greater than 0' });
  }
  const { rows } = await pool.query(
    `UPDATE expenses SET title=COALESCE($1,title), amount=COALESCE($2,amount),
      category=COALESCE($3,category), spent_at=COALESCE($4,spent_at), notes=COALESCE($5,notes)
     WHERE id=$6 RETURNING *`,
    [b.title ?? null, b.amount ?? null,
     b.category && EXPENSE_CATS.includes(b.category) ? b.category : null,
     b.spentAt || b.spent_at || null, b.notes ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// DELETE /api/expenses/:id (admin)
expensesRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});
