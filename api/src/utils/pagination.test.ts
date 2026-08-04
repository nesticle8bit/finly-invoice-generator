import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parsePagination, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from './pagination';

describe('parsePagination', () => {
  test('uses defaults when nothing is supplied', () => {
    assert.deepEqual(parsePagination(undefined, undefined), {
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });

  test('computes the offset from page and limit', () => {
    assert.deepEqual(parsePagination('3', '10'), { page: 3, limit: 10, offset: 20 });
  });

  test('falls back instead of producing NaN for junk input', () => {
    const result = parsePagination('abc', 'xyz');
    assert.equal(result.page, 1);
    assert.equal(result.limit, DEFAULT_PAGE_SIZE);
    assert.ok(Number.isFinite(result.offset));
  });

  test('caps the page size so a client cannot dump the table', () => {
    assert.equal(parsePagination('1', '999999').limit, MAX_PAGE_SIZE);
  });

  test('clamps zero and negative values', () => {
    assert.deepEqual(parsePagination('0', '-5'), { page: 1, limit: 1, offset: 0 });
  });
});
