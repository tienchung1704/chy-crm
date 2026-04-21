import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalCustomers,
      newCustomersThisMonth,
      totalOrders,
      completedOrders,
      totalRevenue,
      activeVouchers,
      pendingCommissions,
      recentOrders,
      topCustomers,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      this.prisma.voucher.count({ where: { isActive: true } }),
      this.prisma.commissionLedger.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, rank: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { role: 'CUSTOMER' },
        take: 5,
        orderBy: { totalSpent: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          rank: true,
          totalSpent: true,
          _count: { select: { orders: true } },
        },
      }),
    ]);

    return {
      totalCustomers,
      newCustomersThisMonth,
      totalOrders,
      completedOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      activeVouchers,
      pendingCommissions: pendingCommissions._sum.amount || 0,
      recentOrders,
      topCustomers,
    };
  }

  async getCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    rank?: string;
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const search = params?.search || '';
    const rank = params?.rank || '';

    const where: any = { role: 'CUSTOMER' };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (rank) {
      where.rank = rank;
    }

    const [customers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          gender: true,
          dob: true,
          rank: true,
          totalSpent: true,
          commissionBalance: true,
          referralCode: true,
          createdAt: true,
          _count: { select: { orders: true, referees: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDashboardMeta(user: any) {
    let unreadCount = 0;
    let pendingStoresCount = 0;
    let isStoreActive = true;

    if (user.role === 'ADMIN' || user.role === 'STAFF') {
      const [uCount, pCount] = await Promise.all([
        this.prisma.order.count({ where: { isRead: false } }),
        this.prisma.store.count({
          where: { isActive: false, isBanned: false },
        }),
      ]);
      unreadCount = uCount;
      pendingStoresCount = pCount;
    } else if (user.role === 'MODERATOR') {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: user.id },
      });
      if (store) {
        unreadCount = await this.prisma.order.count({
          where: { storeId: store.id, isRead: false },
        });
        isStoreActive = store.isActive;
      } else {
        isStoreActive = false;
      }
    }

    return { unreadCount, pendingStoresCount, isStoreActive };
  }
}
