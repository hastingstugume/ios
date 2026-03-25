// ingestion.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { AlertsService } from '../alerts/alerts.service';

@Processor('ingestion')
export class IngestionProcessor {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private ingestion: IngestionService,
    private alerts: AlertsService,
  ) {}

  @Process('fetch-source')
  async handleFetch(job: Job<{ sourceId: string }>) {
    this.logger.log(`Processing source fetch: ${job.data.sourceId}`);
    await this.ingestion.fetchSource(job.data.sourceId);
  }

  @Process('check-alerts')
  async handleAlerts(job: Job<{ orgId: string; signalId: string; confidenceScore: number; category: string }>) {
    await this.alerts.checkAndTrigger(job.data.orgId, job.data.signalId, job.data.confidenceScore, job.data.category as any);
  }
}
