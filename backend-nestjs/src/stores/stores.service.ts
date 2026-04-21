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
}
