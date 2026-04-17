import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import CheckoutClient from './CheckoutClient';
import { redirect } from 'next/navigation';

export default async function CheckoutPage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login?callbackUrl=/portal/checkout');
  }

  const searchParams = await props.searchParams;
  const productId = searchParams.productId;
  const quantity = parseInt(searchParams.quantity || '1', 10);
  const size = searchParams.size || null;
  const color = searchParams.color || null;

  if (!productId) {
    // Currently only supporting direct checkout, fallback to portal if no product info
    redirect('/portal/products');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id }
  });

  if (!user) redirect('/login');

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product || !product.isActive) {
    redirect('/portal/products');
  }

  const orderItem = {
    product,
    quantity,
    size,
    color,
    price: product.salePrice || product.originalPrice
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Thanh toán đơn hàng</h1>
        <CheckoutClient user={user} item={orderItem} />
      </div>
    </div>
  );
}
