import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, color, probability, quantity, voucher } = body;

    // Update spin prize
    const updateData: any = {
      name,
      color,
      probability,
      quantity,
    };

    // Update voucher if provided
    if (voucher) {
      const prize = await prisma.spinPrize.findUnique({
        where: { id },
        select: { voucherId: true },
      });

      if (prize?.voucherId) {
        await prisma.voucher.update({
          where: { id: prize.voucherId },
          data: {
            code: voucher.code,
            name: voucher.name,
            description: voucher.description,
            type: voucher.type,
            value: voucher.value,
            minOrderValue: voucher.minOrderValue,
            maxDiscount: voucher.maxDiscount,
            perCustomerLimit: voucher.perCustomerLimit,
            durationDays: voucher.durationDays,
            isStackable: voucher.isStackable,
          },
        });
      }
    }

    const updated = await prisma.spinPrize.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, prize: updated });
  } catch (error) {
    console.error('Update spin prize error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi cập nhật giải thưởng' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get prize to check if it has a voucher
    const prize = await prisma.spinPrize.findUnique({
      where: { id },
      select: { voucherId: true },
    });

    // Delete spin prize
    await prisma.spinPrize.delete({
      where: { id },
    });

    // Delete associated voucher if exists
    if (prize?.voucherId) {
      await prisma.voucher.delete({
        where: { id: prize.voucherId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete spin prize error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi xóa giải thưởng' },
      { status: 500 }
    );
  }
}
