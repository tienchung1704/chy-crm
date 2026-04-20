import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !['ADMIN', 'STAFF', 'MODERATOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let resolvedStoreId = null;
    if (payload.role === 'MODERATOR') {
      const store = await prisma.store.findUnique({ where: { ownerId: payload.userId } });
      if (!store) {
        return NextResponse.json({ error: 'Bạn cần mở một cửa hàng trước khi tạo sản phẩm' }, { status: 403 });
      }
      resolvedStoreId = store.id;
    }

    const body = await req.json();
    const {
      name,
      slug,
      sku,
      description,
      originalPrice,
      salePrice,
      stockQuantity,
      weight,
      imageUrl,
      categoryIds,
      isComboSet,
      isGiftItem,
      isActive,
      variants, // expected [{ sizeId?, colorId?, price?, stock }]
    } = body;

    // Check if slug already exists
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json({ error: 'Slug đã tồn tại' }, { status: 400 });
    }

    // Check if SKU already exists (if provided)
    if (sku) {
      const existingSku = await prisma.product.findUnique({ where: { sku } });
      if (existingSku) {
        return NextResponse.json({ error: 'SKU đã tồn tại' }, { status: 400 });
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        sku: sku || null,
        description: description || null,
        originalPrice,
        salePrice: salePrice || null,
        stockQuantity: stockQuantity || 0,
        weight: weight || 500,
        imageUrl: imageUrl || null,
        storeId: resolvedStoreId,
        isComboSet: isComboSet || false,
        isGiftItem: isGiftItem || false,
        isActive: isActive !== false,
        categories: categoryIds?.length
          ? { connect: categoryIds.map((id: string) => ({ id })) }
          : undefined,
        variants: variants?.length
          ? { create: variants.map((v: any) => ({
              sizeId: v.sizeId || null,
              colorId: v.colorId || null,
              price: v.price ? parseFloat(v.price) : null,
              stock: parseInt(v.stock) || 0
            })) }
          : undefined,
      },
      include: {
        categories: true,
        variants: { include: { size: true, color: true } },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Lỗi tạo sản phẩm' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    const payload = token ? verifyToken(token) : null;
    
    let whereClause = {};

    if (payload?.role === 'MODERATOR') {
      const store = await prisma.store.findUnique({ where: { ownerId: payload.userId } });
      if (store) {
        whereClause = { storeId: store.id };
      } else {
        // If they are moderator but haven't created store, show nothing
        whereClause = { id: 'no-store' }; 
      }
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        categories: { select: { id: true, name: true } },
        variants: { include: { size: true, color: true } },
        _count: { select: { orderItems: true } },
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { error: 'Lỗi lấy danh sách sản phẩm' },
      { status: 500 }
    );
  }
}
