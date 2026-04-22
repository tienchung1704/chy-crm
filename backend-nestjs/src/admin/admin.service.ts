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

  async getCustomerDetail(id: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
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
        addressStreet: true,
        addressWard: true,
        addressProvince: true,
        createdAt: true,
        updatedAt: true,
        referrer: {
          select: { id: true, name: true, phone: true, referralCode: true },
        },
        referees: {
          select: {
            id: true, name: true, phone: true, rank: true, totalSpent: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        orders: {
          select: {
            id: true, orderCode: true, totalAmount: true, status: true,
            paymentStatus: true, source: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        commissionsEarned: {
          select: {
            id: true, amount: true, percentage: true, level: true,
            status: true, createdAt: true,
            order: { select: { orderCode: true, totalAmount: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        userVouchers: {
          select: {
            id: true, isUsed: true, usedAt: true, createdAt: true,
            voucher: { select: { code: true, type: true, value: true, validTo: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { orders: true, referees: true, commissionsEarned: true, userVouchers: true },
        },
      },
    });

    if (!customer) {
      return null;
    }

    // Aggregate stats
    const [orderStats, commissionStats] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: id, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.commissionLedger.aggregate({
        where: { userId: id },
        _sum: { amount: true },
      }),
    ]);

    return {
      ...customer,
      stats: {
        completedOrders: orderStats._count,
        completedRevenue: orderStats._sum.totalAmount || 0,
        totalCommission: commissionStats._sum.amount || 0,
      },
    };
  }
}
