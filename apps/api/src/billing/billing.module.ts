import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController, BillingWebhookController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService],
})
export class BillingModule {}
