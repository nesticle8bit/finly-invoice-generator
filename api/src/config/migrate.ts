import { pool } from './database';
import dotenv from 'dotenv';

dotenv.config();

const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles (settings)
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

-- Clients table
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

-- Invoices table
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

-- Invoice items
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

-- Share tokens (for collaborators to add WP numbers without an account)
CREATE TABLE IF NOT EXISTS invoice_share_tokens (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Invitation codes (single-use, required for registration by non-first users)
CREATE TABLE IF NOT EXISTS invitation_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON invoice_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_invoice_id ON invoice_share_tokens(invoice_id);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running database migrations...');
    await client.query(schema);
    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
