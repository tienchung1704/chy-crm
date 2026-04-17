import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ProductDetailClient from '@/components/customer/ProductDetailClient';

export default async function ProductDetailPage(props: { 
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: {
      categories: { select: { id: true, name: true } },
      variants: { include: { size: true, color: true } },
    },
  });

  if (!product || !product.isActive) {
    notFound();
  }

  const session = await getSession();
  
  // Check if URL has referral code
  const refCode = searchParams.ref;
  
  // If user is logged in AND URL has ref parameter, redirect to clean URL
  // (Referral code only applies to new users, not existing logged-in users)
  if (session && refCode) {
    redirect(`/portal/products/${params.slug}`);
  }
  let wishlistIds: string[] = [];
  let userReferralCode = '';
  let userCompletedOrders: Array<{ orderId: string; size: string | null; color: string | null }> = [];

  if (session) {
    const [wishes, user, completedOrders] = await Promise.all([
      prisma.wishlist.findMany({
        where: { userId: session.id },
        select: { productId: true },
      }),
      prisma.user.findUnique({
        where: { id: session.id },
        select: { referralCode: true },
      }),
      // Get completed orders containing this product
      prisma.order.findMany({
        where: {
          userId: session.id,
          status: 'COMPLETED',
          items: {
            some: {
              productId: product.id,
            },
          },
        },
        select: {
          id: true,
          items: {
            where: {
              productId: product.id,
            },
            select: {
              size: true,
              color: true,
            },
          },
        },
      }),
    ]);
    wishlistIds = wishes.map((w: any) => w.productId);
    userReferralCode = user?.referralCode || '';
    
    // Map completed orders to the format needed by ReviewForm
    userCompletedOrders = completedOrders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        size: item.size,
        color: item.color,
      }))
    );
  }

  const relatedProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      categories: {
        some: { id: { in: product.categories.map((c: any) => c.id) } }
      }
    },
    take: 6,
    include: {
      categories: { select: { name: true } },
      variants: { include: { size: true, color: true } },
    }
  });

  return (
    <ProductDetailClient 
      product={product} 
      relatedProducts={relatedProducts}
      initialWishlistIds={wishlistIds}
      userReferralCode={userReferralCode}
      userCompletedOrders={userCompletedOrders}
    />
  );
}
