import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app';
import { pool } from '../config/database';
import { databaseAvailable, resetDatabase, uniqueEmail } from './helpers';

let dbUp = false;
let token = '';

const sampleItems = [{ description: 'Work done', hours: 8, rate: 25 }];

before(async () => {
  dbUp = await databaseAvailable();
  if (!dbUp) return;

  await resetDatabase();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Owner', email: uniqueEmail('owner'), password: 'secret123' });
  token = res.body.token;
});

after(async () => {
  await pool.end().catch(() => undefined);
});

function auth(req: request.Test): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('GET /api/invoices pagination', () => {
  test('junk paging params fall back instead of erroring', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).get('/api/invoices?page=abc&limit=xyz'));
    assert.equal(res.status, 200, 'NaN OFFSET used to produce a 500');
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 20);
  });

  test('page size is capped', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).get('/api/invoices?limit=999999'));
    assert.equal(res.status, 200);
    assert.equal(res.body.limit, 100);
  });

  test('a non-numeric client_id is rejected, not passed to SQL', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).get('/api/invoices?client_id=abc'));
    assert.equal(res.status, 400);
  });
});

describe('POST /api/invoices', () => {
  test('requires a number, a date and at least one item', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/invoices')).send({ date: '2026-01-01', items: [] });
    assert.equal(res.status, 400);
  });

  test('creates an invoice with its items', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0001',
      date: '2026-01-01',
      items: sampleItems,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.items.length, 1);
    assert.equal(Number(res.body.total), 200);
  });

  test('a duplicate invoice number is refused with 409', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0001',
      date: '2026-02-01',
      items: sampleItems,
    });

    assert.equal(res.status, 409, 'the unique index must reject the duplicate');
  });

  test('a failed insert leaves no partial rows behind', async (t) => {
    if (!dbUp) return t.skip('no database');

    const before = await pool.query('SELECT COUNT(*) FROM invoice_items');

    await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0001', // duplicate → the whole transaction must roll back
      date: '2026-03-01',
      items: [
        { description: 'One', hours: 1, rate: 10 },
        { description: 'Two', hours: 2, rate: 10 },
      ],
    });

    const after = await pool.query('SELECT COUNT(*) FROM invoice_items');
    assert.equal(after.rows[0].count, before.rows[0].count, 'orphan items were committed');
  });
});

describe('GET /api/invoices/next-number', () => {
  test('returns the highest number plus one, zero padded', async (t) => {
    if (!dbUp) return t.skip('no database');

    await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0075',
      date: '2026-04-01',
      items: sampleItems,
    });

    const res = await auth(request(app).get('/api/invoices/next-number'));
    assert.equal(res.status, 200);
    assert.equal(res.body.number, '0076');
  });
});

describe('money', () => {
  test('the stored total equals the sum of the stored line amounts', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0500',
      date: '2026-05-01',
      items: [
        { description: 'One', hours: 1.335, rate: 25 },
        { description: 'Two', hours: 2.665, rate: 25 },
      ],
    });

    assert.equal(res.status, 201);

    const lines = res.body.items.reduce((sum: number, i: { amount: string }) => sum + Number(i.amount), 0);
    assert.equal(Number(res.body.total), lines, 'raw float products would drift by a cent');
    assert.equal(Number(res.body.total), 100.01);
  });
});

describe('due dates', () => {
  test('an invoice past its due date and still unpaid reads as overdue', async (t) => {
    if (!dbUp) return t.skip('no database');

    const created = await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0501',
      date: '2026-05-01',
      due_date: '2020-01-01',
      status: 'sent',
      items: sampleItems,
    });
    assert.equal(created.status, 201);

    const res = await auth(request(app).get(`/api/invoices/${created.body.id}`));
    assert.equal(res.body.is_overdue, true);

    const filtered = await auth(request(app).get('/api/invoices?overdue=true'));
    assert.ok(
      filtered.body.data.some((i: { id: number }) => i.id === created.body.id),
      'the overdue filter must return it'
    );
  });

  test('paying it clears the overdue flag', async (t) => {
    if (!dbUp) return t.skip('no database');

    const list = await auth(request(app).get('/api/invoices?search=0501'));
    const id = list.body.data[0].id;

    await auth(request(app).put(`/api/invoices/${id}`)).send({ status: 'paid' });

    const res = await auth(request(app).get(`/api/invoices/${id}`));
    assert.equal(res.body.is_overdue, false);
  });

  test('an unparseable due date is refused', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0502',
      date: '2026-05-01',
      due_date: 'whenever',
      items: sampleItems,
    });

    assert.equal(res.status, 400);
  });
});

describe('ownership', () => {
  test('another user cannot read this user invoices', async (t) => {
    if (!dbUp) return t.skip('no database');

    const owner = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
    await pool.query('INSERT INTO invitation_codes (code, created_by) VALUES ($1, $2)', [
      'OTHERUSER',
      owner.rows[0].id,
    ]);

    const intruder = await request(app).post('/api/auth/register').send({
      name: 'Intruder',
      email: uniqueEmail('intruder'),
      password: 'secret123',
      invite_code: 'OTHERUSER',
    });

    const mine = await pool.query('SELECT id FROM invoices ORDER BY id LIMIT 1');
    const res = await request(app)
      .get(`/api/invoices/${mine.rows[0].id}`)
      .set('Authorization', `Bearer ${intruder.body.token}`);

    assert.equal(res.status, 404);
  });

  test('an invoice cannot be attached to another user client', async (t) => {
    if (!dbUp) return t.skip('no database');

    const owner = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
    await pool.query('INSERT INTO invitation_codes (code, created_by) VALUES ($1, $2)', [
      'IDORTEST',
      owner.rows[0].id,
    ]);

    const stranger = await request(app).post('/api/auth/register').send({
      name: 'Stranger',
      email: uniqueEmail('stranger'),
      password: 'secret123',
      invite_code: 'IDORTEST',
    });

    const theirClient = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${stranger.body.token}`)
      .send({ name: 'Private Client Ltd' });

    // Without the ownership check this succeeded, and the response echoed back
    // the other account's client name through the JOIN.
    const res = await auth(request(app).post('/api/invoices')).send({
      invoice_number: '0600',
      date: '2026-06-01',
      client_id: theirClient.body.id,
      items: sampleItems,
    });

    assert.equal(res.status, 400);

    const leaked = await pool.query('SELECT id FROM invoices WHERE invoice_number = $1', ['0600']);
    assert.equal(leaked.rows.length, 0, 'the rejected invoice must not have been written');
  });
});
