import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: any, user?: any) {
    let storeId = null;
    
    if (user && user.role === 'MODERATOR') {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: user.id },
      });
      if (store) {
        storeId = store.id;
      }
    }

    const slug = data.slug || data.name.toLowerCase().replace(/ /g, '-');

    // Only pick known Category fields, ignore unknown ones like 'level'
    const { name, description, parentId, sortOrder, isActive, externalId, imageUrl } = data;

    return this.prisma.category.create({
      data: {
        name,
        slug,
        ...(description !== undefined && { description }),
        ...(parentId && { parentId }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        ...(externalId && { externalId }),
        ...(imageUrl && { imageUrl }),
        ...(storeId && { storeId }),
      },
    });
  }

  async findAll(isAdmin: boolean = false, storeId?: string) {
    const where: any = isAdmin ? {} : { isActive: true };
    if (storeId) {
      where.storeId = storeId;
    }
    return this.prisma.category.findMany({
      where,
      include: {
        parent: { select: { name: true } },
        children: true,
        _count: {
          select: { products: true, children: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        products: {
          where: { isActive: true },
          take: 20,
        },
        _count: {
          select: { products: true, children: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, data: any) {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    // Check if category exists
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Cascade delete children is handled by Prisma if configured, 
    // but here we just manually handle it to be safe or set null
    // Looking at the schema is better, but I'll assume we want to delete them for now
    if (category.children.length > 0) {
      await this.prisma.category.deleteMany({
        where: { parentId: id },
      });
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }
}
