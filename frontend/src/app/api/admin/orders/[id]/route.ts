import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { updateUserRank } from '@/services/userService';

// Hàm hủy hoa hồng khi đơn hàng bị hủy/hoàn trả
async function cancelCommissions(orderId: string) {
  try {
    // Lấy tất cả hoa hồng của đơn hàng này
    const commissions = await prisma.commissionLedger.findMany({
      where: {
        orderId,
        status: { not: 'CANCELLED' },
      },
    });

    // Hủy từng bản ghi hoa hồng và trừ tiền
    for (const commission of commissions) {
      // Cập nhật trạng thái hoa hồng thành CANCELLED
      await prisma.commissionLedger.update({
        where: { id: commission.id },
        data: {
          status: 'CANCELLED',
          reversedAt: new Date(),
        },
      });

      // Trừ tiền hoa hồng từ người nhận
      await prisma.user.update({
        where: { id: commission.userId },
        data: {
          commissionBalance: {
            decrement: commission.amount,
          },
        },
      });
    }
  } catch (error) {
    console.error('Error cancelling commissions:', error);
  }
}

// Hàm tính hoa hồng cho người giới thiệu
async function calculateAndCreateCommissions(order: any) {
  try {
    // Lấy cấu hình hoa hồng
    const commissionConfigs = await prisma.commissionConfig.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
    });

    if (commissionConfigs.length === 0) return;

    // Lấy chuỗi người giới thiệu (ancestors) từ ReferralClosure
    const ancestors = await prisma.referralClosure.findMany({
      where: {
        descendantId: order.userId,
        depth: { gt: 0 }, // Không lấy chính user
      },
      orderBy: { depth: 'asc' },
      include: {
        ancestor: {
          select: {
            id: true,
            name: true,
            commissionBalance: true,
          },
        },
      },
    });

    // Tính hoa hồng cho từng cấp
    for (const ancestor of ancestors) {
      const config = commissionConfigs.find(c => c.level === ancestor.depth);
      if (!config) continue;

      const commissionAmount = (order.totalAmount * config.percentage) / 100;

      // Tạo bản ghi hoa hồng
      await prisma.commissionLedger.create({
        data: {
          userId: ancestor.ancestorId,
          orderId: order.id,
          fromUserId: order.userId,
          level: ancestor.depth,
          percentage: config.percentage,
          amount: commissionAmount,
          status: 'APPROVED', // Tự động duyệt khi đơn hoàn thành
        },
      });

      // Cập nhật số dư hoa hồng cho người nhận
      await prisma.user.update({
        where: { id: ancestor.ancestorId },
        data: {
          commissionBalance: {
            increment: commissionAmount,
          },
        },
      });
    }
  } catch (error) {
    console.error('Error calculating commissions:', error);
    // Không throw error để không ảnh hưởng đến việc cập nhật đơn hàng
  }
}

// GET - Lấy chi tiết đơn hàng
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            rank: true,
            address: true,
            addressStreet: true,
            addressWard: true,
            addressDistrict: true,
            addressProvince: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                slug: true,
              },
            },
          },
        },
        appliedVouchers: {
          include: {
            userVoucher: {
              include: {
                voucher: true,
              },
            },
          },
        },
        commissions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Cập nhật trạng thái đơn hàng
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, paymentStatus } = body;

    // Lấy đơn hàng hiện tại
    const currentOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            referrerId: true,
          },
        },
      },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Cập nhật đơn hàng
    const updateData: any = {};

    if (status) updateData.status = status;
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
      if (paymentStatus === 'PAID' && !currentOrder.paidAt) {
        updateData.paidAt = new Date();
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    // Nếu đơn hàng chuyển sang COMPLETED, cập nhật soldCount cho các sản phẩm
    if (status === 'COMPLETED' && currentOrder.status !== 'COMPLETED') {
      for (const item of currentOrder.items) {
        if (!item.isGift) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              soldCount: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      // Cập nhật totalSpent cho user
      await prisma.user.update({
        where: { id: currentOrder.userId },
        data: {
          totalSpent: {
            increment: currentOrder.totalAmount,
          },
        },
      });
      await updateUserRank(currentOrder.userId);

      // Tính hoa hồng cho người giới thiệu (chỉ khi chưa tính)
      if (currentOrder.user.referrerId) {
        // Kiểm tra xem đã tính hoa hồng cho đơn này chưa
        const existingCommissions = await prisma.commissionLedger.findFirst({
          where: {
            orderId: currentOrder.id,
            status: { not: 'CANCELLED' },
          },
        });

        // Chỉ tính hoa hồng nếu chưa có bản ghi
        if (!existingCommissions) {
          await calculateAndCreateCommissions(currentOrder);
        }
      }
    }

    // Nếu đơn hàng bị hủy hoặc hoàn trả từ COMPLETED, giảm soldCount và hủy hoa hồng
    if (
      (status === 'CANCELLED' || status === 'REFUNDED') &&
      currentOrder.status === 'COMPLETED'
    ) {
      // Giảm soldCount
      for (const item of currentOrder.items) {
        if (!item.isGift) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              soldCount: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      // Giảm totalSpent cho user
      await prisma.user.update({
        where: { id: currentOrder.userId },
        data: {
          totalSpent: {
            decrement: currentOrder.totalAmount,
          },
        },
      });
      await updateUserRank(currentOrder.userId);

      // Hủy hoa hồng đã tính
      await cancelCommissions(currentOrder.id);
    }

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
