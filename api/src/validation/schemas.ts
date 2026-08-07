import { z } from 'zod';

/**
 * Every schema here is strict about *shape* only. Business rules that decide a
 * status code other than 400 (wrong password, spent invite code, foreign
 * client_id) stay in the controllers.
 */

/** DECIMAL(10,2) tops out here; larger values fail in Postgres, not in JS. */
const MAX_DECIMAL = 99_999_999.99;

/** Accepts a number or a numeric string — form inputs send strings. */
const numeric = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine((value) => Number.isFinite(value), 'must be a number');

const money = numeric.refine(
  (value) => value >= 0 && value <= MAX_DECIMAL,
  `must be between 0 and ${MAX_DECIMAL}`
);

/**
 * Postgres DATE columns. The UI posts 'YYYY-MM-DD' from a date input but echoes
 * back a full ISO timestamp when it saves a record it just loaded, so both are
 * accepted and normalised to the day.
 */
const dateOnly = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid date')
  .transform((value) => new Date(value).toISOString().slice(0, 10));

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const invoiceItem = z.object({
  description: z.string().trim().min(1, 'is required').max(5000),
  hours: money,
  rate: money,
});

// ---------- auth ----------

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'is required').max(255),
  email: z.string().trim().min(1, 'is required').max(255).email('must be a valid email'),
  password: z.string().min(8, 'must be at least 8 characters').max(200),
  invite_code: z.string().trim().max(20).optional(),
});

/**
 * Deliberately loose: enforcing the password policy here would answer "that is
 * not even a valid password for this app" with a 400 before the 401, which
 * tells an attacker something about the stored value.
 */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'is required').max(255),
  password: z.string().min(1, 'is required').max(200),
});

// ---------- clients ----------

const clientFields = {
  name: z.string().trim().min(1, 'is required').max(255),
  address: optionalText(2000),
  city: optionalText(255),
  postal_code: optionalText(50),
  country: optionalText(100),
  vat: optionalText(100),
  email: optionalText(255),
  currency: z.string().trim().max(10).nullish(),
};

export const createClientSchema = z.object(clientFields);
export const updateClientSchema = z.object({ ...clientFields, name: clientFields.name.optional() });

// ---------- invoices ----------

const invoiceFields = {
  client_id: numeric.refine(Number.isInteger, 'must be an id').nullish(),
  invoice_number: z.string().trim().min(1, 'is required').max(20),
  date: dateOnly,
  due_date: dateOnly.nullish(),
  status: z.enum(['draft', 'sent', 'paid']).optional(),
  notes: optionalText(10_000),
  period_start: dateOnly.nullish(),
  period_end: dateOnly.nullish(),
  is_template: z.boolean().optional(),
};

export const createInvoiceSchema = z.object({
  ...invoiceFields,
  items: z.array(invoiceItem).min(1, 'at least one item is required').max(500),
});

/** PUT is a partial update: every field is optional, `items` replaces the set. */
export const updateInvoiceSchema = z.object({
  ...invoiceFields,
  invoice_number: invoiceFields.invoice_number.optional(),
  date: invoiceFields.date.optional(),
  items: z.array(invoiceItem).max(500).optional(),
});

// ---------- profile ----------

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  vat: optionalText(100),
  phone: optionalText(50),
  swift: optionalText(100),
  iban: optionalText(150),
  bank_name: optionalText(255),
  default_rate: money.nullish(),
  currency: z.string().trim().max(10).nullish(),
  notes_template: optionalText(10_000),
});

// ---------- share ----------

export const createShareSchema = z.object({
  password: z.string().min(4, 'must be at least 4 characters').max(200),
  expires_in_days: numeric
    .refine((value) => value > 0 && value <= 365, 'must be between 1 and 365')
    .nullish(),
});

export const accessShareSchema = z.object({
  password: z.string().min(1, 'is required').max(200),
});

export const updateSharedWPSchema = z.object({
  password: z.string().max(200).optional(),
  session_token: z.string().max(2000).optional(),
  items: z.array(
    z.object({
      id: numeric.refine(Number.isInteger, 'must be an id'),
      // Validated for content in the controller: the rule is shared with the
      // parser that has to read the value back out of the description.
      wp_number: z.union([z.string(), z.number(), z.null()]).optional(),
    })
  ),
});

// ---------- route params ----------

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'must be a numeric id'),
});
