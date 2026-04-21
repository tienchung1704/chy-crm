import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const { productId, size, color, quantity } = await req.json();

    if (!productId || typeof quantity !== 'number' || quantity < 1) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true }
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Sản phẩm không còn kinh doanh' }, { status: 404 });
    }

    // Check variant stock if size or color is provided
    if (size || color) {
      const variant = product.variants.find((v: any) => 
        (size ? v.sizeId === size : true) && 
        (color ? v.colorId === color : true)
      );

      // If variant system uses names instead of IDs, we would need to join Size/Color. 
      // We will do a generic check via DB to be safe.
      const dbVariant = await prisma.productVariant.findFirst({
        where: {
          productId,
          ...(size ? { size: { name: size } } : {}),
          ...(color ? { color: { name: color } } : {}),
        }
      });

      if (!dbVariant || dbVariant.stock < quantity) {
        return NextResponse.json({ error: 'Phân loại sản phẩm này đã hết hàng' }, { status: 400 });
      }
    } else {
      // Check main product stock
      if (product.stockQuantity < quantity) {
        return NextResponse.json({ error: 'Sản phẩm đã hết hàng hạn mức' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, message: 'Đủ tồn kho' });
  } catch (error) {
    console.error('Check Stock error:', error);
    return NextResponse.json(
      { error: 'Lỗi kiểm tra tồn kho' },
      { status: 500 }
    );
  }
}
