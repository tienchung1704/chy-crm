import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all integrations for Admin' })
  async findAllAdmin(@Query('storeId') storeId?: string) {
    return this.integrationsService.findAllAdmin(storeId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Upsert an integration config' })
  async upsertAdmin(@Body() data: any) {
    return this.integrationsService.upsertAdmin(data);
  }
}
