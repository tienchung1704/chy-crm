import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SpinService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user's spin attempts
   */
  async getUserSpinAttempts(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        spinTurns: true,
      },
    });

    return {
      spinAttempts: user?.spinTurns || 0,
    };
  }

  /**
   * Spin the wheel
   */
  async spin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        spinTurns: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.spinTurns <= 0) {
      throw new ForbiddenException('Bạn đã hết lượt quay');
    }

    // Define prizes with probabilities
    const prizes = [
      { type: 'VOUCHER', value: 50000, probability: 0.05, name: 'Voucher 50K' },
      { type: 'VOUCHER', value: 20000, probability: 0.10, name: 'Voucher 20K' },
      { type: 'VOUCHER', value: 10000, probability: 0.15, name: 'Voucher 10K' },
      { type: 'POINTS', value: 100, probability: 0.20, name: '100 Điểm' },
      { type: 'POINTS', value: 50, probability: 0.25, name: '50 Điểm' },
      { type: 'NONE', value: 0, probability: 0.25, name: 'Chúc bạn may mắn lần sau' },
    ];

    // Random selection based on probability
    const random = Math.random();
    let cumulativeProbability = 0;
    let selectedPrize = prizes[prizes.length - 1]; // Default to last prize

    for (const prize of prizes) {
      cumulativeProbability += prize.probability;
      if (random <= cumulativeProbability) {
        selectedPrize = prize;
        break;
      }
    }

    // Decrease spin attempts
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        spinTurns: user.spinTurns - 1,
      },
    });

    // Apply prize
    if (selectedPrize.type === 'VOUCHER' && selectedPrize.value > 0) {
      // Create a voucher for the user
      const voucher = await this.prisma.voucher.create({
        data: {
          code: `SPIN-${Date.now()}-${userId.slice(0, 6)}`,
          name: `Voucher ${selectedPrize.value}đ từ vòng quay`,
          type: 'FIXED_AMOUNT',
          value: selectedPrize.value,
          minOrderValue: 0,
          perCustomerLimit: 1,
          totalUsageLimit: 1,
          validFrom: new Date(),
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          campaignCategory: 'GAMIFICATION',
        },
      });

      // Create user voucher
      await this.prisma.userVoucher.create({
        data: {
          userId,
          voucherId: voucher.id,
        },
      });

      return {
        prize: selectedPrize,
        voucherCode: voucher.code,
        message: `Chúc mừng! Bạn nhận được voucher ${selectedPrize.value}đ`,
      };
    } else if (selectedPrize.type === 'POINTS' && selectedPrize.value > 0) {
      // Add points to user
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          points: { increment: selectedPrize.value },
        },
      });

      return {
        prize: selectedPrize,
        message: `Chúc mừng! Bạn nhận được ${selectedPrize.value} điểm`,
      };
    }

    return {
      prize: selectedPrize,
      message: selectedPrize.name,
    };
  }

  /**
   * Add spin attempts to user (Admin only)
   */
  async addSpinAttempts(userId: string, attempts: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        spinTurns: { increment: attempts },
      },
    });
  }
}
