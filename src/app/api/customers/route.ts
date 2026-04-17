import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const rank = searchParams.get('rank') || '';
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') || 'desc';

  const where: Record<string, unknown> = { role: 'CUSTOMER' };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  if (rank) {
    where.rank = rank;
  }

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        dob: true,
        rank: true,
        totalSpent: true,
        commissionBalance: true,
        referralCode: true,
        createdAt: true,
        _count: { select: { orders: true, referees: true } },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, email, phone, gender, dob, address } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên là bắt buộc' }, { status: 400 });
    }

    // Generate referral code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let referralCode = '';
    for (let i = 0; i < 8; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const customer = await prisma.user.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        gender: gender || null,
        dob: dob ? new Date(dob) : null,
        address: address || null,
        referralCode,
        role: 'CUSTOMER',
      },
    });

    // Self closure entry
    await prisma.referralClosure.create({
      data: {
        ancestorId: customer.id,
        descendantId: customer.id,
        depth: 0,
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json({ error: 'Lỗi tạo khách hàng' }, { status: 500 });
  }
}
