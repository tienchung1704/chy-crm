import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      name,
      slug,
      sku,
      description,
      originalPrice,
      salePrice,
      stockQuantity,
      imageUrl,
      categoryIds,
      isComboSet,
      isGiftItem,
      isActive,
      variants, // expected [{ sizeId?, colorId?, price?, stock }]
    } = body;

    // Check if slug is taken by another product
    const existingSlug = await prisma.product.findFirst({
      where: { slug, NOT: { id } },
    });
    if (existingSlug) {
      return NextResponse.json({ error: 'Slug đã tồn tại' }, { status: 400 });
    }

    // Check if SKU is taken by another product (if provided)
    if (sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku, NOT: { id } },
      });
      if (existingSku) {
        return NextResponse.json({ error: 'SKU đã tồn tại' }, { status: 400 });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        slug,
        sku: sku || null,
        description: description || null,
        originalPrice,
        salePrice: salePrice || null,
        stockQuantity: stockQuantity || 0,
        imageUrl: imageUrl || null,
        isComboSet: isComboSet || false,
        isGiftItem: isGiftItem || false,
        isActive: isActive !== false,
        categories: {
          set: [], // Clear existing
          connect: categoryIds?.length
            ? categoryIds.map((catId: string) => ({ id: catId }))
            : [],
        },
        variants: {
          deleteMany: {},
          ...(variants?.length ? {
            create: variants.map((v: any) => ({
              sizeId: v.sizeId || null,
              colorId: v.colorId || null,
              price: v.price ? parseFloat(v.price) : null,
              stock: parseInt(v.stock) || 0
            }))
          } : {}),
        },
      },
      include: {
        categories: true,
        variants: { include: { size: true, color: true } },
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Lỗi cập nhật sản phẩm' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get('crm_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if product is used in orders
    const orderItems = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItems > 0) {
      return NextResponse.json(
        { error: 'Không thể xóa sản phẩm đã có trong đơn hàng' },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Lỗi xóa sản phẩm' },
      { status: 500 }
    );
  }
}
