import { prisma } from '@/lib/prisma';
import { updateUserRank } from '@/services/userService';

// API Pancake Docs: https://api-docs.pancake.vn/#tag/warehouse

/**
 * Fetch all orders from Pancake matching a phone number (list endpoint)
 */
export async function fetchPancakeOrdersByPhone(phone: string) {
  const pConfig = await prisma.storeIntegration.findFirst({
    where: { platform: 'PANCAKE', isActive: true }
  });
  
  const shopId = pConfig?.shopId || process.env.PANCAKE_SHOP_ID;
  const apiKey = pConfig?.apiKey || process.env.PANCAKE_API_KEY;

  if (!shopId || !apiKey) {
    console.error('[Pancake] Missing Shop ID or API Key from StoreConfig or .env');
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
  const pConfig = await prisma.storeIntegration.findFirst({
    where: { platform: 'PANCAKE', isActive: true }
  });
  
  const shopId = pConfig?.shopId || process.env.PANCAKE_SHOP_ID;
  const apiKey = pConfig?.apiKey || process.env.PANCAKE_API_KEY;
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

  const rawGender = customer?.gender;
  let parsedGender = null;
  if (rawGender === 1 || String(rawGender).toLowerCase() === 'male') parsedGender = 'MALE';
  else if (rawGender === 2 || String(rawGender).toLowerCase() === 'female') parsedGender = 'FEMALE';
  else if (String(rawGender).toLowerCase() === 'other') parsedGender = 'OTHER';

  return {
    name: customer?.name || shippingAddr?.full_name || null,
    gender: parsedGender,
    email: customer?.email || customer?.email_address || shippingAddr?.email || null,
    dob: customer?.date_of_birth || customer?.birthday || null,
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

    // Bỏ qua nếu đơn hàng có tổng tiền bằng 0
    if (totalAmount <= 0) {
      console.log(`[Pancake] Order ${orderCode} has 0 amount, skipping`);
      continue;
    }

    // Build shipping address string
    const shippingAddress = detailData.shipping_address?.full_address 
      || detailData.bill_full_address 
      || null;

    // Map Pancake items to our products in database
    const orderItemsData = [];
    for (const item of items) {
      const itemName = item.variation_info?.name || item.name || '';
      const price = item.variation_info?.retail_price || 0;
      const quantity = item.quantity || 1;

      // Try to find matching product by name (fuzzy match)
      // Extract base name by removing size/color info
      const baseName = itemName
        .replace(/\s+size\s+[smlxSMLX]+/gi, '')
        .replace(/\s+màu\s+\w+/gi, '')
        .replace(/\s+[smlxSMLX]$/gi, '')
        .trim();

      // Find product by name similarity
      const matchingProduct = await prisma.product.findFirst({
        where: {
          OR: [
            { name: { contains: baseName } },
            { name: { contains: itemName } },
          ]
        }
      });

      if (matchingProduct) {
        orderItemsData.push({
          productId: matchingProduct.id,
          quantity: quantity,
          price: price,
          isGift: false,
          size: null, // Could extract from itemName if needed
          color: null,
        });
      }
    }

    // Save Order with rich metadata AND order items
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
        },
        // Create order items if we found matching products
        items: orderItemsData.length > 0 ? {
          create: orderItemsData
        } : undefined,
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
  email: string | null;
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
  if (!user.email && custInfo.email) {
    updateData.email = custInfo.email;
  }
  if (!user.gender && custInfo.gender) {
    updateData.gender = custInfo.gender as any;
  }
  if (!user.dob && custInfo.dob) {
    let dateObj = new Date(custInfo.dob);
    if (isNaN(dateObj.getTime()) && (custInfo.dob.includes('/') || custInfo.dob.includes('-'))) {
      const parts = custInfo.dob.split(/[/|-]/);
      if (parts.length === 3) {
        // Assume DD/MM/YYYY
        dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
    if (!isNaN(dateObj.getTime())) {
      updateData.dob = dateObj;
    }
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      totalSpent: newTotalSpent,
    }
  });

  await updateUserRank(userId);
  console.log(`[Pancake] User ${userId} updated. New Total Spent: ${newTotalSpent}`);
}

/**
 * Fetch all categories from Pancake
 */
export async function fetchPancakeCategories() {
  const pConfig = await prisma.storeIntegration.findFirst({
    where: { platform: 'PANCAKE', isActive: true }
  });
  
  const shopId = pConfig?.shopId || process.env.PANCAKE_SHOP_ID;
  const apiKey = pConfig?.apiKey || process.env.PANCAKE_API_KEY;

  if (!shopId || !apiKey) {
    console.error('[Pancake] Missing Shop ID or API Key');
    return [];
  }

  try {
    const url = `https://pos.pages.fm/api/v1/shops/${shopId}/categories?api_key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('[Pancake] Failed to fetch categories', await response.text());
      return [];
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      console.log(`[Pancake] Fetched ${data.data.length} root categories`);
      return data.data;
    }
    
    return [];
  } catch (error) {
    console.error('[Pancake] Error fetching categories:', error);
    return [];
  }
}

/**
 * Sync all categories from Pancake to database (recursive tree structure)
 */
export async function syncAllPancakeCategories() {
  console.log('[Pancake] Starting category sync...');
  
  const categories = await fetchPancakeCategories();
  if (categories.length === 0) {
    console.log('[Pancake] No categories to sync');
    return { synced: 0, errors: 0 };
  }

  let totalSynced = 0;
  let totalErrors = 0;

  // Process each root category and its children recursively
  for (const category of categories) {
    try {
      await syncCategoryRecursive(category, null);
      totalSynced++;
    } catch (error) {
      console.error(`[Pancake] Error syncing category ${category.id}:`, error);
      totalErrors++;
    }
  }

  console.log(`[Pancake] Category sync completed. Synced: ${totalSynced}, Errors: ${totalErrors}`);
  return { synced: totalSynced, errors: totalErrors };
}

/**
 * Recursively sync a category and its children
 */
async function syncCategoryRecursive(pCategory: any, parentId: string | null) {
  // Generate slug from name
  const slug = pCategory.text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    + `-${pCategory.id}`;

  // Check if category already exists by externalId or slug
  const existingCategory = await prisma.category.findFirst({
    where: {
      OR: [
        { externalId: String(pCategory.id) },
        { slug: slug }
      ]
    }
  });

  const categoryData = {
    name: pCategory.text,
    slug: slug,
    parentId: parentId,
    externalId: String(pCategory.id), // Lưu Pancake category ID
    isActive: true,
  };

  let category;
  if (existingCategory) {
    // Update existing category
    category = await prisma.category.update({
      where: { id: existingCategory.id },
      data: categoryData
    });
    console.log(`[Pancake] Updated category: ${category.name} (External ID: ${pCategory.id})`);
  } else {
    // Create new category
    category = await prisma.category.create({
      data: categoryData
    });
    console.log(`[Pancake] Created category: ${category.name} (External ID: ${pCategory.id})`);
  }

  // Recursively sync child categories
  if (pCategory.nodes && Array.isArray(pCategory.nodes) && pCategory.nodes.length > 0) {
    for (const childCategory of pCategory.nodes) {
      try {
        await syncCategoryRecursive(childCategory, category.id);
      } catch (error) {
        console.error(`[Pancake] Error syncing child category ${childCategory.id}:`, error);
      }
    }
  }

  return category;
}

/**
 * Fetch all products from Pancake using variations endpoint (better pagination & category info)
 */
export async function fetchPancakeProducts(page = 1, pageSize = 100) {
  const pConfig = await prisma.storeIntegration.findFirst({
    where: { platform: 'PANCAKE', isActive: true }
  });
  
  const shopId = pConfig?.shopId || process.env.PANCAKE_SHOP_ID;
  const apiKey = pConfig?.apiKey || process.env.PANCAKE_API_KEY;

  if (!shopId || !apiKey) {
    console.error('[Pancake] Missing Shop ID or API Key');
    return { variations: [], hasMore: false, total: 0 };
  }

  try {
    const url = `https://pos.pages.fm/api/v1/shops/${shopId}/products/variations?api_key=${apiKey}&page=${page}&page_size=${pageSize}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('[Pancake] Failed to fetch product variations', await response.text());
      return { variations: [], hasMore: false, total: 0 };
    }

    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      const variations = data.data;
      const totalEntries = data.total_entries || 0;
      const totalPages = data.total_pages || 0;
      const currentPage = data.page_number || page;
      
      console.log(`[Pancake] Fetched ${variations.length} variations from page ${currentPage}/${totalPages} (Total: ${totalEntries})`);
      
      const hasMore = currentPage < totalPages;
      
      return { 
        variations, 
        hasMore,
        total: totalEntries,
        currentPage,
        totalPages
      };
    }
    
    return { variations: [], hasMore: false, total: 0 };
  } catch (error) {
    console.error('[Pancake] Error fetching product variations:', error);
    return { variations: [], hasMore: false, total: 0 };
  }
}

