import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class PancakeService {
  private readonly logger = new Logger(PancakeService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  private async getPancakeConfig() {
    const pConfig = await this.prisma.storeIntegration.findFirst({
      where: { platform: 'PANCAKE', isActive: true }
    });
    
    const shopId = pConfig?.shopId || this.configService.get('PANCAKE_SHOP_ID');
    const apiKey = pConfig?.apiKey || this.configService.get('PANCAKE_API_KEY');

    if (!shopId || !apiKey) {
      this.logger.error('[Pancake] Missing Shop ID or API Key');
      return null;
    }

    return { shopId, apiKey };
  }

  /**
   * Fetch orders from Pancake by phone number
   */
  async fetchOrdersByPhone(phone: string) {
    const config = await this.getPancakeConfig();
    if (!config) return [];

    try {
      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}/orders?api_key=${config.apiKey}&search=${encodeURIComponent(phone)}&page_size=100`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        this.logger.error('[Pancake] Failed to fetch orders');
        return [];
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        this.logger.log(`[Pancake] Found ${data.data.length} orders for phone: ${phone}`);
        return data.data;
      }
      
      return [];
    } catch (error) {
      this.logger.error('[Pancake] Error fetching orders:', error);
      return [];
    }
  }

  /**
   * Fetch single order detail
   */
  async fetchOrderDetail(orderId: number) {
    const config = await this.getPancakeConfig();
    if (!config) return null;

    try {
      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}/orders/${orderId}?api_key=${config.apiKey}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        this.logger.error(`[Pancake] Failed to fetch order detail #${orderId}`);
        return null;
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      this.logger.error(`[Pancake] Error fetching order detail:`, error);
      return null;
    }
  }

  /**
   * Extract items metadata from order
   */
  private extractItemsMetadata(items: any[]) {
    if (!items || items.length === 0) return [];
    return items.map(item => ({
      name: item.variation_info?.name || 'S?n ph?m kh�ng r�',
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
   * Extract customer info from order detail
   */
  private extractCustomerInfo(orderDetail: any) {
    const customer = orderDetail?.customer;
    const shippingAddr = orderDetail?.shipping_address;
    const addresses = customer?.shop_customer_addresses || [];
    const primaryAddr = addresses[0];

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
      province,
      ward,
    };
  }

  /**
   * Sync orders for a user
   */
  async syncOrdersForUser(phone: string, userId: string) {
    this.logger.log(`[Pancake] Starting sync for userId: ${userId}, phone: ${phone}`);
    const orders = await this.fetchOrdersByPhone(phone);
    let totalNewSpent = 0;
    let syncedCount = 0;
    let customerInfoSynced = false;
    
    if (!orders || orders.length === 0) {
      this.logger.log(`[Pancake] No orders to sync for phone: ${phone}`);
      return 0;
    }

    for (const pOrder of orders) {
      const orderCode = `PCK-${pOrder.id}`;
      
      const existing = await this.prisma.order.findUnique({
        where: { orderCode }
      });

      if (existing) {
        this.logger.log(`[Pancake] Order ${orderCode} already exists, skipping`);
        continue;
      }

      const orderDetail = await this.fetchOrderDetail(pOrder.id);
      const detailData = orderDetail || pOrder;

      const itemsMeta = this.extractItemsMetadata(detailData.items || pOrder.items || []);

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

      if (totalAmount <= 0) {
        this.logger.log(`[Pancake] Order ${orderCode} has 0 amount, skipping`);
        continue;
      }

      const shippingAddress = detailData.shipping_address?.full_address 
        || detailData.bill_full_address 
        || null;

      const orderItemsData = [];
      for (const item of items) {
        const itemName = item.variation_info?.name || item.name || '';
        const price = item.variation_info?.retail_price || 0;
        const quantity = item.quantity || 1;

        const baseName = itemName
          .replace(/\s+size\s+[smlxSMLX]+/gi, '')
          .replace(/\s+m�u\s+\w+/gi, '')
          .replace(/\s+[smlxSMLX]$/gi, '')
          .trim();

        const matchingProduct = await this.prisma.product.findFirst({
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
            quantity,
            price,
            isGift: false,
            size: null,
            color: null,
          });
        }
      }

      await this.prisma.order.create({
        data: {
          userId,
          orderCode,
          source: 'PANCAKE',
          subtotal: finalSubtotal,
          discountAmount: detailData.total_discount || 0,
          shippingFee: detailData.shipping_fee || 0,
          totalAmount,
          status: OrderStatus.COMPLETED,
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
          items: orderItemsData.length > 0 ? {
            create: orderItemsData
          } : undefined,
        }
      });

      totalNewSpent += totalAmount;
      syncedCount++;
      this.logger.log(`[Pancake] Synced order: ${orderCode}, amount: ${totalAmount}`);

      if (!customerInfoSynced && orderDetail) {
        const custInfo = this.extractCustomerInfo(orderDetail);
        if (custInfo.name || custInfo.fullAddress) {
          await this.syncUserProfile(userId, custInfo);
          customerInfoSynced = true;
        }
      }
    }

    this.logger.log(`[Pancake] Sync completed. Orders: ${syncedCount}, Amount: ${totalNewSpent}`);

    if (totalNewSpent > 0) {
      await this.updateUserRankAndSpent(userId, totalNewSpent);
    }

    return totalNewSpent;
  }

  /**
   * Sync user profile from Pancake data
   */
  private async syncUserProfile(userId: string, custInfo: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const updateData: Record<string, any> = {};

    if (!user.name || user.name === user.phone) {
      if (custInfo.name) updateData.name = custInfo.name;
    }
    if (!user.email && custInfo.email) {
      updateData.email = custInfo.email;
    }
    if (!user.gender && custInfo.gender) {
      updateData.gender = custInfo.gender;
    }
    if (!user.dob && custInfo.dob) {
      let dateObj = new Date(custInfo.dob);
      if (isNaN(dateObj.getTime()) && (custInfo.dob.includes('/') || custInfo.dob.includes('-'))) {
        const parts = custInfo.dob.split(/[/|-]/);
        if (parts.length === 3) {
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
    updateData.addressDistrict = null;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
      this.logger.log(`[Pancake] User profile synced`);
    }
  }

  /**
   * Update user rank and spent
   */
  private async updateUserRankAndSpent(userId: string, addedSpent: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const newTotalSpent = user.totalSpent + addedSpent;

    await this.prisma.user.update({
      where: { id: userId },
      data: { totalSpent: newTotalSpent },
    });

    await this.usersService.updateUserRank(userId);
    this.logger.log(`[Pancake] User ${userId} updated. New Total Spent: ${newTotalSpent}`);
  }

  /**
   * Fetch categories from Pancake
   */
  async fetchCategories() {
    const config = await this.getPancakeConfig();
    if (!config) return [];

    try {
      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}/categories?api_key=${config.apiKey}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        this.logger.error('[Pancake] Failed to fetch categories');
        return [];
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        this.logger.log(`[Pancake] Fetched ${data.data.length} root categories`);
        return data.data;
      }
      
      return [];
    } catch (error) {
      this.logger.error('[Pancake] Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Sync all categories
   */
  async syncAllCategories() {
    this.logger.log('[Pancake] Starting category sync...');
    
    const categories = await this.fetchCategories();
    if (categories.length === 0) {
      this.logger.log('[Pancake] No categories to sync');
      return { synced: 0, errors: 0 };
    }

    let totalSynced = 0;
    let totalErrors = 0;

    for (const category of categories) {
      try {
        await this.syncCategoryRecursive(category, null);
        totalSynced++;
      } catch (error) {
        this.logger.error(`[Pancake] Error syncing category ${category.id}:`, error);
        totalErrors++;
      }
    }

    this.logger.log(`[Pancake] Category sync completed. Synced: ${totalSynced}, Errors: ${totalErrors}`);
    return { synced: totalSynced, errors: totalErrors };
  }

  /**
   * Recursively sync category and children
   */
  private async syncCategoryRecursive(pCategory: any, parentId: string | null) {
    const slug = pCategory.text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[d�]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + `-${pCategory.id}`;

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        OR: [
          { externalId: String(pCategory.id) },
          { slug }
        ]
      }
    });

    const categoryData = {
      name: pCategory.text,
      slug,
      parentId,
      externalId: String(pCategory.id),
      isActive: true,
    };

    let category;
    if (existingCategory) {
      category = await this.prisma.category.update({
        where: { id: existingCategory.id },
        data: categoryData
      });
      this.logger.log(`[Pancake] Updated category: ${category.name}`);
    } else {
      category = await this.prisma.category.create({
        data: categoryData
      });
      this.logger.log(`[Pancake] Created category: ${category.name}`);
    }

    if (pCategory.nodes && Array.isArray(pCategory.nodes) && pCategory.nodes.length > 0) {
      for (const childCategory of pCategory.nodes) {
        try {
          await this.syncCategoryRecursive(childCategory, category.id);
        } catch (error) {
          this.logger.error(`[Pancake] Error syncing child category:`, error);
        }
      }
    }

    return category;
  }

  /**
   * Fetch products from Pancake
   */
  async fetchProducts(page = 1, pageSize = 100) {
    const config = await this.getPancakeConfig();
    if (!config) return { variations: [], hasMore: false, total: 0 };

    try {
      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}/products/variations?api_key=${config.apiKey}&page=${page}&page_size=${pageSize}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        this.logger.error('[Pancake] Failed to fetch product variations');
        return { variations: [], hasMore: false, total: 0 };
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const variations = data.data;
        const totalEntries = data.total_entries || 0;
        const totalPages = data.total_pages || 0;
        const currentPage = data.page_number || page;
        
        this.logger.log(`[Pancake] Fetched ${variations.length} variations from page ${currentPage}/${totalPages}`);
        
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
      this.logger.error('[Pancake] Error fetching product variations:', error);
      return { variations: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Extract product info (name, color, size)
   */
  private extractProductInfo(productName: string) {
    let baseName = productName;
    let color = null;
    let size = null;
    
    baseName = baseName.replace(/_+/g, ' ');
    
    const sizeValuePattern = /\s+(?:Size|size|ize)\s+([X]{1,3}L|2XL|3XL|[LMS])\b|\s+([X]{1,3}L|[LMS])\b(?=\s*$)/gi;
    const sizeMatches = Array.from(baseName.matchAll(sizeValuePattern));
    if (sizeMatches.length > 0) {
      const lastMatch = sizeMatches[sizeMatches.length - 1];
      size = (lastMatch[1] || lastMatch[2] || '').toUpperCase().trim();
    }
    
    baseName = baseName.replace(/\s+Size\s+[X]{1,3}L\b/gi, ' ');
    baseName = baseName.replace(/\s+size\s+[X]{1,3}L\b/gi, ' ');
    baseName = baseName.replace(/\s+ize\s+[X]{1,3}L\b/gi, ' ');
    baseName = baseName.replace(/\s+Size\s+[LMS]\b/gi, ' ');
    baseName = baseName.replace(/\s+size\s+[LMS]\b/gi, ' ');
    baseName = baseName.replace(/\s+ize\s+[LMS]\b/gi, ' ');
    baseName = baseName.replace(/\s+[X]{1,3}L\s*$/gi, '');
    baseName = baseName.replace(/\s+[LMS]\s*$/gi, '');
    baseName = baseName.replace(/\s+Size\b/gi, ' ');
    baseName = baseName.replace(/\s+size\b/gi, ' ');
    baseName = baseName.replace(/\s+ize\b/gi, ' ');
    baseName = baseName.trim();
    
    const colorPattern = /(�en|�?|Xanh|Tr?ng|H?ng|Be|T�m|V�ng|N�u|X�m|Cam)\b/gi;
    const colorMatches = Array.from(baseName.matchAll(colorPattern));
    if (colorMatches.length > 0) {
      color = colorMatches[0][1];
    }
    
    baseName = baseName.replace(/\bm�u\s*/gi, ' ').trim();
    
    if (color) {
      const removeColorPattern = new RegExp(`\\b${color}\\b`, 'gi');
      baseName = baseName.replace(removeColorPattern, ' ').trim();
    }
    
    baseName = baseName
      .replace(/\s+/g, ' ')
      .replace(/\b�u\b/gi, '')
      .replace(/\bSo\s+/gi, 'So ')
      .replace(/\biza\b/gi, 'Lisa')
      .replace(/\baina\b/gi, 'Amina')
      .trim();
    
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
    
    baseName = baseName
      .replace(/^[\s-]+|[\s-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    baseName = baseName
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return '';
        if (word === 'so') return 'So';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
    
    return { baseName, color, size };
  }

  /**
   * Sync all products
   */
  async syncAllProducts(storeId?: string) {
    this.logger.log('[Pancake] Starting full product sync...');
    
    let store = null;
    if (storeId) {
      store = await this.prisma.store.findUnique({ where: { id: storeId } });
    } else {
      const integration = await this.prisma.storeIntegration.findFirst({
        where: { platform: 'PANCAKE', isActive: true },
        include: { store: true }
      });
      store = integration?.store;
    }

    if (!store) {
      this.logger.error('[Pancake] No store found for product sync');
      return { synced: 0, errors: 0, total: 0 };
    }

    let page = 1;
    let totalSynced = 0;
    let totalErrors = 0;
    let hasMore = true;
    let totalVariations = 0;

    const productMap = new Map<string, any[]>();

    while (hasMore) {
      const { variations, hasMore: more, total } = await this.fetchProducts(page, 100);
      hasMore = more;
      
      if (page === 1 && total > 0) {
        totalVariations = total;
        this.logger.log(`[Pancake] Total variations to sync: ${total}`);
      }

      if (variations.length === 0) {
        this.logger.log('[Pancake] No more variations to fetch');
        break;
      }

      for (const variation of variations) {
        const productName = variation.product?.name || 'Unknown';
        const { baseName } = this.extractProductInfo(productName);
        
        if (!baseName) continue;
        
        if (!productMap.has(baseName)) {
          productMap.set(baseName, []);
        }
        productMap.get(baseName)!.push(variation);
      }

      this.logger.log(`[Pancake] Fetched page ${page}: ${variations.length} variations`);
      page++;

      if (page > 100) {
        this.logger.warn('[Pancake] Reached page limit (100), stopping sync');
        break;
      }
    }

    this.logger.log(`[Pancake] Grouped ${totalVariations} variations into ${productMap.size} unique products`);

    let processedCount = 0;
    for (const [pancakeProductId, variations] of productMap.entries()) {
      try {
        await this.syncProductFromVariations(variations, store.id);
        totalSynced++;
        processedCount++;
        
        if (processedCount % 10 === 0) {
          this.logger.log(`[Pancake] Progress: ${processedCount}/${productMap.size} products synced`);
        }
      } catch (error) {
        this.logger.error(`[Pancake] Error syncing product ${pancakeProductId}:`, error);
        totalErrors++;
      }
    }

    this.logger.log(`[Pancake] Product sync completed. Total synced: ${totalSynced}, Errors: ${totalErrors}`);
    return { synced: totalSynced, errors: totalErrors, total: productMap.size };
  }

  /**
   * Sync product from variations
   */
  private async syncProductFromVariations(variations: any[], storeId: string) {
    if (variations.length === 0) return;

    const firstVariation = variations[0];
    const productData = firstVariation.product;
    
    if (!productData) {
      this.logger.warn(`[Pancake] Variation ${firstVariation.id} has no product data, skipping`);
      return;
    }

    const { baseName } = this.extractProductInfo(productData.name);
    const pancakeProductId = baseName.toLowerCase().replace(/\s+/g, '-');

    const slug = baseName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[d�]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const totalStock = variations.reduce((sum: number, v: any) => {
      const stock = Math.max(0, v.remain_quantity || 0);
      return sum + stock;
    }, 0);

    let mainImage = productData.image || null;
    if (!mainImage && firstVariation.images && firstVariation.images.length > 0) {
      mainImage = firstVariation.images[0];
    }

    const retailPrice = firstVariation.retail_price || 0;
    const salePrice = firstVariation.price_at_counter || retailPrice;

    const existingProduct = await this.prisma.product.findFirst({
      where: { externalId: pancakeProductId }
    });

    const productPayload = {
      name: baseName,
      slug,
      sku: productData.display_id || null,
      externalId: pancakeProductId,
      imageUrl: mainImage,
      description: productData.note_product || productData.note || null,
      originalPrice: retailPrice,
      salePrice,
      stockQuantity: totalStock,
      weight: 500,
      isActive: productData.is_published !== false,
      storeId,
    };

    let product;
    if (existingProduct) {
      product = await this.prisma.product.update({
        where: { id: existingProduct.id },
        data: productPayload
      });
      this.logger.log(`[Pancake] Updated product: ${product.name}`);
    } else {
      product = await this.prisma.product.create({
        data: productPayload
      });
      this.logger.log(`[Pancake] Created product: ${product.name}`);
    }

    if (productData.categories && Array.isArray(productData.categories) && productData.categories.length > 0) {
      const categoryIds = productData.categories
        .map((cat: any) => {
          if (typeof cat === 'number') return cat;
          if (typeof cat === 'object' && cat !== null && cat.id) return cat.id;
          return null;
        })
        .filter((id: any) => id !== null);
      
      if (categoryIds.length > 0) {
        await this.syncProductCategories(product.id, categoryIds);
      }
    }

    await this.syncProductVariations(product.id, variations);

    return product;
  }

  /**
   * Sync product categories
   */
  private async syncProductCategories(productId: string, pancakeCategoryIds: number[]) {
    if (!pancakeCategoryIds || pancakeCategoryIds.length === 0) return;

    const categories = await this.prisma.category.findMany({
      where: {
        externalId: {
          in: pancakeCategoryIds.map(id => String(id))
        }
      }
    });

    if (categories.length === 0) {
      this.logger.log(`[Pancake] No matching categories found`);
      return;
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { categories: true }
    });

    if (!product) return;

    const categoryIdsToConnect = categories.map(c => c.id);
    const existingCategoryIds = product.categories.map(c => c.id);
    const categoriesToAdd = categoryIdsToConnect.filter(id => !existingCategoryIds.includes(id));

    if (categoriesToAdd.length > 0) {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          categories: {
            connect: categoriesToAdd.map(id => ({ id }))
          }
        }
      });
      this.logger.log(`[Pancake] Linked ${categoriesToAdd.length} categories to product`);
    }
  }

  /**
   * Sync product variations
   */
  private async syncProductVariations(productId: string, variations: any[]) {
    for (const variation of variations) {
      const productName = variation.product?.name || '';
      const { color, size } = this.extractProductInfo(productName);
      
      if (!size && !color) continue;

      let sizeId = null;
      if (size) {
        let sizeRecord = await this.prisma.size.findUnique({ where: { name: size } });
        if (!sizeRecord) {
          sizeRecord = await this.prisma.size.create({ data: { name: size } });
        }
        sizeId = sizeRecord.id;
      }

      let colorId = null;
      if (color) {
        let colorRecord = await this.prisma.color.findUnique({ where: { name: color } });
        if (!colorRecord) {
          colorRecord = await this.prisma.color.create({ data: { name: color } });
        }
        colorId = colorRecord.id;
      }

      const stock = variation.remain_quantity || 0;

      const existingVariant = await this.prisma.productVariant.findFirst({
        where: {
          productId,
          sizeId,
          colorId,
        }
      });

      const variantData = {
        productId,
        sizeId,
        colorId,
        price: variation.price_at_counter || variation.retail_price || null,
        stock,
      };

      if (existingVariant) {
        await this.prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: { price: variantData.price, stock: variantData.stock }
        });
      } else {
        await this.prisma.productVariant.create({
          data: variantData
        });
      }
    }
  }

  /**
   * Sync all orders from Pancake
   */
  async syncAllOrders(storeId?: string, startDate?: string, endDate?: string) {
    this.logger.log('[Pancake] Starting full order sync...');
    
    let store = null;
    if (storeId) {
      store = await this.prisma.store.findUnique({ where: { id: storeId } });
    } else {
      const integration = await this.prisma.storeIntegration.findFirst({
        where: { platform: 'PANCAKE', isActive: true },
        include: { store: true }
      });
      store = integration?.store;
    }

    if (!store) {
      this.logger.error('[Pancake] No store found for order sync');
      return { synced: 0, errors: 0, total: 0, totalAmount: 0 };
    }

    const config = await this.getPancakeConfig();
    if (!config) {
      return { synced: 0, errors: 0, total: 0, totalAmount: 0 };
    }

    let page = 1;
    let totalSynced = 0;
    let totalErrors = 0;
    let totalAmount = 0;
    let hasMore = true;

    const params = new URLSearchParams({
      api_key: config.apiKey,
      page_size: '100',
      page_number: page.toString(),
      option_sort: 'inserted_at_desc',
    });

    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      params.append('startDateTime', startTimestamp.toString());
    }
    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      params.append('endDateTime', endTimestamp.toString());
    }

    while (hasMore && page <= 50) {
      try {
        params.set('page_number', page.toString());
        const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}/orders?${params.toString()}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          this.logger.error(`[Pancake] Failed to fetch orders page ${page}`);
          break;
        }

        const data = await response.json();
        
        if (!data.success || !Array.isArray(data.data)) {
          this.logger.error('[Pancake] Invalid response format');
          break;
        }

        const orders = data.data;
        const totalPages = data.total_pages || 1;
        
        this.logger.log(`[Pancake] Fetched page ${page}/${totalPages}: ${orders.length} orders`);

        for (const order of orders) {
          try {
            const result = await this.syncSingleOrder(order, store.id);
            if (result.synced) {
              totalSynced++;
              totalAmount += result.amount;
            }
          } catch (error) {
            this.logger.error(`[Pancake] Error syncing order ${order.id}:`, error);
            totalErrors++;
          }
        }

        hasMore = page < totalPages && orders.length > 0;
        page++;

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        this.logger.error(`[Pancake] Error fetching orders page ${page}:`, error);
        totalErrors++;
        break;
      }
    }

    this.logger.log(`[Pancake] Order sync completed. Synced: ${totalSynced}, Errors: ${totalErrors}, Total Amount: ${totalAmount}`);
    return { 
      synced: totalSynced, 
      errors: totalErrors, 
      total: totalSynced + totalErrors,
      totalAmount 
    };
  }

  /**
   * Sync single order from Pancake
   */
  async syncSingleOrder(pOrder: any, storeId: string) {
    const orderCode = `PCK-${pOrder.id}`;
    
    const existing = await this.prisma.order.findUnique({
      where: { orderCode }
    });

    if (existing) {
      this.logger.log(`[Pancake] Order ${orderCode} already exists, skipping`);
      return { synced: false, amount: 0 };
    }

    const phone = pOrder.bill_phone_number || pOrder.shipping_address?.phone_number;
    if (!phone) {
      this.logger.warn(`[Pancake] Order ${orderCode} has no phone number, skipping`);
      return { synced: false, amount: 0 };
    }

    let user = await this.prisma.user.findFirst({
      where: { phone }
    });

    if (!user) {
      const name = pOrder.bill_full_name || pOrder.shipping_address?.full_name || phone;
      const referralCode = `REF${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      user = await this.prisma.user.create({
        data: {
          phone,
          name,
          email: pOrder.bill_email || null,
          role: 'CUSTOMER',
          referralCode,
        }
      });
      
      this.logger.log(`[Pancake] Created new user: ${user.id} (${phone})`);
    }

    const orderDetail = await this.fetchOrderDetail(pOrder.id);
    const detailData = orderDetail || pOrder;

    const itemsMeta = this.extractItemsMetadata(detailData.items || pOrder.items || []);

    const subtotal = detailData.total_price || pOrder.total_price || 0;
    const shippingFee = detailData.shipping_fee || pOrder.shipping_fee || 0;
    const discount = detailData.total_discount || pOrder.total_discount || 0;
    const totalAmount = subtotal - discount + shippingFee;

    if (totalAmount <= 0) {
      this.logger.log(`[Pancake] Order ${orderCode} has 0 amount, skipping`);
      return { synced: false, amount: 0 };
    }

    const status = this.mapPancakeOrderStatus(detailData.status || pOrder.status);
    const paymentStatus = status === OrderStatus.COMPLETED ? 'PAID' : 'UNPAID';

    const shippingAddr = detailData.shipping_address || pOrder.shipping_address;
    
    const orderItemsData = [];
    const items = detailData.items || pOrder.items || [];
    
    for (const item of items) {
      const itemName = item.variation_info?.name || item.name || '';
      const price = item.variation_info?.retail_price || item.price || 0;
      const quantity = item.quantity || 1;

      const baseName = itemName
        .replace(/\s+size\s+[smlxSMLX]+/gi, '')
        .replace(/\s+màu\s+\w+/gi, '')
        .replace(/\s+[smlxSMLX]$/gi, '')
        .trim();

      const matchingProduct = await this.prisma.product.findFirst({
        where: {
          OR: [
            { name: { contains: baseName } },
            { name: { contains: itemName } },
            { externalId: { contains: String(item.product_id || '') } },
          ]
        }
      });

      if (matchingProduct) {
        orderItemsData.push({
          productId: matchingProduct.id,
          quantity,
          price,
          isGift: false,
          size: null,
          color: null,
        });
      }
    }

    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        orderCode,
        source: 'PANCAKE',
        shippingName: shippingAddr?.full_name || pOrder.bill_full_name || null,
        shippingPhone: shippingAddr?.phone_number || pOrder.bill_phone_number || null,
        shippingStreet: shippingAddr?.address || null,
        shippingWard: shippingAddr?.commune_id || null,
        shippingProvince: shippingAddr?.province_id || null,
        subtotal,
        discountAmount: discount,
        shippingFee,
        totalAmount,
        status,
        paymentStatus,
        note: pOrder.note || null,
        metadata: {
          items: itemsMeta,
          shippingAddress: shippingAddr || null,
          partner: detailData.partner || pOrder.partner || null,
          pancakeOrderId: pOrder.id,
          pancakeStatus: detailData.status || pOrder.status,
          pancakeStatusName: detailData.status_name || pOrder.status_name,
          conversationId: pOrder.conversation_id || null,
          pageId: pOrder.page_id || null,
          postId: pOrder.post_id || null,
          adId: pOrder.ad_id || null,
        },
        storeId,
        items: orderItemsData.length > 0 ? {
          create: orderItemsData
        } : undefined,
      }
    });

    this.logger.log(`[Pancake] Synced order: ${orderCode}, amount: ${totalAmount}`);

    if (status === OrderStatus.COMPLETED) {
      await this.updateUserRankAndSpent(user.id, totalAmount);
    }

    return { synced: true, amount: totalAmount, orderId: order.id };
  }

  /**
   * Map Pancake order status to our OrderStatus enum
   */
  private mapPancakeOrderStatus(pancakeStatus: number | string): OrderStatus {
    const statusMap: Record<number, OrderStatus> = {
      0: OrderStatus.PENDING,
      1: OrderStatus.CONFIRMED,
      2: OrderStatus.PACKAGING,
      3: OrderStatus.SHIPPED,
      4: OrderStatus.COMPLETED,
      5: OrderStatus.CANCELLED,
      6: OrderStatus.REFUNDED,
    };

    const statusNum = typeof pancakeStatus === 'string' ? parseInt(pancakeStatus) : pancakeStatus;
    return statusMap[statusNum] || OrderStatus.PENDING;
  }

  /**
   * Handle webhook event from Pancake
   */
  async handleWebhookEvent(payload: any) {
    this.logger.log(`[Pancake Webhook] Processing event type: ${payload.type || 'unknown'}`);

    const eventType = payload.type || payload.event_type;
    const eventData = payload.data || payload;

    switch (eventType) {
      case 'orders':
      case 'order':
        return await this.handleOrderWebhook(eventData);

      case 'customers':
      case 'customer':
        return await this.handleCustomerWebhook(eventData);

      case 'products':
      case 'product':
        return await this.handleProductWebhook(eventData);

      case 'variations_warehouses':
      case 'inventory':
        return await this.handleInventoryWebhook(eventData);

      default:
        this.logger.warn(`[Pancake Webhook] Unknown event type: ${eventType}`);
        return { processed: false, reason: 'Unknown event type' };
    }
  }

  /**
   * Handle order webhook from Pancake
   */
  private async handleOrderWebhook(orderData: any) {
    this.logger.log(`[Pancake Webhook] Processing order: ${orderData.id}`);

    try {
      const integration = await this.prisma.storeIntegration.findFirst({
        where: { platform: 'PANCAKE', isActive: true },
        include: { store: true }
      });

      if (!integration || !integration.store) {
        this.logger.error('[Pancake Webhook] No active store integration found');
        return { processed: false, reason: 'No active store' };
      }

      const result = await this.syncSingleOrder(orderData, integration.store.id);

      return {
        processed: true,
        action: result.synced ? 'created' : 'skipped',
        orderCode: `PCK-${orderData.id}`,
        amount: result.amount,
      };
    } catch (error) {
      this.logger.error(`[Pancake Webhook] Error processing order:`, error);
      throw error;
    }
  }

  /**
   * Handle customer webhook from Pancake
   */
  private async handleCustomerWebhook(customerData: any) {
    this.logger.log(`[Pancake Webhook] Processing customer: ${customerData.id}`);

    try {
      const phone = customerData.phone_number || customerData.phone;
      if (!phone) {
        return { processed: false, reason: 'No phone number' };
      }

      let user = await this.prisma.user.findFirst({
        where: { phone }
      });

      if (!user) {
        const referralCode = `REF${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        
        user = await this.prisma.user.create({
          data: {
            phone,
            name: customerData.name || phone,
            email: customerData.email || null,
            role: 'CUSTOMER',
            referralCode,
          }
        });

        this.logger.log(`[Pancake Webhook] Created new user: ${user.id}`);
        return { processed: true, action: 'created', userId: user.id };
      } else {
        const updateData: any = {};
        if (customerData.name && !user.name) updateData.name = customerData.name;
        if (customerData.email && !user.email) updateData.email = customerData.email;

        if (Object.keys(updateData).length > 0) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
          this.logger.log(`[Pancake Webhook] Updated user: ${user.id}`);
          return { processed: true, action: 'updated', userId: user.id };
        }

        return { processed: true, action: 'skipped', userId: user.id };
      }
    } catch (error) {
      this.logger.error(`[Pancake Webhook] Error processing customer:`, error);
      throw error;
    }
  }

  /**
   * Handle product webhook from Pancake
   */
  private async handleProductWebhook(productData: any) {
    this.logger.log(`[Pancake Webhook] Processing product: ${productData.id}`);

    try {
      const integration = await this.prisma.storeIntegration.findFirst({
        where: { platform: 'PANCAKE', isActive: true },
        include: { store: true }
      });

      if (!integration || !integration.store) {
        return { processed: false, reason: 'No active store' };
      }

      const config = await this.getPancakeConfig();
      if (!config) return { processed: false, reason: 'No config' };

      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}/products/${productData.id}?api_key=${config.apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        return { processed: false, reason: 'Failed to fetch product' };
      }

      this.logger.log(`[Pancake Webhook] Product sync not fully implemented yet`);
      
      return { processed: true, action: 'acknowledged', productId: productData.id };
    } catch (error) {
      this.logger.error(`[Pancake Webhook] Error processing product:`, error);
      throw error;
    }
  }

  /**
   * Handle inventory webhook from Pancake
   */
  private async handleInventoryWebhook(inventoryData: any) {
    this.logger.log(`[Pancake Webhook] Processing inventory update: ${inventoryData.variation_id}`);

    try {
      this.logger.log(`[Pancake Webhook] Inventory sync not fully implemented yet`);
      
      return { processed: true, action: 'acknowledged' };
    } catch (error) {
      this.logger.error(`[Pancake Webhook] Error processing inventory:`, error);
      throw error;
    }
  }

  /**
   * Configure webhook on Pancake
   */
  async configureWebhook(webhookUrl: string, webhookTypes: string[] = ['orders', 'customers']) {
    const config = await this.getPancakeConfig();
    if (!config) {
      throw new Error('Pancake configuration not found');
    }

    try {
      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}?api_key=${config.apiKey}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop: {
            webhook_enable: true,
            webhook_url: webhookUrl,
            webhook_types: webhookTypes,
            webhook_headers: {
              'X-API-KEY': config.apiKey,
              'Content-Type': 'application/json'
            }
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        this.logger.log(`[Pancake] Webhook configured successfully: ${webhookUrl}`);
        return { success: true, webhookUrl, webhookTypes };
      } else {
        this.logger.error(`[Pancake] Failed to configure webhook:`, data);
        throw new Error('Failed to configure webhook');
      }
    } catch (error) {
      this.logger.error(`[Pancake] Error configuring webhook:`, error);
      throw error;
    }
  }

  /**
   * Get webhook configuration from Pancake
   */
  async getWebhookConfig() {
    const config = await this.getPancakeConfig();
    if (!config) {
      throw new Error('Pancake configuration not found');
    }

    try {
      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}?api_key=${config.apiKey}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success && data.data) {
        const shop = data.data;
        return {
          enabled: shop.webhook_enable || false,
          url: shop.webhook_url || null,
          types: shop.webhook_types || [],
          email: shop.webhook_email || null,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`[Pancake] Error fetching webhook config:`, error);
      throw error;
    }
  }
}
