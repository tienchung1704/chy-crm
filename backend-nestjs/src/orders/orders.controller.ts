import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CheckStockDto } from './dto/check-stock.dto';
import { ShippingFeeDto } from './dto/shipping-fee.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  create(@GetUser('id') userId: string, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(userId, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  findAll(@GetUser('id') userId: string) {
    return this.ordersService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  findOne(@Param('id') id: string, @GetUser('id') userId: string, @GetUser('role') role: string) {
    // Admin can view any order, users can only view their own
    return this.ordersService.findOne(id, role === 'ADMIN' ? undefined : userId);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update order status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  updateStatus(@Param('id') id: string, @Body() updateDto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, updateDto);
  }

  @Post('check-stock')
  @ApiOperation({ summary: 'Check product stock before checkout' })
  @ApiResponse({ status: 200, description: 'Stock checked successfully' })
  checkStock(@Body() checkStockDto: CheckStockDto) {
    return this.ordersService.checkStock(
      checkStockDto.productId,
      checkStockDto.size,
      checkStockDto.color,
      checkStockDto.quantity,
    );
  }

  @Post('shipping-fee')
  @ApiOperation({ summary: 'Calculate shipping fee' })
  @ApiResponse({ status: 200, description: 'Shipping fee calculated' })
  calculateShippingFee(@Body() shippingFeeDto: ShippingFeeDto) {
    return this.ordersService.calculateShippingFee(
      shippingFeeDto.street,
      shippingFeeDto.ward,
      shippingFeeDto.province,
      shippingFeeDto.totalWeight,
      shippingFeeDto.storeId,
    );
  }
}
