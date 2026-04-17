import { config } from 'dotenv';
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@chy-crm.com';
  const name = 'admin@chy-crm.com';
  const password = 'admin123*';

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name: name,
      role: 'ADMIN',
    },
    create: {
      email,
      name,
      password: hashedPassword,
      role: 'ADMIN',
      referralCode: 'ADMIN_' + Date.now().toString(36),
    },
  });

  console.log(`[SEED] Admin account ensured: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
