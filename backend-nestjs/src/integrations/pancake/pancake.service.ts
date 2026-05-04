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

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  private buildPhoneSearchTerms(phone: string) {
    const rawPhone = phone.trim();
    const normalizedPhone = this.normalizePhone(rawPhone);
    const searchTerms = new Set<string>();

    if (rawPhone) searchTerms.add(rawPhone);
    if (normalizedPhone) searchTerms.add(normalizedPhone);

    if (normalizedPhone.length === 9) {
      searchTerms.add(`0${normalizedPhone}`);
    }

    if (normalizedPhone.startsWith('84') && normalizedPhone.length >= 11) {
      searchTerms.add(`0${normalizedPhone.slice(2)}`);
    }

    if (normalizedPhone.startsWith('0') && normalizedPhone.length >= 10) {
      searchTerms.add(`84${normalizedPhone.slice(1)}`);
    }

    return Array.from(searchTerms).filter(term => term.length >= 9);
  }

  private async getActivePancakeIntegrations(storeId?: string) {
    const integrations = await this.prisma.storeIntegration.findMany({
      where: {
        platform: 'PANCAKE',
        isActive: true,
        ...(storeId ? { storeId } : {}),
      },
      select: {
        storeId: true,
        shopId: true,
        apiKey: true,
      },
    });

    return integrations.filter((integration) => {
      if (!integration.storeId || !integration.shopId || !integration.apiKey) {
        this.logger.warn('[Pancake] Ignoring active integration missing storeId, shopId or apiKey');
        return false;
      }
      return true;
    });
  }

  private async getPancakeConfig(storeId?: string, shopId?: string) {
    // Only get from database, no fallback to env
    const whereClause: any = { platform: 'PANCAKE', isActive: true };
    if (storeId) whereClause.storeId = storeId;
    if (shopId) whereClause.shopId = shopId;

    const pConfig = await this.prisma.storeIntegration.findFirst({
      where: whereClause
    });
    
    if (!pConfig) {
      this.logger.error(`[Pancake] No active Pancake integration found in database (storeId: ${storeId}, shopId: ${shopId})`);
      return null;
    }

    const configShopId = pConfig.shopId;
    const apiKey = pConfig.apiKey;

    if (!configShopId || !apiKey) {
      this.logger.error('[Pancake] Pancake integration found but missing Shop ID or API Key');
      return null;
    }

    this.logger.log(`[Pancake] Using config from database - Shop ID: ${configShopId.substring(0, 8)}...`);
    return { shopId: configShopId, apiKey };
  }

  /**
   * Fetch orders from Pancake by phone number
   */
  async fetchOrdersByPhone(phone: string, storeId?: string) {
    const config = await this.getPancakeConfig(storeId);
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

  private buildDateRange(date: string) {
    const match = /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (!match) {
      throw new Error(`Invalid date format: ${date}`);
    }

    const start = new Date(`${date}T00:00:00+07:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
  }

  private getPancakeOrderCreatedAt(order: any) {
    const rawDate = order?.inserted_at || order?.created_at || order?.updated_at || null;
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private isOrderInDateRange(order: any, start: Date, end: Date) {
    const createdAt = this.getPancakeOrderCreatedAt(order);
    if (!createdAt) return true;
    return createdAt >= start && createdAt < end;
  }

  private async fetchOrdersByDateRangeForIntegration(
    integration: { storeId: string; shopId: string | null; apiKey: string | null },
    start: Date,
    end: Date,
  ) {
    if (!integration.shopId || !integration.apiKey) return [];

    const orders = new Map<string, any>();
    const pageSize = 100;
    let page = 1;
    let shouldContinue = true;

    while (shouldContinue && page <= 100) {
      const query = new URLSearchParams({
        api_key: integration.apiKey,
        page: String(page),
        page_size: String(pageSize),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        inserted_at_min: start.toISOString(),
        inserted_at_max: end.toISOString(),
      });

      const url = `https://pos.pages.fm/api/v1/shops/${integration.shopId}/orders?${query.toString()}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          this.logger.error(`[Pancake] Failed to fetch orders page ${page} by date. Status: ${response.status}`);
          break;
        }

        const data = await response.json();
        const pageOrders = Array.isArray(data.data) ? data.data : [];
        if (pageOrders.length === 0) break;

        let pageHadInRangeOrder = false;
        let pageHadOlderOrder = false;

        for (const order of pageOrders) {
          const createdAt = this.getPancakeOrderCreatedAt(order);
          if (createdAt && createdAt < start) {
            pageHadOlderOrder = true;
            continue;
          }

          if (this.isOrderInDateRange(order, start, end)) {
            pageHadInRangeOrder = true;
            orders.set(String(order.id), order);
          }
        }

        const totalPages = data.total_pages || data.totalPages || 0;
        const hasMoreByPagination = totalPages ? page < totalPages : pageOrders.length >= pageSize;
        shouldContinue = hasMoreByPagination && (!pageHadOlderOrder || pageHadInRangeOrder);
        page++;
      } catch (error) {
        this.logger.error('[Pancake] Error fetching orders by date:', error);
        break;
      }
    }

    return Array.from(orders.values());
  }

  /**
   * Fetch single order detail
   */
  async fetchOrderDetail(orderId: number, storeId?: string) {
    const config = await this.getPancakeConfig(storeId);
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
      name: item.variation_info?.name || 'Sản phẩm không rõ',
      price: item.variation_info?.retail_price || 0,
      quantity: item.quantity || 1,
      image: item.variation_info?.images?.[0] || null,
      images: item.variation_info?.images || [],
      productId: item.product_id || null,
      variationId: item.variation_id || null,
      displayId: item.variation_info?.display_id || null,
      productDisplayId: item.variation_info?.product_display_id || null,
      barcode: item.variation_info?.barcode || null,
      weight: item.variation_info?.weight || 0,
      fields: item.variation_info?.fields || [],  // variant attributes (size, color, etc.)
      detail: item.variation_info?.detail || null,
      discountEachProduct: item.discount_each_product || 0,
      isDiscountPercent: item.is_discount_percent || false,
      isBonusProduct: item.is_bonus_product || false,
      isWholesale: item.is_wholesale || false,
      isComposite: item.is_composite || false,
      note: item.note || item.note_product || null,
      returnedCount: item.returned_count || 0,
      categoryIds: item.variation_info?.category_ids || [],
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
  async syncOrdersForUser(phone: string, userId: string, storeId?: string) {
    this.logger.log(`[Pancake] Starting sync for userId: ${userId}, phone: ${phone}`);

    const integrations = await this.getActivePancakeIntegrations(storeId);
    if (integrations.length === 0) {
      this.logger.warn(`[Pancake] No active integration found for syncOrdersForUser`);
      return 0;
    }

    const searchTerms = this.buildPhoneSearchTerms(phone);
    if (searchTerms.length === 0) {
      this.logger.warn(`[Pancake] Phone is empty after normalization, skip sync for userId: ${userId}`);
      return 0;
    }

    let totalNewSpent = 0;
    let syncedCount = 0;
    let customerInfoSynced = false;
    let totalFetchedOrders = 0;
    const processedOrders = new Set<string>();

    for (const integration of integrations) {
      const orderMap = new Map<string, any>();

      for (const searchTerm of searchTerms) {
        const orders = await this.fetchOrdersByPhone(searchTerm, integration.storeId);
        for (const order of orders) {
          orderMap.set(String(order.id), order);
        }
      }

      totalFetchedOrders += orderMap.size;

      for (const pOrder of orderMap.values()) {
        const dedupeKey = `${integration.storeId}:${pOrder.id}`;
        if (processedOrders.has(dedupeKey)) {
          continue;
        }
        processedOrders.add(dedupeKey);

        try {
          const result = await this.syncSingleOrder(pOrder, integration.storeId, userId);

          if (result.synced) {
            totalNewSpent += result.amount;
            syncedCount++;

            // Try to sync profile from the first successful order
            if (!customerInfoSynced) {
              const orderDetail = await this.fetchOrderDetail(pOrder.id, integration.storeId);
              if (orderDetail) {
                const custInfo = this.extractCustomerInfo(orderDetail);
                if (custInfo.name || custInfo.fullAddress) {
                  await this.syncUserProfile(userId, custInfo);
                  customerInfoSynced = true;
                }
              }
            }
          }
        } catch (error) {
          this.logger.error(`[Pancake] Error in syncOrdersForUser for order ${pOrder.id}:`, error);
        }
      }
    }

    if (totalFetchedOrders === 0) {
      this.logger.log(`[Pancake] No orders to sync for phone: ${phone}`);
      return 0;
    }

    this.logger.log(`[Pancake] Sync completed. Orders: ${syncedCount}, Amount: ${totalNewSpent}`);
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
  async fetchCategories(storeId?: string) {
    const config = await this.getPancakeConfig(storeId);
    if (!config) return [];

    try {
      const url = `https://pos.pages.fm/api/v1/shops/${config.shopId}/categories?api_key=${config.apiKey}`;
      
      this.logger.log(`[Pancake] Fetching categories from: ${url.replace(config.apiKey, '***')}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      this.logger.log(`[Pancake] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`[Pancake] Failed to fetch categories. Status: ${response.status}, Body: ${errorText}`);
        return [];
      }

      const data = await response.json();
      this.logger.log(`[Pancake] Response data:`, JSON.stringify(data).substring(0, 200));
      
      if (data.success && Array.isArray(data.data)) {
        this.logger.log(`[Pancake] Fetched ${data.data.length} root categories`);
        return data.data;
      }
      
      this.logger.warn(`[Pancake] Unexpected response format:`, data);
      return [];
    } catch (error) {
      this.logger.error('[Pancake] Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Sync all categories
   */
  async syncAllCategories(storeId?: string) {
    this.logger.log('[Pancake] Starting category sync...');
    
    const categories = await this.fetchCategories(storeId);
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
  async fetchProducts(page = 1, pageSize = 100, storeId?: string) {
    const config = await this.getPancakeConfig(storeId);
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
  private extractProductInfo(productName: string, itemFields?: any[]) {
    let baseName = productName;
    let color = null;
    let size = null;
    
    baseName = baseName.replace(/_+/g, ' ');

    if (Array.isArray(itemFields)) {
      const sizeField = itemFields.find((field: any) => {
        const fieldName = String(field?.name || '').toLowerCase();
        return fieldName.includes('size') || fieldName.includes('kich') || fieldName.includes('kích');
      });
      const colorField = itemFields.find((field: any) => {
        const fieldName = String(field?.name || '').toLowerCase();
        return fieldName.includes('color') || fieldName.includes('mau') || fieldName.includes('màu');
      });

      if (!size && sizeField?.value) {
        size = String(sizeField.value).trim().toUpperCase();
      }
      if (!color && colorField?.value) {
        color = String(colorField.value).trim();
      }
    }
    
    const sizeValuePattern = /\s+(?:Size|size|ize)\s+([X]{1,3}L|2XL|3XL|[LMS]|Freesize|Free\s*size)\b|\s+([X]{1,3}L|[LMS]|Freesize|Free\s*size)\b(?=\s*$)/gi;
    const sizeMatches = Array.from(baseName.matchAll(sizeValuePattern));
    if (sizeMatches.length > 0 && !size) {
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
    
    const colorPattern = /(Đen|Đỏ|Xanh|Trắng|Hồng|Be|Tím|Vàng|Nâu|Xám|Cam)\b/gi;
    const colorMatches = Array.from(baseName.matchAll(colorPattern));
    if (colorMatches.length > 0 && !color) {
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
      const { variations, hasMore: more, total } = await this.fetchProducts(page, 100, store.id);
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
    // Track which size+color combos we've already processed to aggregate stock
    const variantMap = new Map<string, { sizeId: string | null; colorId: string | null; price: number | null; stock: number }>();

    for (const variation of variations) {
      const productName = variation.product?.name || '';
      const { color, size } = this.extractProductInfo(productName, variation.fields);
      
      if (!size && !color) continue;

      let sizeId: string | null = null;
      if (size) {
        let sizeRecord = await this.prisma.size.findUnique({ where: { name: size } });
        if (!sizeRecord) {
          sizeRecord = await this.prisma.size.create({ data: { name: size } });
        }
        sizeId = sizeRecord.id;
      }

      let colorId: string | null = null;
      if (color) {
        let colorRecord = await this.prisma.color.findUnique({ where: { name: color } });
        if (!colorRecord) {
          colorRecord = await this.prisma.color.create({ data: { name: color } });
        }
        colorId = colorRecord.id;
      }

      const stock = Math.max(0, variation.remain_quantity || 0);
      const price = variation.price_at_counter || variation.retail_price || null;
      const key = `${sizeId || 'null'}_${colorId || 'null'}`;

      if (variantMap.has(key)) {
        // Aggregate stock for duplicate size+color combos
        const existing = variantMap.get(key)!;
        existing.stock += stock;
        if (price && (!existing.price || price > existing.price)) {
          existing.price = price;
        }
      } else {
        variantMap.set(key, { sizeId, colorId, price, stock });
      }
    }

    // Now upsert each unique variant
    for (const [, variant] of variantMap) {
      try {
        const existingVariant = await this.prisma.productVariant.findFirst({
          where: {
            productId,
            sizeId: variant.sizeId,
            colorId: variant.colorId,
          }
        });

        if (existingVariant) {
          await this.prisma.productVariant.update({
            where: { id: existingVariant.id },
            data: { price: variant.price, stock: variant.stock }
          });
        } else {
          await this.prisma.productVariant.create({
            data: {
              productId,
              sizeId: variant.sizeId,
              colorId: variant.colorId,
              price: variant.price,
              stock: variant.stock,
            }
          });
        }
      } catch (error: any) {
        // Handle race condition: if unique constraint still fails, try update
        if (error.code === 'P2002') {
          const existing = await this.prisma.productVariant.findFirst({
            where: { productId, sizeId: variant.sizeId, colorId: variant.colorId }
          });
          if (existing) {
            await this.prisma.productVariant.update({
              where: { id: existing.id },
              data: { price: variant.price, stock: variant.stock }
            });
          }
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Sync all orders from Pancake
   */
  async syncAllOrders(storeId?: string, startDate?: string, endDate?: string, dates?: string[]) {
    this.logger.log('[Pancake] Starting date-based order sync...');

    const integrations = await this.getActivePancakeIntegrations(storeId);
    if (integrations.length === 0) {
      this.logger.warn('[Pancake] No active integration found for syncAllOrders');
      return { synced: 0, errors: 0, total: 0, totalAmount: 0 };
    }

    const dateRanges = dates && dates.length > 0
      ? Array.from(new Set(dates)).map(date => this.buildDateRange(date))
      : startDate && endDate
        ? [{ start: new Date(startDate), end: new Date(endDate) }]
        : [this.buildDateRange(new Date().toISOString().slice(0, 10))];

    let totalSynced = 0;
    let totalErrors = 0;
    let totalAmount = 0;
    let totalFetched = 0;
    const processedOrders = new Set<string>();

    for (const integration of integrations) {
      for (const range of dateRanges) {
        const orders = await this.fetchOrdersByDateRangeForIntegration(integration, range.start, range.end);
        totalFetched += orders.length;

        for (const order of orders) {
          const dedupeKey = `${integration.storeId}:${order.id}`;
          if (processedOrders.has(dedupeKey)) {
            continue;
          }
          processedOrders.add(dedupeKey);

          try {
            const result = await this.syncSingleOrder(order, integration.storeId);
            if (result.synced) {
              totalAmount += result.amount;
              totalSynced++;
            }
          } catch (error) {
            this.logger.error(`[Pancake] Error syncing order ${order.id}:`, error);
            totalErrors++;
          }

          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }

    this.logger.log(`[Pancake] Date-based sync completed. Fetched: ${totalFetched}, Synced: ${totalSynced}, Errors: ${totalErrors}, Total Amount: ${totalAmount}`);
    return { 
      synced: totalSynced, 
      errors: totalErrors, 
      total: totalFetched,
      totalAmount 
    };
  }

  /**
   * Sync single order from Pancake
   */
  async syncSingleOrder(pOrder: any, storeId: string, targetUserId?: string) {
    const orderCode = `PCK-${pOrder.id}`;
    
    const existing = await this.prisma.order.findUnique({
      where: { orderCode }
    });

    const phone = pOrder.bill_phone_number || pOrder.shipping_address?.phone_number;
    if (!phone) {
      this.logger.warn(`[Pancake] Order ${orderCode} has no phone number, skipping`);
      return { synced: false, amount: 0 };
    }

    const phoneSearchTerms = this.buildPhoneSearchTerms(phone);

    let user = targetUserId
      ? await this.prisma.user.findUnique({
          where: { id: targetUserId },
        })
      : await this.prisma.user.findFirst({
          where: {
            phone: {
              in: phoneSearchTerms,
            },
          },
        });

    if (!user) {
      this.logger.log(`[Pancake] No existing user for phone ${phone}, creating order without userId`);
    }

    // Update user email/name if missing
    if (user && (!user.email && pOrder.bill_email)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { email: pOrder.bill_email },
      });
    }

    const orderDetail = await this.fetchOrderDetail(pOrder.id, storeId);
    const detailData = orderDetail || pOrder;

    const itemsMeta = this.extractItemsMetadata(detailData.items || pOrder.items || []);

    // --- Financial calculations ---
    const subtotal = detailData.total_price || pOrder.total_price || 0;
    const shippingFee = detailData.shipping_fee || pOrder.shipping_fee || 0;
    const partnerFee = detailData.partner_fee || pOrder.partner_fee || 0;
    const discount = detailData.total_discount || pOrder.total_discount || 0;
    const surcharge = detailData.surcharge || pOrder.surcharge || 0;
    const totalAmount = subtotal - discount + shippingFee + surcharge;

    if (totalAmount <= 0) {
      this.logger.log(`[Pancake] Order ${orderCode} has 0 amount, skipping`);
      return { synced: false, amount: 0 };
    }

    // --- Payment info ---
    const cod = detailData.cod || pOrder.cod || 0;
    const cash = detailData.cash || pOrder.cash || 0;
    const transferMoney = detailData.transfer_money || pOrder.transfer_money || 0;
    const chargedByMomo = detailData.charged_by_momo || pOrder.charged_by_momo || 0;
    const chargedByVnpay = detailData.charged_by_vnpay || pOrder.charged_by_vnpay || 0;
    const chargedByCard = detailData.charged_by_card || pOrder.charged_by_card || 0;
    const chargedByQrpay = detailData.charged_by_qrpay || pOrder.charged_by_qrpay || 0;
    const chargedByFundiin = detailData.charged_by_fundiin || pOrder.charged_by_fundiin || 0;
    const chargedByKredivo = detailData.charged_by_kredivo || pOrder.charged_by_kredivo || 0;
    const moneyToCollect = detailData.money_to_collect || pOrder.money_to_collect || 0;
    const totalPaid = cod + cash + transferMoney + chargedByMomo + chargedByVnpay + chargedByCard + chargedByQrpay + chargedByFundiin + chargedByKredivo;

    // --- Status mapping ---
    const status = this.mapPancakeOrderStatus(detailData.status || pOrder.status);
    const paymentStatus = totalPaid >= totalAmount ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    // --- Shipping address ---
    const shippingAddr = detailData.shipping_address || pOrder.shipping_address;
    
    // --- Partner / Shipping provider ---
    const partner = detailData.partner || pOrder.partner || null;

    // --- Order items ---
    const orderItemsData = [];
    const items = detailData.items || pOrder.items || [];
    
    for (const item of items) {
      const itemName = item.variation_info?.name || item.name || '';
      const price = item.variation_info?.retail_price || item.price || 0;
      const quantity = item.quantity || 1;
      const itemFields = item.variation_info?.fields || [];
      const parsedProductInfo = this.extractProductInfo(itemName, itemFields);
      const normalizedExternalId = parsedProductInfo.baseName.toLowerCase().replace(/\s+/g, '-');

      const baseName = itemName
        .replace(/\s+size\s+[smlxSMLX]+/gi, '')
        .replace(/\s+màu\s+\w+/gi, '')
        .replace(/\s+[smlxSMLX]$/gi, '')
        .trim();
      const matchName = parsedProductInfo.baseName || baseName;
      if (!matchName) {
        continue;
      }

      const matchingProduct = await this.prisma.product.findFirst({
        where: {
          storeId,
          OR: [
            { externalId: normalizedExternalId },
            { name: matchName },
            { name: { contains: matchName } },
            { name: { contains: baseName } },
          ]
        }
      });

      if (matchingProduct) {
        orderItemsData.push({
          productId: matchingProduct.id,
          quantity,
          price,
          isGift: item.is_bonus_product || false,
          size: parsedProductInfo.size || null,
          color: parsedProductInfo.color || null,
        });
      }
    }

    // --- Build comprehensive metadata ---
    const metadata: Record<string, any> = {
      // Product items detail
      items: itemsMeta,
      
      // Pancake order identifiers
      pancakeOrderId: pOrder.id,
      pancakeDisplayId: detailData.display_id || pOrder.display_id || null,
      pancakeStatus: detailData.status ?? pOrder.status,
      pancakeStatusName: detailData.status_name || pOrder.status_name || null,

      // Timestamps from Pancake
      pancakeCreatedAt: detailData.inserted_at || pOrder.inserted_at || null,
      pancakeUpdatedAt: detailData.updated_at || pOrder.updated_at || null,
      
      // Customer info
      customer: {
        name: pOrder.bill_full_name || detailData.bill_full_name || null,
        phone: pOrder.bill_phone_number || detailData.bill_phone_number || null,
        email: pOrder.bill_email || detailData.bill_email || null,
        fbId: detailData.customer?.fb_id || pOrder.customer?.fb_id || null,
        pancakeCustomerId: detailData.customer?.id || pOrder.customer?.id || null,
      },

      // Full shipping address
      shippingAddress: shippingAddr ? {
        fullName: shippingAddr.full_name || null,
        phoneNumber: shippingAddr.phone_number || null,
        address: shippingAddr.address || null,
        fullAddress: shippingAddr.full_address || null,
        provinceId: shippingAddr.province_id || null,
        districtId: shippingAddr.district_id || null,
        communeId: shippingAddr.commune_id || null,
        countryCode: shippingAddr.country_code || null,
        postCode: shippingAddr.post_code || null,
      } : null,

      // Shipping partner (ĐVVC)
      partner: partner ? {
        partnerId: partner.partner_id || null,
        trackingCode: partner.extend_code || null,
        totalFee: partner.total_fee || 0,
        cod: partner.cod || 0,
        deliveryName: partner.delivery_name || null,
        deliveryPhone: partner.delivery_tel || null,
        pickedUpAt: partner.picked_up_at || null,
        paidAt: partner.paid_at || null,
        sortCode: partner.sort_code || null,
        updatedAt: partner.updated_at || null,
        courierUpdates: partner.extend_update || [],
      } : null,

      // Payment breakdown
      payment: {
        cod,
        cash,
        transferMoney,
        chargedByMomo,
        chargedByVnpay,
        chargedByCard,
        chargedByQrpay,
        chargedByFundiin,
        chargedByKredivo,
        moneyToCollect,
        totalPaid,
        prepaidByPoint: detailData.prepaid_by_point || pOrder.prepaid_by_point || null,
        bankTransferImages: detailData.bank_transfer_images || pOrder.bank_transfer_images || [],
        paymentHistories: detailData.payment_purchase_histories || pOrder.payment_purchase_histories || [],
        bankPayments: detailData.bank_payments || pOrder.bank_payments || null,
      },

      // Financial summary
      financial: {
        subtotal,
        discount,
        shippingFee,
        partnerFee,
        surcharge,
        totalAmount,
        isFreeShipping: detailData.is_free_shipping || pOrder.is_free_shipping || false,
        customerPayFee: detailData.customer_pay_fee || pOrder.customer_pay_fee || false,
      },

      // Order source / channel info
      source: {
        conversationId: pOrder.conversation_id || detailData.conversation_id || null,
        pageId: pOrder.page_id || detailData.page_id || null,
        postId: pOrder.post_id || detailData.post_id || null,
        adId: pOrder.ad_id || detailData.ad_id || null,
        accountId: pOrder.account || detailData.account || null,
        accountName: pOrder.account_name || detailData.account_name || null,
        isFromEcommerce: detailData.is_from_ecommerce || pOrder.is_from_ecommerce || false,
        marketplaceId: detailData.marketplace_id || pOrder.marketplace_id || null,
        isLivestream: detailData.is_livestream || pOrder.is_livestream || false,
        receivedAtShop: detailData.received_at_shop || pOrder.received_at_shop || false,
      },

      // UTM tracking
      utm: {
        source: pOrder.p_utm_source || null,
        medium: pOrder.p_utm_medium || null,
        campaign: pOrder.p_utm_campaign || null,
        term: pOrder.p_utm_term || null,
        content: pOrder.p_utm_content || null,
      },

      // Notes
      note: pOrder.note || detailData.note || null,
      notePrint: pOrder.note_print || detailData.note_print || null,

      // Warehouse info
      warehouseId: detailData.warehouse_id || pOrder.warehouse_id || null,
      warehouseInfo: detailData.warehouse_info || pOrder.warehouse_info || null,

      // Order tags
      tags: detailData.tags || pOrder.tags || [],

      // Reports by phone
      reportsByPhone: detailData.reports_by_phone || pOrder.reports_by_phone || null,

      // Status history
      statusHistory: detailData.status_history || pOrder.status_history || [],

      // Staff assignments
      creator: detailData.creator || pOrder.creator || null,
      marketer: detailData.marketer || pOrder.marketer || null,
      assigningSeller: detailData.assigning_seller || pOrder.assigning_seller || null,
      assigningCare: detailData.assigning_care || pOrder.assigning_care || null,

      // Tracking link
      trackingLink: detailData.tracking_link || pOrder.tracking_link || null,
    };

    // Use Pancake's original order creation time
    const pancakeCreatedAt = detailData.inserted_at || pOrder.inserted_at;
    const orderCreatedAt = pancakeCreatedAt ? new Date(pancakeCreatedAt) : new Date();

    let order;
    const shouldAttachUserToExistingOrder =
      !!existing &&
      !!user &&
      (!existing.userId || existing.userId === user.id);

    if (existing) {
      // Delete old items so we can recreate them
      await this.prisma.orderItem.deleteMany({
        where: { orderId: existing.id }
      });

      order = await this.prisma.order.update({
        where: { id: existing.id },
        data: {
          ...(shouldAttachUserToExistingOrder ? { userId: user!.id } : {}),
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
          note: pOrder.note || detailData.note || null,
          customerNote: pOrder.note_print || detailData.note_print || null,
          metadata,
          storeId,
          items: orderItemsData.length > 0 ? {
            create: orderItemsData
          } : undefined,
        }
      });
      this.logger.log(`[Pancake] Updated order: ${orderCode}, amount: ${totalAmount}, paid: ${totalPaid}`);

      if (existing.userId && user && existing.userId !== user.id) {
        this.logger.warn(
          `[Pancake] Order ${orderCode} already belongs to another user (${existing.userId}), skip re-attaching to ${user.id}`,
        );
      }
    } else {
      order = await this.prisma.order.create({
        data: {
          userId: user?.id || null,
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
          note: pOrder.note || detailData.note || null,
          customerNote: pOrder.note_print || detailData.note_print || null,
          metadata,
          storeId,
          createdAt: orderCreatedAt,
          items: orderItemsData.length > 0 ? {
            create: orderItemsData
          } : undefined,
        }
      });
      this.logger.log(`[Pancake] Synced order: ${orderCode}, amount: ${totalAmount}, paid: ${totalPaid}`);
    }

    const isCreditableStatus = status === 'COMPLETED' || status === 'DELIVERED';
    const wasCreditableStatus = existing && (existing.status === 'COMPLETED' || existing.status === 'DELIVERED');

    const shouldCreditOrder =
      isCreditableStatus &&
      user &&
      (
        !existing ||
        !wasCreditableStatus ||
        (!existing.userId && order.userId === user.id)
      );

    if (shouldCreditOrder) {
      await this.updateUserRankAndSpent(user.id, totalAmount);
    }

    const shouldDeductOrder =
      !isCreditableStatus &&
      wasCreditableStatus &&
      user &&
      existing.userId === user.id;

    if (shouldDeductOrder) {
      await this.updateUserRankAndSpent(user.id, -totalAmount);
    }

    return { synced: true, amount: totalAmount, orderId: order.id, isUpdate: !!existing };
  }

  /**
   * Map Pancake order status to our OrderStatus enum
   * Pancake statuses: 0=New, 17=WaitConfirm, 11=Restocking, 12=WaitPrint, 13=Printed,
   * 20=Purchased, 1=Confirmed, 8=Packaging, 9=WaitPickup, 2=Shipped,
   * 3=Received, 16=CollectedMoney, 4=Returning, 15=PartialReturn, 5=Returned, 6=Canceled, 7=Deleted
   */
  private mapPancakeOrderStatus(pancakeStatus: number | string): OrderStatus {
    const statusNum = typeof pancakeStatus === 'string' ? parseInt(pancakeStatus) : pancakeStatus;
    
    const statusMap: Record<number, OrderStatus> = {
      0:  OrderStatus.PENDING,              // Mới
      17: OrderStatus.PENDING,              // Chờ xác nhận
      11: OrderStatus.WAITING_FOR_GOODS,    // Chờ hàng
      20: OrderStatus.CONFIRMED,            // Đã đặt hàng
      1:  OrderStatus.CONFIRMED,            // Đã xác nhận
      12: OrderStatus.CONFIRMED,            // Chờ in
      13: OrderStatus.CONFIRMED,            // Đã in
      8:  OrderStatus.PACKAGING,            // Đang đóng hàng
      9:  OrderStatus.WAITING_FOR_SHIPPING, // Chờ chuyển hàng
      2:  OrderStatus.SHIPPED,              // Đã gửi hàng
      3:  OrderStatus.DELIVERED,            // Đã nhận
      16: OrderStatus.PAYMENT_COLLECTED,    // Đã thu tiền
      4:  OrderStatus.RETURNING,            // Đang hoàn
      15: OrderStatus.RETURNING,            // Hoàn một phần
      5:  OrderStatus.REFUNDED,             // Đã hoàn
      6:  OrderStatus.CANCELLED,            // Đã hủy
      7:  OrderStatus.CANCELLED,            // Đã xóa
    };

    return statusMap[statusNum] || OrderStatus.PENDING;
  }

  /**
   * Handle webhook event from Pancake
   */
  async handleWebhookEvent(payload: any, shopId?: string) {
    this.logger.log(`[Pancake Webhook] Processing event type: ${payload.type || 'unknown'} for shopId: ${shopId || 'unknown'}`);

    const eventType = payload.type || payload.event_type;
    const eventData = payload.data || payload;

    switch (eventType) {
      case 'orders':
      case 'order':
        return await this.handleOrderWebhook(eventData, shopId);

      case 'customers':
      case 'customer':
        return await this.handleCustomerWebhook(eventData, shopId);

      case 'products':
      case 'product':
        return await this.handleProductWebhook(eventData, shopId);

      case 'variations_warehouses':
      case 'inventory':
        return await this.handleInventoryWebhook(eventData, shopId);

      default:
        this.logger.warn(`[Pancake Webhook] Unknown event type: ${eventType}`);
        return { processed: false, reason: 'Unknown event type' };
    }
  }

  /**
   * Handle order webhook from Pancake
   */
  private async handleOrderWebhook(orderData: any, shopId?: string) {
    this.logger.log(`[Pancake Webhook] Processing order: ${orderData.id}`);

    try {
      const whereClause: any = { platform: 'PANCAKE', isActive: true };
      if (shopId) whereClause.shopId = shopId;

      const integration = await this.prisma.storeIntegration.findFirst({
        where: whereClause,
        include: { store: true }
      });

      if (!integration || !integration.store) {
        this.logger.error('[Pancake Webhook] No active store integration found');
        return { processed: false, reason: 'No active store' };
      }

      const result = await this.syncSingleOrder(orderData, integration.store.id);

      return {
        processed: true,
        action: result.synced ? (result.isUpdate ? 'updated' : 'created') : 'skipped',
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
  private async handleCustomerWebhook(customerData: any, shopId?: string) {
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
        // DON'T create user - will be created when they actually register/login
        this.logger.log(`[Pancake Webhook] No existing user for phone ${phone}, skipping`);
        return { processed: false, reason: 'User not registered yet' };
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
  private async handleProductWebhook(productData: any, shopId?: string) {
    this.logger.log(`[Pancake Webhook] Processing product update: ${productData.id || 'unknown'}`);

    try {
      const whereClause: any = { platform: 'PANCAKE', isActive: true };
      if (shopId) whereClause.shopId = shopId;

      const integration = await this.prisma.storeIntegration.findFirst({
        where: whereClause,
      });

      if (!integration || !integration.storeId) {
        return { processed: false, reason: 'No active store integration' };
      }

      // Trigger full product sync asynchronously (runs in background)
      this.syncAllProducts(integration.storeId).catch(err => {
        this.logger.error(`[Pancake Webhook] Error in background product sync:`, err);
      });
      
      return { processed: true, action: 'background_sync_started', productId: productData.id };
    } catch (error) {
      this.logger.error(`[Pancake Webhook] Error handling product webhook:`, error);
      throw error;
    }
  }

  /**
   * Handle inventory webhook from Pancake
   */
  private async handleInventoryWebhook(inventoryData: any, shopId?: string) {
    this.logger.log(`[Pancake Webhook] Processing inventory update: ${inventoryData.variation_id || 'unknown'}`);

    try {
      const whereClause: any = { platform: 'PANCAKE', isActive: true };
      if (shopId) whereClause.shopId = shopId;

      const integration = await this.prisma.storeIntegration.findFirst({
        where: whereClause,
      });

      if (!integration || !integration.storeId) {
        return { processed: false, reason: 'No active store integration' };
      }

      // Trigger full product sync asynchronously to recalculate all stock
      this.syncAllProducts(integration.storeId).catch(err => {
        this.logger.error(`[Pancake Webhook] Error in background inventory sync:`, err);
      });
      
      return { processed: true, action: 'background_sync_started', variationId: inventoryData.variation_id };
    } catch (error) {
      this.logger.error(`[Pancake Webhook] Error processing inventory:`, error);
      throw error;
    }
  }

  /**
   * Configure webhook on Pancake
   */
  async configureWebhook(webhookUrl: string, webhookTypes: string[] = ['orders', 'customers'], storeId?: string) {
    const config = await this.getPancakeConfig(storeId);
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
  async getWebhookConfig(storeId?: string) {
    const config = await this.getPancakeConfig(storeId);
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
