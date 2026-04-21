import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const configs = await prisma.commissionConfig.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Get commission config error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi lấy cấu hình' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { level, percentage } = body;

    // Upsert commission config
    const config = await prisma.commissionConfig.upsert({
      where: { level },
      create: {
        level,
        percentage,
        isActive: true,
      },
      update: {
        percentage,
      },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Update commission config error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi cập nhật cấu hình' },
      { status: 500 }
    );
  }
}
