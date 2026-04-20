import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/reviews?productId=xxx&rating=5&sort=newest&page=1&limit=10
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const rating = searchParams.get('rating');
    const sort = searchParams.get('sort') || 'newest';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Build where clause
    const where: any = { productId };
    if (rating && rating !== 'all') {
      where.rating = parseInt(rating);
    }

    // Build orderBy clause
    const orderBy: any = sort === 'oldest' 
      ? { createdAt: 'asc' } 
      : { createdAt: 'desc' };

    // Get reviews with pagination
    const [reviews, totalCount, stats] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
          product: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
      // Get statistics
      prisma.review.groupBy({
        by: ['rating'],
        where: { productId },
        _count: { rating: true },
      }),
    ]);

    // Calculate average rating and distribution
    const totalReviews = await prisma.review.count({ where: { productId } });
    const avgRating = totalReviews > 0
      ? await prisma.review.aggregate({
          where: { productId },
          _avg: { rating: true },
        })
      : { _avg: { rating: 0 } };

    const distribution = [1, 2, 3, 4, 5].map(star => {
      const found = stats.find(s => s.rating === star);
      return {
        rating: star,
        count: found ? found._count.rating : 0,
      };
    });

    // Get all images from reviews
    const allReviews = await prisma.review.findMany({
      where: { productId },
      select: { images: true },
    });
    
    const allImages: string[] = [];
    allReviews.forEach(review => {
      if (review.images && Array.isArray(review.images)) {
        allImages.push(...(review.images as string[]));
      }
    });

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      statistics: {
        averageRating: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(1)) : 0,
        totalReviews,
        distribution,
      },
      allImages: allImages.slice(0, 20), // Limit to 20 images for gallery
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST /api/reviews
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, orderId, rating, comment, images, size, color } = body;

    // Validate required fields
    if (!productId || !rating) {
      return NextResponse.json({ error: 'Product ID and rating are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Check if user has completed order with this product
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: session.id,
        status: 'COMPLETED',
        items: {
          some: {
            productId,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Bạn chỉ có thể đánh giá sản phẩm sau khi hoàn thành đơn hàng' },
        { status: 403 }
      );
    }

    // Check if review already exists for this user, product, and order
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: session.id,
        productId,
        orderId,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này' },
        { status: 409 }
      );
    }

    // Validate images
    if (images && Array.isArray(images) && images.length > 5) {
      return NextResponse.json({ error: 'Tối đa 5 ảnh' }, { status: 400 });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        userId: session.id,
        productId,
        orderId,
        rating,
        comment: comment || null,
        images: images || null,
        size: size || null,
        color: color || null,
        isVerifiedPurchase: true,
      },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
