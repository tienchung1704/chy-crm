const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRawUnsafe(`ALTER TABLE stores MODIFY logo_url LONGTEXT`);
  await prisma.$queryRawUnsafe(`ALTER TABLE products MODIFY image_url LONGTEXT`);
  console.log('Done!');
}

main().finally(() => prisma.$disconnect());
