import { Response } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateInvoicePDF, renderInvoiceHTML, type InvoiceData } from '../services/pdf.service';
import { parsePagination } from '../utils/pagination';
import { lineAmount, sumLineAmounts } from '../utils/money';
import { createInvoiceSchema, updateInvoiceSchema } from '../validation/schemas';
import { logger } from '../config/logger';

/** Postgres unique_violation — a duplicate invoice number for this user. */
const UNIQUE_VIOLATION = '23505';

type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;
type UpdateInvoiceBody = z.infer<typeof updateInvoiceSchema>;

/**
 * A client_id from the request body is attacker-supplied. Without this check an
 * invoice could be attached to someone else's client, and the JOIN would then
 * hand that client's name back in the response.
 */
async function resolveClientName(
  client: PoolClient,
  userId: number,
  clientId: number
): Promise<string | null> {
  const result = await client.query('SELECT name FROM clients WHERE id = $1 AND user_id = $2', [
    clientId,
    userId,
  ]);
  // Returning the name here is what lets the response skip a second round trip
  // just to re-read the row that was written a moment ago.
  return result.rows[0]?.name ?? null;
}

/**
 * One statement for the whole set. The row-per-item loop cost a round trip per
 * task description, which on a month's invoice is 20-30 sequential queries.
 */
async function replaceItems(
  client: PoolClient,
  invoiceId: number | string,
  items: ReadonlyArray<{ description: string; hours: number; rate: number }>
): Promise<Record<string, unknown>[]> {
  await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

  if (items.length === 0) return [];

  const result = await client.query(
    `INSERT INTO invoice_items (invoice_id, description, hours, rate, amount, item_order)
     SELECT $1, d, h, r, a, ord - 1
     FROM unnest($2::text[], $3::numeric[], $4::numeric[], $5::numeric[])
          WITH ORDINALITY AS t(d, h, r, a, ord)
     RETURNING *`,
    [
      invoiceId,
      items.map((i) => i.description),
      items.map((i) => i.hours),
      items.map((i) => i.rate),
      items.map((i) => lineAmount(i.hours, i.rate)),
    ]
  );

  // RETURNING has no guaranteed order — the invoice prints in item_order.
  return result.rows.sort((a, b) => Number(a.item_order) - Number(b.item_order));
}

/**
 * Sortable columns, mapped to SQL. A whitelist is mandatory here: ORDER BY
 * cannot be parameterised, so anything else would be string interpolation.
 */
const SORT_COLUMNS: Record<string, string> = {
  invoice_number: 'i.invoice_number',
  date: 'i.date',
  due_date: 'i.due_date',
  status: 'i.status',
  total: 'i.total',
  client_name: 'c.name',
  created_at: 'i.created_at',
};

/** Overdue is derived, never stored: it changes with the calendar, not an edit. */
function isOverdueExpr(prefix: string): string {
  return `(${prefix}due_date IS NOT NULL AND ${prefix}status <> 'paid' AND ${prefix}due_date < CURRENT_DATE)`;
}

const IS_OVERDUE = isOverdueExpr('i.');
/** RETURNING has no table alias in scope, so the columns are bare there. */
const IS_OVERDUE_RETURNING = isOverdueExpr('');

