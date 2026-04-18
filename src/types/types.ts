export type Lead = {
  name: string;
  email: string;
  company: string;
};

export type EnrichmentResult = {
  industry: string;
  company_size: string;
  icp_score: number;
  linkedin_url: string;
  enriched_at: string;
};

export type LeadStatus = 'pending' | 'processing' | 'complete' | 'failed';

export type BatchRecord = {
  id: string;
  total_leads: number;
  completed_leads: number;
  failed_leads: number;
  status: 'pending' | 'processing' | 'complete';
  created_at: string;
  updated_at: string;
};

export type LeadRecord = {
  id: string;
  batch_id: string;
  name: string;
  email: string;
  company: string;
  status: LeadStatus;
  enrichment_result: EnrichmentResult | null;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type EnrichmentJobData = {
  lead_id: string;
  batch_id: string;
  lead: Lead;
};