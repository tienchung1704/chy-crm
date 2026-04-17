import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import PortalNavbar from '@/components/customer/PortalNavbar';
import FloatingCartButton from '@/components/customer/FloatingCartButton';
import Footer from '@/components/customer/Footer';
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
    select: { onboardingComplete: true },
  });

  // Redirect to onboarding if not completed (only for first-time users)
  if (user && !user.onboardingComplete) {
    redirect('/onboarding');
  }

  // Get cart item count
  const cartItemCount = await getCartItemCount(session.id);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalNavbar user={session} />
      <main className="flex-1 py-8">
        <div className="w-[80%] mx-auto">
          {children}
        </div>
      </main>
      <FloatingCartButton itemCount={cartItemCount} />
      <Footer />
    </div>
  );
}
