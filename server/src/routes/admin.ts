import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const adminRouter = Router();

// GET /api/admin/overview (admin only) - single call for AdminDashboard:
// counts, orders by status, revenue, recent orders, low stock, active videos/offers
adminRouter.get('/overview', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [products, categories, addons, offers, videos, users, ordersByStatus, revenue, recent, lowStock, today, attention] =
      await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM products'),
        pool.query('SELECT COUNT(*)::int AS count FROM categories'),
        pool.query('SELECT COUNT(*)::int AS count FROM addons'),
        pool.query('SELECT COUNT(*)::int AS count FROM offers WHERE is_active AND end_date >= CURRENT_DATE'),
        pool.query('SELECT COUNT(*)::int AS count FROM videos WHERE is_active'),
        pool.query(
          `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`
        ),
        pool.query(
          `SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`
        ),
        pool.query(
          `SELECT COALESCE(SUM(total_amount),0)::float AS total,
                  COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN total_amount ELSE 0 END),0)::float AS today
           FROM orders WHERE status != 'cancelled'`
        ),
        pool.query(
          'SELECT id, order_number, service_method, status, payment_method, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 10'
        ),
        pool.query(
          `SELECT vo.id, vo.value_en, vo.quantity, p.name_en AS product
           FROM variant_options vo
           JOIN variant_groups vg ON vg.id = vo.group_id
           JOIN products p ON p.id = vg.product_id
           WHERE vo.quantity IS NOT NULL AND vo.quantity < 5 ORDER BY vo.quantity ASC LIMIT 20`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS orders_today,
                  COALESCE(SUM(total_amount),0)::float AS revenue_today,
                  CASE WHEN COUNT(*) = 0 THEN 0
                       ELSE COALESCE(SUM(total_amount),0) / COUNT(*) END::float AS avg_ticket
           FROM orders WHERE status != 'cancelled' AND created_at >= CURRENT_DATE`
        ),
        pool.query(
          `SELECT id, order_number, service_method, table_number, total_amount, created_at,
                  EXTRACT(EPOCH FROM (now() - created_at))::int / 60 AS age_min
           FROM orders WHERE status = 'pending' AND created_at < now() - interval '15 minutes'
           ORDER BY created_at ASC LIMIT 10`
        ),
      ]);

    const usersByRole: Record<string, number> = {};
    for (const r of users.rows) usersByRole[r.role] = r.count;

    const orders: Record<string, number> = {};
    for (const r of ordersByStatus.rows) orders[r.status] = r.count;

    res.json({
      counts: {
        products: products.rows[0].count,
        categories: categories.rows[0].count,
        addons: addons.rows[0].count,
        activeOffers: offers.rows[0].count,
        activeVideos: videos.rows[0].count,
        users: usersByRole,
        orders,
      },
      revenue: revenue.rows[0],
      today: today.rows[0],
      attention: attention.rows,
      recentOrders: recent.rows,
      lowStock: lowStock.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'overview failed' });
  }
});

// GET /api/admin/stats/revenue (admin) - modes:
// ?days=7|30 (default 7)          -> daily, trailing days incl. today
// ?preset=last-week               -> daily, previous Mon-Sun week
// ?preset=last-month              -> daily, previous calendar month
// ?year=2026&month=9              -> daily, that calendar month
// ?year=2026                      -> monthly series for the year
adminRouter.get('/stats/revenue', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const preset = String(req.query.preset || '');
    if (year && month >= 1 && month <= 12) {
      const { rows } = await pool.query(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                COALESCE(SUM(o.total_amount), 0)::float AS revenue,
                COUNT(o.id)::int AS orders
         FROM (SELECT (make_date($1, $2, 1) + (s || ' days')::interval)::date AS day
               FROM generate_series(0, EXTRACT(DAY FROM (make_date($1, $2, 1) + interval '1 month' - interval '1 day'))::int - 1) s) d
         LEFT JOIN orders o ON o.created_at::date = d.day AND o.status != 'cancelled'
         GROUP BY d.day ORDER BY d.day`,
        [year, month]
      );
      return res.json(rows);
    }
    if (year) {
      const { rows } = await pool.query(
        `SELECT to_char(d.m, 'YYYY-MM') AS day,
                COALESCE(SUM(o.total_amount), 0)::float AS revenue,
                COUNT(o.id)::int AS orders
         FROM (SELECT date_trunc('month', make_date($1, s, 1)) AS m FROM generate_series(1, 12) s) d
         LEFT JOIN orders o ON date_trunc('month', o.created_at) = d.m AND o.status != 'cancelled'
         GROUP BY d.m ORDER BY d.m`,
        [year]
      );
      return res.json(rows);
    }
    if (preset === 'last-week' || preset === 'last-month') {
      // trailing 7 / 30 days ending today
      const n = preset === 'last-week' ? 7 : 30;
      const { rows } = await pool.query(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                COALESCE(SUM(o.total_amount), 0)::float AS revenue,
                COUNT(o.id)::int AS orders
         FROM (SELECT CURRENT_DATE - (s || ' days')::interval AS day FROM generate_series(0, $1 - 1) s) d
         LEFT JOIN orders o ON o.created_at::date = d.day AND o.status != 'cancelled'
         GROUP BY d.day ORDER BY d.day`,
        [n]
      );
      return res.json(rows);
    }
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const { rows } = await pool.query(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              COALESCE(SUM(o.total_amount),0)::float AS revenue,
              COUNT(o.id)::int AS orders
       FROM (SELECT CURRENT_DATE - (s || ' days')::interval AS day FROM generate_series(0, $1 - 1) s) d
       LEFT JOIN orders o ON o.created_at::date = d.day AND o.status != 'cancelled'
       GROUP BY d.day ORDER BY d.day`,
      [days]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'revenue stats failed' });
  }
});

