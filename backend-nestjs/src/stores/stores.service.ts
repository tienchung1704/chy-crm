import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all stores (public)
   */
  async getAllStores() {
    return this.prisma.store.findMany({
      where: { isActive: true },
      include: {
        owner: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get store by ID
   */
  async getStoreById(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        products: {
          where: { isActive: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  /**
   * Get user's store
   */
  async getUserStore(userId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      include: {
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        integrations: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return store;
  }

  /**
   * Create a new store
   */
  async createStore(userId: string, data: any) {
    // Check if user already has a store
    const existingStore = await this.prisma.store.findUnique({
      where: { ownerId: userId },
    });

    if (existingStore) {
      throw new ForbiddenException('Bạn đã có cửa hàng rồi');
    }

    const { name, description, address, phone, email, logo } = data;

    return this.prisma.store.create({
      data: {
        ownerId: userId,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        description: description || null,
        addressStreet: address || null,
        phone: phone || null,
        email: email || null,
        logoUrl: logo || null,
        isActive: true,
      },
    });
  }

  /**
   * Update store
   */
  async updateStore(userId: string, data: any) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const { name, description, address, phone, email, logo, isActive } = data;

    return this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: name || store.name,
        description: description !== undefined ? description : store.description,
        addressStreet: address !== undefined ? address : store.addressStreet,
        phone: phone !== undefined ? phone : store.phone,
        email: email !== undefined ? email : store.email,
        logoUrl: logo !== undefined ? logo : store.logoUrl,
        isActive: isActive !== undefined ? isActive : store.isActive,
      },
    });
  }

  /**
   * Create store as Admin (manually assign owner)
   */
  async createStoreAdmin(data: any) {
    const { name, slug, ownerId } = data;

    // Check if owner already has a store
    const existingStore = await this.prisma.store.findUnique({
      where: { ownerId },
    });

    if (existingStore) {
      throw new ForbiddenException('Người dùng này đã có cửa hàng rồi');
    }

    // Upgrade owner to MODERATOR
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { role: 'MODERATOR' },
    });

    return this.prisma.store.create({
      data: {
        ownerId,
        name,
        slug: slug || (name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()),
        isActive: true,
      },
    });
  }

  /**
   * Get all stores for Admin
   */
  async findAllAdmin() {
    return this.prisma.store.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get store detail for Admin
   */
  async findAdminStoreDetail(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, phone: true, rank: true, createdAt: true },
        },
        _count: { select: { products: true, orders: true, vouchers: true } },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true } },
          },
        },
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            categories: { select: { name: true } },
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  /**
   * Approve store
   */
  async approveStore(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Upgrade owner to MODERATOR if not already ADMIN/STAFF
    const owner = await this.prisma.user.findUnique({
      where: { id: store.ownerId },
    });

    if (owner && owner.role === 'CUSTOMER') {
      await this.prisma.user.update({
        where: { id: owner.id },
        data: { role: 'MODERATOR' },
      });
    }

    return this.prisma.store.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Update store status (Admin Only)
   */
  async updateStatus(id: string, data: { isActive?: boolean; isBanned?: boolean; bannedReason?: string }) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return this.prisma.store.update({
      where: { id },
      data: {
        isActive: data.isActive !== undefined ? data.isActive : store.isActive,
        isBanned: data.isBanned !== undefined ? data.isBanned : store.isBanned,
        bannedReason: data.bannedReason !== undefined ? data.bannedReason : store.bannedReason,
      },
    });
  }

  /**
   * Delete store as Admin
   */
  async removeAdmin(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return this.prisma.store.delete({
      where: { id },
    });
  }
}
