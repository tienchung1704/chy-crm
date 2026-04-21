import { Injectable, Logger, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class VouchersService implements OnModuleInit {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('voucher-queue') private voucherQueue: Queue,
  ) {}

  async onModuleInit() {
    // Register repeatable job when module initializes (fallback for missed webhooks)
    await this.registerCronJob();
    this.logger.log('✅ Voucher verification cron job registered successfully (fallback mode)');
  }

  private async registerCronJob() {
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
    return this.prisma.voucher.findMany({
      where: {
        isActive: true,
        ...(storeId && { storeId }),
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

  async claimQRVoucher(userId: string, orderCode: string, voucherId: string) {
    // Check if order code already used
    const existingClaim = await this.prisma.userVoucher.findUnique({
      where: { sourceOrderCode: orderCode },
    });

    if (existingClaim) {
      throw new BadRequestException('Mã đơn hàng này đã được sử dụng để claim voucher');
    }

    // Check if voucher exists and is active
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher || !voucher.isActive) {
      throw new NotFoundException('Voucher không tồn tại hoặc đã hết hạn');
    }

    // Check usage limits
    if (voucher.totalUsageLimit && voucher.usedCount >= voucher.totalUsageLimit) {
      throw new BadRequestException('Voucher đã hết lượt sử dụng');
    }

    // Create user voucher with PENDING status
    const unlockAt = new Date();
    unlockAt.setDate(unlockAt.getDate() + 7); // 7 days from now

    const expiresAt = voucher.durationDays
      ? new Date(Date.now() + voucher.durationDays * 24 * 60 * 60 * 1000)
      : voucher.validTo;

    const userVoucher = await this.prisma.userVoucher.create({
      data: {
        userId,
        voucherId,
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
      `🎫 User ${userId} claimed voucher ${voucherId} with order ${orderCode}. Status: PENDING, unlock at: ${unlockAt}`,
    );

    return {
      success: true,
      message: 'Voucher đã được claim thành công. Sẽ được kích hoạt sau khi xác minh đơn hàng (tối đa 7 ngày).',
      userVoucher,
    };
  }

  async getUserVouchers(userId: string) {
    return this.prisma.userVoucher.findMany({
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
  }

  async manualTriggerVerification() {
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
}
