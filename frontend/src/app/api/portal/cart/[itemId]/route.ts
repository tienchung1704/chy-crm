import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(req: NextRequest, props: { params: Promise<{ itemId: string }> }) {
  try {
    const params = await props.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const { quantity } = await req.json();
    
    if (typeof quantity !== 'number' || quantity < 1) {
      return NextResponse.json({ error: 'Số lượng không hợp lệ' }, { status: 400 });
    }

    // Ensure the item belongs to the user's cart
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: params.itemId },
      include: {
        cart: true,
        product: true
      }
    });

    if (!cartItem) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm trong giỏ' }, { status: 404 });
    }

    if (cartItem.cart.userId !== session.id) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Check stock for the quantity update
    if (cartItem.product.stockQuantity < quantity) {
      return NextResponse.json({ error: 'Số lượng vượt quá tồn kho' }, { status: 400 });
    }

    await prisma.cartItem.update({
      where: { id: params.itemId },
      data: { quantity }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cart Item PUT error:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ itemId: string }> }) {
  try {
    const params = await props.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: params.itemId },
      include: { cart: true }
    });

    if (!cartItem) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm trong giỏ' }, { status: 404 });
    }

    if (cartItem.cart.userId !== session.id) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    await prisma.cartItem.delete({
      where: { id: params.itemId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cart Item DELETE error:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
