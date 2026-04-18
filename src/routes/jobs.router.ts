import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { jobService } from '../services/job.service';
import type { LeadRecord } from '../types/types';

export const jobsRouter = Router();

const LeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
});

const CreateJobSchema = z.object({
  leads: z.array(LeadSchema).min(1).max(1000),
});

// POST /jobs
jobsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateJobSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { leads } = parsed.data;
  const { batchId, leadIds } = await jobService.createBatch(leads);

  res.status(202).json({
    job_id: batchId,
    lead_ids: leadIds,
    total: leads.length,
    message: 'Batch accepted. Poll GET /jobs/:id for status.',
  });
});

// GET /jobs/:id
jobsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: 'Missing job id' });
    return;
  }

  const { batch, leads } = await jobService.getBatch(id);

  if (!batch) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    job_id: batch.id,
    status: batch.status,
    total: batch.total_leads,
    completed: batch.completed_leads,
    failed: batch.failed_leads,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    leads: leads.map((l: LeadRecord) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      company: l.company,
      status: l.status,
      attempt_count: l.attempt_count,
      enrichment_result: l.enrichment_result,
      error_message: l.error_message,
    })),
  });
});