import { prisma } from '@/lib/prisma';

// API Pancake Docs: https://api-docs.pancake.vn/#tag/warehouse

/**
 * Fetch all orders from Pancake matching a phone number (list endpoint)
 */
export async function fetchPancakeOrdersByPhone(phone: string) {
  const shopId = process.env.PANCAKE_SHOP_ID;
  const apiKey = process.env.PANCAKE_API_KEY;

  if (!shopId || !apiKey) {
    console.error('[Pancake] Missing PANCAKE_SHOP_ID or PANCAKE_API_KEY in .env');
    return [];
  }

  try {
    const url = `https://pos.pages.fm/api/v1/shops/${shopId}/orders?api_key=${apiKey}&search=${encodeURIComponent(phone)}&page_size=100`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('[Pancake] Failed to fetch orders', await response.text());
      return [];
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      console.log(`[Pancake] Found ${data.data.length} orders for phone: ${phone}`);
      return data.data;
    }
    
    console.log(`[Pancake] No orders found for phone: ${phone}`);
    return [];
  } catch (error) {
    console.error('[Pancake] Error fetching orders by phone:', error);
    return [];
  }
}

/**
 * Fetch single order detail from Pancake (includes customer info, full items, addresses)
 */
export async function fetchPancakeOrderDetail(orderId: number) {
  const shopId = process.env.PANCAKE_SHOP_ID;
  const apiKey = process.env.PANCAKE_API_KEY;
  if (!shopId || !apiKey) return null;

  try {
    const url = `https://pos.pages.fm/api/v1/shops/${shopId}/orders/${orderId}?api_key=${apiKey}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[Pancake] Failed to fetch order detail #${orderId}`, await response.text());
      return null;
    }

    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error(`[Pancake] Error fetching order detail #${orderId}:`, error);
    return null;
  }
}

/**
 * Extract rich item data from Pancake order items
 */
function extractItemsMetadata(items: any[]) {
  if (!items || items.length === 0) return [];
  return items.map(item => ({
    name: item.variation_info?.name || 'Sản phẩm không rõ',
    price: item.variation_info?.retail_price || 0,
    quantity: item.quantity || 1,
    image: item.variation_info?.images?.[0] || null,
    productId: item.product_id || null,
    variationId: item.variation_id || null,
    displayId: item.variation_info?.display_id || null,
    weight: item.variation_info?.weight || 0,
    discount: item.total_discount || 0,
  }));
}

/**
 * Extract customer profile data from Pancake order detail
 */
function extractCustomerInfo(orderDetail: any) {
  const customer = orderDetail?.customer;
  const shippingAddr = orderDetail?.shipping_address;
  const addresses = customer?.shop_customer_addresses || [];
  const primaryAddr = addresses[0]; // Take the first address

  // Try to parse province and ward from full_address if not directly provided
  let province = null;
  let ward = null;

  if (primaryAddr?.full_address) {
    const parts = primaryAddr.full_address.split(',').map((s: string) => s.trim());
    if (parts.length >= 2) {
      province = parts[parts.length - 1];
      ward = parts[parts.length - 2];
    }
  }

  return {
    name: customer?.name || shippingAddr?.full_name || null,
    gender: customer?.gender === 'female' ? 'FEMALE' : customer?.gender === 'male' ? 'MALE' : null,
    dob: customer?.date_of_birth || null,
    fullAddress: shippingAddr?.full_address || primaryAddr?.full_address || null,
    street: shippingAddr?.address || primaryAddr?.address || null,
    province: province,
    ward: ward,
  };
}

/**
 * Sync orders from Pancake into our DB.
 * Fetches order list, then detail for each, stores rich metadata + updates user profile.
 */