/**
 * Extract base product name, color, and size from Pancake product name
 * Examples:
 * - "Twin_Size XL" → { base: "Twin", color: null, size: "XL" }
 * - "CAMELLIA _Đen_Size M" → { base: "CAMELLIA", color: "Đen", size: "M" }
 * - "Adela Blazer Hồng Size L" → { base: "Adela Blazer", color: "Hồng", size: "L" }
 */
function extractProductInfo(productName: string) {
  console.log(`[DEBUG] Original name: "${productName}"`);
  let baseName = productName;
  let color = null;
  let size = null;
  
  // Step 0: Replace underscores with spaces FIRST
  baseName = baseName.replace(/_+/g, ' ');
  
  // Step 1: Extract SIZE value
  // Match "Size M", "size L", "ize XL", or standalone " M", " L", " XL" at the end
  const sizeValuePattern = /\s+(?:Size|size|ize)\s+([X]{1,3}L|2XL|3XL|[LMS])\b|\s+([X]{1,3}L|[LMS])\b(?=\s*$)/gi;
  const sizeMatches = Array.from(baseName.matchAll(sizeValuePattern));
  if (sizeMatches.length > 0) {
    const lastMatch = sizeMatches[sizeMatches.length - 1];
    size = (lastMatch[1] || lastMatch[2] || '').toUpperCase().trim();
  }
  
  // Step 2: Remove ALL size patterns
  baseName = baseName.replace(/\s+Size\s+[X]{1,3}L\b/gi, ' ');
  baseName = baseName.replace(/\s+size\s+[X]{1,3}L\b/gi, ' ');
  baseName = baseName.replace(/\s+ize\s+[X]{1,3}L\b/gi, ' ');
  baseName = baseName.replace(/\s+Size\s+[LMS]\b/gi, ' ');
  baseName = baseName.replace(/\s+size\s+[LMS]\b/gi, ' ');
  baseName = baseName.replace(/\s+ize\s+[LMS]\b/gi, ' ');
  // Remove standalone size letters at the end
  baseName = baseName.replace(/\s+[X]{1,3}L\s*$/gi, '');
  baseName = baseName.replace(/\s+[LMS]\s*$/gi, '');
  // Remove standalone Size/size/ize words
  baseName = baseName.replace(/\s+Size\b/gi, ' ');
  baseName = baseName.replace(/\s+size\b/gi, ' ');
  baseName = baseName.replace(/\s+ize\b/gi, ' ');
  baseName = baseName.trim();
  
  // Step 3: Extract COLOR (BEFORE removing "màu")
  const colorPattern = /(Đen|Đỏ|Xanh|Trắng|Hồng|Be|Tím|Vàng|Nâu|Xám|Cam)\b/gi;
  const colorMatches = Array.from(baseName.matchAll(colorPattern));
  if (colorMatches.length > 0) {
    color = colorMatches[0][1];
  }
  
  // Step 4: Remove "màu" word
  baseName = baseName.replace(/\bmàu\s*/gi, ' ').trim();
  
  // Step 5: Remove color words from base name
  if (color) {
    const removeColorPattern = new RegExp(`\\b${color}\\b`, 'gi');
    baseName = baseName.replace(removeColorPattern, ' ').trim();
  }
  
  // Step 6: Clean up base name
  baseName = baseName
    .replace(/\s+/g, ' ')             // Multiple spaces → single space
    .replace(/\bàu\b/gi, '')          // Remove "àu" leftover
    .replace(/\bSơ\s+/gi, 'Sơ ')     // Fix "Sơ " spacing (prevent double S)
    .replace(/\biza\b/gi, 'Lisa')     // iza → Lisa
    .replace(/\baina\b/gi, 'Amina')   // Aina → Amina
    .trim();
  
  // Step 7: Fix common typos
  const typoMap: Record<string, string> = {
    'CAELLIA': 'CAMELLIA',
    'CAMELIA': 'CAMELLIA',
    'CAELIA': 'CAMELLIA',
    'KYI': 'KYLI',
  };
  
  for (const [typo, correct] of Object.entries(typoMap)) {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    baseName = baseName.replace(regex, correct);
  }
  
  // Step 8: Remove special chars and extra spaces
  baseName = baseName
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Step 9: Normalize to Title Case for consistent grouping
  baseName = baseName
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      // Special handling for "Sơ" to prevent "Ssơ"
      if (word === 'sơ') return 'Sơ';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  
  console.log(`[DEBUG] Final: base="${baseName}", color="${color}", size="${size}"`);
  
  return { baseName, color, size };
}

