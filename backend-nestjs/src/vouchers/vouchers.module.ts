import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';
import { VoucherProcessor } from './voucher.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'voucher-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    }),
    // Register queue with Bull Board Dashboard
    BullBoardModule.forFeature({
      name: 'voucher-queue',
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [VouchersController],
  providers: [VouchersService, VoucherProcessor],
  exports: [VouchersService],
})
export class VouchersModule {}
