import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

function generateOrderCode() {
  const prefix = 'ORD';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      items, // { productId, quantity, size, color }[]
      paymentMethod,
      name,
      phone,
      addressStreet,
      addressWard,
      addressProvince,
      note,
      voucherId,
      useCommissionPoints = false // Now a boolean
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Update user info
    await prisma.user.update({
      where: { id: session.id },
      data: {
        name: name || undefined,
        phone: phone || undefined,
        addressStreet,
        addressWard,
        addressDistrict: null, // CLEAR DISTRICT
        addressProvince,
      }
    });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Process items and calculate totals
    let subtotal = 0;
    const orderItemsToCreate = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: { include: { size: true, color: true } } }
      });

      if (!product || !product.isActive) {
        return NextResponse.json({ error: `Product unavailable` }, { status: 400 });
      }

      if (product.stockQuantity < item.quantity) {
        return NextResponse.json({ error: `Not enough stock for ${product.name}` }, { status: 400 });
      }

      let itemPrice = product.salePrice || product.originalPrice;

      // Decrement Variant Stock if variants are chosen
      if (item.size || item.color) {
        const matchingVariant = product.variants.find((v: any) => 
          (v.size?.name || null) === (item.size || null) && 
          (v.color?.name || null) === (item.color || null)
        );

        if (!matchingVariant || matchingVariant.stock < item.quantity) {
          return NextResponse.json({ error: `Phân loại ${item.size || ''} ${item.color || ''} cho ${product.name} không đủ số lượng` }, { status: 400 });
        }

        if (matchingVariant.price !== null && matchingVariant.price !== undefined) {
          itemPrice = matchingVariant.price;
        }

        await prisma.productVariant.update({
          where: { id: matchingVariant.id },
          data: { stock: { decrement: item.quantity } }
        });
      }

      // Decrement main product stock
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: { decrement: item.quantity } }
      });

      subtotal += itemPrice * item.quantity;
      orderItemsToCreate.push({
        productId: product.id,
        quantity: item.quantity,
        price: itemPrice,
        size: item.size || null,
        color: item.color || null
      });
    }

    // Handle discounts
    let discountAmount = 0;
    let appliedUserVoucherId: string | null = null;

    // Apply Voucher
    if (voucherId) {
      const targetVoucher = await prisma.voucher.findUnique({
        where: { id: voucherId }
      });

      if (targetVoucher && targetVoucher.isActive) {
        // Double check user limits
        const userUsedCount = await prisma.userVoucher.count({
          where: { userId: session.id, voucherId: voucherId, isUsed: true }
        });

        if (userUsedCount < targetVoucher.perCustomerLimit && subtotal >= targetVoucher.minOrderValue) {
          let voucherDiscount = targetVoucher.type === 'PERCENT'
            ? subtotal * (targetVoucher.value / 100)
            : targetVoucher.value;

          if (targetVoucher.maxDiscount && voucherDiscount > targetVoucher.maxDiscount) {
            voucherDiscount = targetVoucher.maxDiscount;
          }
          discountAmount += voucherDiscount;

          // Claim and mark used
          const newlyClaimed = await prisma.userVoucher.create({
            data: {
              userId: session.id,
              voucherId: targetVoucher.id,
              isUsed: true,
              usedAt: new Date()
            }
          });
          
          appliedUserVoucherId = newlyClaimed.id;
          
          // Increment global used count
          await prisma.voucher.update({
             where: { id: targetVoucher.id },
             data: { usedCount: { increment: 1 } }
          });
        }
      }
    }

    // Apply Commission Points (1 point = 1 VND roughly, assuming commissionBalance is in VND)
    let commissionDiscount = 0;
    if (useCommissionPoints && user.commissionBalance > 0) {
      const maxApplicable = Math.min(user.commissionBalance, Math.max(0, subtotal - discountAmount));
      if (maxApplicable > 0) {
        commissionDiscount = maxApplicable;
        discountAmount += commissionDiscount;
        await prisma.user.update({
          where: { id: user.id },
          data: { commissionBalance: { decrement: commissionDiscount } }
        });
      }
    }

    const shippingFee = 0; // Assuming free shipping for now
    let totalAmount = subtotal - discountAmount + shippingFee;
    if (totalAmount < 0) totalAmount = 0;

    // Create Order
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        orderCode: generateOrderCode(),
        subtotal,
        discountAmount,
        shippingFee,
        totalAmount,
        paymentMethod,
        paymentStatus: 'UNPAID',
        note,
        source: 'PORTAL_DIRECT',
        items: {
          create: orderItemsToCreate
        },
        ...(appliedUserVoucherId ? {
          appliedVouchers: {
            create: {
              userVoucherId: appliedUserVoucherId,
              discountApplied: discountAmount - commissionDiscount
            }
          }
        } : {})
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, orderCode: order.orderCode });
  } catch (error) {
    console.error('Create direct order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
