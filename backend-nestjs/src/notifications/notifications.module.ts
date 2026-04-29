import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ZaloTokenService } from './zalo-token.service';
import { ZbsTemplateService } from './zbs-template.service';
import { ZaloZnsProcessor } from './zalo-zns.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'zalo-zns',
    }),
    BullBoardModule.forFeature({
      name: 'zalo-zns',
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ZaloTokenService,
    ZbsTemplateService,
    ZaloZnsProcessor,
  ],
  exports: [NotificationsService, ZaloTokenService],
})
export class NotificationsModule {}
