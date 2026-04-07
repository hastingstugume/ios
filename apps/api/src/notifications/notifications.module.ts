// notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { BillingLifecycleService } from './billing-lifecycle.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [EntitlementsModule],
  providers: [NotificationsService, BillingLifecycleService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
