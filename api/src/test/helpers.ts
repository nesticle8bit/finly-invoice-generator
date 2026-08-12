import { pool } from '../config/database';

/**
 * These tests TRUNCATE every table, so they must only ever point at a database
 * that exists to be destroyed. `api/.env` holds real credentials for local
 * development, and running the suite with it loaded wiped the live data — the
 * name has to be checked before a single statement runs.
 *
 * CI uses `invoice_generator_test`. Set ALLOW_DESTRUCTIVE_TESTS=true to opt a
 * differently named throwaway database in, deliberately.
 */
function isDisposableDatabase(): boolean {
  if (process.env.ALLOW_DESTRUCTIVE_TESTS === 'true') return true;
  return /(^|[_-])tests?([_-]|$)/i.test(process.env.DB_NAME ?? '');
}

/**
 * Integration tests need a real Postgres. When none is reachable, or the one
 * configured is not a throwaway, they are skipped rather than failing — and
 * never truncate.
 */
export async function databaseAvailable(): Promise<boolean> {
  if (!isDisposableDatabase()) {
    console.warn(
      `[tests] Skipping integration tests: DB_NAME="${process.env.DB_NAME ?? ''}" is not a test database. ` +
        'These tests TRUNCATE every table. Point DB_NAME at a throwaway database, ' +
        'or set ALLOW_DESTRUCTIVE_TESTS=true if it really is disposable.'
    );
    return false;
  }

  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Wipes every table so each suite starts from a known state. */
export async function resetDatabase(): Promise<void> {
  // Second line of defence: a suite that forgets the availability check must
  // still not be able to truncate a real database.
  if (!isDisposableDatabase()) {
    throw new Error(
      `Refusing to TRUNCATE "${process.env.DB_NAME ?? ''}" — it is not a test database.`
    );
  }

  await pool.query(`
    TRUNCATE invoice_items, invoice_share_tokens, invoices, clients,
             invitation_codes, profiles, users
    RESTART IDENTITY CASCADE
  `);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.local`;
}