function resolveSort(rawSort: unknown, rawOrder: unknown): string {
  const column = SORT_COLUMNS[String(rawSort ?? '')] ?? 'i.created_at';
  const direction = String(rawOrder ?? '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${column} ${direction}`;
}

export async function listInvoices(req: AuthRequest, res: Response): Promise<void> {
  const { status, search, client_id, date_from, date_to, is_template, overdue } = req.query;
  const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

  try {
    let sql = `
      SELECT i.id, i.invoice_number, i.date, i.due_date, i.status, i.total, i.created_at,
             i.sent_at, i.is_template, c.name as client_name,
             ${IS_OVERDUE} AS is_overdue
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.user_id = $1
    `;
    const params: unknown[] = [req.userId];
    let paramIdx = 2;

    if (status) {
      sql += ` AND i.status = $${paramIdx++}`;
      params.push(status);
    }

    if (is_template !== undefined) {
      sql += ` AND i.is_template = $${paramIdx++}`;
      params.push(is_template === 'true');
    }

    if (client_id) {
      const clientId = parseInt(client_id as string, 10);
      if (!Number.isFinite(clientId)) {
        res.status(400).json({ error: 'client_id must be a number' });
        return;
      }
      sql += ` AND i.client_id = $${paramIdx++}`;
      params.push(clientId);
    }

    if (date_from) {
      sql += ` AND i.date >= $${paramIdx++}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND i.date <= $${paramIdx++}`;
      params.push(date_to);
    }

    if (overdue === 'true') {
      sql += ` AND ${IS_OVERDUE}`;
    }

    if (search) {
      sql += ` AND (i.invoice_number ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countResult = await query(`SELECT COUNT(*) FROM (${sql}) AS _c`, params);

    sql += ` ORDER BY ${resolveSort(req.query.sort, req.query.order)} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    logger.error('List invoices error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const invoiceResult = await query(
      `SELECT i.*, c.name as client_name, c.address as client_address,
              c.city as client_city, c.postal_code as client_postal_code,
              c.vat as client_vat, c.email as client_email,
              c.currency as client_currency,
              ${IS_OVERDUE} AS is_overdue
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.id = $1 AND i.user_id = $2`,
      [id, req.userId]
    );

    if (invoiceResult.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const itemsResult = await query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order ASC',
      [id]
    );

    res.json({ ...invoiceResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    logger.error('Get invoice error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getNextNumber(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Highest numeric value, not the newest row: an out-of-order or edited
    // invoice used to make the sequence go backwards and collide.
    const result = await query(
      `SELECT COALESCE(MAX(invoice_number::bigint), 0) AS max
       FROM invoices
       WHERE user_id = $1 AND invoice_number ~ '^[0-9]+$'`,
      [req.userId]
    );

    const nextNum = Number(result.rows[0].max) + 1;

    res.json({ number: String(nextNum).padStart(4, '0') });
  } catch (err) {
    logger.error('Next number error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { client_id, invoice_number, date, due_date, status, notes, period_start, period_end, items } =
    req.body as CreateInvoiceBody;

  // A real transaction needs one dedicated connection — issuing BEGIN through
  // the pool ran each statement on an arbitrary connection, so nothing was
  // actually atomic and the BEGIN leaked onto a pooled connection.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let clientName: string | null = null;
    if (client_id != null) {
      clientName = await resolveClientName(client, req.userId!, client_id);
      if (clientName === null) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Unknown client' });
        return;
      }
    }

    const total = sumLineAmounts(items);

    const invoiceResult = await client.query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, date, due_date, status, total, subtotal, notes, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)
       RETURNING *, ${IS_OVERDUE_RETURNING} AS is_overdue`,
      [req.userId, client_id ?? null, invoice_number, date, due_date ?? null, status || 'draft', total, notes, period_start, period_end]
    );

    const invoice = invoiceResult.rows[0];
    const insertedItems = await replaceItems(client, invoice.id, items);

    await client.query('COMMIT');

    res.status(201).json({ ...invoice, client_name: clientName, items: insertedItems });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);

    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      res.status(409).json({ error: `Invoice number ${invoice_number} already exists` });
      return;
    }

    logger.error('Create invoice error', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/** Columns a PUT may write straight through, in the order they are applied. */
const UPDATABLE_COLUMNS = [
  'invoice_number',
  'date',
  'due_date',
  'status',
  'notes',
  'period_start',
  'period_end',
  'is_template',
] as const;

export async function updateInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as UpdateInvoiceBody & Record<string, unknown>;
  const { invoice_number, status, items } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Inside the transaction and row-locked: the ownership check used to run
    // before BEGIN, so the invoice could change between the check and the write.
    const existing = await client.query(
      `SELECT i.id, c.name AS client_name
         FROM invoices i
         LEFT JOIN clients c ON c.id = i.client_id
        WHERE i.id = $1 AND i.user_id = $2
        FOR UPDATE OF i`,
      [id, req.userId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    let clientName: string | null = existing.rows[0].client_name ?? null;

    // Only the keys actually present in the body are written. The old
    // COALESCE($n, column) form could not tell "field omitted" from "field set
    // to null", so a due date, a note or a client could never be cleared.
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown): void => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    for (const column of UPDATABLE_COLUMNS) {
      if (column in body) set(column, body[column] ?? null);
    }

    if ('client_id' in body) {
      const clientId = body.client_id ?? null;
      if (clientId != null) {
        clientName = await resolveClientName(client, req.userId!, clientId);
        if (clientName === null) {
          await client.query('ROLLBACK');
          res.status(400).json({ error: 'Unknown client' });
          return;
        }
      } else {
        clientName = null;
      }
      set('client_id', clientId);
    }

    if (items) {
      const total = sumLineAmounts(items);
      set('total', total);
      set('subtotal', total);
    }

    // The first transition to 'sent' stamps the date; later saves keep it.
    if (status === 'sent') sets.push('sent_at = COALESCE(sent_at, NOW())');
    sets.push('updated_at = NOW()');

    params.push(id);
    const updated = await client.query(
      `UPDATE invoices SET ${sets.join(', ')}
        WHERE id = $${params.length}
       RETURNING *, ${IS_OVERDUE_RETURNING} AS is_overdue`,
      params
    );

    const savedItems = items
      ? await replaceItems(client, id, items)
      : (
          await client.query(
            'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order',
            [id]
          )
        ).rows;

    await client.query('COMMIT');

    res.json({ ...updated.rows[0], client_name: clientName, items: savedItems });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);

    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      res.status(409).json({ error: `Invoice number ${invoice_number} already exists` });
      return;
    }

    logger.error('Update invoice error', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function deleteInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    logger.error('Delete invoice error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * The full record the invoice document is rendered from — profile, client and
 * items in one shape. Shared by the PDF and the on-screen preview so the two
 * cannot drift apart.
 */
async function loadRenderData(
  invoiceId: string,
  userId: number | undefined
): Promise<InvoiceData | null> {
  const invoiceResult = await query(
    `SELECT i.*, c.name as client_name, c.address as client_address,
            c.city as client_city, c.postal_code as client_postal_code,
            c.vat as client_vat, c.currency as client_currency,
            u.name as user_name, u.email as user_email,
            p.vat as user_vat, p.phone as user_phone,
            p.logo_path, p.signature_path, p.swift, p.iban, p.bank_name,
            COALESCE(c.currency, p.currency, 'EUR') as currency
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     LEFT JOIN users u ON u.id = i.user_id
     LEFT JOIN profiles p ON p.user_id = i.user_id
     WHERE i.id = $1 AND i.user_id = $2`,
    [invoiceId, userId]
  );

  if (invoiceResult.rows.length === 0) return null;

  const itemsResult = await query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order ASC',
    [invoiceId]
  );

  return { ...invoiceResult.rows[0], items: itemsResult.rows } as InvoiceData;
}

export async function downloadPDF(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const invoiceData = await loadRenderData(id, req.userId);

    if (!invoiceData) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const pdfBuffer = await generateInvoicePDF(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceData.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Download PDF error', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

/**
 * The exact HTML the PDF is printed from, for the preview screen to show in a
 * sandboxed iframe. Returned as JSON, not as a document: it must never be a
 * live same-origin page.
 */
export async function getInvoiceHTML(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const invoiceData = await loadRenderData(id, req.userId);

    if (!invoiceData) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json({ html: renderInvoiceHTML(invoiceData) });
  } catch (err) {
    logger.error('Invoice HTML error', err);
    res.status(500).json({ error: 'Failed to render invoice' });
  }
}

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const stats = await query(
      `SELECT
         COUNT(*) as total_invoices,
         COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
         COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_invoices,
         COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_invoices,
         COALESCE(SUM(total), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN total END), 0) as paid_revenue,
         COALESCE(SUM(CASE WHEN status = 'sent' THEN total END), 0) as pending_revenue,
         COUNT(CASE WHEN due_date IS NOT NULL AND status <> 'paid' AND due_date < CURRENT_DATE
                    THEN 1 END) as overdue_invoices,
         COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND status <> 'paid' AND due_date < CURRENT_DATE
                           THEN total END), 0) as overdue_revenue,
         COALESCE(ROUND(AVG(total)::numeric, 2), 0) as avg_invoice,
         COALESCE(SUM(CASE WHEN date_part('month', date) = date_part('month', NOW())
                           AND date_part('year', date) = date_part('year', NOW())
                      THEN total END), 0) as month_revenue,
         COALESCE(SUM(CASE WHEN date_part('month', date) = date_part('month', NOW() - interval '1 month')
                           AND date_part('year', date) = date_part('year', NOW() - interval '1 month')
                      THEN total END), 0) as last_month_revenue
       FROM invoices WHERE user_id = $1`,
      [req.userId]
    );

    const recent = await query(
      `SELECT i.id, i.invoice_number, i.date, i.due_date, i.status, i.total,
              c.name as client_name, ${IS_OVERDUE} AS is_overdue
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC LIMIT 5`,
      [req.userId]
    );

    res.json({ ...stats.rows[0], recent_invoices: recent.rows });
  } catch (err) {
    logger.error('Dashboard stats error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function duplicateInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Take the number inside the transaction and lock this user's invoices so two
    // concurrent duplicates cannot pick the same next number.
    await client.query('SELECT pg_advisory_xact_lock($1)', [req.userId]);

    const src = await client.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (src.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const inv = src.rows[0];

    const nextNum = await client.query(
      `SELECT LPAD((COALESCE(MAX(invoice_number::bigint), 0) + 1)::text, 4, '0') as num
       FROM invoices WHERE user_id = $1 AND invoice_number ~ '^[0-9]+$'`,
      [req.userId]
    );
    const newNumber = nextNum.rows[0].num;

    const newInv = await client.query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, date, status, total, subtotal, notes, period_start, period_end)
       VALUES ($1, $2, $3, NOW(), 'draft', $4, $5, $6, $7, $8) RETURNING *`,
      [req.userId, inv.client_id, newNumber, inv.total, inv.subtotal, inv.notes, inv.period_start, inv.period_end]
    );
    const items = await client.query(
      'SELECT description, hours, rate FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order',
      [id]
    );
    await replaceItems(client, newInv.rows[0].id, items.rows);

    const clientName = inv.client_id
      ? await resolveClientName(client, req.userId!, inv.client_id)
      : null;

    await client.query('COMMIT');

    res.status(201).json({ ...newInv.rows[0], client_name: clientName });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error('Duplicate invoice error', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function getMonthlyStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await query(
      `SELECT to_char(date_trunc('month', date), 'Mon YYYY') as month,
              date_trunc('month', date) as month_date,
              COALESCE(SUM(total), 0) as revenue,
              COUNT(*) as count
       FROM invoices
       WHERE user_id = $1
       GROUP BY date_trunc('month', date)
       ORDER BY date_trunc('month', date) DESC
       LIMIT 12`,
      [req.userId]
    );
    res.json(result.rows.reverse());
  } catch (err) {
    logger.error('Monthly stats error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
