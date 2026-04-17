import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, type, color, probability, quantity, voucher } = body;

    // Validate required fields
    if (!name || !type || probability === undefined) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      );
    }

    // Validate probability
    if (probability < 0 || probability > 1) {
      return NextResponse.json(
        { error: 'Xác suất phải từ 0 đến 1' },
        { status: 400 }
      );
    }

    // Create voucher template first
    const voucherRecord = await prisma.voucher.create({
      data: {
        code: voucher.code,
        name: voucher.name,
        description: voucher.description || null,
        campaignCategory: voucher.campaignCategory || 'GAMIFICATION',
        type: voucher.type,
        value: voucher.value,
        minOrderValue: voucher.minOrderValue || 0,
        maxDiscount: voucher.maxDiscount || null,
        totalUsageLimit: null, // No limit for spin vouchers
        perCustomerLimit: voucher.perCustomerLimit || 1,
        durationDays: voucher.durationDays || 30,
        isStackable: voucher.isStackable || false,
        isActive: true,
      },
    });

    // Get current max sortOrder
    const maxSortOrder = await prisma.spinPrize.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    // Create spin prize linked to voucher
    const spinPrize = await prisma.spinPrize.create({
      data: {
        name,
        type,
        color: color || '#6366f1',
        probability,
        quantity: quantity || null,
        voucherId: voucherRecord.id,
        value: voucher.value,
        isActive: true,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
      },
      include: {
        voucher: true,
      },
    });

    return NextResponse.json(spinPrize, { status: 201 });
  } catch (error) {
    console.error('Error creating spin prize:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Mã voucher đã tồn tại' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Lỗi tạo giải thưởng' },
      { status: 500 }
    );
  }
}
