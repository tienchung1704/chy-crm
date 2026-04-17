import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserRankAndSpent } from '@/services/pancakeService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Pancake payload typically has the order structure directly or inside an event wrapper.
    // Check if it's an order creation/update
    const orderData = body.order || body;
    console.log(`[Pancake Webhook] Received payload for order: ${orderData.id}`);
    
    const phone = orderData.bill_phone_number || orderData.shipping_address?.phone_number;

    if (!phone) {
      return NextResponse.json({ message: 'No phone number, skipped' }, { status: 200 });
    }

    const orderId = orderData.id;
    if (!orderId) {
      return NextResponse.json({ message: 'No order ID, skipped' }, { status: 200 });
    }

    // Try to find a user with this phone
    const user = await prisma.user.findFirst({
      where: { phone: phone }
    });

    if (!user) {
      console.log(`[Pancake Webhook] User not found for phone: ${phone}. Order ${orderId} skipped.`);
      // If user doesn't exist, we don't save the order yet. 
      // When they sign up later on the CRM, the Onboarding sync will fetch it from Pancake!
      return NextResponse.json({ message: 'User not found, skipped for now' }, { status: 200 });
    }

    const orderCode = `PCK-${orderId}`;
    const existingOrder = await prisma.order.findUnique({
      where: { orderCode }
    });

    if (existingOrder) {
      console.log(`[Pancake Webhook] Order ${orderCode} already exists. Skipping.`);
      // Order already exists. If Pancake sends status updates, we could update it here.
      // For now, we only care about tracking points for completed orders once.
      return NextResponse.json({ message: 'Order already synced' }, { status: 200 });
    }

    // Calculate subtotal
    const subtotal = orderData.total_price || 0; 
    let itemSubtotal = 0;
    const items = orderData.items || [];
    for (const item of items) {
      const price = item.variation_info?.retail_price || 0;
      const amount = price * (item.quantity || 1);
      itemSubtotal += amount;
    }
    const finalSubtotal = subtotal > 0 ? subtotal : itemSubtotal;
    const totalAmount = finalSubtotal - (orderData.total_discount || 0) + (orderData.shipping_fee || 0);

    // Save order (without Product mapping as requested, we only store metadata for details)
    await prisma.order.create({
      data: {
        userId: user.id,
        orderCode: orderCode,
        source: 'PANCAKE',
        subtotal: finalSubtotal,
        discountAmount: orderData.total_discount || 0,
        shippingFee: orderData.shipping_fee || 0,
        totalAmount: totalAmount,
        status: orderData.status_name === 'Đã hủy' || orderData.status === 4 ? 'CANCELLED' : 'COMPLETED',
        paymentStatus: 'PAID',
        metadata: { items: orderData.items || [], fullData: orderData }
      }
    });

    // Update user spent & points if the order isn't strictly canceled
    if (totalAmount > 0 && orderData.status_name !== 'Đã hủy') {
      await updateUserRankAndSpent(user.id, totalAmount);
    }

    console.log(`[Pancake Webhook] Successfully synced order ${orderCode} for user ${user.id}`);

    return NextResponse.json({ success: true, message: 'Order synced via webhook' }, { status: 200 });
  } catch (error) {
    console.error('Pancake Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
