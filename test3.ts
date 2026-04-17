import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function resetPancakeOrders() {
  // Delete old Pancake orders to re-sync with full data
  const deleted = await prisma.order.deleteMany({
    where: { source: 'PANCAKE' }
  });
  console.log(`Deleted ${deleted.count} old Pancake orders`);
  
  // Reset totalSpent for the test user so it recalculates
  const user = await prisma.user.findFirst({
    where: { phone: '0394883260' }
  });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { totalSpent: 0, rank: 'MEMBER', points: 0 }
    });
    console.log(`Reset user ${user.id} totalSpent to 0`);
  }

  await prisma.$disconnect();
}

resetPancakeOrders();
