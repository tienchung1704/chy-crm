import { config } from 'dotenv';
config({ path: '.env' });

import * as mariadb from 'mariadb';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}

const parsed = new URL(url);

async function main() {
  const conn = await mariadb.createConnection({
    host: parsed.hostname,
    port: parseInt(parsed.port) || 4000,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    ssl: true,
  });

  console.log('[SEED] Connected to database');

  const email = 'admin@chy-crm.com';
  const name = 'admin@chy-crm.com';
  const password = 'admin123*';
  const hashedPassword = await bcrypt.hash(password, 10);
  const referralCode = 'ADMIN_' + Date.now().toString(36);

  const existing = await conn.query('SELECT id FROM users WHERE email = ?', [email]);

  if (existing.length > 0) {
    await conn.query(
      'UPDATE users SET password = ?, name = ?, role = ? WHERE email = ?',
      [hashedPassword, name, 'ADMIN', email]
    );
    console.log(`[SEED] Admin updated: ${email}`);
  } else {
    await conn.query(
      `INSERT INTO users (id, email, name, password, role, referral_code, \`rank\`, totalSpent, commission_balance, points, is_active, onboarding_complete, createdAt, updatedAt)
       VALUES (UUID(), ?, ?, ?, 'ADMIN', ?, 'MEMBER', 0, 0, 0, 1, 1, NOW(), NOW())`,
      [email, name, hashedPassword, referralCode]
    );
    console.log(`[SEED] Admin created: ${email}`);
  }

  await conn.end();
  console.log('[SEED] Done!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