/**
 * Sync all products from Pancake to database
 */
export async function syncAllPancakeProducts(storeId?: string) {
  console.log('[Pancake] Starting full product sync using variations endpoint...');
  
  // Get or create store
  let store = null;
  if (storeId) {
    store = await prisma.store.findUnique({ where: { id: storeId } });
  } else {
    // Find first active Pancake integration
    const integration = await prisma.storeIntegration.findFirst({
      where: { platform: 'PANCAKE', isActive: true },
      include: { store: true }
    });
    store = integration?.store;
  }

  if (!store) {
    console.error('[Pancake] No store found for product sync');
    return { synced: 0, errors: 0, total: 0 };
  }

  let page = 1;
  let totalSynced = 0;
  let totalErrors = 0;
  let hasMore = true;
  let totalVariations = 0;

  // Group variations by Pancake product ID (not by base name)
  const productMap = new Map<string, any[]>();

  while (hasMore) {
    const { variations, hasMore: more, total } = await fetchPancakeProducts(page, 100);
    hasMore = more;
    
    if (page === 1 && total > 0) {
      totalVariations = total;
      console.log(`[Pancake] Total variations to sync: ${total}`);
    }

    if (variations.length === 0) {
      console.log('[Pancake] No more variations to fetch');
      break;
    }

    // Group variations by BASE product name (after processing)
    // Because Pancake creates different product_id for each size!
    for (const variation of variations) {
      const productName = variation.product?.name || 'Unknown';
      const { baseName } = extractProductInfo(productName);
      
      if (!baseName) continue;
      
      if (!productMap.has(baseName)) {
        productMap.set(baseName, []);
      }
      productMap.get(baseName)!.push(variation);
    }

    console.log(`[Pancake] Fetched page ${page}: ${variations.length} variations`);
    page++;

    // Safety limit
    if (page > 100) {
      console.warn('[Pancake] Reached page limit (100), stopping sync');
      break;
    }
  }

  console.log(`[Pancake] Grouped ${totalVariations} variations into ${productMap.size} unique products`);

  // Now sync each product with its variations
  let processedCount = 0;
  for (const [pancakeProductId, variations] of productMap.entries()) {
    try {
      await syncProductFromVariations(variations, store.id);
      totalSynced++;
      processedCount++;
      
      if (processedCount % 10 === 0) {
        console.log(`[Pancake] Progress: ${processedCount}/${productMap.size} products synced`);
      }
    } catch (error) {
      console.error(`[Pancake] Error syncing product ${pancakeProductId}:`, error);
      totalErrors++;
    }
  }

  console.log(`[Pancake] Product sync completed. Total synced: ${totalSynced}, Errors: ${totalErrors}`);
  return { synced: totalSynced, errors: totalErrors, total: productMap.size };
}

