const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'tien.chungloveu@admin.com' }, select: { id: true, role: true }});
  console.log('User:', u);
}

main().finally(() => prisma.$disconnect());
