import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF' && session.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
      take: 10,
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Error searching customers:', error);
    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
  }
}
