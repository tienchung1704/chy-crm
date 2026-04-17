import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import OrderList from './OrderList';

export default async function PortalOrdersPage() {
  const session = await getSession();
  if (!session) return null;

  const orders = await prisma.order.findMany({
    where: { userId: session.id },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Đơn hàng của tôi</h1>
        <p className="text-gray-600 text-sm">Theo dõi lịch sử mua sắm và quà tặng</p>
      </div>

      <OrderList orders={orders} />
    </>
  );
}
