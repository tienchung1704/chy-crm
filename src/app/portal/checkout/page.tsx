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
  const cartMode = searchParams.cartMode === 'true';

  const user = await prisma.user.findUnique({
    where: { id: session.id }
  });
  if (!user) redirect('/login');

  if (cartMode) {
    // Cart mode: checkout multiple items from cart
    const itemIds = (searchParams.items || '').split(',').filter(Boolean);
    const storeId = searchParams.storeId || null;

    if (itemIds.length === 0) redirect('/portal/cart');

    // Fetch cart items with products
    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: itemIds },
        cart: { userId: session.id },
      },
      include: {
        product: {
          include: {
            store: { select: { id: true, name: true, addressStreet: true, addressWard: true, addressProvince: true } },
          },
        },
      },
    });

    if (cartItems.length === 0) redirect('/portal/cart');

    // Validate all items belong to the same store
    const storeIds = new Set(cartItems.map(ci => ci.product.storeId || '__system__'));
    if (storeIds.size > 1) {
      redirect('/portal/cart'); // Can't mix stores
    }

    const orderItems = cartItems.map(ci => ({
      cartItemId: ci.id,
      product: ci.product,
      quantity: ci.quantity,
      size: null as string | null,
      color: null as string | null,
      price: ci.product.salePrice || ci.product.originalPrice,
    }));

    const store = cartItems[0]?.product.store || null;

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Thanh toán đơn hàng</h1>
          <CheckoutClient user={user} items={orderItems} store={store} cartMode={true} />
        </div>
      </div>
    );
  }

  // Single product mode (Buy Now)
  const productId = searchParams.productId;
  const quantity = parseInt(searchParams.quantity || '1', 10);
  const size = searchParams.size || null;
  const color = searchParams.color || null;

  if (!productId) {
    redirect('/portal/products');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      store: { select: { id: true, name: true, addressStreet: true, addressWard: true, addressProvince: true } },
    },
  });

  if (!product || !product.isActive) {
    redirect('/portal/products');
  }

  const orderItems = [{
    product,
    quantity,
    size,
    color,
    price: product.salePrice || product.originalPrice,
  }];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Thanh toán đơn hàng</h1>
        <CheckoutClient user={user} items={orderItems} store={product.store} cartMode={false} />
      </div>
    </div>
  );
}
