# Section 1 – System Design

## Architecture Overview

This design is built around one core promise: **each lead is owned, isolated, and processed independently**.
The API returns immediately, the ingestion layer tags tenant context, and the background pipeline delivers results asynchronously.

### Component diagram

```
Tenant A ──┐
Tenant B ──┼──► API Gateway ──► Ingestion Layer ──► Queue (BullMQ) ──► Workers ──► 
Tenant C ──┘  
Third-party APIs / LLMs
                (validate, tag)     (Redis-backed)    (stateless)   (Clearbit, Apollo)
                                                         │
                                                         ▼
                                                      PostgreSQL
                                                  (RLS enforced)
                                                         │
                                           Delivery: REST / polling / webhooks
```

### Why it matters

- **Data isolation** is enforced at ingestion: every lead gets a `tenant_id` before enqueueing.
- **Per-lead jobs** isolate failures and retries at the individual lead level.
- **Background processing** keeps the API fast and scales horizontally.

---

## Tenant-aware ingestion

### Data isolation

When Tenant A submits a lead, the ingestion layer immediately tags it with `tenant_id: 123`.
That lead cannot later show up in Tenant B's dashboard, because both the queue and storage layers preserve tenant context.

### Contextual tagging

Each lead record contains:
- `tenant_id`
- `batch_id`
- `lead_id`
- source metadata

This is essential to prevent any tenant's ICP, enrichment signals, or model tuning data from leaking to another tenant.

### API workflow

A real production workflow looks like:

```
POST /api/v1/leads
Authorization: Bearer <tenant-token>
{
  "leads": [
    { "name": "Alice", "email": "alice@acme.com", "company": "Acme Corp" }
  ]
}
```

The request token identifies the tenant. The backend authenticates the token, resolves `tenant_id`, validates payload fields, and tags each lead before it enters the queue.

### Ingestion sources

Supported sources include:
- API requests
- webhooks from partner systems
- CRM integrations (Salesforce, HubSpot)
- raw inputs such as email or LinkedIn URL

The ingestion layer validates data, normalizes fields, prioritizes the source, and routes each lead into the queue with tenant metadata.

---

## API Gateway & Ingestion Layer

The gateway is responsible for:
- authenticating tenant requests
- routing requests to the ingestion service
- applying per-tenant rate limits
- rejecting malformed payloads before they enter the pipeline

The ingestion layer is responsible for:
- tagging every job with `tenant_id`
- validating and normalizing leads
- prioritizing jobs based on tier or source
- enqueueing each lead as an individual job

---

## Queueing & Async Processing

### Why BullMQ?

BullMQ is used for:
- concurrency control and rate limiting for complex sync jobs
- scheduled jobs and cleanup tasks where a single instance must own the work
- parent/child flows for complex automation
- delivering a single, reliable worker execution model instead of `node-cron` on all instances

This makes BullMQ a strong fit for a GTM pipeline that needs reliable retries, DLQ semantics, and multi-instance coordination.

### Job model: one lead, one job

Every lead enters the queue as an individual BullMQ job. This enables:
- horizontal scaling of consumers
- independent retry and failure handling
- batch processing without batch-level blockage
- fine-grained tenant fairness

### Shared queue architecture

For MVP, a shared BullMQ queue is preferable to per-tenant queues.
It reduces operational complexity while still supporting tenant fairness through priority-based scheduling.

Premium tenants can be assigned higher priority, so their jobs are processed ahead of lower-tier tenants, without needing separate infrastructure.

---

## Retry Logic & Dead Letter Queue

### Retry policy

Workers retry transient failures with exponential backoff:

| Attempt | Delay |
|--------|--------|
| 1 | 1s |
| 2 | 5s |
| 3 | 30s |

### Permanent failures

Permanent failures such as invalid input or provider 4xx responses are not retried. They are immediately marked failed.

### Dead-letter queue

Jobs that exhaust retries move to a DLQ so operators can inspect and reprocess them later.
This keeps failures contained at the job level while the main pipeline continues.

---

## Rate Limiting & Provider Failure

### Provider rate limits

External providers are treated as unreliable dependencies.
The system controls provider usage with worker-level concurrency limits and Redis-backed rate limiting.

If a provider limit is reached, jobs are delayed rather than immediately failed, preventing retry storms.

### Graceful degradation

If a provider becomes unavailable, workers can skip that enrichment step and continue the pipeline with partial results.
This prevents a dependency outage from failing the whole lead or batch.

