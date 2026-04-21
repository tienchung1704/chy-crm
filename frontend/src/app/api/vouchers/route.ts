import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || !['ADMIN', 'STAFF', 'MODERATOR'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let whereClause = {};
  if (session.role === 'MODERATOR') {
    const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
    if (store) {
      whereClause = { storeId: store.id };
    } else {
      whereClause = { id: 'no-store' };
    }
  }

  const vouchers = await prisma.voucher.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { userVouchers: true } },
    },
  });

  return NextResponse.json({ vouchers });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['ADMIN', 'MODERATOR'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let storeId = null;
    if (session.role === 'MODERATOR') {
      const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
      if (!store) {
         return NextResponse.json({ error: 'Bạn cần mở một cửa hàng trước khi tạo voucher' }, { status: 403 });
      }
      storeId = store.id;
    }

    const body = await req.json();
    const {
      code, name, description, campaignCategory, type,
      value, minOrderValue, maxDiscount,
      totalUsageLimit, perCustomerLimit, durationDays,
      validFrom, validTo, isStackable,
    } = body;

    if (!code || !name || value === undefined) {
      return NextResponse.json(
        { error: 'Mã, tên và giá trị voucher là bắt buộc' },
        { status: 400 }
      );
    }

    // Check duplicate code
    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: 'Mã voucher đã tồn tại' },
        { status: 400 }
      );
    }

    const voucher = await prisma.voucher.create({
      data: {
        code,
        name,
        description: description || null,
        campaignCategory: campaignCategory || 'WELCOME',
        type: type || 'PERCENT',
        value: parseFloat(value),
        minOrderValue: parseFloat(minOrderValue) || 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        totalUsageLimit: totalUsageLimit ? parseInt(totalUsageLimit) : null,
        perCustomerLimit: parseInt(perCustomerLimit) || 1,
        durationDays: durationDays ? parseInt(durationDays) : null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        isStackable: isStackable || false,
        storeId,
      },
    });

    return NextResponse.json({ success: true, voucher });
  } catch (error) {
    console.error('Create voucher error:', error);
    return NextResponse.json({ error: 'Lỗi tạo voucher' }, { status: 500 });
  }
}
