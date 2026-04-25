'use server';

import { apiClient } from '@/lib/apiClient';

interface ClaimResult {
  success: boolean;
  message: string;
  voucherAmount?: number;
  unlockDate?: string;
  claimCount?: number;
}

export async function claimQrRewardAction(orderCode: string, phone: string): Promise<ClaimResult> {
  try {
    const trimmedOrderCode = orderCode.trim().toUpperCase();
    const trimmedPhone = phone.trim();

    if (!trimmedOrderCode || trimmedOrderCode.length < 5) {
      return {
        success: false,
        message: 'Mã đơn hàng không hợp lệ',
      };
    }

    if (!trimmedPhone || trimmedPhone.length < 9) {
      return {
        success: false,
        message: 'Số điện thoại không hợp lệ',
      };
    }

    const result = await apiClient.post<any>('/vouchers/claim-qr', {
      orderCode: trimmedOrderCode,
      phone: trimmedPhone,
    });

    if (result.success) {
      return {
        success: true,
        message: result.message,
        voucherAmount: result.userVoucher?.voucher?.value,
        unlockDate: result.userVoucher?.unlockAt,
      };
    } else {
      return {
        success: false,
        message: result.message || 'Không thể nhận quà lúc này',
      };
    }
  } catch (error: any) {
    console.error('QR Claim Error:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
    };
  }
}
