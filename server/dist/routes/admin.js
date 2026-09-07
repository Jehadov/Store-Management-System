import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
export const adminRouter = Router();
// GET /api/admin/overview (admin only) - single call for AdminDashboard:
// counts, orders by status, revenue, recent orders, low stock, active videos/offers
adminRouter.get('/overview', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
        const [products, categories, addons, offers, videos, users, ordersByStatus, revenue, recent, lowStock] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS count FROM products'),
            pool.query('SELECT COUNT(*)::int AS count FROM categories'),
            pool.query('SELECT COUNT(*)::int AS count FROM addons'),
            pool.query('SELECT COUNT(*)::int AS count FROM offers WHERE is_active AND end_date >= CURRENT_DATE'),
            pool.query('SELECT COUNT(*)::int AS count FROM videos WHERE is_active'),
            pool.query(`SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`),
            pool.query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`),
            pool.query(`SELECT COALESCE(SUM(total_amount),0)::float AS total,
                  COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN total_amount ELSE 0 END),0)::float AS today
           FROM orders WHERE status != 'cancelled'`),
            pool.query('SELECT id, order_number, service_method, status, payment_method, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 10'),
            pool.query(`SELECT vo.id, vo.value_en, vo.quantity, p.name_en AS product
           FROM variant_options vo
           JOIN variant_groups vg ON vg.id = vo.group_id
           JOIN products p ON p.id = vg.product_id
           WHERE vo.quantity < 5 ORDER BY vo.quantity ASC LIMIT 20`),
        ]);
        const usersByRole = {};
        for (const r of users.rows)
            usersByRole[r.role] = r.count;
        const orders = {};
        for (const r of ordersByStatus.rows)
            orders[r.status] = r.count;
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
            recentOrders: recent.rows,
            lowStock: lowStock.rows,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'overview failed' });
    }
});
