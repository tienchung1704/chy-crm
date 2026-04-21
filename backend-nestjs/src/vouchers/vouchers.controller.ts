import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ClaimQRVoucherDto } from './dto/claim-qr-voucher.dto';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get()
  @Public()
  async findAll(@Query('storeId') storeId?: string) {
    return this.vouchersService.findAll(storeId);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.vouchersService.findOne(id);
  }

  @Post('claim-qr')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async getMyVouchers(@GetUser('id') userId: string) {
    return this.vouchersService.getUserVouchers(userId);
  }

  @Post('manual-verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async manualVerifyVouchers() {
    return this.vouchersService.manualTriggerVerification();
  }
}
