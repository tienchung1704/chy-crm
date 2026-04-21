import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user has spin turns
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { spinTurns: true },
    });

    if (!user || user.spinTurns <= 0) {
      return NextResponse.json({ error: 'Bạn không còn lượt quay' }, { status: 400 });
    }

    // Get active prizes
    const prizes = await prisma.spinPrize.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { voucher: true },
    });

    if (prizes.length === 0) {
      return NextResponse.json({ error: 'Không có giải thưởng nào' }, { status: 400 });
    }

    // Weighted random selection based on probability
    const totalProb = prizes.reduce((sum, p) => sum + p.probability, 0);
    let random = Math.random() * totalProb;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
      random -= prize.probability;
      if (random <= 0) {
        selectedPrize = prize;
        break;
      }
    }

    // Check quantity limit
    if (selectedPrize.quantity !== null && selectedPrize.wonCount >= selectedPrize.quantity) {
      // Fallback to "nothing" prize or last prize
      const nothingPrize = prizes.find(p => p.type === 'NOTHING');
      if (nothingPrize) selectedPrize = nothingPrize;
    }

    const won = selectedPrize.type !== 'NOTHING';

    // Deduct spin turn
    await prisma.user.update({
      where: { id: session.id },
      data: { spinTurns: { decrement: 1 } },
    });

    // Record spin
    await prisma.spinHistory.create({
      data: {
        userId: session.id,
        prizeId: selectedPrize.id,
        won,
      },
    });

    // Update won count
    if (won) {
      await prisma.spinPrize.update({
        where: { id: selectedPrize.id },
        data: { wonCount: { increment: 1 } },
      });

      // Grant reward
      if (selectedPrize.type === 'POINTS' && selectedPrize.value) {
        await prisma.user.update({
          where: { id: session.id },
          data: { points: { increment: Math.floor(selectedPrize.value) } },
        });
      }

      if (selectedPrize.type === 'VOUCHER' && selectedPrize.voucherId && selectedPrize.voucher) {
        // Calculate expiration date based on voucher's durationDays
        const expiresAt = selectedPrize.voucher.durationDays
          ? new Date(Date.now() + selectedPrize.voucher.durationDays * 24 * 60 * 60 * 1000)
          : null;

        await prisma.userVoucher.create({
          data: {
            userId: session.id,
            voucherId: selectedPrize.voucherId,
            expiresAt,
          },
        });
      }
    }

    // Get remaining turns
    const updatedUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { spinTurns: true },
    });

    return NextResponse.json({
      success: true,
      prizeId: selectedPrize.id,
      prizeName: selectedPrize.name,
      prizeType: selectedPrize.type,
      won,
      remainingTurns: updatedUser?.spinTurns || 0,
    });
  } catch (error) {
    console.error('Spin error:', error);
    return NextResponse.json({ error: 'Lỗi quay' }, { status: 500 });
  }
}
