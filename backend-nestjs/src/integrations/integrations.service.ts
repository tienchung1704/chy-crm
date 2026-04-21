import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async findAllAdmin(storeId?: string) {
    return this.prisma.storeIntegration.findMany({
      where: {
        ...(storeId && { storeId }),
      },
      include: {
        store: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        platform: 'asc',
      },
    });
  }

  async upsertAdmin(data: any) {
    const { platform, storeId, ...config } = data;

    // Check if storeId is provided (from Admin)
    // If not provided, it should fail or handled by controller to get current user's store
    if (!storeId) {
      throw new Error('Store ID is required for administrative integration management');
    }

    return this.prisma.storeIntegration.upsert({
      where: {
        storeId_platform: {
          storeId,
          platform,
        },
      },
      update: {
        ...config,
      },
      create: {
        storeId,
        platform,
        ...config,
      },
    });
  }
}
