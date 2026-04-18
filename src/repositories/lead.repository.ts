import { db } from '../db/pool';
import type { BatchRecord, EnrichmentResult, LeadRecord, LeadStatus } from '../types/types';

export const batchRepository = {
  async create(id: string, totalLeads: number): Promise<BatchRecord> {
    await db.query(
      `INSERT INTO batches (id, total_leads, status, created_at, updated_at)
       VALUES (?, ?, 'pending', datetime('now'), datetime('now'))`,
      [id, totalLeads]
    );
    return {
      id,
      total_leads: totalLeads,
      completed_leads: 0,
      failed_leads: 0,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async findById(id: string): Promise<BatchRecord | null> {
    const result = await db.query<BatchRecord>(
      `SELECT * FROM batches WHERE id = ?`,
      [id]
    );
    return result.rows[0] ?? null;
  },

  async incrementCompleted(id: string): Promise<void> {
    const batch = await this.findById(id);
    if (!batch) return;
    const newCompleted = batch.completed_leads + 1;
    const newStatus = (newCompleted + batch.failed_leads) >= batch.total_leads ? 'complete' : 'processing';
    await db.query(
      `UPDATE batches
       SET completed_leads = ?, updated_at = datetime('now'), status = ?
       WHERE id = ?`,
      [newCompleted, newStatus, id]
    );
  },

  async incrementFailed(id: string): Promise<void> {
    const batch = await this.findById(id);
    if (!batch) return;
    const newFailed = batch.failed_leads + 1;
    const newStatus = (batch.completed_leads + newFailed) >= batch.total_leads ? 'complete' : 'processing';
    await db.query(
      `UPDATE batches
       SET failed_leads = ?, updated_at = datetime('now'), status = ?
       WHERE id = ?`,
      [newFailed, newStatus, id]
    );
  },
};

export const leadRepository = {
  async create(id: string, batchId: string, name: string, email: string, company: string): Promise<LeadRecord> {
    await db.query(
      `INSERT INTO leads (id, batch_id, name, email, company, status, created_at, updated_at, attempt_count)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'), 0)`,
      [id, batchId, name, email, company]
    );
    return {
      id,
      batch_id: batchId,
      name,
      email,
      company,
      status: 'pending',
      enrichment_result: null,
      attempt_count: 0,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async findById(id: string): Promise<LeadRecord | null> {
    const result = await db.query<LeadRecord>(
      `SELECT * FROM leads WHERE id = ?`,
      [id]
    );
    return result.rows[0] ?? null;
  },

  async findByBatchId(batchId: string): Promise<LeadRecord[]> {
    const result = await db.query<LeadRecord>(
      `SELECT * FROM leads WHERE batch_id = ? ORDER BY created_at ASC`,
      [batchId]
    );
    return result.rows;
  },

  async setStatus(id: string, status: LeadStatus): Promise<void> {
    await db.query(
      `UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, id]
    );
  },

  async setProcessing(id: string): Promise<void> {
    await db.query(
      `UPDATE leads
       SET status = 'processing',
           attempt_count = attempt_count + 1,
           updated_at = datetime('now')
       WHERE id = ?`,
      [id]
    );
  },

  async setComplete(id: string, result: EnrichmentResult): Promise<void> {
    await db.query(
      `UPDATE leads
       SET status = 'complete',
           enrichment_result = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(result), id]
    );
  },

  async setFailed(id: string, errorMessage: string): Promise<void> {
    await db.query(
      `UPDATE leads
       SET status = 'failed',
           error_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [errorMessage, id]
    );
  },
};