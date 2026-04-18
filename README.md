# AI Enrichment Platform – Technical Assessment

## Repository Structure

```
/
├── /src        # Section 2 – Working async enrichment pipeline (Node.js + TypeScript)
├── /design     # Sections 1, 3, 4, 5 – Written design documents
└── README.md   # This file
```

---

## Quick Start (Section 2 – Working Code)

### Prerequisites
- Node.js 20+
- Docker and Docker Compose (for Redis)

```bash
cd src
npm install
docker compose up -d        # starts Redis
cp .env.example .env
npm run migrate             # runs schema migrations
npm run dev                 # starts API server + worker
```

Server runs on `http://localhost:3000`.

### API

**Submit a batch of leads**
```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "leads": [
      { "name": "Alice Smith", "email": "alice@acme.com", "company": "Acme Corp" },
      { "name": "Bob Jones",   "email": "bob@globex.com", "company": "Globex" }
    ]
  }'
# → 202 Accepted with job_id
```

**Poll for results**
```bash
curl http://localhost:3000/jobs/{job_id}
# → status, per-lead results, enrichment data
```

---

## Architecture (Summary)

```
POST /jobs → Ingestion (validate + tag) → BullMQ Queue → Workers
                                                             │
                                              ┌──────────────┤
                                              ▼              ▼
                                       Enrichment APIs    LLM Layer
                                              │              │
                                              └──────┬───────┘
                                                     ▼
                                               PostgreSQL
                                                     │
                                          GET /jobs/:id (polling)
```

**Key decisions:**
- **One BullMQ job per lead** — granular retry, independent failure, clean DLQ semantics
- **BullMQ over SQS** — Redis already in stack, built-in backoff/concurrency, simpler local dev
- **Exponential backoff (1s → 2s → 4s)** — retries up to 3 times, then marks lead `failed` and moves on
- **Router → Service → Repository** — each layer has one responsibility and no knowledge of the others
- **Structured JSON logging throughout** — every log line includes `lead_id`, `batch_id`, `tenant_id`

---

## Design Documents

| Section | File | Status |
|---------|------|--------|
| 1 – System Design | [design/section1-system-design.md](design/section1-system-design.md) | ✅ Complete |
| 3 – LLM Architecture | [design/section3-llm-architecture.md](design/section3-llm-architecture.md) | 🔄 In progress |
| 4 – Security & Governance | [design/section4-security.md](design/section4-security.md) | 🔄 In progress |
| 5 – Scaling & Real-World Thinking | [design/section5-scaling.md](design/section5-scaling.md) | 🔄 In progress |

---

## Assumptions

- Worker runs in-process with the API server for local dev simplicity. In production, run `npm run worker` as a separate process and scale independently.
- SQLite was chosen for portability and simplicity in this exercise.
- No authentication middleware is included in the API (tenant isolation is demonstrated via the data model and RLS design in Section 4).
