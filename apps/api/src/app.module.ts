import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { KeywordsModule } from './keywords/keywords.module';
import { SourcesModule } from './sources/sources.module';
import { SignalsModule } from './signals/signals.module';
import { AlertsModule } from './alerts/alerts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ClassificationModule } from './classification/classification.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublicModule } from './public/public.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('RATE_LIMIT_GLOBAL_WINDOW_MS', 60000),
            limit: config.get('RATE_LIMIT_GLOBAL_MAX', 500),
          },
        ],
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get('REDIS_URL', 'redis://localhost:6379'),
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    KeywordsModule,
    SourcesModule,
    SignalsModule,
    AlertsModule,
    DashboardModule,
    IngestionModule,
    ClassificationModule,
    NotificationsModule,
    PublicModule,
    EntitlementsModule,
    BillingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
