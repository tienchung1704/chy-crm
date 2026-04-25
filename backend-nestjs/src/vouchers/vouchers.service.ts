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
    return this.prisma.voucher.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
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
    const QR_VOUCHER_AMOUNTS = [50000, 40000, 30000, 20000, 10000];
    const MAX_QR_CLAIMS = 5;
    const LOCK_DURATION_DAYS = 7;

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

    // If no voucherId, it's a gamification claim - calculate amount and find/create voucher
    if (!finalVoucherId) {
      const voucherAmount = QR_VOUCHER_AMOUNTS[userClaimCount] || QR_VOUCHER_AMOUNTS[QR_VOUCHER_AMOUNTS.length - 1];
      const voucherCode = `QR${voucherAmount / 1000}K`;

      let voucher = await this.prisma.voucher.findUnique({
        where: { code: voucherCode },
      });

      if (!voucher) {
        voucher = await this.prisma.voucher.create({
          data: {
            code: voucherCode,
            name: `Voucher QR ${voucherAmount.toLocaleString('vi-VN')}đ`,
            description: `Giảm ${voucherAmount.toLocaleString('vi-VN')}đ cho đơn hàng từ ${(voucherAmount * 2).toLocaleString('vi-VN')}đ`,
            campaignCategory: 'GAMIFICATION',
            type: 'FIXED_AMOUNT',
            value: voucherAmount,
            minOrderValue: voucherAmount * 2,
            perCustomerLimit: 1,
            isActive: true,
          },
        });
      }
      finalVoucherId = voucher.id;
    }

    // Check if voucher exists and is active
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: finalVoucherId },
    });

    if (!voucher || !voucher.isActive) {
      throw new NotFoundException('Voucher không tồn tại hoặc đã hết hạn');
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
    });

    if (welcomeVouchers.length === 0) {
      this.logger.log(`No welcome vouchers available for user ${userId}`);
      return;
    }

    // Grant each welcome voucher to the user
    for (const voucher of welcomeVouchers) {
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
    }

    this.logger.log(`✅ Granted ${welcomeVouchers.length} welcome vouchers to user ${userId}`);
  }
}
