import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

/**
 * Replaces req.body with the parsed value, so handlers work on data that has
 * already been typed, trimmed and bounded instead of raw JSON.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      res.status(400).json({ error: firstMessage(result.error), details: fieldErrors(result.error) });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Params are checked, never replaced: an `/invoices/abc` used to reach Postgres
 * as `WHERE id = 'abc'` and come back as a 500 instead of a 400.
 */
export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({ error: firstMessage(result.error) });
      return;
    }

    next();
  };
}

/** The toast only shows one line, so the first problem has to be the useful one. */
function firstMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request body';

  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