/**
 * Sync a product from variations data (new API format)
 */
async function syncProductFromVariations(variations: any[], storeId: string) {
  if (variations.length === 0) return;

  // Get product info from first variation
  const firstVariation = variations[0];
  const productData = firstVariation.product;
  
  if (!productData) {
    console.warn(`[Pancake] Variation ${firstVariation.id} has no product data, skipping`);
    return;
  }

  // Extract base product name (without color/size)
  const { baseName } = extractProductInfo(productData.name);

  // Use baseName as externalId (since Pancake has different product_id for each size)
  // Generate a consistent ID from baseName
  const pancakeProductId = baseName.toLowerCase().replace(/\s+/g, '-');

  // Generate slug from base name
  const slug = baseName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Calculate total stock from all variations (ensure non-negative)
  const totalStock = variations.reduce((sum: number, v: any) => {
    const stock = Math.max(0, v.remain_quantity || 0); // Prevent negative stock
    return sum + stock;
  }, 0);

  // Get main image from product or first variation
  let mainImage = productData.image || null;
  if (!mainImage && firstVariation.images && firstVariation.images.length > 0) {
    mainImage = firstVariation.images[0];
  }

  // Get price from first variation
  const retailPrice = firstVariation.retail_price || 0;
  const salePrice = firstVariation.price_at_counter || retailPrice;

  // Check if product already exists by externalId (Pancake product ID)
  const existingProduct = await prisma.product.findFirst({
    where: { externalId: pancakeProductId }
  });

  console.log(`[Pancake] Checking product with externalId: ${pancakeProductId}, found: ${existingProduct ? 'YES' : 'NO'}`);

  const productPayload = {
    name: baseName,
    slug: slug,
    sku: productData.display_id || null,
    externalId: pancakeProductId,
    imageUrl: mainImage,
    description: productData.note_product || productData.note || null,
    originalPrice: retailPrice,
    salePrice: salePrice,
    stockQuantity: totalStock,
    weight: 500,
    isActive: productData.is_published !== false,
    storeId: storeId,
  };

  let product;
  if (existingProduct) {
    // Update existing product
    product = await prisma.product.update({
      where: { id: existingProduct.id },
      data: productPayload
    });
    console.log(`[Pancake] Updated product: ${product.name} (${variations.length} variations)`);
  } else {
    // Create new product
    product = await prisma.product.create({
      data: productPayload
    });
    console.log(`[Pancake] Created product: ${product.name} (${variations.length} variations)`);
  }

  // Sync categories if available
  if (productData.categories && Array.isArray(productData.categories) && productData.categories.length > 0) {
    // Extract category IDs from array of objects or numbers
    const categoryIds = productData.categories
      .map((cat: any) => {
        if (typeof cat === 'number') return cat;
        if (typeof cat === 'object' && cat !== null && cat.id) return cat.id;
        return null;
      })
      .filter((id: any) => id !== null);
    
    if (categoryIds.length > 0) {
      await syncProductCategories(product.id, categoryIds);
    }
  }

  // Sync variations (size, color combinations)
  await syncProductVariationsFromAPI(product.id, variations);

  return product;
}

