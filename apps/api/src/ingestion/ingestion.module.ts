import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IngestionService } from './ingestion.service';
import { IngestionProcessor } from './ingestion.processor';
import { ClassificationModule } from '../classification/classification.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ingestion' }),
    ClassificationModule,
    AlertsModule,
  ],
  providers: [IngestionService, IngestionProcessor],
  exports: [IngestionService],
})
export class IngestionModule {}
