import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active stores' })
  async getAllStores() {
    return this.storesService.getAllStores();
  }

  @Get('my-store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user store' })
  async getUserStore(@GetUser('id') userId: string) {
    return this.storesService.getUserStore(userId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get store by ID' })
  async getStoreById(@Param('id') id: string) {
    return this.storesService.getStoreById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new store' })
  async createStore(@GetUser('id') userId: string, @Body() data: any) {
    return this.storesService.createStore(userId, data);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user store' })
  async updateStore(@GetUser('id') userId: string, @Body() data: any) {
    return this.storesService.updateStore(userId, data);
  }
}
