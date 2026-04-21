import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [forwardRef(() => IntegrationsModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
