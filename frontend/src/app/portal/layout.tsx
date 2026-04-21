import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Rank } from '@prisma/client';
import PortalNavbar from '@/components/customer/PortalNavbar';
import FloatingCartButton from '@/components/customer/FloatingCartButton';
import Footer from '@/components/customer/Footer';
import QrClaimModal from '@/components/customer/QrClaimModal';
import prisma from '@/lib/prisma';

async function getCartItemCount(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        select: { quantity: true },
      },
    },
  });

  if (!cart) return 0;
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'ADMIN' || session.role === 'STAFF') redirect('/admin');

  // Check if user has completed onboarding
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { onboardingComplete: true, rank: true },
  });

  // Redirect to onboarding if not completed (only for first-time users)
  if (user && !user.onboardingComplete) {
    redirect('/onboarding');
  }

  // Calculate 30 days ago
  const now = new Date();
  const vietnamOffset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const offsetDiff = vietnamOffset + localOffset;
  const thirtyDaysAgo = new Date(now.getTime() + offsetDiff * 60 * 1000);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  // Get total spent in last 30 days
  const spentLast30Days = await prisma.order.aggregate({
    where: {
      userId: session.id,
      status: 'COMPLETED',
      createdAt: { gte: thirtyDaysAgo },
    },
    _sum: { totalAmount: true },
  });

  const spentInLast30Days = spentLast30Days._sum.totalAmount || 0;

  const rankProgress: Record<string, { next: Rank | 'MAX', target: number }> = {
    MEMBER: { next: 'SILVER', target: 2000000 },
    SILVER: { next: 'GOLD', target: 5000000 },
    GOLD: { next: 'DIAMOND', target: 7000000 },
    DIAMOND: { next: 'PLATINUM', target: 10000000 },
    PLATINUM: { next: 'MAX', target: 0 },
  };

  let effectiveRank: Rank = user?.rank || session.rank || 'MEMBER';
  let progress = rankProgress[effectiveRank];
  while (progress && progress.target > 0 && spentInLast30Days >= progress.target) {
    if (progress.next !== 'MAX') {
      effectiveRank = progress.next as Rank;
      progress = rankProgress[effectiveRank];
    } else {
      break;
    }
  }

  const enrichedSession = { ...session, rank: effectiveRank };

  // Get cart item count
  const cartItemCount = await getCartItemCount(session.id);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalNavbar user={enrichedSession} />
      <main className="flex-1 py-8">
        <div className="w-[80%] mx-auto">
          {children}
        </div>
      </main>
      <FloatingCartButton itemCount={cartItemCount} />
      <Footer />
      <QrClaimModal />
    </div>
  );
}
