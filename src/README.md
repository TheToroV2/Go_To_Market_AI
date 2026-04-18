# Enrichment Pipeline

A minimal, production-like async lead enrichment pipeline built with Node.js, TypeScript, BullMQ, and SQLite.

## Architecture

```
POST /jobs → Ingestion → BullMQ Queue → Worker → Mock Enrichment API
                                                        ↓
GET /jobs/:id ←──────── SQLite ←─── Store result / mark failed
```

Each lead in a batch is enqueued as an **individual BullMQ job**. The API returns immediately with a `job_id`. Workers process leads concurrently, retrying up to 3 times with exponential backoff. Failed leads are marked individually — they never block the rest of the batch.

## Key Design Decisions

- **One job per lead** (not per batch): gives granular retry control and prevents one bad lead from blocking thousands of others.
- **BullMQ over SQS**: lower operational overhead for early stage, Redis is already needed, built-in exponential backoff and concurrency control.
- **Zod validation** at the router layer keeps services clean — invalid input never reaches the queue.
- **Structured JSON logging** throughout so logs are parseable by any log aggregator from day one.
- **Worker runs in-process** for local dev simplicity. In production, run it as a separate process (`npm run worker`) and scale independently.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.example .env
```

The defaults in `.env.example` match the Docker Compose setup and work out of the box.

### 4. Run migrations

```bash
npm run migrate
```

### 5. Start the server

```bash
npm run dev
```

The server starts on `http://localhost:3000` and boots a worker in the same process.

## API Usage

### Submit a batch of leads

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "leads": [
      { "name": "Alice Smith", "email": "alice@acme.com", "company": "Acme Corp" },
      { "name": "Bob Jones",   "email": "bob@globex.com", "company": "Globex" },
      { "name": "Carol White", "email": "carol@initech.com", "company": "Initech" }
    ]
  }'
```

Response (202 Accepted):
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_ids": ["...", "...", "..."],
  "total": 3,
  "message": "Batch accepted. Poll GET /jobs/:id for status."
}
```

### Poll for results

```bash
curl http://localhost:3000/jobs/550e8400-e29b-41d4-a716-446655440000
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "complete",
  "total": 3,
  "completed": 2,
  "failed": 1,
  "leads": [
    {
      "id": "...",
      "email": "alice@acme.com",
      "status": "complete",
      "attempt_count": 1,
      "enrichment_result": {
        "industry": "SaaS",
        "company_size": "51-200",
        "icp_score": 82,
        "linkedin_url": "https://linkedin.com/company/acme-corp",
        "enriched_at": "2024-01-15T10:30:00.000Z"
      }
    },
    {
      "id": "...",
      "email": "bob@globex.com",
      "status": "failed",
      "attempt_count": 3,
      "error_message": "Enrichment API error: upstream timeout for bob@globex.com"
    }
  ]
}
```

## Retry Behaviour

| Attempt | Delay |
|---------|-------|
| 1st retry | 1s |
| 2nd retry | 2s |
| 3rd retry | 4s |
| After 3rd | Marked `failed`, batch continues |

## Running the Worker Separately (production-like)

```bash
# Terminal 1 — API server only
npm run dev

# Terminal 2 — Worker process
npm run worker
```

Remove the `import './workers/enrichment.worker'` line from `src/index.ts` when doing this.

## Project Structure

```
src/
├── config/         # Env config loader
├── db/             # Pool, Redis connection, migrations
├── repositories/   # All database access (lead, batch)
├── routes/         # Express routers (HTTP layer only)
├── services/       # Business logic (job creation, enrichment mock)
├── types/          # Shared TypeScript interfaces
├── workers/        # BullMQ worker process
└── index.ts        # Entry point
```
