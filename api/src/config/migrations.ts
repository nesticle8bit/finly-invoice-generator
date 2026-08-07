import type { PoolClient } from 'pg';

export interface Migration {
  /** Immutable once applied — it is the key stored in `schema_migrations`. */
  id: string;
  sql: string;
  /** Runs after a failure to turn a Postgres error into something actionable. */
  onError?: (client: PoolClient) => Promise<void>;
}

const DUPLICATE_NUMBERS = `
SELECT user_id, invoice_number, COUNT(*) AS copies
FROM invoices
GROUP BY user_id, invoice_number
HAVING COUNT(*) > 1
ORDER BY copies DESC`;

/**
 * Append-only. Every statement is written to be idempotent so the baseline can
 * be applied to a database that predates this runner without dropping anything.
 */
export const migrations: Migration[] = [
  {
    id: '0001_initial_schema',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        vat VARCHAR(100),
        phone VARCHAR(50),
        logo_path VARCHAR(500),
        signature_path VARCHAR(500),
        swift VARCHAR(100),
        iban VARCHAR(150),
        bank_name VARCHAR(255),
        default_rate DECIMAL(10,2) DEFAULT 25.00,
        currency VARCHAR(10) DEFAULT 'EUR',
        notes_template TEXT DEFAULT 'This invoice is for the total amount of hours worked.',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        city VARCHAR(255),
        postal_code VARCHAR(50),
        country VARCHAR(100),
        vat VARCHAR(100),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        invoice_number VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        subtotal DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        period_start DATE,
        period_end DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        hours DECIMAL(10,2) NOT NULL DEFAULT 0,
        rate DECIMAL(10,2) NOT NULL DEFAULT 0,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        item_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_share_tokens (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        token VARCHAR(64) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invitation_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invitation_codes(code);
      CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
      CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON invoice_share_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_share_tokens_invoice_id ON invoice_share_tokens(invoice_id);
      -- The invoice list always filters by owner and sorts by date/status.
      CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices(user_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);
    `,
  },
  {
    id: '0002_invoice_extras',
    sql: `
      ALTER TABLE clients  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT NULL;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP DEFAULT NULL;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;
    `,
  },
  {
    id: '0003_unique_invoice_number',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_user_number
        ON invoices(user_id, invoice_number);
    `,
    // Refusing to create the index means the data already violates it, and
    // picking which copy to renumber is a human decision.
    onError: async (client) => {
      const dupes = await client.query(DUPLICATE_NUMBERS);
      console.error('   Duplicate invoice numbers already exist:');
      dupes.rows.forEach((r) =>
        console.error(`     user ${r.user_id} → invoice ${r.invoice_number} (${r.copies} copies)`)
      );
      console.error('   Renumber them, then run `npm run migrate` again.');
    },
  },
  {
    id: '0004_due_date',
    sql: `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

      -- The overdue lookup is always "mine, still unpaid, past due".
      CREATE INDEX IF NOT EXISTS idx_invoices_user_due
        ON invoices(user_id, due_date)
        WHERE status <> 'paid';
    `,
  },
];
