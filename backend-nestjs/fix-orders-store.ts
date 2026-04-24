import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting order store fix script...');

  // 1. Find Admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    console.error('No Admin user found!');
    return;
  }

  // 2. Find or create Admin store
  let adminStore = await prisma.store.findFirst({
    where: { ownerId: adminUser.id },
  });

  if (!adminStore) {
    console.log('No Admin store found, creating one...');
    adminStore = await prisma.store.create({
      data: {
        name: 'Hệ thống Admin',
        slug: 'admin-global-store',
        ownerId: adminUser.id,
        isActive: true,
      },
    });
    console.log(`Created Admin store with ID: ${adminStore.id}`);
  } else {
    console.log(`Found Admin store with ID: ${adminStore.id}`);
  }

  // 3. Find all orders that DO NOT belong to the Admin store
  const ordersToUpdate = await prisma.order.findMany({
    where: {
      OR: [
        { storeId: { not: adminStore.id } },
        { storeId: null }
      ]
    },
    select: { id: true, storeId: true, orderCode: true }
  });

  console.log(`Found ${ordersToUpdate.length} orders to update.`);

  if (ordersToUpdate.length === 0) {
    console.log('No orders to update. Exiting.');
    return;
  }

  // 4. Update all orders to Admin store
  const updateResult = await prisma.order.updateMany({
    where: {
      id: { in: ordersToUpdate.map(o => o.id) }
    },
    data: {
      storeId: adminStore.id
    }
  });

  console.log(`Successfully updated ${updateResult.count} orders to Admin store (${adminStore.id}).`);

  // Optionally, let's also update the StoreIntegration if it's attached to the wrong store
  const integrations = await prisma.storeIntegration.findMany({
    where: {
      storeId: { not: adminStore.id }
    }
  });

  if (integrations.length > 0) {
    console.log(`Found ${integrations.length} integrations attached to wrong stores. Fixing...`);
    for (const integration of integrations) {
      // Check if admin already has this platform integration
      const existingAdminIntegration = await prisma.storeIntegration.findFirst({
        where: { storeId: adminStore.id, platform: integration.platform }
      });

      if (!existingAdminIntegration) {
        await prisma.storeIntegration.update({
          where: { id: integration.id },
          data: { storeId: adminStore.id }
        });
        console.log(`Moved ${integration.platform} integration to Admin store.`);
      } else {
        console.log(`Admin already has ${integration.platform} integration. Deleting duplicate...`);
        await prisma.storeIntegration.delete({
          where: { id: integration.id }
        });
      }
    }
  }

  console.log('Script completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error executing script:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
