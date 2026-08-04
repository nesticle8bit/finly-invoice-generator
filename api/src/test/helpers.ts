import { pool } from '../config/database';

/**
 * Integration tests need a real Postgres. When none is reachable (typical local
 * run without a test DB) they are skipped rather than failing the suite.
 */
export async function databaseAvailable(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Wipes every table so each suite starts from a known state. */
export async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE invoice_items, invoice_share_tokens, invoices, clients,
             invitation_codes, profiles, users
    RESTART IDENTITY CASCADE
  `);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.local`;
}
