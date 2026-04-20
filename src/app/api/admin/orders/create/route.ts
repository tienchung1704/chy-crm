import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

interface OrderItemInput {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  size: string | null;
  color: string | null;
}

interface CreateOrderRequest {
  userId: string;
  items: OrderItemInput[];
  shippingName: string;
  shippingPhone: string;
  shippingStreet?: string;
  shippingWard?: string;
  shippingProvince?: string;
  customerNote?: string;
  adminNote?: string;
  shippingFee: number;
  discountAmount: number;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateOrderRequest = await req.json();

    // Validate required fields
    if (!body.userId || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      );
    }

    if (!body.shippingName || !body.shippingPhone) {
      return NextResponse.json(
        { error: 'Thiếu thông tin giao hàng' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Không tìm thấy khách hàng' },
        { status: 404 }
      );
    }

    // Verify all products exist
    const productIds = body.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, storeId: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Một số sản phẩm không tồn tại' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = body.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const totalAmount = subtotal + body.shippingFee - body.discountAmount;

    // Generate unique order code
    const orderCode = await generateOrderCode();

    // Determine store (if all products from same store)
    const storeIds = [...new Set(products.map((p) => p.storeId).filter(Boolean))];
    const storeId = storeIds.length === 1 ? storeIds[0] : null;

    // Create order with items
    const order = await prisma.order.create({
      data: {
        userId: body.userId,
        orderCode,
        source: 'ADMIN_MANUAL',
        shippingName: body.shippingName,
        shippingPhone: body.shippingPhone,
        shippingStreet: body.shippingStreet || null,
        shippingWard: body.shippingWard || null,
        shippingProvince: body.shippingProvince || null,
        subtotal,
        discountAmount: body.discountAmount,
        shippingFee: body.shippingFee,
        totalAmount,
        status: 'PENDING',
        paymentMethod: 'COD',
        paymentStatus: 'UNPAID',
        note: body.adminNote || null,
        customerNote: body.customerNote || null,
        storeId,
        isRead: false,
        items: {
          create: body.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            size: item.size,
            color: item.color,
            isGift: false,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, imageUrl: true },
            },
          },
        },
        user: {
          select: { name: true, phone: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Có lỗi xảy ra khi tạo đơn hàng' },
      { status: 500 }
    );
  }
}

async function generateOrderCode(): Promise<string> {
  const prefix = 'ORD';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  const code = `${prefix}-${timestamp}${random}`;

  // Check if code already exists (very unlikely)
  const existing = await prisma.order.findUnique({
    where: { orderCode: code },
  });

  if (existing) {
    // Recursively generate new code
    return generateOrderCode();
  }

  return code;
}
