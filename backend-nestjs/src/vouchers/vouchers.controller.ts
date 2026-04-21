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

  @Get('admin')
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all vouchers for Admin' })
  async findAllAdmin(@Query('excludeGamification') excludeGamification?: string) {
    return this.vouchersService.findAllAdmin(excludeGamification === 'true');
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get voucher by ID' })
  async findOne(@Param('id') id: string) {
    return this.vouchersService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new voucher' })
  async create(@Body() data: any) {
    return this.vouchersService.create(data);
  }

  @Patch(':id')
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a voucher' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.vouchersService.update(id, data);
  }

  @Delete(':id')
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a voucher' })
  async remove(@Param('id') id: string) {
    return this.vouchersService.remove(id);
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
      dto.voucherId,
    );
  }

  @Get('user/my-vouchers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user vouchers' })
  async getMyVouchers(@GetUser('id') userId: string) {
    return this.vouchersService.getUserVouchers(userId);
  }

  @Post('manual-verify')
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger manual voucher verification' })
  async manualVerifyVouchers() {
    return this.vouchersService.manualTriggerVerification();
  }
}
