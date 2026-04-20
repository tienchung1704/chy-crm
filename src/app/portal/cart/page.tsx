import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import CartClient from './CartClient';

async function getCart(userId: string) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              originalPrice: true,
              salePrice: true,
              stockQuantity: true,
              isActive: true,
              storeId: true,
              store: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                originalPrice: true,
                salePrice: true,
                stockQuantity: true,
                isActive: true,
                storeId: true,
                store: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  return cart;
}

export default async function CartPage() {
  const session = await getSession();
  if (!session) return null;

  const cart = await getCart(session.id);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Giỏ hàng của bạn</h1>
          <p className="text-gray-600 text-sm">
            {cart.items.length} sản phẩm trong giỏ hàng
          </p>
        </div>

        <CartClient initialItems={cart.items} />
      </div>
    </div>
  );
}