### LLM budget control

Tenant usage is tracked and budget thresholds trigger fallback behavior:
- switch to cheaper models
- skip non-critical enrichment steps
- preserve core pipeline progress instead of failing leads

---

## Multi-Tenant Isolation

### Database-level isolation

PostgreSQL uses Row-Level Security (RLS) so every query is scoped to the current `tenant_id`.
This is the strongest guard against cross-tenant data leakage.

### Queue-level isolation

All BullMQ jobs include `tenant_id` in the payload and metadata.
That allows tenant-aware scheduling and observability, even when using a shared queue.

### Tenant fairness

Tenant fairness is enforced through:
- priority scheduling for premium/standard/free tiers
- per-tenant or per-tier concurrency limits
- optional separate queues when hard isolation is required

---

## Observability

From day one, instrument these fields:
- `tenant_id`
- `job_id`
- `batch_id`
- `provider`
- `attempt`

Track these metrics:

| Metric | Why |
|-------|-----|
| `queue.depth` | backlog detection |
| `job.throughput` | processing rate |
| `job.failure_rate` | provider/data issues |
| `processing.p95` / `p99` | tail latency |
| `batch.completion_time` | SLA tracking |
| `retry_count` | systemic retry patterns |

Alert on:
- sustained queue backlog
- elevated error rates
- high latency spikes
- provider quota exhaustion

Structured logs and tenant-scoped metrics make debugging and compliance much easier.


- Queue depth > 10K jobs for > 5 minutes → PagerDuty
- p99 enrichment latency > 10s → Slack warning
- Error rate > 10% over 5-minute window → PagerDuty
- Provider budget at 80% → Slack warning

### Structured log format for a failed enrichment job

```json
{
  "level": "error",
  "message": "Enrichment failed after all retries",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "batch_id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "tenant_id": "a87ff679-a2f3-471d-8c2a-8c4e1a1e7a3b",
  "provider": "clearbit",
  "attempts_made": 3,
  "final_error": "Enrichment API error: upstream timeout",
  "lead_email": "bob@globex.com"
}
```

Every log line includes `tenant_id` and `batch_id` so failures can be queried by tenant or batch in any log aggregator (Datadog, Loki, CloudWatch).

---

## Trade-off Questions

### Sync vs. async enrichment

**Sync** (enrich inline, block the request) makes sense when:
- The caller needs the result immediately (e.g. a live form submission that shows enrichment data to the user in real time)
- The batch is tiny (1–5 leads)
- Latency SLA is under 2 seconds and providers are reliable

**Async** (queue and poll/webhook) is correct when:
- Batches are large (100+ leads)
- Provider latency is unpredictable
- Cost optimisation requires batching or deduplication before calling APIs

For this platform: **async always**. The use case is bulk B2B lead enrichment, not real-time UX. Sync enrichment at 5–10M leads/month would require enormous horizontal scaling of the API tier with no benefit.

### Shared queue vs. per-tenant queues

A single queue with priority scores is simpler and sufficient at early scale. Per-tenant queues give harder isolation and per-tenant observability but add operational complexity (N queues to monitor, N worker pools to tune).

**Decision**: Start with a single queue + priority. Add per-tenant queues when a premium tenant reports SLA violations that priority scores cannot resolve.

### Cost vs. latency: pre-enrich or enrich on demand

**Pre-enrich all leads on upload**: higher cost (some leads will never be used), lower latency when results are needed.

**Enrich on demand** (when the tenant first accesses a lead): lower cost, higher latency at access time.

**Decision**: Pre-enrich on upload. The platform's value proposition is having enriched data ready. Tenants upload leads *because* they want them enriched. Enrich on demand only makes sense for a "pay per use" pricing model.

### What NOT to build on day one

| Feature | Reason to defer |
|---------|----------------|
| Per-tenant Redis namespacing with ACLs | Operational complexity. App-layer isolation is sufficient early on. |
| Separate worker pools per tier | One pool with priority queues works until SLA violations are observed. |
| Streaming enrichment results (SSE/WebSockets) | Polling is simpler and sufficient. Build SSE when tenants ask for it. |
| Multi-region deployment | Latency is dominated by provider APIs, not geography. Single region is fine until you have customers on multiple continents. |
| Custom LLM fine-tuning | Off-the-shelf models are sufficient. Fine-tuning adds cost and MLOps complexity with unclear ROI at this stage. |