export async function syncPancakeOrdersForUser(phone: string, userId: string) {
  console.log(`[Pancake] Starting sync for userId: ${userId}, phone: ${phone}`);
  const orders = await fetchPancakeOrdersByPhone(phone);
  let totalNewSpent = 0;
  let syncedCount = 0;
  let customerInfoSynced = false;
  
  if (!orders || orders.length === 0) {
    console.log(`[Pancake] No orders to sync for phone: ${phone}`);
    return 0;
  }

  for (const pOrder of orders) {
    const orderCode = `PCK-${pOrder.id}`;
    
    // Check if order already exists
    const existing = await prisma.order.findUnique({
      where: { orderCode }
    });

    if (existing) {
      console.log(`[Pancake] Order ${orderCode} already exists, skipping`);
      continue;
    }

    // Fetch full order detail for rich data
    const orderDetail = await fetchPancakeOrderDetail(pOrder.id);
    const detailData = orderDetail || pOrder; // Fallback to list data if detail fails

    // Extract rich item metadata
    const itemsMeta = extractItemsMetadata(detailData.items || pOrder.items || []);

    // Calculate money
    const subtotal = detailData.total_price || pOrder.total_price || 0;
    let itemSubtotal = 0;
    const items = detailData.items || pOrder.items || [];
    for (const item of items) {
      const price = item.variation_info?.retail_price || 0;
      const amount = price * (item.quantity || 1);
      itemSubtotal += amount;
    }

    const finalSubtotal = subtotal > 0 ? subtotal : itemSubtotal;
    const totalAmount = finalSubtotal - (detailData.total_discount || 0) + (detailData.shipping_fee || 0);

    // Build shipping address string
    const shippingAddress = detailData.shipping_address?.full_address 
      || detailData.bill_full_address 
      || null;

    // Save Order with rich metadata
    await prisma.order.create({
      data: {
        userId: userId,
        orderCode: orderCode,
        source: 'PANCAKE',
        subtotal: finalSubtotal,
        discountAmount: detailData.total_discount || 0,
        shippingFee: detailData.shipping_fee || 0,
        totalAmount: totalAmount,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        note: shippingAddress ? `Địa chỉ giao: ${shippingAddress}` : null,
        metadata: {
          items: itemsMeta,
          shippingAddress: detailData.shipping_address || null,
          partner: detailData.partner ? {
            name: detailData.partner.partner_name,
            trackingCode: detailData.partner.extend_code,
            status: detailData.partner.partner_status,
          } : null,
          pancakeOrderId: pOrder.id,
          pancakeStatus: detailData.status,
          pancakeStatusName: detailData.status_name,
        }
      }
    });

    totalNewSpent += totalAmount;
    syncedCount++;
    console.log(`[Pancake] Synced order: ${orderCode}, amount: ${totalAmount}, items: ${itemsMeta.length}`);

    // Sync customer profile info from the first order that has it (only once)
    if (!customerInfoSynced && orderDetail) {
      const custInfo = extractCustomerInfo(orderDetail);
      if (custInfo.name || custInfo.fullAddress) {
        await syncUserProfileFromPancake(userId, custInfo);
        customerInfoSynced = true;
      }
    }
  }

  console.log(`[Pancake] Sync completed. Total orders synced: ${syncedCount}, Total amount: ${totalNewSpent}`);

  // Update User total spent
  if (totalNewSpent > 0) {
    await updateUserRankAndSpent(userId, totalNewSpent);
  }

  return totalNewSpent;
}

/**
 * Update user profile with data from Pancake (name, gender, address) if fields are empty
 */
async function syncUserProfileFromPancake(userId: string, custInfo: {
  name: string | null;
  gender: string | null;
  dob: string | null;
  fullAddress: string | null;
  street: string | null;
  province: string | null;
  ward: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const updateData: Record<string, any> = {};

  // Only update fields that the user hasn't filled in yet
  if (!user.name || user.name === user.phone) {
    if (custInfo.name) updateData.name = custInfo.name;
  }
  if (!user.gender && custInfo.gender) {
    updateData.gender = custInfo.gender as any;
  }
  if (!user.dob && custInfo.dob) {
    updateData.dob = new Date(custInfo.dob);
  }
  if (!user.address && custInfo.fullAddress) {
    updateData.address = custInfo.fullAddress;
  }
  if (!user.addressStreet && custInfo.street) {
    updateData.addressStreet = custInfo.street;
  }
  if (!user.addressProvince && custInfo.province) {
    updateData.addressProvince = custInfo.province;
  }
  if (!user.addressWard && custInfo.ward) {
    updateData.addressWard = custInfo.ward;
  }
  // Explicitly clear or ignore district for the new structure
  updateData.addressDistrict = null;

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    console.log(`[Pancake] User profile synced from Pancake (2-tier address):`, updateData);
  }
}

// Helper to update User points/spent
export async function updateUserRankAndSpent(userId: string, addedSpent: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const newTotalSpent = user.totalSpent + addedSpent;

  // Re-eval Rank
  const dbRanks = await prisma.rankConfig.findMany({
    orderBy: { minTotalSpent: 'desc' }
  });

  let newRank = user.rank;
  for (const rankConf of dbRanks) {
    if (newTotalSpent >= rankConf.minTotalSpent) {
      newRank = rankConf.rank;
      break;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totalSpent: newTotalSpent,
      rank: newRank,
      points: Math.floor(newTotalSpent / 10000) 
    }
  });

  console.log(`[Pancake] User ${userId} updated. New Total Spent: ${newTotalSpent}, New Rank: ${newRank}`);
}
