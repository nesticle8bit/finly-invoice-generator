import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';

import { env } from './config/env';
import { pool } from './config/database';
import { logger } from './config/logger';

import authRoutes from './routes/auth.routes';
import invoicesRoutes from './routes/invoices.routes';
import clientsRoutes from './routes/clients.routes';
import profileRoutes from './routes/profile.routes';
import shareRoutes from './routes/share.routes';
import inviteRoutes from './routes/invite.routes';

export const app = express();

// Behind a reverse proxy — needed so req.ip is the real client for rate limiting.
app.set('trust proxy', 1);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (uploaded logos/signatures). The sandbox CSP neutralises active
// content in anything that slipped past the upload filter.
const uploadsDir = env.uploadDir;
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(uploadsDir, { dotfiles: 'deny', index: false })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', shareRoutes);
app.use('/api/invite-codes', inviteRoutes);

// Health check — reports the dependency that actually matters.
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler — multer and thrown errors used to surface as HTML 500s.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large (max ${Math.round(env.maxFileSize / 1024 / 1024)}MB)`
        : 'File upload failed';
    res.status(400).json({ error: message });
    return;
  }

  // Upload filter rejections carry a safe, user-facing message.
  if (err.message?.startsWith('Only ') || err.message?.startsWith('File extension')) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Storage failures used to surface as a bare "Internal server error" with no
  // clue that the uploads volume was the problem. Name it, on both sides.
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EACCES' || code === 'EPERM' || code === 'ENOENT' || code === 'ENOSPC' || code === 'EROFS') {
    logger.error('Upload storage failure', { code, path: (err as NodeJS.ErrnoException).path, uploadDir: env.uploadDir });
    res.status(500).json({ error: 'Upload storage is unavailable — check the server uploads directory' });
    return;
  }

  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
