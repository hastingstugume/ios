import { Module } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { SourcesController } from './sources.controller';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ClassificationModule } from '../classification/classification.module';

@Module({
  imports: [AuthModule, EntitlementsModule, IngestionModule, ClassificationModule],
  providers: [SourcesService],
  controllers: [SourcesController],
  exports: [SourcesService],
})
export class SourcesModule {}
