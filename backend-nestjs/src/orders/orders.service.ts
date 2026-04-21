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
          let voucherDiscount =
            targetVoucher.type === 'PERCENT'
              ? subtotal * (targetVoucher.value / 100)
              : targetVoucher.value;

          if (targetVoucher.maxDiscount && voucherDiscount > targetVoucher.maxDiscount) {
            voucherDiscount = targetVoucher.maxDiscount;
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

  async findOne(id: string, userId?: string) {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findUnique({
      where,
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

    return order;
  }

  async updateStatus(id: string, updateDto: UpdateOrderStatusDto) {
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
      await this.prisma.user.update({
        where: { id: currentOrder.userId },
        data: { totalSpent: { increment: currentOrder.totalAmount } },
      });
      await this.usersService.updateUserRank(currentOrder.userId);

      // Calculate commissions
      if (currentOrder.user.referrerId) {
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
      await this.prisma.user.update({
        where: { id: currentOrder.userId },
        data: { totalSpent: { decrement: currentOrder.totalAmount } },
      });
      await this.usersService.updateUserRank(currentOrder.userId);

      // Cancel commissions
      await this.commissionsService.cancelCommissions(currentOrder.id);
    }

    return updatedOrder;
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
}
