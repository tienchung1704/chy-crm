import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF' && session.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query } },
          { sku: { contains: query } },
        ],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        originalPrice: true,
        salePrice: true,
        stockQuantity: true,
        variants: {
          select: {
            id: true,
            sizeId: true,
            colorId: true,
            price: true,
            stock: true,
            size: {
              select: {
                name: true,
              },
            },
            color: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: 10,
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}