/**
 * Sync product categories from Pancake category IDs
 */
async function syncProductCategories(productId: string, pancakeCategoryIds: number[]) {
  if (!pancakeCategoryIds || pancakeCategoryIds.length === 0) return;

  // Find matching categories in our database by externalId
  const categories = await prisma.category.findMany({
    where: {
      externalId: {
        in: pancakeCategoryIds.map(id => String(id))
      }
    }
  });

  if (categories.length === 0) {
    console.log(`[Pancake] No matching categories found for IDs: ${pancakeCategoryIds.join(', ')}`);
    return;
  }

  // Get existing product with categories
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { categories: true }
  });

  if (!product) return;

  // Get category IDs to connect
  const categoryIdsToConnect = categories.map(c => c.id);
  const existingCategoryIds = product.categories.map(c => c.id);

  // Find categories to add (not already connected)
  const categoriesToAdd = categoryIdsToConnect.filter(id => !existingCategoryIds.includes(id));

  if (categoriesToAdd.length > 0) {
    // Connect new categories
    await prisma.product.update({
      where: { id: productId },
      data: {
        categories: {
          connect: categoriesToAdd.map(id => ({ id }))
        }
      }
    });
    console.log(`[Pancake] Linked ${categoriesToAdd.length} categories to product`);
  } else {
    console.log(`[Pancake] Product already has all ${categories.length} categories`);
  }
}

/**
 * Sync product variations from API format
 */
async function syncProductVariationsFromAPI(productId: string, variations: any[]) {
  for (const variation of variations) {
    const productName = variation.product?.name || '';
    const { color, size } = extractProductInfo(productName);
    
    // Skip if no size or color
    if (!size && !color) continue;

    // Get or create Size
    let sizeId = null;
    if (size) {
      let sizeRecord = await prisma.size.findUnique({ where: { name: size } });
      if (!sizeRecord) {
        sizeRecord = await prisma.size.create({ data: { name: size } });
      }
      sizeId = sizeRecord.id;
    }

    // Get or create Color
    let colorId = null;
    if (color) {
      let colorRecord = await prisma.color.findUnique({ where: { name: color } });
      if (!colorRecord) {
        colorRecord = await prisma.color.create({ data: { name: color } });
      }
      colorId = colorRecord.id;
    }

    // Get stock for this variation
    const stock = variation.remain_quantity || 0;

    // Check if variant exists
    const existingVariant = await prisma.productVariant.findFirst({
      where: {
        productId: productId,
        sizeId: sizeId,
        colorId: colorId,
      }
    });

    const variantData = {
      productId: productId,
      sizeId: sizeId,
      colorId: colorId,
      price: variation.price_at_counter || variation.retail_price || null,
      stock: stock,
    };

    if (existingVariant) {
      await prisma.productVariant.update({
        where: { id: existingVariant.id },
        data: { price: variantData.price, stock: variantData.stock }
      });
    } else {
      await prisma.productVariant.create({
        data: variantData
      });
    }
  }
}

