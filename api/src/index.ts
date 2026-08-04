import app from './app';
import { env } from './config/env';
import { pool } from './config/database';
import { logger } from './config/logger';
import { closeBrowser } from './services/pdf.service';

const server = app.listen(env.port, () => {
  logger.info(`API running at http://localhost:${env.port}`);
  logger.info(`Uploads served at http://localhost:${env.port}/uploads`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await closeBrowser();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;
