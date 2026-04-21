import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, storeId?: string) {
    const { categoryIds, variants, ...productData } = createProductDto;

    // Generate slug from name
    const slug = this.generateSlug(productData.name);

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        slug,
        storeId,
        categories: categoryIds
          ? {
              connect: categoryIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        categories: true,
        variants: {
          include: {
            size: true,
            color: true,
          },
        },
      },
    });

    // Create variants if provided
    if (variants && variants.length > 0) {
      await this.createVariants(product.id, variants);
    }

    return product;
  }

  async findAll(filterDto: FilterProductDto) {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      minPrice,
      maxPrice,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filterDto;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categories = {
        some: { id: categoryId },
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.salePrice = {};
      if (minPrice !== undefined) where.salePrice.gte = minPrice;
      if (maxPrice !== undefined) where.salePrice.lte = maxPrice;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          categories: true,
          variants: {
            include: {
              size: true,
              color: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        categories: true,
        variants: {
          include: {
            size: true,
            color: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Calculate average rating
    const avgRating = product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : 0;

    return {
      ...product,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: product.reviews.length,
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { categoryIds, variants, ...productData } = updateProductDto;

    // Check if product exists
    await this.findOne(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        categories: categoryIds
          ? {
              set: categoryIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        categories: true,
        variants: {
          include: {
            size: true,
            color: true,
          },
        },
      },
    });

    // Update variants if provided
    if (variants) {
      // Delete existing variants
      await this.prisma.productVariant.deleteMany({
        where: { productId: id },
      });

      // Create new variants
      if (variants.length > 0) {
        await this.createVariants(id, variants);
      }
    }

    return product;
  }

  async remove(id: string) {
    // Check if product exists
    await this.findOne(id);

    // Soft delete by setting isActive to false
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true, message: 'Product deleted successfully' };
  }

  async search(query: string) {
    return this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
          { sku: { contains: query } },
        ],
        isActive: true,
      },
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        salePrice: true,
        originalPrice: true,
        sku: true,
      },
    });
  }

  private async createVariants(productId: string, variants: any[]) {
    const variantData = variants.map((v) => ({
      productId,
      sizeId: v.sizeId,
      colorId: v.colorId,
      price: v.price,
      stock: v.stock || 0,
    }));

    await this.prisma.productVariant.createMany({
      data: variantData,
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now().toString(36);
  }
}
