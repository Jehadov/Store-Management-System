import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { pool } from './db/pool.js';
import { requireAuth, requireRole } from './auth/middleware.js';
import { authRouter } from './routes/auth.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { ordersRouter } from './routes/orders.js';
import { addonsRouter } from './routes/addons.js';
import { offersRouter } from './routes/offers.js';
import { uploadRouter } from './routes/upload.js';
import { videosRouter } from './routes/videos.js';
import { adminRouter } from './routes/admin.js';
import { settingsRouter } from './routes/settings.js';
import { tablesRouter } from './routes/tables.js';
import { trackRouter } from './routes/track.js';
import { expensesRouter } from './routes/expenses.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/addons', addonsRouter);
app.use('/api/offers', offersRouter);
app.use('/api/upload', requireAuth, requireRole('admin'), uploadRouter);
app.use('/api/videos', videosRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/track', trackRouter);
app.use('/api/expenses', expensesRouter);
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
