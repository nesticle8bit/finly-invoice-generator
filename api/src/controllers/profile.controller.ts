import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { logger } from '../config/logger';
import path from 'path';
import fs from 'fs';

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.created_at,
              p.vat, p.phone, p.logo_path, p.signature_path,
              p.swift, p.iban, p.bank_name, p.default_rate,
              p.currency, p.notes_template
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Get profile error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  const { name, vat, phone, swift, iban, bank_name, default_rate, currency, notes_template } = req.body;

  try {
    // Update user name
    if (name) {
      await query('UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2', [name, req.userId]);
    }

    // Upsert profile
    await query(
      `INSERT INTO profiles (user_id, vat, phone, swift, iban, bank_name, default_rate, currency, notes_template)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         vat = EXCLUDED.vat,
         phone = EXCLUDED.phone,
         swift = EXCLUDED.swift,
         iban = EXCLUDED.iban,
         bank_name = EXCLUDED.bank_name,
         default_rate = EXCLUDED.default_rate,
         currency = EXCLUDED.currency,
         notes_template = EXCLUDED.notes_template,
         updated_at = NOW()`,
      [req.userId, vat, phone, swift, iban, bank_name, default_rate || 25, currency || 'EUR', notes_template]
    );

    const result = await query(
      `SELECT u.id, u.name, u.email, p.vat, p.phone, p.logo_path, p.signature_path,
              p.swift, p.iban, p.bank_name, p.default_rate, p.currency, p.notes_template
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [req.userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Update profile error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** Best-effort removal — a stale file must never fail the request. */
function removeUpload(relativePath: string | null | undefined): void {
  if (!relativePath) return;
  try {
    const fullPath = path.join(env.uploadDir, relativePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    logger.warn('Could not delete previous upload', { relativePath, err });
  }
}

async function replaceAsset(
  req: AuthRequest,
  res: Response,
  column: 'logo_path' | 'signature_path',
  folder: 'logos' | 'signatures'
): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const relativePath = `${folder}/${req.file.filename}`;

  try {
    const old = await query(`SELECT ${column} FROM profiles WHERE user_id = $1`, [req.userId]);

    await query(
      `UPDATE profiles SET ${column} = $1, updated_at = NOW() WHERE user_id = $2`,
      [relativePath, req.userId]
    );

    // Only drop the previous file once the new path is committed.
    removeUpload(old.rows[0]?.[column]);

    res.json({ [column]: relativePath, url: `/uploads/${relativePath}` });
  } catch (err) {
    // The row still points at the old file — the orphan is the one just written.
    removeUpload(relativePath);
    logger.error(`Upload ${folder} error`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadLogo(req: AuthRequest, res: Response): Promise<void> {
  await replaceAsset(req, res, 'logo_path', 'logos');
}

export async function uploadSignature(req: AuthRequest, res: Response): Promise<void> {
  await replaceAsset(req, res, 'signature_path', 'signatures');
}
