import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Cronjob API để verify QR vouchers sau 7 ngày
 * Gọi từ Vercel Cron hoặc cron-job.org
 * 
 * Bảo mật: Kiểm tra Authorization header hoặc Vercel Cron Secret
 */
export async function GET(req: NextRequest) {
  try {
    // Security check: Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find all PENDING vouchers that should be unlocked
    const pendingVouchers = await prisma.userVoucher.findMany({
      where: {
        status: 'PENDING',
        unlockAt: {
          lte: now,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        voucher: {
          select: {
            name: true,
            value: true,
          },
        },
      },
    });

    if (pendingVouchers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No vouchers to verify',
        processed: 0,
      });
    }

    const results = {
      activated: 0,
      rejected: 0,
      errors: 0,
    };

    // Process each voucher
    for (const userVoucher of pendingVouchers) {
      try {
        // Mock API call to shipping partner to verify order status
        // In production, replace with actual API call
        const orderStatus = await mockVerifyOrderStatus(userVoucher.sourceOrderCode!);

        if (orderStatus === 'COMPLETED' || orderStatus === 'DELIVERED') {
          // Activate voucher
          await prisma.userVoucher.update({
            where: { id: userVoucher.id },
            data: { status: 'ACTIVE' },
          });
          results.activated++;

          // TODO: Send notification to user
          console.log(`✅ Activated voucher for user ${userVoucher.user.name} - ${userVoucher.voucher.name}`);
        } else if (orderStatus === 'CANCELLED' || orderStatus === 'RETURNED') {
          // Reject and delete voucher to return claim slot
          await prisma.userVoucher.update({
            where: { id: userVoucher.id },
            data: { status: 'REJECTED' },
          });
          results.rejected++;

          console.log(`❌ Rejected voucher for user ${userVoucher.user.name} - Order ${orderStatus}`);
        } else {
          // Order still in transit, keep PENDING
          console.log(`⏳ Order ${userVoucher.sourceOrderCode} still in transit`);
        }
      } catch (error) {
        console.error(`Error processing voucher ${userVoucher.id}:`, error);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Voucher verification completed',
      processed: pendingVouchers.length,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Mock function to verify order status with shipping partner
 * Replace with actual API integration in production
 */
async function mockVerifyOrderStatus(orderCode: string): Promise<string> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock logic: 80% completed, 10% cancelled, 10% still in transit
  const random = Math.random();
  if (random < 0.8) return 'COMPLETED';
  if (random < 0.9) return 'CANCELLED';
  return 'IN_TRANSIT';
}
