import type { EnrichmentResult, Lead } from '../types/types';

const INDUSTRIES = ['SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Enterprise Software', 'Media'];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Simulates a third-party enrichment API call.
 * - Random latency: 200–800ms
 * - ~20% failure rate to simulate real-world unreliability
 */
export async function mockEnrichLead(lead: Lead): Promise<EnrichmentResult> {
  // Simulate network latency
  const latency = randomBetween(200, 800);
  await new Promise((resolve) => setTimeout(resolve, latency));

  // Simulate ~20% failure rate
  if (Math.random() < 0.2) {
    throw new Error(`Enrichment API error: upstream timeout for ${lead.email}`);
  }

  return {
    industry: INDUSTRIES[randomBetween(0, INDUSTRIES.length - 1)]!,
    company_size: SIZES[randomBetween(0, SIZES.length - 1)]!,
    icp_score: randomBetween(1, 100),
    linkedin_url: `https://linkedin.com/company/${lead.company.toLowerCase().replace(/\s+/g, '-')}`,
    enriched_at: new Date().toISOString(),
  };
}