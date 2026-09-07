import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const settingsRouter = Router();

export const DEFAULT_THEME = {
  light: { headerBg: '#ffffff', headerText: '#18181b', footerBg: '#f4f4f5', footerText: '#52525b', accent: '#0d6efd' },
  dark: { headerBg: '#18181b', headerText: '#f8f9fa', footerBg: '#101014', footerText: '#a1a1aa', accent: '#60a5fa' },
};

function parseTheme(raw: any) {
  try {
    const t = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    return {
      light: { ...DEFAULT_THEME.light, ...(t.light || {}) },
      dark: { ...DEFAULT_THEME.dark, ...(t.dark || {}) },
    };
  } catch {
    return DEFAULT_THEME;
  }
}

// GET /api/settings - public shop identity (name EN/AR + logo + layout + theme + phones)
settingsRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT name_en, name_ar, logo_url, layout, loyalty_earn_per_jd, loyalty_jd_per_point, theme_json, phones FROM settings WHERE id=1'
  );
  const r = rows[0];
  res.json(
    r
      ? { name_en: r.name_en, name_ar: r.name_ar, logo_url: r.logo_url, layout: r.layout || 'topbar',
          loyalty_earn_per_jd: Number(r.loyalty_earn_per_jd), loyalty_jd_per_point: Number(r.loyalty_jd_per_point),
          theme: parseTheme(r.theme_json), phones: r.phones || [] }
      : { name_en: 'My Restaurant', name_ar: 'مطعمي', logo_url: '', layout: 'topbar',
          loyalty_earn_per_jd: 1, loyalty_jd_per_point: 0.05, theme: DEFAULT_THEME, phones: [] }
  );
});

// PUT /api/settings (admin) - update shop identity
settingsRouter.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  const b = req.body || {};
  if (b.layout !== undefined && !['topbar', 'sidebar'].includes(b.layout)) {
    return res.status(400).json({ error: 'layout must be topbar|sidebar' });
  }
  let phones: string[] | null = null;
  if (b.phones !== undefined) {
    if (!Array.isArray(b.phones)) return res.status(400).json({ error: 'phones must be an array' });
    const cleaned: string[] = [...new Set((b.phones as any[]).map((p: any) => String(p || '').trim()).filter(Boolean))];
    phones = cleaned.slice(0, 4);
  }
  const { rows } = await pool.query(
    `UPDATE settings SET name_en=COALESCE($1,name_en), name_ar=COALESCE($2,name_ar),
      logo_url=COALESCE($3,logo_url), layout=COALESCE($4,layout),
      loyalty_earn_per_jd=COALESCE($5,loyalty_earn_per_jd), loyalty_jd_per_point=COALESCE($6,loyalty_jd_per_point),
      theme_json=COALESCE($7,theme_json), phones=COALESCE($8,phones),
      updated_at=now() WHERE id=1
      RETURNING name_en, name_ar, logo_url, layout, loyalty_earn_per_jd, loyalty_jd_per_point, theme_json, phones`,
    [b.name_en ?? null, b.name_ar ?? null, b.logo_url ?? b.logoUrl ?? null, b.layout ?? null,
     b.loyaltyEarn ?? b.loyalty_earn_per_jd ?? null, b.loyaltyValue ?? b.loyalty_jd_per_point ?? null,
     b.theme ? JSON.stringify(parseTheme(b.theme)) : null, phones]
  );
  const r = rows[0];
  res.json({ ...r, theme: parseTheme(r.theme_json) });
});
