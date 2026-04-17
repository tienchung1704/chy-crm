import { config } from 'dotenv';
config({ path: '.env' });
import * as mariadb from 'mariadb';
const url = process.env.DATABASE_URL!;
const parsed = new URL(url);
async function main() {
  const conn = await mariadb.createConnection({
    host: parsed.hostname, port: parseInt(parsed.port) || 4000,
    user: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1), ssl: true,
  });
  const cols = await conn.query('DESCRIBE users');
  console.log('Columns:', cols.map((c: any) => c.Field));
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
