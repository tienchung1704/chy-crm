import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const { productId, quantity, size, color } = await req.json();

    if (!productId || !quantity) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    // Check if product exists and check stock
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Sản phẩm không có sẵn' }, { status: 404 });
    }

    if (product.stockQuantity < quantity) {
      return NextResponse.json({ error: 'Vượt quá số lượng tồn kho' }, { status: 400 });
    }

    // Get or create cart for user
    let cart = await prisma.cart.findUnique({
      where: { userId: session.id }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: session.id }
      });
    }

    // Find existing item with the SAME productId, size, and color
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        size: size || null,
        color: color || null,
      }
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stockQuantity < newQuantity) {
        return NextResponse.json({ error: 'Tổng giỏ hàng vượt quá tồn kho' }, { status: 400 });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity }
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          size: size || null,
          color: color || null,
        }
      });
    }

    return NextResponse.json({ success: true, message: 'Đã thêm vào giỏ hàng' });
  } catch (error) {
    console.error('Cart POST error:', error);
    return NextResponse.json(
      { error: 'Có lỗi xảy ra khi thêm vào giỏ hàng' },
      { status: 500 }
    );
  }
}
