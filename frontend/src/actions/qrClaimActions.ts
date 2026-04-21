'use server';

import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

const QR_VOUCHER_AMOUNTS = [50000, 40000, 30000, 20000, 10000];
const MAX_QR_CLAIMS = 5;
const LOCK_DURATION_DAYS = 7;

interface ClaimResult {
  success: boolean;
  message: string;
  voucherAmount?: number;
  unlockDate?: string;
  claimCount?: number;
}

export async function claimQrRewardAction(orderCode: string): Promise<ClaimResult> {
  try {
    // 1. Validate Auth
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      return {
        success: false,
        message: 'Vui lòng đăng nhập để nhận quà',
      };
    }

    const payload = await verifyAccessToken(token);
    if (!payload?.userId) {
      return {
        success: false,
        message: 'Phiên đăng nhập không hợp lệ',
      };
    }

    const userId = payload.userId;

    // 2. Validate Order Code format
    const trimmedOrderCode = orderCode.trim().toUpperCase();
    if (!trimmedOrderCode || trimmedOrderCode.length < 5) {
      return {
        success: false,
        message: 'Mã đơn hàng không hợp lệ',
      };
    }

    // 3. Check if order code already used
    const existingClaim = await prisma.userVoucher.findUnique({
      where: { sourceOrderCode: trimmedOrderCode },
    });

    if (existingClaim) {
      return {
        success: false,
        message: 'Mã đơn hàng này đã được sử dụng để nhận quà',
      };
    }

    // 4. Check user claim limit
    const userClaimCount = await prisma.userVoucher.count({
      where: {
        userId,
        sourceOrderCode: { not: null },
      },
    });

    if (userClaimCount >= MAX_QR_CLAIMS) {
      return {
        success: false,
        message: `Bạn đã hết lượt nhận quà (tối đa ${MAX_QR_CLAIMS} lần)`,
      };
    }

    // 5. Calculate reward amount (decreasing)
    const voucherAmount = QR_VOUCHER_AMOUNTS[userClaimCount] || QR_VOUCHER_AMOUNTS[QR_VOUCHER_AMOUNTS.length - 1];

    // 6. Find or create voucher template for this amount
    const voucherCode = `QR${voucherAmount / 1000}K`;
    let voucher = await prisma.voucher.findUnique({
      where: { code: voucherCode },
    });

    if (!voucher) {
      // Create voucher template if not exists
      voucher = await prisma.voucher.create({
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

    // 7. Calculate unlock date (7 days from now)
    const unlockAt = new Date();
    unlockAt.setDate(unlockAt.getDate() + LOCK_DURATION_DAYS);

    // 8. Create UserVoucher with PENDING status
    const userVoucher = await prisma.userVoucher.create({
      data: {
        userId,
        voucherId: voucher.id,
        sourceOrderCode: trimmedOrderCode,
        status: 'PENDING',
        unlockAt,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days validity
      },
    });

    return {
      success: true,
      message: `Chúc mừng! Bạn nhận được voucher ${voucherAmount.toLocaleString('vi-VN')}đ. Voucher sẽ khả dụng sau ${LOCK_DURATION_DAYS} ngày.`,
      voucherAmount,
      unlockDate: unlockAt.toISOString(),
      claimCount: userClaimCount + 1,
    };
  } catch (error) {
    console.error('QR Claim Error:', error);
    return {
      success: false,
      message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
    };
  }
}
