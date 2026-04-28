// A script to trigger product sync directly if needed
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Use POST /integrations/pancake/sync-products via Admin panel to trigger sync.');
}

run();
