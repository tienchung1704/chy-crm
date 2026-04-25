const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrderInDB() {
  const SEARCH_QUERY = '139211587021';
  const PHONE = '0338253111';

  console.log(`🔍 Checking DB for Order Code/Tracking: ${SEARCH_QUERY} or Phone: ${PHONE}`);

  try {
    const allOrders = await prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    console.log(`ℹ️ Last 5 orders in DB:`, allOrders.map(o => o.orderCode));

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { orderCode: SEARCH_QUERY },
          { shippingPhone: PHONE },
          {
            metadata: {
              path: '$.partner.trackingCode',
              equals: SEARCH_QUERY,
            },
          },
        ],
      },
    });

    if (orders.length === 0) {
      console.log('❌ No orders found in database.');
    } else {
      console.log(`✅ Found ${orders.length} orders:`);
      orders.forEach(o => {
        console.log(`- ID: ${o.id}, Code: ${o.orderCode}, Status: ${o.status}, Phone: ${o.shippingPhone}`);
        console.log(`  Metadata: ${JSON.stringify(o.metadata)}`);
      });
    }
  } catch (error) {
    console.error('❌ DB Query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrderInDB();
