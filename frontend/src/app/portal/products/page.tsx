import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import ProductsClient from '@/components/customer/ProductsClient';

async function getProducts() {
  return prisma.product.findMany({
    where: { 
      isActive: true,
      OR: [
        { storeId: null },
        { store: { isActive: true, isBanned: false } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      originalPrice: true,
      salePrice: true,
      stockQuantity: true,
      soldCount: true,
      isComboSet: true,
      categories: { select: { name: true } },
      variants: { select: { price: true } },
      store: { select: { name: true, slug: true, logoUrl: true } },
    },
  });
}

async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, parentId: true },
  });
}

export default async function ProductsPage() {
  const session = await getSession();
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  let wishlistIds: string[] = [];
  let userReferralCode = '';

  if (session) {
    const [wishlists, user] = await Promise.all([
      prisma.wishlist.findMany({
        where: { userId: session.id },
        select: { productId: true },
      }),
      prisma.user.findUnique({
        where: { id: session.id },
        select: { referralCode: true },
      }),
    ]);
    wishlistIds = wishlists.map((w) => w.productId);
    userReferralCode = user?.referralCode || '';
  }

  return (
    <ProductsClient
      products={products}
      categories={categories}
      initialWishlistIds={wishlistIds}
      userReferralCode={userReferralCode}
    />
  );
}
