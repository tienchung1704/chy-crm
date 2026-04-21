import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommissionsService {
  constructor(private prisma: PrismaService) {}

  async calculateCommissions(order: any) {
    try {
      // Get commission configs
      const commissionConfigs = await this.prisma.commissionConfig.findMany({
        where: { isActive: true },
        orderBy: { level: 'asc' },
      });

      if (commissionConfigs.length === 0) return;

      // Get referral chain (ancestors) from ReferralClosure
      const ancestors = await this.prisma.referralClosure.findMany({
        where: {
          descendantId: order.userId,
          depth: { gt: 0 }, // Don't include the user themselves
        },
        orderBy: { depth: 'asc' },
        include: {
          ancestor: {
            select: {
              id: true,
              name: true,
              commissionBalance: true,
            },
          },
        },
      });

      // Calculate commission for each level
      for (const ancestor of ancestors) {
        const config = commissionConfigs.find((c) => c.level === ancestor.depth);
        if (!config) continue;

        const commissionAmount = (order.totalAmount * config.percentage) / 100;

        // Create commission record
        await this.prisma.commissionLedger.create({
          data: {
            userId: ancestor.ancestorId,
            orderId: order.id,
            fromUserId: order.userId,
            level: ancestor.depth,
            percentage: config.percentage,
            amount: commissionAmount,
            status: 'APPROVED', // Auto-approve when order is completed
          },
        });

        // Update commission balance
        await this.prisma.user.update({
          where: { id: ancestor.ancestorId },
          data: {
            commissionBalance: {
              increment: commissionAmount,
            },
          },
        });
      }
    } catch (error) {
      console.error('Error calculating commissions:', error);
      // Don't throw error to avoid affecting order update
    }
  }

  async cancelCommissions(orderId: string) {
    try {
      // Get all commissions for this order
      const commissions = await this.prisma.commissionLedger.findMany({
        where: {
          orderId,
          status: { not: 'CANCELLED' },
        },
      });

      // Cancel each commission record and deduct money
      for (const commission of commissions) {
        // Update commission status to CANCELLED
        await this.prisma.commissionLedger.update({
          where: { id: commission.id },
          data: {
            status: 'CANCELLED',
            reversedAt: new Date(),
          },
        });

        // Deduct commission from recipient
        await this.prisma.user.update({
          where: { id: commission.userId },
          data: {
            commissionBalance: {
              decrement: commission.amount,
            },
          },
        });
      }
    } catch (error) {
      console.error('Error cancelling commissions:', error);
    }
  }
}
