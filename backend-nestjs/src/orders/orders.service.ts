import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CommissionsService } from '../commissions/commissions.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private commissionsService: CommissionsService,
  ) {}

  private generateOrderCode(): string {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const {
      items,
      cartItemIds,
      paymentMethod,
      name,
      phone,
      addressStreet,
      addressWard,
      addressProvince,
      note,
      voucherId,
      useCommissionPoints = false,
      shippingFee: clientShippingFee = 0,
    } = createOrderDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Get user info
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Process items and calculate totals
    let subtotal = 0;
    const orderItemsToCreate = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: { include: { size: true, color: true } } },
      });

      if (!product || !product.isActive) {
        throw new BadRequestException(`Product unavailable`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(`Not enough stock for ${product.name}`);
      }

      let itemPrice = product.salePrice || product.originalPrice;

      // Handle variants
      if (item.size || item.color) {
        const matchingVariant = product.variants.find(
          (v: any) =>
            (v.size?.name || null) === (item.size || null) &&
            (v.color?.name || null) === (item.color || null),
        );

        if (!matchingVariant || matchingVariant.stock < item.quantity) {
          throw new BadRequestException(
            `Phân loại ${item.size || ''} ${item.color || ''} cho ${product.name} không đủ số lượng`,
          );
        }

        if (matchingVariant.price !== null && matchingVariant.price !== undefined) {
          itemPrice = matchingVariant.price;
        }

        // Decrement variant stock
        await this.prisma.productVariant.update({
          where: { id: matchingVariant.id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Decrement main product stock
      await this.prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: { decrement: item.quantity } },
      });

      subtotal += itemPrice * item.quantity;
      orderItemsToCreate.push({
        productId: product.id,
        quantity: item.quantity,
        price: itemPrice,
        size: item.size || null,
        color: item.color || null,
      });
    }

    // Handle discounts
    let discountAmount = 0;
    let appliedUserVoucherId: string | null = null;

    // Apply Voucher
    if (voucherId) {
      const targetVoucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
      });

      if (targetVoucher && targetVoucher.isActive) {
        const userUsedCount = await this.prisma.userVoucher.count({
          where: { userId, voucherId, isUsed: true },
        });

        if (
          userUsedCount < targetVoucher.perCustomerLimit &&
          subtotal >= targetVoucher.minOrderValue
        ) {
          let voucherDiscount = 0;

          if (targetVoucher.type === 'STACK') {
            // STACK voucher: discount depends on distinct product count
            const distinctProductCount = new Set(items.map(i => i.productId)).size;
            const tiers = (targetVoucher as any).stackTiers as Array<{ minProducts: number; discount: number; type?: string }> | null;

            if (tiers && Array.isArray(tiers) && tiers.length > 0) {
              // Sort tiers descending by minProducts and find the best match
              const sortedTiers = [...tiers].sort((a, b) => b.minProducts - a.minProducts);
              const matchedTier = sortedTiers.find(t => distinctProductCount >= t.minProducts);

              if (matchedTier) {
                if (matchedTier.type === 'PERCENT') {
                  voucherDiscount = subtotal * (matchedTier.discount / 100);
                } else {
                  voucherDiscount = matchedTier.discount;
                }
              }
            }
          } else if (targetVoucher.type === 'PERCENT') {
            voucherDiscount = subtotal * (targetVoucher.value / 100);
          } else {
            voucherDiscount = targetVoucher.value;
          }

          if (targetVoucher.maxDiscount && voucherDiscount > targetVoucher.maxDiscount) {
            voucherDiscount = targetVoucher.maxDiscount;
          }

          // Never discount more than subtotal
          if (voucherDiscount > subtotal) {
            voucherDiscount = subtotal;
          }

          discountAmount += voucherDiscount;

          const newlyClaimed = await this.prisma.userVoucher.create({
            data: {
              userId,
              voucherId: targetVoucher.id,
              isUsed: true,
              usedAt: new Date(),
            },
          });

          appliedUserVoucherId = newlyClaimed.id;

          await this.prisma.voucher.update({
            where: { id: targetVoucher.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }
    }

    // Apply Commission Points
    let commissionDiscount = 0;
    if (useCommissionPoints && user.commissionBalance > 0) {
      const maxApplicable = Math.min(
        user.commissionBalance,
        Math.max(0, subtotal - discountAmount),
      );
      if (maxApplicable > 0) {
        commissionDiscount = maxApplicable;
        discountAmount += commissionDiscount;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { commissionBalance: { decrement: commissionDiscount } },
        });
      }
    }

    const parsedShippingFee = parseFloat(clientShippingFee.toString()) || 0;
    let totalAmount = subtotal - discountAmount + parsedShippingFee;
    if (totalAmount < 0) totalAmount = 0;

    // Determine storeId
    const firstProduct = await this.prisma.product.findUnique({
      where: { id: items[0].productId },
    });
    const orderStoreId = firstProduct?.storeId || null;

    // Create Order
    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        orderCode: this.generateOrderCode(),
        shippingName: name || user.name,
        shippingPhone: phone || user.phone,
        shippingStreet: addressStreet,
        shippingWard: addressWard,
        shippingProvince: addressProvince,
        subtotal,
        discountAmount,
        shippingFee: parsedShippingFee,
        totalAmount,
        paymentMethod: paymentMethod as any,
        paymentStatus: 'UNPAID',
        note,
        customerNote: note,
        source: 'PORTAL_DIRECT',
        storeId: orderStoreId,
        items: {
          create: orderItemsToCreate,
        },
        ...(appliedUserVoucherId
          ? {
              appliedVouchers: {
                create: {
                  userVoucherId: appliedUserVoucherId,
                  discountApplied: discountAmount - commissionDiscount,
                },
              },
            }
          : {}),
      },
    });

    // Clean up cart items
    if (cartItemIds && Array.isArray(cartItemIds) && cartItemIds.length > 0) {
      await this.prisma.cartItem.deleteMany({
        where: { id: { in: cartItemIds } },
      });
    }

    return { success: true, orderId: order.id, orderCode: order.orderCode };
  }

  async findAdminOrders(params: {
    userId: string;
    role: string;
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    paymentMethod?: string;
  }) {
    const { userId, role } = params;
    const page = params.page || 1;
    const limit = params.limit || 11;
    const search = params.search || '';
    const status = params.status;
    const paymentMethod = params.paymentMethod;

    const where: any = {};
    const baseWhere: any = {}; // For status counts

    if (role === 'MODERATOR') {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: userId },
      });
      if (store) {
        where.storeId = store.id;
        baseWhere.storeId = store.id;
      } else {
        where.id = 'no-access';
        baseWhere.id = 'no-access';
      }
    }

    if (search) {
      const searchFilter = {
        OR: [
          { orderCode: { contains: search } },
          { user: { name: { contains: search } } },
        ],
      };
      where.OR = searchFilter.OR;
      baseWhere.OR = searchFilter.OR;
    }

    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const [orders, total, countsData] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, rank: true, phone: true } },
          appliedVouchers: {
            include: {
              userVoucher: {
                include: {
                  voucher: { select: { code: true, type: true } },
                },
              },
            },
          },
          items: {
            include: {
              product: { select: { name: true, imageUrl: true } },
            },
          },
          _count: { select: { commissions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    const statusCounts = countsData.reduce((acc, curr) => {
      acc[curr.status] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts,
    };
  }

  async findAll(userId: string, filters?: any) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
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
      throw new NotFoundException('Order not found');
    }

    // Permission check
    if (role === 'ADMIN' || role === 'STAFF') {
      return order;
    }

    if (role === 'MODERATOR') {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: userId },
      });
      if (order.storeId === store?.id) {
        return order;
      }
    }

    if (order.userId === userId) {
      return order;
    }

    throw new NotFoundException('Order not found');
  }

  async updateStatus(
    id: string,
    updateDto: UpdateOrderStatusDto,
    userId?: string,
    role?: string,
  ) {
    const { status, paymentStatus } = updateDto;

    // Get current order
    const currentOrder = await this.prisma.order.findUnique({
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
      throw new NotFoundException('Order not found');
    }

    // Permission check for MODERATOR
    if (role === 'MODERATOR' && userId) {
      const store = await this.prisma.store.findUnique({
        where: { ownerId: userId },
      });
      if (currentOrder.storeId !== store?.id) {
        throw new NotFoundException('Order not found');
      }
    }

    // Update order
    const updateData: any = {};
    if (status) updateData.status = status;
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
      if (paymentStatus === 'PAID' && !currentOrder.paidAt) {
        updateData.paidAt = new Date();
      }
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateData,
    });

    // Handle COMPLETED status
    if (status === 'COMPLETED' && currentOrder.status !== 'COMPLETED') {
      // Update soldCount
      for (const item of currentOrder.items) {
        if (!item.isGift) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: { soldCount: { increment: item.quantity } },
          });
        }
      }

      // Update totalSpent and rank
      if (currentOrder.userId) {
        await this.prisma.user.update({
          where: { id: currentOrder.userId },
          data: { totalSpent: { increment: currentOrder.totalAmount } },
        });
        await this.usersService.updateUserRank(currentOrder.userId);
      }

      // Calculate commissions
      if (currentOrder.user && currentOrder.user.referrerId) {
        const existingCommissions = await this.prisma.commissionLedger.findFirst({
          where: {
            orderId: currentOrder.id,
            status: { not: 'CANCELLED' },
          },
        });

        if (!existingCommissions) {
          await this.commissionsService.calculateCommissions(currentOrder);
        }
      }
    }

    // Handle CANCELLED or REFUNDED from COMPLETED
    if (
      (status === 'CANCELLED' || status === 'REFUNDED') &&
      currentOrder.status === 'COMPLETED'
    ) {
      // Decrease soldCount
      for (const item of currentOrder.items) {
        if (!item.isGift) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: { soldCount: { decrement: item.quantity } },
          });
        }
      }

      // Decrease totalSpent and update rank
      if (currentOrder.userId) {
        await this.prisma.user.update({
          where: { id: currentOrder.userId },
          data: { totalSpent: { decrement: currentOrder.totalAmount } },
        });
        await this.usersService.updateUserRank(currentOrder.userId);
      }

      // Cancel commissions
      await this.commissionsService.cancelCommissions(currentOrder.id);
    }

    return updatedOrder;
  }

  async markAsRead(id: string, userId?: string, role?: string) {
    if (role === 'MODERATOR' && userId) {
      const order = await this.prisma.order.findUnique({ where: { id } });
      const store = await this.prisma.store.findUnique({
        where: { ownerId: userId },
      });
      if (!order || order.storeId !== store?.id) {
        throw new NotFoundException('Order not found');
      }
    }

    return this.prisma.order.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async checkStock(productId: string, size: string, color: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Sản phẩm không còn kinh doanh');
    }

    if (size || color) {
      const dbVariant = await this.prisma.productVariant.findFirst({
        where: {
          productId,
          ...(size ? { size: { name: size } } : {}),
          ...(color ? { color: { name: color } } : {}),
        },
      });

      if (!dbVariant || dbVariant.stock < quantity) {
        throw new BadRequestException('Phân loại sản phẩm này đã hết hàng');
      }
    } else {
      if (product.stockQuantity < quantity) {
        throw new BadRequestException('Sản phẩm đã hết hàng hạn mức');
      }
    }

    return { success: true, message: 'Đủ tồn kho' };
  }

  async calculateShippingFee(
    street: string,
    ward: string,
    province: string,
    totalWeight: number,
    storeId?: string,
  ) {
    if (!street || !ward || !province) {
      throw new BadRequestException('Thiếu thông tin địa chỉ');
    }

    const vtpConfig = await this.prisma.storeIntegration.findFirst({
      where: { platform: 'VIETTELPOST', isActive: true },
    });

    const configMetadata = (vtpConfig?.metadata as any) || {};
    const token = vtpConfig?.accessToken || process.env.VIETTELPOST_TOKEN;

    let senderAddress =
      process.env.VIETTELPOST_SENDER_ADDRESS ||
      'Trần Duy Hưng, Trung Hoà, Cầu Giấy, Hà Nội';

    // Get store address if provided
    if (storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          addressStreet: true,
          addressWard: true,
          addressDistrict: true,
          addressProvince: true,
        },
      });

      if (store && store.addressProvince && store.addressWard && store.addressStreet) {
        senderAddress = [
          store.addressStreet,
          store.addressWard,
          store.addressDistrict,
          store.addressProvince,
        ]
          .filter(Boolean)
          .join(', ');
      }
    } else if (
      configMetadata.senderProvince &&
      configMetadata.senderWard &&
      configMetadata.senderAddress
    ) {
      senderAddress = `${configMetadata.senderAddress}, ${configMetadata.senderWard}, ${configMetadata.senderProvince}`;
    }

    if (!token) {
      console.warn('Missing VIETTELPOST_TOKEN, returning default shipping fee.');
      return { fee: 30000 };
    }

    const receiverAddress = `${street}, ${ward}, ${province}`;
    const weight = parseInt(totalWeight.toString()) || 500;

    const payload = {
      PRODUCT_WEIGHT: weight,
      PRODUCT_PRICE: 0,
      MONEY_COLLECTION: 0,
      ORDER_SERVICE: 'VHT',
      ORDER_SERVICE_ADD: '',
      SENDER_ADDRESS: senderAddress,
      RECEIVER_ADDRESS: receiverAddress,
      PRODUCT_LENGTH: 0,
      PRODUCT_WIDTH: 0,
      PRODUCT_HEIGHT: 0,
      PRODUCT_TYPE: 'HH',
      NATIONAL_TYPE: 1,
    };

    try {
      const response = await fetch(
        'https://partner.viettelpost.vn/v2/order/getPriceNlp',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Token: token,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        console.error('ViettelPost HTTP error:', response.statusText);
        return { fee: 30000, error: 'Lỗi kết nối HTTP ViettelPost' };
      }

      const data = await response.json();

      if (data.status === 200 && data.error === false) {
        const fee = data.data?.MONEY_TOTAL || 0;
        return { fee };
      } else {
        console.error('ViettelPost Business error:', data);
        return { fee: 30000, error: data.message };
      }
    } catch (error) {
      console.error('Shipping fee calculation exception:', error);
      return { fee: 30000, error: 'Internal Server Error' };
    }
  }

  async checkProductPurchase(userId: string, productId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        items: {
          some: {
            productId,
          },
        },
      },
      select: {
        id: true,
        items: {
          where: {
            productId,
          },
          select: {
            size: true,
            color: true,
          },
        },
      },
    });

    return orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        size: item.size,
        color: item.color,
      })),
    );
  }

  async customerCancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Bạn không có quyền hủy đơn này');
    }

    const cancellableStatuses = ['PENDING', 'CONFIRMED'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng ở trạng thái "Chờ duyệt" hoặc "Đã xác nhận"',
      );
    }

    // Restore stock
    for (const item of order.items) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        customerNote: reason
          ? `${order.customerNote ? order.customerNote + ' | ' : ''}Lý do hủy: ${reason}`
          : order.customerNote,
      },
    });

    return { success: true, order: updated };
  }

  async trackPublicOrder(code: string, phone: string) {
    if (!code || !phone) {
      throw new BadRequestException('Vui lòng nhập cả mã đơn hàng/mã vận đơn và số điện thoại');
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanPhone = phone.trim();

    // Find orders that match the orderCode or trackingCode
    // We fetch all potential matches because metadata JSON filtering can be tricky/inconsistent across SQL dialects
    const potentialOrders = await this.prisma.order.findMany({
      where: {
        OR: [
          { orderCode: cleanCode },
          {
            // JSON path query for trackingCode - using string path for MySQL compatibility
            metadata: {
              path: '$.partner.trackingCode',
              equals: cleanCode,
            },
          },
        ],
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, imageUrl: true }
            }
          }
        }
      }
    });

    if (potentialOrders.length === 0) {
      throw new NotFoundException('Không tìm thấy đơn hàng với mã này');
    }

    // Now filter by phone
    const matchedOrder = potentialOrders.find((order) => {
      // Check standard shippingPhone
      if (order.shippingPhone && order.shippingPhone.includes(cleanPhone)) {
        return true;
      }
      
      // Check Pancake shippingAddress phone
      const metadata = order.metadata as any;
      if (metadata?.shippingAddress?.phoneNumber && metadata.shippingAddress.phoneNumber.includes(cleanPhone)) {
        return true;
      }
      
      return false;
    });

    if (!matchedOrder) {
      throw new BadRequestException('Số điện thoại không đúng với đơn hàng này');
    }

    // Return safe data only (exclude user details, exact address, etc. if not needed, 
    // but we can return basic tracking info)
    const m = matchedOrder.metadata as any || {};
    return {
      id: matchedOrder.id,
      orderCode: matchedOrder.orderCode,
      status: matchedOrder.status,
      createdAt: matchedOrder.createdAt,
      totalAmount: matchedOrder.totalAmount,
      shippingName: matchedOrder.shippingName || m.shippingAddress?.fullName,
      paymentMethod: matchedOrder.paymentMethod || (matchedOrder.source === 'PANCAKE' ? 'Thanh toán qua Pancake' : 'Chưa xác định'),
      paymentStatus: matchedOrder.paymentStatus,
      isPancake: matchedOrder.source === 'PANCAKE',
      items: (matchedOrder as any).items.map(item => ({
        name: item.product?.name || 'Sản phẩm',
        image: item.product?.imageUrl,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color,
        isGift: item.isGift,
      })),
      tracking: m.partner ? {
        trackingCode: m.partner.trackingCode,
        deliveryName: m.partner.deliveryName,
        deliveryPhone: m.partner.deliveryPhone,
        totalFee: m.partner.totalFee,
        courierUpdates: m.partner.courierUpdates || []
      } : null
    };
  }
}
