import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { query, pool } from '../config/database';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, invite_code } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First user ever doesn't need an invite code (becomes the admin)
    const countResult = await client.query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(countResult.rows[0].count) === 0;

    if (!isFirstUser && !invite_code) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'An invitation code is required' });
      return;
    }

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, passwordHash]
    );

    const user = result.rows[0];

    // Create empty profile
    await client.query('INSERT INTO profiles (user_id) VALUES ($1)', [user.id]);

    // Claim the code and check it in a single statement — a check-then-update
    // let two concurrent registrations consume the same code.
    if (!isFirstUser) {
      const claimed = await client.query(
        `UPDATE invitation_codes SET used_by = $1, used_at = NOW()
         WHERE code = $2 AND used_by IS NULL
         RETURNING id`,
        [user.id, String(invite_code).trim().toUpperCase()]
      );
      if (claimed.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Invalid or already used invitation code' });
        return;
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ token: signToken(user.id, user.email), user });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error('Register error', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  try {
    const result = await query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    res.json({
      token: signToken(user.id, user.email),
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Me error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
