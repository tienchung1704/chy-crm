import prisma from './prisma';

/**
 * Grant welcome vouchers to a new user
 * Looks for vouchers with codes: new10, new15, new20
 * and creates UserVoucher entries for them
 */
export async function grantWelcomeVouchers(userId: string) {
  try {
    // Find welcome vouchers by code
    const welcomeVouchers = await prisma.voucher.findMany({
      where: {
        code: {
          in: ['new10', 'new15', 'new20'],
        },
        isActive: true,
        campaignCategory: 'WELCOME',
      },
    });

    if (welcomeVouchers.length === 0) {
      console.log('No welcome vouchers found');
      return;
    }

    // Create UserVoucher entries for each welcome voucher
    const userVouchers = welcomeVouchers.map(voucher => {
      // Calculate expiration date if durationDays is set
      let expiresAt: Date | null = null;
      if (voucher.durationDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + voucher.durationDays);
      } else if (voucher.validTo) {
        expiresAt = voucher.validTo;
      }

      return {
        userId,
        voucherId: voucher.id,
        isUsed: false,
        expiresAt,
      };
    });

    // Bulk create user vouchers
    await prisma.userVoucher.createMany({
      data: userVouchers,
      skipDuplicates: true, // Skip if user already has these vouchers
    });

    console.log(`Granted ${userVouchers.length} welcome vouchers to user ${userId}`);
  } catch (error) {
    console.error('Error granting welcome vouchers:', error);
    // Don't throw error - we don't want to fail user registration if voucher grant fails
  }
}
