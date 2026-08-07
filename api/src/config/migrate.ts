import dotenv from 'dotenv';
import { pool } from './database';
import { migrations } from './migrations';

dotenv.config();

/** Arbitrary but fixed: two runners must never apply the same migration twice. */
const ADVISORY_LOCK_KEY = 4242;

const CONTROL_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
)`;

export class MigrationError extends Error {
  constructor(
    readonly migrationId: string,
    readonly cause: unknown
  ) {
    super(`Migration ${migrationId} failed: ${(cause as Error).message}`);
    this.name = 'MigrationError';
  }
}

type Log = (message: string) => void;

/**
 * Applies every pending migration and returns how many ran. Throws on the first
 * failure; the caller decides whether that is fatal.
 *
 * Leaves the pool open — the API calls this during boot and keeps using it.
 */
export async function runMigrations(log: Log = () => undefined): Promise<number> {
  const client = await pool.connect();

  try {
    await client.query(CONTROL_TABLE);
    // Held for the whole run: a second instance booting at the same time waits
    // here instead of racing to apply the same migration.
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

    const applied = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
    const done = new Set(applied.rows.map((r) => r.id));
    const pending = migrations.filter((m) => !done.has(m.id));

    for (const migration of pending) {
      try {
        // One transaction per migration: a failure leaves the ones before it
        // applied and recorded, so a re-run resumes instead of starting over.
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
        await client.query('COMMIT');
        log(`   ${migration.id} ... ok`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        log(`   ${migration.id} ... failed`);
        if (migration.onError) await migration.onError(client).catch(() => undefined);
        throw new MigrationError(migration.id, err);
      }
    }

    return pending.length;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

/** `npm run migrate` — the standalone entry point. */
async function main(): Promise<void> {
  let failed = false;

  try {
    console.log('🚀 Running database migrations...');
    const count = await runMigrations((line) => console.log(line));
    console.log(count === 0 ? '✅ Already up to date.' : `✅ Applied ${count} migration(s).`);
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}`);
    failed = true;
  } finally {
    await pool.end().catch(() => undefined);
  }

  if (failed) process.exit(1);
}

if (require.main === module) void main();
