import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'MODERATOR')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getDashboardStats(@GetUser() user: any) {
    return this.adminService.getDashboardStats(user);
  }

  @Get('dashboard-meta')
  @ApiOperation({ summary: 'Get layout meta (counts, status)' })
  async getDashboardMeta(@GetUser() user: any) {
    return this.adminService.getDashboardMeta(user);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get all customers with filters' })
  async getCustomers(
    @GetUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('rank') rank?: string,
  ) {
    return this.adminService.getCustomers(user, { page, limit, search, rank });
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer detail by ID' })
  async getCustomerDetail(@GetUser() user: any, @Param('id') id: string) {
    return this.adminService.getCustomerDetail(id, user);
  }
}
