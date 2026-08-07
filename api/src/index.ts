import type { Server } from 'http';
import app from './app';
import { env } from './config/env';
import { pool } from './config/database';
import { logger } from './config/logger';
import { runMigrations } from './config/migrate';
import { closeBrowser } from './services/pdf.service';

let server: Server | null = null;

function listen(): void {
  server = app.listen(env.port, () => {
    logger.info(`API running at http://localhost:${env.port}`);
    logger.info(`Uploads served at http://localhost:${env.port}/uploads`);
  });
}

/**
 * Migrations run before the first request, never alongside it: serving traffic
 * against a schema this build does not match is worse than not starting at all.
 * A crash here is intentional — the restart policy retries, and the logs say why.
 */
async function bootstrap(): Promise<void> {
  if (env.autoMigrate) {
    try {
      const applied = await runMigrations((line) => logger.info(line.trim()));
      logger.info(applied === 0 ? 'Database schema is up to date' : `Applied ${applied} migration(s)`);
    } catch (err) {
      logger.error('Startup migration failed — refusing to serve', err);
      await pool.end().catch(() => undefined);
      process.exit(1);
    }
  }

  listen();
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down`);
  server?.close();
  await closeBrowser();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void bootstrap();

export default app;
