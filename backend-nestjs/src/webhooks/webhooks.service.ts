import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ViettelPostWebhookDto } from './dto/viettelpost-webhook.dto';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue('voucher-queue') private voucherQueue?: Queue,
  ) {}

  validateWebhookToken(
    token: string,
    signature: string,
    payload: ViettelPostWebhookDto,
  ): boolean {
    const expectedToken = process.env.VIETTELPOST_WEBHOOK_TOKEN;

    // If no token configured, log warning but allow (for development)
    if (!expectedToken) {
      this.logger.warn('⚠️ VIETTELPOST_WEBHOOK_TOKEN not configured');
      return true; // Allow in development
    }

    // Simple token validation
    if (token !== expectedToken) {
      return false;
    }

    // Optional: Validate signature if ViettelPost provides one
    if (signature && process.env.VIETTELPOST_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.VIETTELPOST_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      return signature === expectedSignature;
    }

    return true;
  }

  async processViettelPostWebhook(payload: ViettelPostWebhookDto) {
    const { ORDER_NUMBER, ORDER_STATUS, ORDER_STATUS_NAME } = payload;

    this.logger.log(
      `🔍 Processing order ${ORDER_NUMBER} with status ${ORDER_STATUS} (${ORDER_STATUS_NAME})`,
    );

    // Find UserVoucher associated with this order
    const userVoucher = await this.prisma.userVoucher.findUnique({
      where: { sourceOrderCode: ORDER_NUMBER },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        voucher: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!userVoucher) {
      this.logger.warn(
        `⚠️ No voucher found for order ${ORDER_NUMBER}. Skipping...`,
      );
      return {
        action: 'skipped',
        reason: 'No voucher associated with this order',
      };
    }

    // Map ViettelPost status to action
    const action = this.mapStatusToAction(ORDER_STATUS);

    switch (action) {
      case 'SCHEDULE_UNLOCK':
        return await this.scheduleVoucherUnlock(userVoucher, payload);

      case 'REJECT_IMMEDIATELY':
        return await this.rejectVoucherImmediately(userVoucher, payload);

      case 'ACTIVATE_IMMEDIATELY':
        return await this.activateVoucherImmediately(userVoucher, payload);

      default:
        this.logger.log(
          `ℹ️ Status ${ORDER_STATUS} does not require action. Keeping current state.`,
        );
        return {
          action: 'no_action',
          status: ORDER_STATUS,
        };
    }
  }

  private mapStatusToAction(
    status: number,
  ): 'SCHEDULE_UNLOCK' | 'REJECT_IMMEDIATELY' | 'ACTIVATE_IMMEDIATELY' | 'NO_ACTION' {
    // ViettelPost status codes mapping
    // Reference: https://partner2.viettelpost.vn/document/webhook
    
    switch (status) {
      // Delivered successfully - Schedule unlock after 7 days
      case 501: // Đã giao hàng
      case 515: // Đã ký nhận
        return 'SCHEDULE_UNLOCK';

      // Returned/Cancelled - Reject immediately
      case 502: // Hoàn trả
      case 503: // Hủy đơn
      case 504: // Đã hủy
      case 107: // Hủy đơn hàng
      case 550: // Không liên hệ được người nhận
        return 'REJECT_IMMEDIATELY';

      // Other statuses - No action needed
      default:
        return 'NO_ACTION';
    }
  }

  private async scheduleVoucherUnlock(userVoucher: any, payload: ViettelPostWebhookDto) {
    const { ORDER_NUMBER } = payload;

    // Check if queue is available
    if (!this.voucherQueue) {
      this.logger.warn('⚠️  Queue not available - cannot schedule voucher unlock. Activating immediately instead.');
      return await this.activateVoucherImmediately(userVoucher, payload);
    }

    // Check if voucher is still in PENDING state
    if (userVoucher.status !== 'PENDING') {
      this.logger.warn(
        `⚠️ Voucher ${userVoucher.id} is not PENDING (current: ${userVoucher.status}). Skipping schedule.`,
      );
      return {
        action: 'skipped',
        reason: `Voucher already in ${userVoucher.status} state`,
      };
    }

    // Create a delayed job to unlock voucher after 7 days
    const jobId = `unlock-voucher-${userVoucher.id}`;
    const unlockDate = new Date(Date.now() + this.SEVEN_DAYS_MS);

    try {
      // Remove existing job if any (idempotency)
      const existingJob = await this.voucherQueue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
        this.logger.log(`🗑️ Removed existing job ${jobId}`);
      }

      // Add new delayed job
      const job = await this.voucherQueue.add(
        'unlock-voucher-task',
        {
          userVoucherId: userVoucher.id,
          orderCode: ORDER_NUMBER,
          userId: userVoucher.userId,
          voucherCode: userVoucher.voucher.code,
          scheduledAt: new Date().toISOString(),
        },
        {
          jobId,
          delay: this.SEVEN_DAYS_MS,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
          },
        },
      );

      this.logger.log(
        `⏰ Scheduled voucher unlock for ${userVoucher.id} at ${unlockDate.toISOString()} (Job ID: ${job.id})`,
      );

      // Update unlockAt timestamp in database
      await this.prisma.userVoucher.update({
        where: { id: userVoucher.id },
        data: { unlockAt: unlockDate },
      });

      return {
        action: 'scheduled',
        jobId: job.id,
        unlockAt: unlockDate,
        userVoucherId: userVoucher.id,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to schedule unlock: ${error.message}`);
      throw error;
    }
  }

  private async rejectVoucherImmediately(userVoucher: any, payload: ViettelPostWebhookDto) {
    const { ORDER_NUMBER, ORDER_STATUS_NAME } = payload;

    try {
      // Cancel any pending unlock jobs
      const jobId = `unlock-voucher-${userVoucher.id}`;
      const existingJob = await this.voucherQueue.getJob(jobId);
      
      if (existingJob) {
        await existingJob.remove();
        this.logger.log(`🗑️ Cancelled pending unlock job ${jobId}`);
      }

      // Update voucher status to REJECTED
      await this.prisma.userVoucher.update({
        where: { id: userVoucher.id },
        data: {
          status: 'REJECTED',
        },
      });

      this.logger.log(
        `❌ Voucher ${userVoucher.id} REJECTED due to order status: ${ORDER_STATUS_NAME} (Order: ${ORDER_NUMBER})`,
      );

      // TODO: Send notification to user about rejected voucher
      // await this.notificationService.sendVoucherRejected(userVoucher.userId, ...);

      return {
        action: 'rejected',
        userVoucherId: userVoucher.id,
        reason: ORDER_STATUS_NAME,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to reject voucher: ${error.message}`);
      throw error;
    }
  }

  private async activateVoucherImmediately(userVoucher: any, payload: ViettelPostWebhookDto) {
    const { ORDER_NUMBER } = payload;

    try {
      // Update voucher status to ACTIVE
      await this.prisma.userVoucher.update({
        where: { id: userVoucher.id },
        data: {
          status: 'ACTIVE',
        },
      });

      this.logger.log(
        `✅ Voucher ${userVoucher.id} ACTIVATED immediately (Order: ${ORDER_NUMBER})`,
      );

      // TODO: Send notification to user about activated voucher
      // await this.notificationService.sendVoucherActivated(userVoucher.userId, ...);

      return {
        action: 'activated',
        userVoucherId: userVoucher.id,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to activate voucher: ${error.message}`);
      throw error;
    }
  }
}
