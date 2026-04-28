const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, slug: true, isActive: true }
  });
  console.log('Stores:', stores);

  const adminStore = stores.find(s => s.slug === 'admin-global-store');
  if (adminStore) {
    const newSlug = adminStore.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    console.log('Updating admin store slug to:', newSlug);
    await prisma.store.update({
      where: { id: adminStore.id },
      data: { slug: newSlug, isActive: true }
    });
    console.log('Update complete.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
