# Section 4 – Security & Data Governance

> **Status**: To be completed.

## Row-Level Security (RLS)

### Implementation in Supabase / PostgreSQL

<!-- How do you implement RLS for a multi-tenant leads table? -->

```sql
-- TODO: SQL policy for leads table enforcing tenant isolation
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY ...
```

### Failure modes of RLS

<!-- What are the ways RLS can be bypassed or fail silently?
     How have you audited for them? (e.g. superuser connections, SECURITY DEFINER functions) -->

---

## Tenant Isolation

### Beyond RLS

<!-- Separate schemas? Connection pooling per tenant (PgBouncer)?
     Query tagging (pg_stat_statements)? -->

### Shared infrastructure isolation (Redis, queues)

<!-- How do you isolate tenants on shared Redis without per-tenant ACLs? -->

---

## API Key Management

### Storing and rotating third-party keys

<!-- Never in env vars committed to git. Where do they live?
     (AWS Secrets Manager, Vault, Supabase Vault) -->

### Per-tenant vs. platform-level credentials

<!-- When does a tenant bring their own OpenAI key vs. use the platform's? -->

### Detecting a leaked key

<!-- How do you detect and respond to a compromised API key? -->

---

## Audit Logging

### Events to log

<!-- What constitutes an auditable event in this system?
     (data access, enrichment calls, key rotations, admin actions) -->

### Structure for compliance (SOC 2)

<!-- What fields does every audit log entry include? -->

### Tamper-proofing

<!-- How do you ensure audit logs cannot be modified after the fact?
     (append-only storage, write-once S3, log signing) -->
