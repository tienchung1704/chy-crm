import { prisma } from '@/lib/prisma';

/**
 * Recalculates the user's rank and points based on their current totalSpent.
 */
export async function updateUserRank(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Fetch all rank configurations sorted by highest spend threshold first
  const dbRanks = await prisma.rankConfig.findMany({
    orderBy: { minTotalSpent: 'desc' }
  });

  let newRank = user.rank;
  for (const rankConf of dbRanks) {
    if (user.totalSpent >= rankConf.minTotalSpent) {
      newRank = rankConf.rank as any;
      break;
    }
  }

  // Update if rank changed or we want to sync points
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      rank: newRank,
      points: Math.floor(user.totalSpent / 10000)
    }
  });

  return updatedUser;
}
