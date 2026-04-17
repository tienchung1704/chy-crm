import { PrismaClient } from '@prisma/client';

// Set env vars needed
process.env.PANCAKE_SHOP_ID = '4893018';
process.env.PANCAKE_API_KEY = '7e1ae4f6939d481a8a09ec176b740358';

// We need to mock the @/lib/prisma import since we're running outside Next.js
// Let's just directly call the Pancake API and sync

const prisma = new PrismaClient();

async function fetchPancakeOrderDetail(orderId: number) {
  const shopId = process.env.PANCAKE_SHOP_ID;
  const apiKey = process.env.PANCAKE_API_KEY;
  const url = `https://pos.pages.fm/api/v1/shops/${shopId}/orders/${orderId}?api_key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.success ? data.data : null;
}

async function testSync() {
  const phone = '0394883260';
  const shopId = process.env.PANCAKE_SHOP_ID;
  const apiKey = process.env.PANCAKE_API_KEY;

  // Find the user
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log(`Found user: ${user.id}, name: ${user.name}`);

  // Fetch orders
  const url = `https://pos.pages.fm/api/v1/shops/${shopId}/orders?api_key=${apiKey}&search=${encodeURIComponent(phone)}&page_size=100`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.success || !data.data?.length) {
    console.log('No orders found');
    return;
  }
  
  console.log(`Found ${data.data.length} orders`);

  for (const pOrder of data.data) {
    const orderCode = `PCK-${pOrder.id}`;
    
    // Fetch detail
    console.log(`\nFetching detail for order ${pOrder.id}...`);
    const detail = await fetchPancakeOrderDetail(pOrder.id);
    const d = detail || pOrder;

    // Extract items
    const items = (d.items || []).map((item: any) => ({
      name: item.variation_info?.name || 'Unknown',
      price: item.variation_info?.retail_price || 0,
      quantity: item.quantity || 1,
      image: item.variation_info?.images?.[0] || null,
      displayId: item.variation_info?.display_id || null,
    }));
    
    console.log(`  Items:`, items);

    // Extract customer
    const customer = d.customer;
    if (customer) {
      console.log(`  Customer name: ${customer.name}`);
      console.log(`  Customer gender: ${customer.gender}`);
      console.log(`  Customer phones: ${customer.phone_numbers}`);
      console.log(`  Customer addresses:`, customer.shop_customer_addresses);
    }

    // Extract shipping
    const ship = d.shipping_address;
    if (ship) {
      console.log(`  Shipping: ${ship.full_address}`);
    }

    // Calculate amounts
    const subtotal = d.total_price || 0;
    let itemTotal = 0;
    for (const item of d.items || []) {
      itemTotal += (item.variation_info?.retail_price || 0) * (item.quantity || 1);
    }
    const finalSubtotal = subtotal > 0 ? subtotal : itemTotal;
    const totalAmount = finalSubtotal - (d.total_discount || 0) + (d.shipping_fee || 0);

    console.log(`  Subtotal: ${finalSubtotal}, Total: ${totalAmount}`);

    // Create order in DB
    const existing = await prisma.order.findUnique({ where: { orderCode } });
    if (existing) {
      console.log(`  Order ${orderCode} already exists, skipping`);
      continue;
    }

    await prisma.order.create({
      data: {
        userId: user.id,
        orderCode,
        source: 'PANCAKE',
        subtotal: finalSubtotal,
        discountAmount: d.total_discount || 0,
        shippingFee: d.shipping_fee || 0,
        totalAmount,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        note: ship?.full_address ? `Địa chỉ giao: ${ship.full_address}` : null,
        metadata: {
          items,
          shippingAddress: ship || null,
          partner: d.partner ? {
            name: d.partner.partner_name,
            trackingCode: d.partner.extend_code,
            status: d.partner.partner_status,
          } : null,
          pancakeOrderId: pOrder.id,
        }
      }
    });

    console.log(`  ✅ Created order ${orderCode}`);

    // Sync customer profile
    if (customer) {
      const updates: Record<string, any> = {};
      if ((!user.name || user.name === user.phone) && customer.name) {
        updates.name = customer.name;
      }
      if (!user.gender && customer.gender) {
        updates.gender = customer.gender === 'female' ? 'FEMALE' : customer.gender === 'male' ? 'MALE' : undefined;
      }
      if (!user.address && customer.shop_customer_addresses?.[0]?.full_address) {
        updates.address = customer.shop_customer_addresses[0].full_address;
      }
      if (!user.addressStreet && customer.shop_customer_addresses?.[0]?.address) {
        updates.addressStreet = customer.shop_customer_addresses[0].address;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: updates });
        console.log(`  ✅ Updated user profile:`, updates);
      }
    }

    // Update totalSpent
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalSpent: { increment: totalAmount },
      }
    });
  }

  // Final state
  const finalUser = await prisma.user.findUnique({ where: { id: user.id } });
  console.log(`\n=== FINAL USER STATE ===`);
  console.log(`Name: ${finalUser?.name}`);
  console.log(`Gender: ${finalUser?.gender}`);
  console.log(`Address: ${finalUser?.address}`);
  console.log(`Street: ${finalUser?.addressStreet}`);
  console.log(`Total Spent: ${finalUser?.totalSpent}`);

  await prisma.$disconnect();
}

testSync();
