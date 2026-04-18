# Section 5 – Scaling & Real-World Thinking

> **Status**: To be completed.

## What breaks at 10x?

Current baseline: ~1M leads/month
10x target: ~10M leads/month

<!-- Walk through each layer and identify the bottleneck:
     - Queue throughput: how many jobs/sec can BullMQ handle on a single Redis node?
     - DB write throughput: PostgreSQL write bottleneck at N leads/sec?
     - LLM costs: what does 10x volume cost at current per-call pricing?
     - Provider rate limits: do current limits scale, or do you need multiple API keys / accounts? -->

---

## What would you optimize first?

<!-- Given the bottlenecks above, what do you tackle in the first sprint?
     Be specific: what would you change, measure, and validate?
     Example: "Add a read replica to offload GET /jobs/:id queries" -->

---

## What would you NOT optimize yet?

<!-- Identify 2-3 things that look like problems but are premature:
     - What signal would tell you it's time to revisit them?
     Example: "Per-tenant Redis namespacing — not needed until we have >50 tenants
     or a compliance requirement. Signal: a tenant reports data in their dashboard
     that doesn't belong to them." -->

---

## One Decision You'd Undo

<!-- Hypothetical: 6 months in, what architectural decision would you revisit?
     This is about demonstrating trade-off awareness over time, not admitting mistakes.
     Example: "I'd undo running the worker in the same process as the API server.
     It seemed convenient early on but made independent scaling impossible and
     caused memory pressure during large batch processing." -->
