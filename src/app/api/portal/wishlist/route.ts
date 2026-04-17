import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: Return all wishlisted product IDs for the current user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wishlists = await prisma.wishlist.findMany({
    where: { userId: session.id },
    select: { productId: true },
  });

  return NextResponse.json({
    productIds: wishlists.map((w) => w.productId),
  });
}

// POST: Toggle wishlist (add/remove)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { productId } = await req.json();
  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });
  }

  // Check if already wishlisted
  const existing = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId: session.id,
        productId,
      },
    },
  });

  if (existing) {
    // Remove from wishlist
    await prisma.wishlist.delete({ where: { id: existing.id } });
    return NextResponse.json({ action: 'removed', productId });
  } else {
    // Add to wishlist
    await prisma.wishlist.create({
      data: {
        userId: session.id,
        productId,
      },
    });
    return NextResponse.json({ action: 'added', productId });
  }
}
