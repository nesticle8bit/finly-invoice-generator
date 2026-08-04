import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

export async function listClients(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await query(
      'SELECT * FROM clients WHERE user_id = $1 ORDER BY name ASC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('List clients error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClient(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await query(
      'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Get client error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createClient(req: AuthRequest, res: Response): Promise<void> {
  const { name, address, city, postal_code, country, vat, email, currency } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Client name is required' });
    return;
  }

  try {
    const result = await query(
      `INSERT INTO clients (user_id, name, address, city, postal_code, country, vat, email, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, name, address, city, postal_code, country, vat, email, currency || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Create client error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateClient(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, address, city, postal_code, country, vat, email, currency } = req.body;

  try {
    const result = await query(
      `UPDATE clients SET
         name = COALESCE($1, name),
         address = COALESCE($2, address),
         city = COALESCE($3, city),
         postal_code = COALESCE($4, postal_code),
         country = COALESCE($5, country),
         vat = COALESCE($6, vat),
         email = COALESCE($7, email),
         currency = $8,
         updated_at = NOW()
       WHERE id = $9 AND user_id = $10 RETURNING *`,
      [name, address, city, postal_code, country, vat, email, currency || null, id, req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Update client error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    logger.error('Delete client error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
