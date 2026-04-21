import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SpinService } from './spin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Spin Wheel')
@Controller('spin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpinController {
  constructor(private readonly spinService: SpinService) {}

  @Get('attempts')
  @ApiOperation({ summary: 'Get user spin attempts' })
  async getUserSpinAttempts(@GetUser('id') userId: string) {
    return this.spinService.getUserSpinAttempts(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Spin the wheel' })
  async spin(@GetUser('id') userId: string) {
    return this.spinService.spin(userId);
  }

  @Post('add-attempts')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add spin attempts to user (Admin only)' })
  async addSpinAttempts(
    @Body() data: { userId: string; attempts: number },
  ) {
    return this.spinService.addSpinAttempts(data.userId, data.attempts);
  }
}
