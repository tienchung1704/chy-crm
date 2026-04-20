import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import prisma from '@/lib/prisma';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (!['ADMIN', 'STAFF', 'MODERATOR'].includes(session.role)) {
    redirect('/portal');
  }

  // Block Moderator if their store is not yet approved
  if (session.role === 'MODERATOR') {
    const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
    if (!store || !store.isActive) {
      redirect('/portal/seller-register');
    }
  }

  // Fetch unread orders count and pending stores
  let unreadCount = 0;
  let pendingStoresCount = 0;
  
  if (session.role === 'ADMIN' || session.role === 'STAFF') {
    unreadCount = await prisma.order.count({
      where: { isRead: false }
    });
    
    // Only Admin/Staff can see pending stores
    pendingStoresCount = await prisma.store.count({
      where: { isActive: false, isBanned: false }
    });
  } else if (session.role === 'MODERATOR') {
    const store = await prisma.store.findUnique({ where: { ownerId: session.id } });
    if (store) {
      unreadCount = await prisma.order.count({
        where: { storeId: store.id, isRead: false }
      });
    }
  }

  return (
    <AdminShell 
      user={session} 
      unreadCount={unreadCount} 
      pendingStoresCount={pendingStoresCount}
    >
      {children}
    </AdminShell>
  );
}
