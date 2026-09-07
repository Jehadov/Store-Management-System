import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { signToken, requireAuth, requireRole } from '../auth/middleware.js';

export const authRouter = Router();

// POST /api/auth/login { username, password } -> { token, user }
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username + password required' });
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = signToken({ id: user.id, username: user.username, role: user.role });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// POST /api/auth/seed - one-time bootstrap, disabled once any admin exists
authRouter.post('/seed', async (req, res) => {
  const existing = await pool.query("SELECT 1 FROM users WHERE role='admin' LIMIT 1");
  if (existing.rowCount) return res.status(403).json({ error: 'admin already exists' });
  const { username = 'admin', password = 'admin123' } = req.body || {};
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO users (username, password_hash, role) VALUES ($1,$2,'admin') RETURNING id, username, role",
    [username, hash]
  );
  res.status(201).json(rows[0]);
});

// POST /api/auth/users (admin only) - create employee: { username, password, role }
// role: admin | cashier | kitchen
authRouter.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username?.trim() || !password || !['admin', 'cashier', 'kitchen'].includes(role)) {
    return res.status(400).json({ error: 'username, password, role=admin|cashier|kitchen required' });
  }
  const exists = await pool.query('SELECT 1 FROM users WHERE username=$1', [username.trim()]);
  if (exists.rowCount) return res.status(409).json({ error: 'username taken' });
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role',
    [username.trim(), hash, role]
  );
  res.status(201).json(rows[0]);
});

// GET /api/auth/users (admin only) - list employees (no password hashes)
authRouter.get('/users', requireAuth, requireRole('admin'), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY username');
  res.json(rows);
});

// DELETE /api/auth/users/:id (admin only) - remove employee
authRouter.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = req.params.id;
  // Cannot delete yourself
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'cannot delete your own account' });
  }
  const target = await pool.query('SELECT id, role FROM users WHERE id=$1', [id]);
  if (!target.rows[0]) return res.status(404).json({ error: 'not found' });
  // Prevent deleting the last admin
  if (target.rows[0].role === 'admin') {
    const admins = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin'");
    if (admins.rows[0].count <= 1) {
      return res.status(409).json({ error: 'cannot delete the last admin' });
    }
  }
  await pool.query('DELETE FROM users WHERE id=$1', [id]);
  res.json({ ok: true });
});

// GET /api/auth/me - who am I (any logged-in staff)
authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
