import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
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
    console.error('Get profile error:', err);
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
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadLogo(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    // Delete old logo
    const old = await query('SELECT logo_path FROM profiles WHERE user_id = $1', [req.userId]);
    if (old.rows[0]?.logo_path) {
      const oldPath = path.join(process.env.UPLOAD_DIR || 'uploads', old.rows[0].logo_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const relativePath = `logos/${req.file.filename}`;
    await query(
      'UPDATE profiles SET logo_path = $1, updated_at = NOW() WHERE user_id = $2',
      [relativePath, req.userId]
    );

    res.json({ logo_path: relativePath, url: `/uploads/${relativePath}` });
  } catch (err) {
    console.error('Upload logo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadSignature(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const old = await query('SELECT signature_path FROM profiles WHERE user_id = $1', [req.userId]);
    if (old.rows[0]?.signature_path) {
      const oldPath = path.join(process.env.UPLOAD_DIR || 'uploads', old.rows[0].signature_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const relativePath = `signatures/${req.file.filename}`;
    await query(
      'UPDATE profiles SET signature_path = $1, updated_at = NOW() WHERE user_id = $2',
      [relativePath, req.userId]
    );

    res.json({ signature_path: relativePath, url: `/uploads/${relativePath}` });
  } catch (err) {
    console.error('Upload signature error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
