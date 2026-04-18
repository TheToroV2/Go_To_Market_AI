import { db } from './db/pool';

async function migrate(): Promise<void> {
  console.log('[migrate] Running migrations...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      total_leads INTEGER NOT NULL DEFAULT 0,
      completed_leads INTEGER NOT NULL DEFAULT 0,
      failed_leads INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      enrichment_result TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS leads_batch_id_idx ON leads(batch_id);
    CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
  `);

  console.log('[migrate] Done.');
  await db.end();
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
