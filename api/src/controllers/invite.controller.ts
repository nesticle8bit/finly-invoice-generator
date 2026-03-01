import { Response } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

// Only the first registered user (id = 1) can manage invitation codes
function isAdmin(req: AuthRequest): boolean {
  return req.userId === 1;
}

export async function listCodes(req: AuthRequest, res: Response): Promise<void> {
  if (!isAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  try {
    const result = await query(
      `SELECT ic.id, ic.code, ic.created_at, ic.used_at,
              u.name AS used_by_name, u.email AS used_by_email
       FROM invitation_codes ic
       LEFT JOIN users u ON u.id = ic.used_by
       WHERE ic.created_by = $1
       ORDER BY ic.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List codes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createCode(req: AuthRequest, res: Response): Promise<void> {
  if (!isAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  try {
    // Format: XXXX-XXXX (8 uppercase hex chars with dash)
    const raw = randomBytes(4).toString('hex').toUpperCase();
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;

    const result = await query(
      'INSERT INTO invitation_codes (code, created_by) VALUES ($1, $2) RETURNING id, code, created_at',
      [code, req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteCode(req: AuthRequest, res: Response): Promise<void> {
  if (!isAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM invitation_codes WHERE id = $1 AND created_by = $2 AND used_by IS NULL RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Code not found or already used' });
      return;
    }
    res.json({ message: 'Code deleted' });
  } catch (err) {
    console.error('Delete code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
