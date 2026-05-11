import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateInvoicePDF } from '../services/pdf.service';

export async function listInvoices(req: AuthRequest, res: Response): Promise<void> {
  const { status, search, page = '1', limit = '20', client_id, date_from, date_to, is_template } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    let sql = `
      SELECT i.id, i.invoice_number, i.date, i.status, i.total, i.created_at,
             i.sent_at, i.is_template, c.name as client_name
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
      sql += ` AND i.client_id = $${paramIdx++}`;
      params.push(parseInt(client_id as string));
    }

    if (date_from) {
      sql += ` AND i.date >= $${paramIdx++}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND i.date <= $${paramIdx++}`;
      params.push(date_to);
    }

    if (search) {
      sql += ` AND (i.invoice_number ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countResult = await query(`SELECT COUNT(*) FROM (${sql}) AS _c`, params);

    sql += ` ORDER BY i.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(parseInt(limit as string), offset);

    const result = await query(sql, params);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) {
    console.error('List invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const invoiceResult = await query(
      `SELECT i.*, c.name as client_name, c.address as client_address,
              c.city as client_city, c.postal_code as client_postal_code,
              c.vat as client_vat, c.email as client_email
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
    console.error('Get invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getNextNumber(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await query(
      `SELECT invoice_number FROM invoices WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [req.userId]
    );

    let nextNum = 1;
    if (result.rows.length > 0) {
      nextNum = parseInt(result.rows[0].invoice_number) + 1;
    }

    res.json({ number: String(nextNum).padStart(4, '0') });
  } catch (err) {
    console.error('Next number error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { client_id, invoice_number, date, status, notes, period_start, period_end, items } = req.body;

  if (!invoice_number || !date) {
    res.status(400).json({ error: 'Invoice number and date are required' });
    return;
  }

  if (!items || items.length === 0) {
    res.status(400).json({ error: 'At least one item is required' });
    return;
  }

  const client = await query('BEGIN');
  try {
    // Calculate totals
    const total = items.reduce((sum: number, item: { hours: number; rate: number }) =>
      sum + item.hours * item.rate, 0);

    const invoiceResult = await query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, date, status, total, subtotal, notes, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9) RETURNING *`,
      [req.userId, client_id || null, invoice_number, date, status || 'draft', total, notes, period_start, period_end]
    );

    const invoice = invoiceResult.rows[0];

    // Insert items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const amount = item.hours * item.rate;
      await query(
        `INSERT INTO invoice_items (invoice_id, description, hours, rate, amount, item_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, item.description, item.hours, item.rate, amount, i]
      );
    }

    await query('COMMIT');

    const full = await query(
      `SELECT i.*, c.name as client_name FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = $1`,
      [invoice.id]
    );
    const fullItems = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order', [invoice.id]);

    res.status(201).json({ ...full.rows[0], items: fullItems.rows });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { client_id, invoice_number, date, status, notes, period_start, period_end, items, is_template } = req.body;

  try {
    // Check ownership
    const exists = await query('SELECT id FROM invoices WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (exists.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    await query('BEGIN');

    const total = items
      ? items.reduce((sum: number, item: { hours: number; rate: number }) => sum + item.hours * item.rate, 0)
      : undefined;

    // Set sent_at when transitioning to 'sent' for the first time
    const sentAtClause = status === 'sent'
      ? `, sent_at = COALESCE(sent_at, NOW())`
      : '';

    await query(
      `UPDATE invoices SET
         client_id = COALESCE($1, client_id),
         invoice_number = COALESCE($2, invoice_number),
         date = COALESCE($3, date),
         status = COALESCE($4, status),
         notes = COALESCE($5, notes),
         period_start = COALESCE($6, period_start),
         period_end = COALESCE($7, period_end),
         total = COALESCE($8, total),
         subtotal = COALESCE($8, subtotal),
         is_template = COALESCE($10, is_template),
         updated_at = NOW()${sentAtClause}
       WHERE id = $9`,
      [client_id, invoice_number, date, status, notes, period_start, period_end, total, id, is_template ?? null]
    );

    if (items) {
      await query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const amount = item.hours * item.rate;
        await query(
          `INSERT INTO invoice_items (invoice_id, description, hours, rate, amount, item_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, item.description, item.hours, item.rate, amount, i]
        );
      }
    }

    await query('COMMIT');

    const full = await query(
      `SELECT i.*, c.name as client_name FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = $1`,
      [id]
    );
    const fullItems = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order', [id]);

    res.json({ ...full.rows[0], items: fullItems.rows });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Update invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error('Delete invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function downloadPDF(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    // Get invoice with all data
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

    const invoiceData = { ...invoiceResult.rows[0], items: itemsResult.rows };
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceData.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Download PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
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
      `SELECT i.id, i.invoice_number, i.date, i.status, i.total, c.name as client_name
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC LIMIT 5`,
      [req.userId]
    );

    res.json({ ...stats.rows[0], recent_invoices: recent.rows });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function duplicateInvoice(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const src = await query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (src.rows.length === 0) { res.status(404).json({ error: 'Invoice not found' }); return; }
    const inv = src.rows[0];

    const nextNum = await query(
      `SELECT LPAD((COALESCE(MAX(CAST(invoice_number AS INTEGER)), 0) + 1)::text, 4, '0') as num
       FROM invoices WHERE user_id = $1 AND invoice_number ~ '^[0-9]+$'`,
      [req.userId]
    );
    const newNumber = nextNum.rows[0].num;

    await query('BEGIN');
    const newInv = await query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, date, status, total, subtotal, notes, period_start, period_end)
       VALUES ($1, $2, $3, NOW(), 'draft', $4, $5, $6, $7, $8) RETURNING *`,
      [req.userId, inv.client_id, newNumber, inv.total, inv.subtotal, inv.notes, inv.period_start, inv.period_end]
    );
    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order', [id]);
    for (let i = 0; i < items.rows.length; i++) {
      const it = items.rows[i];
      await query(
        'INSERT INTO invoice_items (invoice_id, description, hours, rate, amount, item_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [newInv.rows[0].id, it.description, it.hours, it.rate, it.amount, i]
      );
    }
    await query('COMMIT');

    const full = await query(
      `SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = $1`,
      [newInv.rows[0].id]
    );
    res.status(201).json(full.rows[0]);
  } catch (err) {
    await query('ROLLBACK');
    console.error('Duplicate invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error('Monthly stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
