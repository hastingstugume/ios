/**
 * Standalone worker entry point.
 * In normal operation, the NestJS API hosts the BullMQ processor and cron scheduler
 * via IngestionModule. This file exists as a standalone fallback for environments
 * where the worker should run as a separate process.
 *
 * To run standalone: NODE_ENV=production yarn workspace @ios/worker start
 */
import Queue from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const ingestionQueue = new Queue('ingestion', REDIS_URL);

ingestionQueue.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} (${job.name}) completed`);
});

ingestionQueue.on('failed', (job, err) => {
  console.error(`[worker] Job ${job.id} (${job.name}) failed: ${err.message}`);
});

console.log('🔧 Standalone worker connected to Redis:', REDIS_URL);
console.log('📋 Monitoring ingestion queue…');
console.log('ℹ️  For full processing, ensure the NestJS API is running (it hosts the processors).');
