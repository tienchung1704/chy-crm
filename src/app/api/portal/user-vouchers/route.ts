import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();

    // Find all active global vouchers
    const activeVouchers = await prisma.voucher.findMany({
      where: {
        isActive: true,
        OR: [
          { validFrom: null },
          { validFrom: { lte: today } }
        ],
        AND: [
          {
            OR: [
              { validTo: null },
              { validTo: { gt: today } }
            ]
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get the user's used count for these vouchers
    const userUsedCounts = await prisma.userVoucher.groupBy({
      by: ['voucherId'],
      where: {
        userId: session.id,
        isUsed: true
      },
      _count: {
        isUsed: true
      }
    });

    const userUsedMap = new Map();
    userUsedCounts.forEach(c => userUsedMap.set(c.voucherId, c._count.isUsed));

    const availableVouchers = activeVouchers.filter(v => {
      // Check total limit
      if (v.totalUsageLimit !== null && v.usedCount >= v.totalUsageLimit) {
        return false;
      }
      
      // Check user limit (perCustomerLimit)
      const userUsed = userUsedMap.get(v.id) || 0;
      if (userUsed >= v.perCustomerLimit) {
        return false;
      }

      return true;
    });

    return NextResponse.json(availableVouchers);
  } catch (error) {
    console.error('Fetch vouchers error:', error);
    return NextResponse.json({ error: 'Failed to fetch vouchers' }, { status: 500 });
  }
}