// GET /api/admin/stats/years (admin) - years that have orders (for the picker)
adminRouter.get('/stats/years', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year FROM orders ORDER BY year DESC`
    );
    const years = rows.map((r) => r.year);
    const current = new Date().getFullYear();
    if (!years.includes(current)) years.unshift(current);
    res.json(years);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'years failed' });
  }
});

// GET /api/admin/stats/top-products?limit=5&year=2026&month=9&preset=last-month (admin)
adminRouter.get('/stats/top-products', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const preset = String(req.query.preset || '');
    let cond = '';
    const params: any[] = [limit];
    if (year && month >= 1 && month <= 12) {
      params.push(year, month);
      cond = `AND o.created_at >= make_date($2, $3, 1) AND o.created_at < make_date($2, $3, 1) + interval '1 month'`;
    } else if (year) {
      params.push(year);
      cond = `AND EXTRACT(YEAR FROM o.created_at) = $2`;
    } else if (preset === 'last-week') {
      cond = `AND o.created_at >= CURRENT_DATE - interval '6 days'`;
    } else if (preset === 'last-month') {
      cond = `AND o.created_at >= CURRENT_DATE - interval '29 days'`;
    }
    const { rows } = await pool.query(
      `SELECT i.product_name_snapshot AS name, i.product_id,
              SUM(i.quantity)::int AS qty,
              SUM(i.unit_price * i.quantity)::float AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.status != 'cancelled' ${cond}
       GROUP BY i.product_name_snapshot, i.product_id
       ORDER BY qty DESC LIMIT $1`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'top products failed' });
  }
});

// GET /api/admin/stats/mix (admin) - revenue share by service + payment, avg order, items sold
adminRouter.get('/stats/mix', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [service, payment, totals] = await Promise.all([
      pool.query(
        `SELECT service_method AS key, COUNT(*)::int AS orders, COALESCE(SUM(total_amount),0)::float AS revenue
         FROM orders WHERE status != 'cancelled' GROUP BY service_method`
      ),
      pool.query(
        `SELECT payment_method AS key, COUNT(*)::int AS orders, COALESCE(SUM(total_amount),0)::float AS revenue
         FROM orders WHERE status != 'cancelled' GROUP BY payment_method`
      ),
      pool.query(
        `SELECT (SELECT COUNT(*)::int FROM orders WHERE status != 'cancelled') AS orders,
                (SELECT COALESCE(SUM(total_amount),0)::float FROM orders WHERE status != 'cancelled') AS revenue,
                (SELECT COALESCE(SUM(i.quantity),0)::int FROM order_items i
                 JOIN orders o ON o.id = i.order_id WHERE o.status != 'cancelled') AS items,
                CASE WHEN (SELECT COUNT(*) FROM orders WHERE status != 'cancelled') = 0 THEN 0
                     ELSE (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status != 'cancelled')
                        / (SELECT COUNT(*) FROM orders WHERE status != 'cancelled') END::float AS avg_order`
      ),
    ]);
    res.json({ service: service.rows, payment: payment.rows, totals: totals.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'mix stats failed' });
  }
});

// GET /api/admin/stats/hours (admin) - orders + revenue by hour of day (staffing the rush)
adminRouter.get('/stats/hours', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.hr AS hour, COUNT(o.id)::int AS orders, COALESCE(SUM(o.total_amount),0)::float AS revenue
       FROM (SELECT s AS hr FROM generate_series(0, 23) s) h
       LEFT JOIN orders o ON EXTRACT(HOUR FROM o.created_at)::int = h.hr AND o.status != 'cancelled'
       GROUP BY h.hr ORDER BY h.hr`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'hours stats failed' });
  }
});

