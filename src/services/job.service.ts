import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import { batchRepository, leadRepository } from '../repositories/lead.repository';
import type { BatchRecord, EnrichmentJobData, Lead, LeadRecord } from '../types/types';

export const enrichmentQueue = new Queue<EnrichmentJobData>('enrichment', {
  connection: { url: config.redisUrl },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

export const jobService = {
  async createBatch(leads: Lead[]): Promise<{ batchId: string; leadIds: string[] }> {
    const batchId = uuidv4();
    await batchRepository.create(batchId, leads.length);

    const leadIds: string[] = [];

    for (const lead of leads) {
      const leadId = uuidv4();
      await leadRepository.create(leadId, batchId, lead.name, lead.email, lead.company);

      const jobData: EnrichmentJobData = { lead_id: leadId, batch_id: batchId, lead };
      await enrichmentQueue.add('enrich', jobData, {
        jobId: leadId, // idempotent: re-adding same leadId is a no-op
      });

      leadIds.push(leadId);
    }

    return { batchId, leadIds };
  },

  async getBatch(batchId: string): Promise<{
    batch: BatchRecord | null;
    leads: LeadRecord[];
  }> {
    const [batch, leads] = await Promise.all([
      batchRepository.findById(batchId),
      leadRepository.findByBatchId(batchId),
    ]);
    return { batch, leads };
  },
};