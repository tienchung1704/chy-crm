import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async createCustomer(dto: CreateCustomerDto) {
    const name = dto.name?.trim();
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;
    const address = dto.address?.trim() || null;

    if (!name) {
      throw new BadRequestException('Name is required');
    }

    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const customer = await this.prisma.user.create({
      data: {
        role: 'CUSTOMER',
        name,
        email,
        phone,
        gender: dto.gender || null,
        dob: dto.dob ? new Date(dto.dob) : null,
        address,
        addressStreet: address,
        onboardingComplete: true,
        referralCode: await this.generateUniqueReferralCode(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        dob: true,
        referralCode: true,
        createdAt: true,
      },
    });

    return { success: true, customer };
  }

  async getDashboardStats(user: any) {
    const isModerator = user.role === 'MODERATOR';
    let storeId: string | undefined;

    if (isModerator) {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: user.id },
      });
      storeId = store?.id;
    }

    const orderWhere: any = isModerator ? { storeId: storeId || 'no-access' } : {};
    const customerWhere: any = { role: 'CUSTOMER' };
    if (isModerator) {
      customerWhere.orders = { some: { storeId: storeId || 'no-access' } };
    }

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
      this.prisma.user.count({ where: customerWhere }),
      this.prisma.user.count({
        where: {
          ...customerWhere,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.count({
        where: { ...orderWhere, status: 'COMPLETED' },
      }),
      this.prisma.order.aggregate({
        where: { ...orderWhere, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      this.prisma.voucher.count({ where: { isActive: true } }),
      this.prisma.commissionLedger.aggregate({
        where: {
          status: 'PENDING',
          ...(isModerator ? { order: { storeId: storeId || 'no-access' } } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        where: orderWhere,
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, phone: true, rank: true } },
        },
      }),
      this.prisma.user.findMany({
        where: customerWhere,
        take: 5,
        orderBy: { totalSpent: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          rank: true,
          totalSpent: true,
          _count: { select: { orders: { where: orderWhere } } },
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

  async getCustomers(
    user: any,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      rank?: string;
      includeAll?: boolean;
    },
  ) {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const search = params?.search || '';
    const rank = params?.rank || '';

    const isModerator = user.role === 'MODERATOR';
    const where: any = { role: 'CUSTOMER' };

    if (isModerator && !params?.includeAll) {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: user.id },
      });
      where.orders = { some: { storeId: store?.id || 'no-access' } };
    }

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

  async getCustomerDetail(id: string, user: any) {
    const isModerator = user.role === 'MODERATOR';
    let storeId: string | undefined;

    if (isModerator) {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: user.id },
      });
      storeId = store?.id || 'no-access';
      
      const hasOrder = await this.prisma.order.findFirst({
        where: { userId: id, storeId },
      });
      if (!hasOrder) {
        return null;
      }
    }

    const orderWhere = isModerator ? { storeId } : {};

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
        isActive: true,
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
          where: orderWhere,
          select: {
            id: true, orderCode: true, totalAmount: true, status: true,
            paymentStatus: true, source: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        commissionsEarned: {
          where: isModerator ? { order: { storeId } } : {},
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
          select: { 
            orders: { where: orderWhere }, 
            referees: true, 
            commissionsEarned: { where: isModerator ? { order: { storeId } } : {} }, 
            userVouchers: true 
          },
        },
      },
    });

    if (!customer) {
      return null;
    }

    // Aggregate stats
    const [orderStats, commissionStats] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: id, status: 'COMPLETED', ...orderWhere },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.commissionLedger.aggregate({
        where: { userId: id, status: 'PAID', ...(isModerator ? { order: { storeId } } : {}) },
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

  private async generateUniqueReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    while (true) {
      let code = '';
      for (let i = 0; i < 8; i += 1) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
      });

      if (!existing) {
        return code;
      }
    }
  }

  async softDeleteCustomer(id: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    if (customer.role !== 'CUSTOMER') {
      throw new BadRequestException('Can only soft delete customers');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true, message: 'Customer has been banned (soft deleted)' };
  }

  async hardDeleteCustomer(id: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    if (customer.role !== 'CUSTOMER') {
      throw new BadRequestException('Can only delete customers');
    }

    // Delete related records first (cascade delete)
    await this.prisma.$transaction([
      // Delete cart items
      this.prisma.cartItem.deleteMany({ where: { cart: { userId: id } } }),
      // Delete cart
      this.prisma.cart.deleteMany({ where: { userId: id } }),
      // Delete user vouchers
      this.prisma.userVoucher.deleteMany({ where: { userId: id } }),
      // Delete commission ledgers
      this.prisma.commissionLedger.deleteMany({ where: { userId: id } }),
      // Delete reviews
      this.prisma.review.deleteMany({ where: { userId: id } }),
      // Delete wishlist
      this.prisma.wishlist.deleteMany({ where: { userId: id } }),
      // Delete notifications
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      // Delete OAuth accounts
      this.prisma.oAuthAccount.deleteMany({ where: { userId: id } }),
      // Update referees to remove referrer
      this.prisma.user.updateMany({
        where: { referrerId: id },
        data: { referrerId: null },
      }),
      // Delete orders (if allowed, or update to remove user reference)
      // Note: You might want to keep orders for record keeping
      // this.prisma.order.deleteMany({ where: { userId: id } }),
      // Finally delete the user
      this.prisma.user.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Customer has been permanently deleted' };
  }

  async getSystemConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    return config || { key, value: null };
  }

  async upsertSystemConfig(key: string, value: any) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
