import { env } from './env';

type Level = 'info' | 'warn' | 'error';

/**
 * Minimal structured logger. JSON lines in production so a log collector can
 * parse them; human-readable text in development.
 */
function emit(level: Level, message: string, meta?: unknown): void {
  const write = level === 'error' ? console.error : console.log;

  if (!env.isProduction) {
    write(`[${level.toUpperCase()}] ${message}`, meta ?? '');
    return;
  }

  const payload: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (meta instanceof Error) {
    payload.error = { name: meta.name, message: meta.message, stack: meta.stack };
  } else if (meta !== undefined) {
    payload.meta = meta;
  }

  write(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
