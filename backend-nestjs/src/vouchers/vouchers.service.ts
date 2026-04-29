import { Injectable, Logger, OnModuleInit, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class VouchersService implements OnModuleInit {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue('voucher-queue') private voucherQueue?: Queue,
  ) {}

  async onModuleInit() {
    // Only register cron job if queue is available
    if (this.voucherQueue) {
      await this.registerCronJob();
      this.logger.log('✅ Voucher verification cron job registered successfully (fallback mode)');
    } else {
      this.logger.warn('⚠️  Voucher queue not available - background verification disabled');
    }
  }

  private async registerCronJob() {
    if (!this.voucherQueue) return;

    // Remove any existing repeatable jobs with the same name
    const repeatableJobs = await this.voucherQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'verify-qr-vouchers-job') {
        await this.voucherQueue.removeRepeatableByKey(job.key);
      }
    }

    // Add new repeatable job - runs at 00:00 every day (fallback for missed webhooks)
    await this.voucherQueue.add(
      'verify-qr-vouchers-job',
      {},
      {
        repeat: {
          pattern: '0 0 * * *', // Cron pattern: 00:00 daily
        },
        jobId: 'verify-qr-vouchers-job',
      },
    );

    this.logger.log('📅 Fallback cron job scheduled: verify-qr-vouchers-job at 00:00 daily');
  }

  async findAll(storeId?: string) {
    const now = new Date();
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        campaignCategory: { not: 'GAMIFICATION' },
        ...(storeId && { storeId }),
        OR: [
          { validTo: null },
          { validTo: { gt: now } },
        ],
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            userVouchers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter out vouchers that have reached their total usage limit
    return vouchers.filter(v => {
      if (v.totalUsageLimit !== null && v._count.userVouchers >= v.totalUsageLimit) {
        return false;
      }
      return true;
    }).map(v => {
      const { _count, ...rest } = v;
      return rest;
    });
  }

  async findOne(id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    return voucher;
  }

  async claimQRVoucher(userId: string, orderCode: string, phone: string, voucherId?: string) {
    const MAX_QR_CLAIMS = 5;
    
    // Get lock duration from system config, fallback to 7 days
    const sysConfig = await this.prisma.systemConfig.findUnique({
      where: { key: 'qr_voucher_default' },
    });
    const sysConfigData = sysConfig?.value as any;
    const LOCK_DURATION_DAYS = sysConfigData?.lockDurationDays || 7;

    // Normalize phone: remove spaces, dashes
    const normalizedPhone = phone.replace(/[\s\-]/g, '');

    // Check if order code already used
    const existingClaim = await this.prisma.userVoucher.findUnique({
      where: { sourceOrderCode: orderCode },
    });

    if (existingClaim) {
      throw new BadRequestException('Mã đơn hàng này đã được sử dụng để nhận quà');
    }

    // --- VERIFY ORDER EXISTS AND STATUS ---
    // Try to find order by orderCode (internal CRM orders)
    let order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderCode: orderCode },
          // Also check in metadata for external tracking codes (ViettelPost, Pancake)
          { metadata: { path: '$.trackingNumber', equals: orderCode } },
        ],
      },
      select: {
        id: true,
        status: true,
        shippingPhone: true,
        userId: true,
        user: {
          select: { phone: true },
        },
      },
    });

    // If no order found by orderCode, try searching in metadata as string contains
    if (!order) {
      order = await this.prisma.order.findFirst({
        where: {
          metadata: { string_contains: orderCode },
        },
        select: {
          id: true,
          status: true,
          shippingPhone: true,
          userId: true,
          user: {
            select: { phone: true },
          },
        },
      });
    }

    if (!order) {
      throw new BadRequestException('Không tìm thấy đơn hàng với mã này. Vui lòng kiểm tra lại.');
    }

    // Verify phone number matches
    const orderPhone = (order.shippingPhone || order.user?.phone || '').replace(/[\s\-]/g, '');
    if (!orderPhone || !normalizedPhone.endsWith(orderPhone.slice(-9)) && !orderPhone.endsWith(normalizedPhone.slice(-9))) {
      throw new BadRequestException('Số điện thoại không khớp với đơn hàng. Vui lòng nhập đúng SĐT đặt hàng.');
    }

    // Check order status - only allow for delivered/completed orders
    const ALLOWED_STATUSES = ['DELIVERED', 'PAYMENT_COLLECTED', 'COMPLETED'];
    if (!ALLOWED_STATUSES.includes(order.status)) {
      const statusMessages: Record<string, string> = {
        PENDING: 'Đơn hàng đang chờ xử lý',
        CONFIRMED: 'Đơn hàng đã xác nhận nhưng chưa giao',
        PACKAGING: 'Đơn hàng đang đóng gói',
        WAITING_FOR_SHIPPING: 'Đơn hàng đang chờ vận chuyển',
        SHIPPED: 'Đơn hàng đang được giao, vui lòng chờ nhận hàng',
        CANCELLED: 'Đơn hàng đã bị hủy',
        REFUNDED: 'Đơn hàng đã hoàn trả',
      };
      const msg = statusMessages[order.status] || `Trạng thái đơn hàng: ${order.status}`;
      throw new BadRequestException(`Chưa thể nhận voucher. ${msg}. Bạn cần nhận hàng thành công trước khi nhận quà.`);
    }

    // Check user claim count for gamification
    const userClaimCount = await this.prisma.userVoucher.count({
      where: {
        userId,
        sourceOrderCode: { not: null },
      },
    });

    if (userClaimCount >= MAX_QR_CLAIMS) {
      throw new BadRequestException(`Bạn đã hết lượt nhận quà (tối đa ${MAX_QR_CLAIMS} lần)`);
    }

    let finalVoucherId = voucherId;

    // If no voucherId provided, determine which voucher to use
    if (!finalVoucherId) {
      // Priority 1: Check for order-specific voucher created by admin
      const orderVoucher = await this.prisma.voucher.findUnique({
        where: { code: `QR-ORDER-${orderCode}` },
      });

      if (orderVoucher && orderVoucher.isActive) {
        finalVoucherId = orderVoucher.id;
      } else {
        // Priority 2 & 3: Use system config values array for gamification tiers
        const config = await this.prisma.systemConfig.findUnique({
          where: { key: 'qr_voucher_default' },
        });
        const configData = config?.value as any;

        // Ensure we have an array of values (support both new 'values' array and old 'value' fallback)
        let configValues = [50000, 40000, 30000, 20000, 10000]; // Absolute fallback
        if (configData?.values && Array.isArray(configData.values) && configData.values.length > 0) {
          configValues = configData.values;
        } else if (configData?.value) {
          configValues = [configData.value];
        }

        const configMinOrder = configData?.minOrderValue || 0;
        
        // Determine amount based on claim count (if count exceeds array, use the last value)
        const voucherAmount = configValues[userClaimCount] || configValues[configValues.length - 1];
        const voucherCode = `QR-DEFAULT-${voucherAmount}`;

        let defaultVoucher = await this.prisma.voucher.findUnique({
          where: { code: voucherCode },
        });

        if (!defaultVoucher) {
          defaultVoucher = await this.prisma.voucher.create({
            data: {
              code: voucherCode,
              name: `Voucher QR ${voucherAmount.toLocaleString('vi-VN')}đ`,
              description: `Giảm ${voucherAmount.toLocaleString('vi-VN')}đ cho đơn hàng từ ${configMinOrder.toLocaleString('vi-VN')}đ`,
              campaignCategory: 'GAMIFICATION',
              type: 'FIXED_AMOUNT',
              value: voucherAmount,
              minOrderValue: configMinOrder,
              perCustomerLimit: 1,
              isActive: true,
            },
          });
        }
        finalVoucherId = defaultVoucher.id;


      }
    }

    // Check if voucher exists and is active
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: finalVoucherId },
      include: {
        _count: {
          select: { userVouchers: true },
        },
      },
    });

    if (!voucher || !voucher.isActive) {
      throw new NotFoundException('Voucher không tồn tại hoặc đã hết hạn');
    }

    if (voucher.totalUsageLimit !== null && voucher._count.userVouchers >= voucher.totalUsageLimit) {
      throw new BadRequestException('Voucher này đã hết số lượng phát hành');
    }

    // Create user voucher with PENDING status
    const unlockAt = new Date();
    unlockAt.setDate(unlockAt.getDate() + LOCK_DURATION_DAYS);

    const expiresAt = voucher.durationDays
      ? new Date(Date.now() + voucher.durationDays * 24 * 60 * 60 * 1000)
      : voucher.validTo || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const userVoucher = await this.prisma.userVoucher.create({
      data: {
        userId,
        voucherId: finalVoucherId,
        sourceOrderCode: orderCode,
        unlockAt,
        expiresAt,
        status: 'PENDING',
        isUsed: false,
      },
      include: {
        voucher: true,
      },
    });

    this.logger.log(
      `🎫 User ${userId} claimed voucher ${finalVoucherId} with order ${orderCode}. Status: PENDING, unlock at: ${unlockAt}`,
    );

    return {
      success: true,
      message: `Chúc mừng! Bạn đã nhận được voucher ${voucher.value.toLocaleString('vi-VN')}đ. Voucher sẽ khả dụng sau ${LOCK_DURATION_DAYS} ngày.`,
      userVoucher,
    };
  }

  /**
   * Create a dedicated voucher for a specific order (Admin only)
   */
  async createOrderVoucher(data: {
    orderId: string; 
    name?: string;
    type?: 'FIXED_AMOUNT' | 'PERCENT';
    value?: number; 
    maxDiscount?: number;
    minOrderValue?: number;
    durationDays?: number;
  }) {
    const { orderId, name, type, value, maxDiscount, minOrderValue, durationDays } = data;

    // Find the order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderCode: true, totalAmount: true, storeId: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // Check if this order already has a dedicated voucher
    const existingVoucher = await this.prisma.voucher.findUnique({
      where: { code: `QR-ORDER-${order.orderCode}` },
    });

    if (existingVoucher) {
      throw new BadRequestException('Đơn hàng này đã có voucher riêng rồi');
    }

    // Get default config if value not provided
    let voucherValue = value;
    let voucherMinOrder = minOrderValue;

    if (voucherValue === undefined) {
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: 'qr_voucher_default' },
      });
      const configData = config?.value as any;
      voucherValue = configData?.value || 50000;
      voucherMinOrder = voucherMinOrder ?? configData?.minOrderValue ?? 0;
    }

    const voucherType = type || 'FIXED_AMOUNT';
    const voucherName = name || `Voucher QR đơn #${order.orderCode}`;

    // Create the voucher (GAMIFICATION category so it won't show in user-facing lists)
    const voucher = await this.prisma.voucher.create({
      data: {
        code: `QR-ORDER-${order.orderCode}`,
        name: voucherName,
        description: `Voucher riêng dành cho đơn hàng #${order.orderCode}`,
        campaignCategory: 'GAMIFICATION',
        type: voucherType,
        value: voucherValue,
        maxDiscount: maxDiscount || null,
        minOrderValue: voucherMinOrder || 0,
        durationDays: durationDays || null,
        perCustomerLimit: 1,
        totalUsageLimit: 1,
        isActive: true,
        storeId: order.storeId || null,
      },
    });

    this.logger.log(
      `🎟️ Created order-specific voucher ${voucher.code} (${voucherValue}) for order #${order.orderCode}`,
    );

    return {
      success: true,
      message: `Đã tạo voucher ${voucherValue.toLocaleString('vi-VN')}${voucherType === 'PERCENT' ? '%' : 'đ'} cho đơn hàng #${order.orderCode}`,
      voucher,
    };
  }

  /**
   * Get voucher info for a specific order
   */
  async getOrderVoucher(orderCode: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: `QR-ORDER-${orderCode}` },
    });

    return { exists: !!voucher, voucher: voucher || null };
  }

  async getUserVouchers(userId: string) {
    const now = new Date();
    const vouchers = await this.prisma.userVoucher.findMany({
      where: { userId },
      include: {
        voucher: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mark PENDING vouchers that have passed their unlock date as ACTIVE
    for (const uv of vouchers) {
      if (uv.status === 'PENDING' && uv.unlockAt && new Date(uv.unlockAt) <= now) {
        await this.prisma.userVoucher.update({
          where: { id: uv.id },
          data: { status: 'ACTIVE' },
        });
        uv.status = 'ACTIVE';
      }
    }

    return vouchers;
  }

  async manualTriggerVerification() {
    if (!this.voucherQueue) {
      this.logger.warn('⚠️  Queue not available - cannot trigger manual verification');
      throw new BadRequestException('Queue service not available. Redis is required for background jobs.');
    }

    // Add a one-time job to the queue
    const job = await this.voucherQueue.add('verify-qr-vouchers-job', {
      manual: true,
    });

    this.logger.log(`🔧 Manual verification triggered. Job ID: ${job.id}`);

    return {
      success: true,
      message: 'Verification job has been queued',
      jobId: job.id,
    };
  }

  /**
   * Helper: get storeId for a MODERATOR user
   */
  private async getStoreIdForUser(user: any): Promise<string | null> {
    if (!user || user.role !== 'MODERATOR') return null;
    const store = await this.prisma.store.findUnique({
      where: { ownerId: user.id },
      select: { id: true },
    });
    return store?.id || null;
  }

  async findAllAdmin(excludeGamification: boolean = false, user?: any) {
    let storeFilter: any = {};

    if (user?.role === 'MODERATOR') {
      const storeId = await this.getStoreIdForUser(user);
      if (!storeId) return [];
      storeFilter = { storeId };
    }

    return this.prisma.voucher.findMany({
      where: {
        ...storeFilter,
        ...(excludeGamification && { campaignCategory: { not: 'GAMIFICATION' } }),
      },
      include: {
        _count: {
          select: {
            userVouchers: true,
          },
        },
        store: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(data: any, user?: any) {
    const formattedData = { ...data };
    
    if (formattedData.validFrom === '') formattedData.validFrom = null;
    if (formattedData.validTo === '') formattedData.validTo = null;
    
    if (formattedData.validFrom) formattedData.validFrom = new Date(formattedData.validFrom);
    if (formattedData.validTo) formattedData.validTo = new Date(formattedData.validTo);

    // Auto-assign storeId for MODERATOR
    if (user?.role === 'MODERATOR' && !formattedData.storeId) {
      const storeId = await this.getStoreIdForUser(user);
      if (storeId) formattedData.storeId = storeId;
    }

    return this.prisma.voucher.create({
      data: {
        ...formattedData,
        isActive: formattedData.isActive !== undefined ? formattedData.isActive : true,
      },
    });
  }

  async update(id: string, data: any, user?: any) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    // MODERATOR can only update their own store's vouchers
    if (user?.role === 'MODERATOR') {
      const storeId = await this.getStoreIdForUser(user);
      if (voucher.storeId !== storeId) {
        throw new NotFoundException('Voucher not found');
      }
    }

    const formattedData = { ...data };
    
    if (formattedData.validFrom === '') formattedData.validFrom = null;
    if (formattedData.validTo === '') formattedData.validTo = null;
    
    if (formattedData.validFrom) formattedData.validFrom = new Date(formattedData.validFrom);
    if (formattedData.validTo) formattedData.validTo = new Date(formattedData.validTo);

    return this.prisma.voucher.update({
      where: { id },
      data: formattedData,
    });
  }

  async remove(id: string, user?: any) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    // MODERATOR can only delete their own store's vouchers
    if (user?.role === 'MODERATOR') {
      const storeId = await this.getStoreIdForUser(user);
      if (voucher.storeId !== storeId) {
        throw new NotFoundException('Voucher not found');
      }
    }

    // Hard delete if it is already inactive
    if (!voucher.isActive) {
      await this.prisma.userVoucher.deleteMany({
        where: { voucherId: id },
      });
      return this.prisma.voucher.delete({
        where: { id },
      });
    }

    // Instead of deleting, we might want to just deactivate if it has user claims
    const claimsCount = await this.prisma.userVoucher.count({
      where: { voucherId: id },
    });

    if (claimsCount > 0) {
      return this.prisma.voucher.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.voucher.delete({
      where: { id },
    });
  }

  async grantWelcomeVouchers(userId: string) {
    // Find all active welcome vouchers
    const welcomeVouchers = await this.prisma.voucher.findMany({
      where: {
        campaignCategory: 'WELCOME',
        isActive: true,
      },
      include: {
        _count: {
          select: { userVouchers: true },
        },
      },
    });

    if (welcomeVouchers.length === 0) {
      this.logger.log(`No welcome vouchers available for user ${userId}`);
      return;
    }

    let grantedCount = 0;
    // Grant each welcome voucher to the user
    for (const voucher of welcomeVouchers) {
      if (voucher.totalUsageLimit !== null && voucher._count.userVouchers >= voucher.totalUsageLimit) {
        continue; // Skip if limit reached
      }

      const expiresAt = voucher.durationDays
        ? new Date(Date.now() + voucher.durationDays * 24 * 60 * 60 * 1000)
        : voucher.validTo || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await this.prisma.userVoucher.create({
        data: {
          userId,
          voucherId: voucher.id,
          expiresAt,
          status: 'ACTIVE',
          isUsed: false,
        },
      });
      grantedCount++;
    }

    if (grantedCount > 0) {
      this.logger.log(`✅ Granted ${grantedCount} welcome vouchers to user ${userId}`);
    }
  }
}
