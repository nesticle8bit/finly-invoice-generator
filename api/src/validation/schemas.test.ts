import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInvoiceSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  updateSharedWPSchema,
} from './schemas';

describe('createInvoiceSchema', () => {
  test('accepts form input and normalises it', () => {
    const parsed = createInvoiceSchema.safeParse({
      invoice_number: ' 0001 ',
      // The UI echoes back the full timestamp it loaded from the API.
      date: '2026-01-01T22:00:00.000Z',
      client_id: '3',
      items: [{ description: ' Work ', hours: '8', rate: 25 }],
    });

    assert.ok(parsed.success, 'a valid body must parse');
    assert.equal(parsed.data.date, '2026-01-01');
    assert.equal(parsed.data.invoice_number, '0001');
    assert.equal(parsed.data.client_id, 3);
    assert.equal(parsed.data.items[0].hours, 8, 'numeric strings become numbers');
  });

  test('rejects an items payload that is not an array', () => {
    // This used to reach `.reduce` and come back as a 500.
    assert.equal(createInvoiceSchema.safeParse({ invoice_number: '1', date: '2026-01-01', items: 'boom' }).success, false);
  });

  test('rejects non-numeric hours instead of storing NaN', () => {
    const parsed = createInvoiceSchema.safeParse({
      invoice_number: '1',
      date: '2026-01-01',
      items: [{ description: 'x', hours: 'abc', rate: 2 }],
    });
    assert.equal(parsed.success, false);
  });

  test('rejects an empty item list and an unparseable date', () => {
    assert.equal(createInvoiceSchema.safeParse({ invoice_number: '1', date: '2026-01-01', items: [] }).success, false);
    assert.equal(
      createInvoiceSchema.safeParse({ invoice_number: '1', date: 'not a date', items: [{ description: 'x', hours: 1, rate: 1 }] }).success,
      false
    );
  });

  test('a status outside the known set is refused', () => {
    const parsed = createInvoiceSchema.safeParse({
      invoice_number: '1',
      date: '2026-01-01',
      status: 'cancelled',
      items: [{ description: 'x', hours: 1, rate: 1 }],
    });
    assert.equal(parsed.success, false);
  });
});

describe('auth schemas', () => {
  test('registration needs a real email and a password worth storing', () => {
    assert.equal(registerSchema.safeParse({ name: 'A', email: 'nope', password: 'secret123' }).success, false);
    assert.equal(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short' }).success, false);
    assert.ok(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'secret123' }).success);
  });

  test('login does not apply the password policy', () => {
    // Enforcing it here would answer with a 400 before the 401 and tell an
    // attacker their guess could not possibly be the stored password.
    assert.ok(loginSchema.safeParse({ email: 'a@b.c', password: 'nope' }).success);
  });
});

describe('partial update schemas', () => {
  test('an empty profile update is valid', () => {
    assert.ok(updateProfileSchema.safeParse({}).success);
  });

  test('shared WP autosave accepts an empty item list', () => {
    assert.ok(updateSharedWPSchema.safeParse({ session_token: 'x', items: [] }).success);
  });
});
