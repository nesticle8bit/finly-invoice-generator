export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Clamps user-supplied paging params. Unvalidated values previously produced a
 * NaN OFFSET (500) or let a client request the whole table in one page.
 */
export function parsePagination(rawPage: unknown, rawLimit: unknown): Pagination {
  const page = toBoundedInt(rawPage, 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = toBoundedInt(rawLimit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  return { page, limit, offset: (page - 1) * limit };
}

function toBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
