import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, Query } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ClaimQRVoucherDto } from './dto/claim-qr-voucher.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Vouchers')
@Controller('vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active vouchers' })
  async findAll(@Query('storeId') storeId?: string) {
    return this.vouchersService.findAll(storeId);
  }

  @Get('order-vouchers')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all order-specific vouchers' })
  async getOrderVouchersList(@GetUser() user: any) {
    return this.vouchersService.getOrderVouchersList(user);
  }

  @Get('admin')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all vouchers for Admin' })
  async findAllAdmin(
    @GetUser() user: any,
    @Query('excludeGamification') excludeGamification?: string,
  ) {
    return this.vouchersService.findAllAdmin(excludeGamification === 'true', user);
  }

  @Get('user/my-vouchers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user vouchers' })
  async getMyVouchers(@GetUser('id') userId: string) {
    return this.vouchersService.getUserVouchers(userId);
  }

  @Get('referral-vouchers')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all referral vouchers for admin' })
  async getReferralVouchersList(@GetUser() user: any) {
    return this.vouchersService.getReferralVouchersList(user);
  }

  @Get('referral-rewards-config')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get referral reward tiers config' })
  async getReferralRewardConfig() {
    return this.vouchersService.getReferralRewardConfig();
  }

  @Get('referral-rewards-config/public')
  @Public()
  @ApiOperation({ summary: 'Get referral reward tiers config for portal' })
  async getReferralRewardConfigPublic() {
    return this.vouchersService.getReferralRewardConfig();
  }

  @Get('order-voucher/:orderCode')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get voucher info for a specific order' })
  async getOrderVoucher(@Param('orderCode') orderCode: string) {
    return this.vouchersService.getOrderVoucher(orderCode);
  }

  // --- :id routes MUST be last among GETs ---
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get voucher by ID' })
  async findOne(@Param('id') id: string) {
    return this.vouchersService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new voucher' })
  async create(@GetUser() user: any, @Body() data: any) {
    return this.vouchersService.create(data, user);
  }

  @Post('claim-qr')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim a QR voucher' })
  async claimQRVoucher(
    @GetUser('id') userId: string,
    @Body() dto: ClaimQRVoucherDto,
  ) {
    return this.vouchersService.claimQRVoucher(
      userId,
      dto.orderCode,
      dto.phone,
      dto.voucherId,
    );
  }

  @Post('manual-verify')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger manual voucher verification' })
  async manualVerifyVouchers() {
    return this.vouchersService.manualTriggerVerification();
  }

  @Post('create-order-voucher')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a dedicated voucher for a specific order' })
  async createOrderVoucher(
    @Body() data: { 
      orderId: string; 
      name?: string;
      type?: 'FIXED_AMOUNT' | 'PERCENT' | 'FREESHIP' | 'STACK';
      value?: number; 
      maxDiscount?: number;
      minOrderValue?: number;
      durationDays?: number;
      stackTiers?: any;
    }
  ) {
    return this.vouchersService.createOrderVoucher(data);
  }

  @Post('referral-voucher')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a referral voucher' })
  async createReferralVoucher(@GetUser() user: any, @Body() data: any) {
    return this.vouchersService.createReferralVoucher(data, user);
  }

  @Post('referral-rewards-config')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save referral reward tiers config' })
  async saveReferralRewardConfig(@Body() data: { tiers: any[] }) {
    return this.vouchersService.saveReferralRewardConfig(data);
  }

  @Patch(':id')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a voucher' })
  async update(@GetUser() user: any, @Param('id') id: string, @Body() data: any) {
    return this.vouchersService.update(id, data, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'STAFF', 'MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a voucher' })
  async remove(@GetUser() user: any, @Param('id') id: string) {
    return this.vouchersService.remove(id, user);
  }
}

