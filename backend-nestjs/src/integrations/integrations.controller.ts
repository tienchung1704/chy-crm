import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
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
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Get all integrations' })
  async findAll(@Request() req, @Query('storeId') storeId?: string) {
    return this.integrationsService.findAll(req.user, storeId);
  }

  @Post()
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Upsert an integration config' })
  async upsert(@Request() req, @Body() data: any) {
    return this.integrationsService.upsert(req.user, data);
  }
}
