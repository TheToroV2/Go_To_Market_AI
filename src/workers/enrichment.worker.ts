import { Worker, type Job } from 'bullmq';
import { config } from '../config/config';
import { batchRepository, leadRepository } from '../repositories/lead.repository';
import { mockEnrichLead } from '../services/enrichment.service';
import type { EnrichmentJobData } from '../types/types';

function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...meta }));
}

async function processEnrichmentJob(job: Job<EnrichmentJobData>): Promise<void> {
  const { lead_id, batch_id, lead } = job.data;

  log('info', 'Processing enrichment job', {
    job_id: job.id,
    lead_id,
    batch_id,
    attempt: job.attemptsMade + 1,
  });

  await leadRepository.setProcessing(lead_id);

  const result = await mockEnrichLead(lead);

  await leadRepository.setComplete(lead_id, result);
  await batchRepository.incrementCompleted(batch_id);

  log('info', 'Enrichment complete', { lead_id, batch_id, icp_score: result.icp_score });
}

// Called by BullMQ after all retries are exhausted
async function onFailed(job: Job<EnrichmentJobData> | undefined, error: Error): Promise<void> {
  if (!job) return;

  const { lead_id, batch_id } = job.data;

  log('error', 'Enrichment failed after all retries', {
    job_id: job.id,
    lead_id,
    batch_id,
    attempts_made: job.attemptsMade,
    error: error.message,
  });

  await leadRepository.setFailed(lead_id, error.message);
  await batchRepository.incrementFailed(batch_id);
}

export const enrichmentWorker = new Worker<EnrichmentJobData>(
  'enrichment',
  processEnrichmentJob,
  {
    connection: { url: config.redisUrl },
    concurrency: config.workerConcurrency,
  }
);

enrichmentWorker.on('failed', onFailed);

enrichmentWorker.on('error', (err) => {
  log('error', 'Worker error', { error: err.message });
});

log('info', 'Enrichment worker started', { concurrency: config.workerConcurrency });