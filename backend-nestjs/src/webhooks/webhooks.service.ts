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

  async validateWebhookToken(
    token: string,
    signature: string,
    payload: ViettelPostWebhookDto,
  ): Promise<boolean> {
    const expectedToken = process.env.VIETTELPOST_WEBHOOK_TOKEN;

    if (token) {
      const storeIntegration = await this.prisma.storeIntegration.findFirst({
        where: { platform: 'VIETTELPOST', isActive: true, accessToken: token }
      });
      if (storeIntegration) {
        return true;
      }
    }

    // If no token configured, log warning but allow (for development)
    if (!expectedToken) {
      this.logger.warn('⚠️ VIETTELPOST_WEBHOOK_TOKEN not configured and no store integration matched');
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
    const { ORDER_NUMBER, ORDER_STATUS, STATUS_NAME, ORDER_STATUSDATE, NOTE, LOCALION_CURRENTLY, LOCATION_CURRENTLY, MONEY_COLLECTION } = payload.DATA;

    this.logger.log(
      `🔍 Processing order ${ORDER_NUMBER} with status ${ORDER_STATUS} (${STATUS_NAME})`,
    );

    // ── 1. Update the Order record ──
    await this.updateOrderFromWebhook(payload);

    // ── 2. Handle voucher logic (existing behavior) ──
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
      this.logger.log(
        `ℹ️ No voucher found for order ${ORDER_NUMBER}. Skipping voucher logic.`,
      );
      return {
        action: 'order_updated',
        voucherAction: 'skipped',
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
          `ℹ️ Status ${ORDER_STATUS} does not require voucher action. Keeping current state.`,
        );
        return {
          action: 'order_updated',
          voucherAction: 'no_action',
          status: ORDER_STATUS,
        };
    }
  }

  /**
   * Find the Order by tracking code and update its status + metadata
   */
  private async updateOrderFromWebhook(payload: ViettelPostWebhookDto) {
    const { ORDER_NUMBER, ORDER_STATUS, STATUS_NAME, ORDER_STATUSDATE, NOTE, LOCALION_CURRENTLY, LOCATION_CURRENTLY, MONEY_COLLECTION } = payload.DATA;

    // Find order by tracking code in metadata OR by orderCode
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { orderCode: ORDER_NUMBER },
          {
            metadata: {
              path: '$.partner.trackingCode',
              equals: ORDER_NUMBER,
            },
          },
        ],
      },
    });

    if (orders.length === 0) {
      this.logger.warn(`⚠️ No order found for tracking code ${ORDER_NUMBER}. Skipping order update.`);
      return;
    }

    for (const order of orders) {
      // Map ViettelPost status code to our OrderStatus enum
      const newOrderStatus = this.mapVtpStatusToOrderStatus(ORDER_STATUS);
      const location = LOCATION_CURRENTLY || LOCALION_CURRENTLY || '';

      // Build courier update entry
      const courierUpdate = {
        status: STATUS_NAME || `VTP-${ORDER_STATUS}`,
        key: `VTP_${ORDER_STATUS}`,
        note: [NOTE, location].filter(Boolean).join(' - ') || null,
        update_at: ORDER_STATUSDATE || new Date().toISOString(),
      };

      // Get existing metadata
      const existingMeta = (order.metadata as any) || {};
      const existingPartner = existingMeta.partner || {};
      const existingUpdates: any[] = existingPartner.courierUpdates || [];

      // Avoid duplicate updates (same status + same timestamp)
      const isDuplicate = existingUpdates.some(
        (u: any) => u.key === courierUpdate.key && u.update_at === courierUpdate.update_at,
      );

      if (isDuplicate) {
        this.logger.log(`ℹ️ Duplicate webhook for order ${order.orderCode}, skipping metadata update.`);
        continue;
      }

      // Build update data
      const updateData: any = {
        metadata: {
          ...existingMeta,
          partner: {
            ...existingPartner,
            trackingCode: existingPartner.trackingCode || ORDER_NUMBER,
            courierUpdates: [...existingUpdates, courierUpdate],
            ...(MONEY_COLLECTION !== undefined ? { cod: MONEY_COLLECTION } : {}),
          },
        },
      };

      // Update order status if we have a valid mapping
      if (newOrderStatus) {
        updateData.status = newOrderStatus;
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: updateData,
      });

      this.logger.log(
        `✅ Order ${order.orderCode} updated: status → ${newOrderStatus || '(unchanged)'}, courier update added`,
      );
    }
  }

  /**
   * Map ViettelPost status codes to our OrderStatus enum
   */
  private mapVtpStatusToOrderStatus(vtpStatus: number): string | null {
    // ViettelPost status codes reference
    switch (vtpStatus) {
      // Picking up
      case 100: // Đơn hàng mới tạo
      case 101: // Chờ lấy hàng
        return null; // Keep current status

      case 102: // Đã lấy hàng
      case 200: // Đang vận chuyển
      case 201: // Đang vận chuyển
      case 300: // Đang giao hàng
      case 301: // Đang giao hàng
        return 'SHIPPED';

      case 501: // Đã giao hàng thành công
      case 515: // Đã ký nhận
        return 'DELIVERED';

      case 500: // Đã thu tiền (COD)
      case 505: // Đã đối soát
        return 'PAYMENT_COLLECTED';

      case 502: // Đang hoàn hàng
      case 510: // Đang hoàn hàng
        return 'RETURNING';

      case 503: // Đã hoàn hàng
      case 504: // Hủy đơn
      case 107: // Hủy đơn hàng
        return 'CANCELLED';

      default:
        return null; // Unknown status, don't change
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
    const { ORDER_NUMBER } = payload.DATA;

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
    const { ORDER_NUMBER, STATUS_NAME } = payload.DATA;

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
        `❌ Voucher ${userVoucher.id} REJECTED due to order status: ${STATUS_NAME} (Order: ${ORDER_NUMBER})`,
      );

      // TODO: Send notification to user about rejected voucher
      // await this.notificationService.sendVoucherRejected(userVoucher.userId, ...);

      return {
        action: 'rejected',
        userVoucherId: userVoucher.id,
        reason: STATUS_NAME,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to reject voucher: ${error.message}`);
      throw error;
    }
  }

  private async activateVoucherImmediately(userVoucher: any, payload: ViettelPostWebhookDto) {
    const { ORDER_NUMBER } = payload.DATA;

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