/**
 * Sync a single product from Pancake to database (OLD FORMAT - kept for compatibility)
 */
async function syncSingleProduct(pProduct: any, storeId: string) {
  const variations = pProduct.variations || [];
  
  // Skip products without variations
  if (variations.length === 0) {
    console.warn(`[Pancake] Product ${pProduct.id} (${pProduct.name}) has no variations, skipping`);
    return;
  }

  // Use first variation for main product data
  const firstVariation = variations[0];

  // Generate slug from name
  const slug = pProduct.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    + `-${pProduct.id}`;

  // Calculate stock from all variations
  const totalStock = variations.reduce((sum: number, v: any) => {
    const warehouses = v.variations_warehouses || [];
    const varStock = warehouses.reduce((s: number, w: any) => s + (w.remain_quantity || 0), 0);
    return sum + varStock;
  }, 0);

  // Get main image - check both variation images and product images
  let mainImage = null;
  if (firstVariation.images && firstVariation.images.length > 0) {
    mainImage = firstVariation.images[0];
  } else if (pProduct.images && pProduct.images.length > 0) {
    mainImage = pProduct.images[0];
  }

  // Check if product already exists by custom_id or name+store
  const existingProduct = await prisma.product.findFirst({
    where: {
      OR: [
        { sku: pProduct.custom_id || `PCK-${pProduct.id}` },
        { name: pProduct.name, storeId: storeId }
      ]
    }
  });

  const productData = {
    name: pProduct.name,
    slug: slug,
    sku: pProduct.custom_id || `PCK-${pProduct.id}`,
    imageUrl: mainImage,
    description: pProduct.note_product || null,
    originalPrice: firstVariation.retail_price || 0,
    salePrice: firstVariation.price_at_counter || firstVariation.retail_price || 0,
    stockQuantity: totalStock,
    weight: pProduct.weight || 500,
    isActive: pProduct.is_published !== false,
    storeId: storeId,
  };

  let product;
  if (existingProduct) {
    // Update existing product
    product = await prisma.product.update({
      where: { id: existingProduct.id },
      data: productData
    });
    console.log(`[Pancake] Updated product: ${product.name} (ID: ${product.id})`);
  } else {
    // Create new product
    product = await prisma.product.create({
      data: productData
    });
    console.log(`[Pancake] Created product: ${product.name} (ID: ${product.id})`);
  }

  // Sync variations (size, color combinations)
  await syncProductVariations(product.id, variations);

  return product;
}

/**
 * Sync product variations (size/color combinations)
 */
async function syncProductVariations(productId: string, variations: any[]) {
  for (const variation of variations) {
    const fields = variation.fields || [];
    
    // Extract size and color from fields
    let sizeName = null;
    let colorName = null;
    
    for (const field of fields) {
      if (field.name === 'Size' || field.name === 'Kích thước') {
        sizeName = field.value;
      } else if (field.name === 'Màu' || field.name === 'Color') {
        colorName = field.value;
      }
    }

    // Skip if no size or color
    if (!sizeName && !colorName) continue;

    // Get or create Size
    let sizeId = null;
    if (sizeName) {
      let size = await prisma.size.findUnique({ where: { name: sizeName } });
      if (!size) {
        size = await prisma.size.create({ data: { name: sizeName } });
      }
      sizeId = size.id;
    }

    // Get or create Color
    let colorId = null;
    if (colorName) {
      let color = await prisma.color.findUnique({ where: { name: colorName } });
      if (!color) {
        color = await prisma.color.create({ data: { name: colorName } });
      }
      colorId = color.id;
    }

    // Calculate stock for this variation
    const warehouses = variation.variations_warehouses || [];
    const stock = warehouses.reduce((sum: number, w: any) => sum + (w.remain_quantity || 0), 0);

    // Check if variant exists
    const existingVariant = await prisma.productVariant.findFirst({
      where: {
        productId: productId,
        sizeId: sizeId,
        colorId: colorId,
      }
    });

    const variantData = {
      productId: productId,
      sizeId: sizeId,
      colorId: colorId,
      price: variation.price_at_counter || variation.retail_price || null,
      stock: stock,
    };

    if (existingVariant) {
      await prisma.productVariant.update({
        where: { id: existingVariant.id },
        data: { price: variantData.price, stock: variantData.stock }
      });
    } else {
      await prisma.productVariant.create({
        data: variantData
      });
    }
  }
}
