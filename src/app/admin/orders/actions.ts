'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function markOrderAsRead(orderId: string) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { isRead: true },
    });
    
    // Revalidate the list and the layout (for the sidebar badge)
    revalidatePath('/admin/orders', 'page');
    revalidatePath('/admin', 'layout');
    
    return { success: true };
  } catch (error) {
    console.error('Failed to mark order as read:', error);
    return { success: false };
  }
}
