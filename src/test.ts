import { db } from './db/pool';
import { batchRepository, leadRepository } from './repositories/lead.repository';
import { mockEnrichLead } from './services/enrichment.service';
import type { Lead } from './types/types';

let passCount = 0;
let failCount = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n📋 Running Enrichment Pipeline Tests\n');

  // Test 1: Database migrations
  await test('Database: Create batch', async () => {
    const batchId = 'test-batch-1';
    const batch = await batchRepository.create(batchId, 3);
    if (!batch || batch.id !== batchId) throw new Error('Batch not created');
  });

  await test('Database: Find batch by ID', async () => {
    const batch = await batchRepository.findById('test-batch-1');
    if (!batch) throw new Error('Batch not found');
  });

  await test('Database: Create lead', async () => {
    const leadId = 'test-lead-1';
    const lead = await leadRepository.create(
      leadId,
      'test-batch-1',
      'Alice Smith',
      'alice@example.com',
      'Acme Corp'
    );
    if (!lead || lead.id !== leadId) throw new Error('Lead not created');
  });

  await test('Database: Find lead by batch ID', async () => {
    const leads = await leadRepository.findByBatchId('test-batch-1');
    if (!leads || leads.length === 0) throw new Error('Leads not found');
  });

  await test('Database: Update lead to processing', async () => {
    await leadRepository.setProcessing('test-lead-1');
    const lead = await leadRepository.findById('test-lead-1');
    if (lead?.status !== 'processing') throw new Error('Lead not updated to processing');
  });

  await test('Database: Update lead to complete', async () => {
    const result = {
      industry: 'SaaS',
      company_size: '51-200',
      icp_score: 85,
      linkedin_url: 'https://linkedin.com/company/acme-corp',
      enriched_at: new Date().toISOString(),
    };
    await leadRepository.setComplete('test-lead-1', result);
    const lead = await leadRepository.findById('test-lead-1');
    if (lead?.status !== 'complete' || !lead.enrichment_result) throw new Error('Lead not completed');
  });

  await test('Database: Update lead to failed', async () => {
    const leadId = 'test-lead-fail';
    await leadRepository.create(leadId, 'test-batch-1', 'Bob', 'bob@example.com', 'Globex');
    await leadRepository.setFailed(leadId, 'Enrichment API error: timeout');
    const lead = await leadRepository.findById(leadId);
    if (lead?.status !== 'failed' || !lead.error_message) throw new Error('Lead not marked as failed');
  });

  // Test 2: Batch counting
  await test('Database: Increment completed leads', async () => {
    const batchId = 'test-batch-2';
    await batchRepository.create(batchId, 2);
    await batchRepository.incrementCompleted(batchId);
    const batch = await batchRepository.findById(batchId);
    if (batch?.completed_leads !== 1) throw new Error('Completed count not incremented');
  });

  await test('Database: Increment failed leads', async () => {
    const batchId = 'test-batch-3';
    await batchRepository.create(batchId, 2);
    await batchRepository.incrementFailed(batchId);
    const batch = await batchRepository.findById(batchId);
    if (batch?.failed_leads !== 1) throw new Error('Failed count not incremented');
  });

  await test('Database: Mark batch complete when all leads done', async () => {
    const batchId = 'test-batch-4';
    await batchRepository.create(batchId, 1);
    await batchRepository.incrementCompleted(batchId);
    const batch = await batchRepository.findById(batchId);
    if (batch?.status !== 'complete') throw new Error('Batch not marked complete');
  });

  // Test 3: Enrichment service
  await test('Service: Mock enrichment succeeds', async () => {
    const lead: Lead = { name: 'Test', email: 'test@example.com', company: 'Test Co' };
    const result = await mockEnrichLead(lead);
    if (!result.industry || !result.company_size || result.icp_score === undefined) {
      throw new Error('Enrichment result missing fields');
    }
  });

  await test('Service: Mock enrichment has realistic latency', async () => {
    const lead: Lead = { name: 'Test', email: 'test@example.com', company: 'Test Co' };
    const start = Date.now();
    await mockEnrichLead(lead);
    const elapsed = Date.now() - start;
    if (elapsed < 200) throw new Error(`Latency too low: ${elapsed}ms (expected 200-800ms)`);
  });

  // Test 4: Retry simulation
  let failureCount = 0;
  await test('Service: ~20% failure rate over 100 calls', async () => {
    const lead: Lead = { name: 'Test', email: 'test@example.com', company: 'Test Co' };
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
      try {
        await mockEnrichLead(lead);
      } catch {
        failureCount++;
      }
    }
    const failureRate = failureCount / attempts;
    // Allow 10-30% failure rate (expected ~20%)
    if (failureRate < 0.1 || failureRate > 0.3) {
      throw new Error(`Failure rate ${(failureRate * 100).toFixed(1)}% outside expected 10-30%`);
    }
  });

  // Test 5: Type checking
  await test('Types: LeadRecord structure is correct', async () => {
    const lead = await leadRepository.findById('test-lead-1');
    if (!lead || !('id' in lead && 'batch_id' in lead && 'status' in lead && 'attempt_count' in lead)) {
      throw new Error('LeadRecord missing required fields');
    }
  });

  await test('Types: BatchRecord structure is correct', async () => {
    const batch = await batchRepository.findById('test-batch-1');
    if (!batch || !('id' in batch && 'total_leads' in batch && 'status' in batch)) {
      throw new Error('BatchRecord missing required fields');
    }
  });

  // Cleanup
  await db.end();

  // Summary
  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
