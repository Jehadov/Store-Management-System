// Run: npm run db:migrate  (needs DATABASE_URL, works on Windows without psql)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');
const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/restaurant',
});
try {
    await client.connect();
    await client.query(sql);
    console.log('[migrate] schema applied OK');
}
catch (e) {
    console.error('[migrate] FAILED:', e.message);
    process.exit(1);
}
finally {
    await client.end();
}
