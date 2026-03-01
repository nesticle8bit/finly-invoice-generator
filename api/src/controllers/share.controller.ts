import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { query, pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

// Helpers
function parseWP(description: string): string | null {
  const match = description.match(/\(WP:\s*(\d+)\)/);
  return match ? match[1] : null;
}

function setWP(description: string, wpNumber: string | null): string {
  const base = description.replace(/\s*\(WP:\s*\d+\)/, '').trim();
  return wpNumber ? `${base} (WP: ${wpNumber})` : base;
}

async function resolveToken(token: string) {
  const result = await query(
    `SELECT ist.*, i.status, i.id as invoice_id
     FROM invoice_share_tokens ist
     JOIN invoices i ON i.id = ist.invoice_id
     WHERE ist.token = $1
       AND (ist.expires_at IS NULL OR ist.expires_at > NOW())`,
    [token]
  );
  return result.rows[0] ?? null;
}

// POST /api/share/:id  — generate share link (owner only, draft only)
export async function createShareLink(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { password, expires_in_days } = req.body;

  if (!password || password.length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters' });
    return;
  }

  try {
    // Check invoice exists, belongs to user and is draft
    const inv = await query(
      'SELECT id, status FROM invoices WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (inv.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    if (inv.rows[0].status !== 'draft') {
      res.status(400).json({ error: 'Share links can only be created for draft invoices' });
      return;
    }

    const token = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000)
      : null;

    // Delete any existing token for this invoice first
    await query('DELETE FROM invoice_share_tokens WHERE invoice_id = $1', [id]);

    await query(
      `INSERT INTO invoice_share_tokens (invoice_id, token, password_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, token, passwordHash, expiresAt]
    );

    res.json({ token, expires_at: expiresAt });
  } catch (err) {
    console.error('Create share link error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/share/:id  — revoke share link (owner only)
export async function revokeShareLink(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const inv = await query(
      'SELECT id FROM invoices WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (inv.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    await query('DELETE FROM invoice_share_tokens WHERE invoice_id = $1', [id]);
    res.json({ message: 'Share link revoked' });
  } catch (err) {
    console.error('Revoke share link error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/share/:id/token-info  — check if share token exists (owner only)
export async function getShareInfo(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT ist.token, ist.expires_at, ist.created_at
       FROM invoice_share_tokens ist
       JOIN invoices i ON i.id = ist.invoice_id
       WHERE ist.invoice_id = $1 AND i.user_id = $2`,
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      res.json({ active: false });
      return;
    }
    const row = result.rows[0];
    const expired = row.expires_at && new Date(row.expires_at) < new Date();
    res.json({ active: !expired, token: row.token, expires_at: row.expires_at, created_at: row.created_at });
  } catch (err) {
    console.error('Get share info error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/public/share/:token  — public: validate password + return invoice items
export async function accessSharedInvoice(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  try {
    const shareRow = await resolveToken(token);
    if (!shareRow) {
      res.status(404).json({ error: 'Link not found or expired' });
      return;
    }

    if (shareRow.status !== 'draft') {
      res.status(403).json({ error: 'This invoice is no longer editable' });
      return;
    }

    const valid = await bcrypt.compare(password, shareRow.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    // Return invoice number + items (with parsed WP)
    const invResult = await query(
      'SELECT invoice_number, date FROM invoices WHERE id = $1',
      [shareRow.invoice_id]
    );
    const itemsResult = await query(
      'SELECT id, description, hours, rate, amount, item_order FROM invoice_items WHERE invoice_id = $1 ORDER BY item_order',
      [shareRow.invoice_id]
    );

    const items = itemsResult.rows.map((row) => ({
      ...row,
      wp_number: parseWP(row.description),
      description_clean: row.description.replace(/\s*\(WP:\s*\d+\)/, '').trim(),
    }));

    res.json({
      invoice_number: invResult.rows[0].invoice_number,
      date: invResult.rows[0].date,
      items,
    });
  } catch (err) {
    console.error('Access shared invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/public/share/:token/wp  — public: update WP numbers only
export async function updateSharedWP(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  const { password, items } = req.body;

  if (!password || !Array.isArray(items)) {
    res.status(400).json({ error: 'Password and items array are required' });
    return;
  }

  try {
    const shareRow = await resolveToken(token);
    if (!shareRow) {
      res.status(404).json({ error: 'Link not found or expired' });
      return;
    }

    if (shareRow.status !== 'draft') {
      res.status(403).json({ error: 'This invoice is no longer editable' });
      return;
    }

    const valid = await bcrypt.compare(password, shareRow.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    // Validate that all item IDs belong to this invoice
    const validItems = await query(
      'SELECT id, description FROM invoice_items WHERE invoice_id = $1',
      [shareRow.invoice_id]
    );
    const validIds = new Set(validItems.rows.map((r) => r.id));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items as { id: number; wp_number: string | null }[]) {
        if (!validIds.has(item.id)) continue;
        const current = validItems.rows.find((r) => r.id === item.id);
        if (!current) continue;
        const newDescription = setWP(current.description, item.wp_number || null);
        await client.query('UPDATE invoice_items SET description = $1 WHERE id = $2', [newDescription, item.id]);
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ message: 'Work package numbers updated successfully' });
  } catch (err) {
    console.error('Update shared WP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
