import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ProductsModule } from '../products/products.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ProductsModule, VouchersModule, CommissionsModule, UsersModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
