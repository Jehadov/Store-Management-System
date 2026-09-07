import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
if (!process.env.DATABASE_URL) {
    console.warn('[db] DATABASE_URL not set, using local default');
}
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/restaurant',
});
pool.on('error', (err) => console.error('[db] pool error', err));