// GET /api/admin/stats/categories (admin) - revenue + qty per category
adminRouter.get('/stats/categories', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(c.name_en, 'Uncategorized') AS name,
              SUM(i.quantity)::int AS qty,
              SUM(i.unit_price * i.quantity)::float AS revenue
       FROM order_items i
       JOIN orders o ON o.id = i.order_id
       LEFT JOIN product_categories pc ON pc.product_id = i.product_id
       LEFT JOIN categories c ON c.id = pc.category_id
       WHERE o.status != 'cancelled'
       GROUP BY 1 ORDER BY revenue DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'category stats failed' });
  }
});

// GET /api/admin/stats/discounts (admin) - what offers cost + top coupons + cancel rate inputs
adminRouter.get('/stats/discounts', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const [tot, coupons, cancelled] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(discount_amount),0)::float AS given,
                COUNT(*) FILTER (WHERE COALESCE(discount_amount,0) > 0)::int AS discounted_orders,
                COUNT(*)::int AS orders
         FROM orders WHERE status != 'cancelled'`
      ),
      pool.query(
        `SELECT coupon_code AS code, COUNT(*)::int AS uses, COALESCE(SUM(discount_amount),0)::float AS given
         FROM orders WHERE status != 'cancelled' AND coupon_code IS NOT NULL
         GROUP BY coupon_code ORDER BY uses DESC LIMIT 5`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount),0)::float AS lost
         FROM orders WHERE status = 'cancelled'`
      ),
    ]);
    res.json({ totals: tot.rows[0], coupons: coupons.rows, cancelled: cancelled.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'discount stats failed' });
  }
});

// GET /api/admin/stats/eod?date=YYYY-MM-DD (admin, default today) - end-of-day Z-report
adminRouter.get('/stats/eod', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const day = String(req.query.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
      ? String(req.query.date)
      : new Date().toISOString().slice(0, 10);
    const [summary, payment, status, coupons, losses] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS orders,
                COALESCE(SUM(subtotal_amount),0)::float AS gross,
                COALESCE(SUM(discount_amount),0)::float AS discounts,
                COALESCE(SUM(loyalty_discount),0)::float AS loyalty,
                COALESCE(SUM(total_amount),0)::float AS net,
                COALESCE(SUM(loyalty_earned),0)::int AS points_earned,
                CASE WHEN COUNT(*) = 0 THEN 0
                     ELSE COALESCE(SUM(total_amount),0) / COUNT(*) END::float AS avg_ticket
         FROM orders WHERE status != 'cancelled' AND created_at::date = $1::date`,
        [day]
      ),
      pool.query(
        `SELECT payment_method AS key, COUNT(*)::int AS orders, COALESCE(SUM(total_amount),0)::float AS revenue
         FROM orders WHERE status != 'cancelled' AND created_at::date = $1::date GROUP BY payment_method`,
        [day]
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS count FROM orders
         WHERE created_at::date = $1::date GROUP BY status`,
        [day]
      ),
      pool.query(
        `SELECT coupon_code AS code, COUNT(*)::int AS uses, COALESCE(SUM(discount_amount),0)::float AS given
         FROM orders WHERE status != 'cancelled' AND created_at::date = $1::date AND coupon_code IS NOT NULL
         GROUP BY coupon_code ORDER BY uses DESC`,
        [day]
      ),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM expenses WHERE spent_at = $1::date`, [day]),
    ]);
    res.json({ day, summary: summary.rows[0], payment: payment.rows, status: status.rows, coupons: coupons.rows, losses: losses.rows[0].total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'eod failed' });
  }
});
