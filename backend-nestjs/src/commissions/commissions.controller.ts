import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommissionsService } from './commissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Commissions')
@Controller('commissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  // TODO: Implement commission endpoints
}
