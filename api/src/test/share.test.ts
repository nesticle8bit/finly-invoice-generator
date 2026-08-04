import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app';
import { pool } from '../config/database';
import { databaseAvailable, resetDatabase, uniqueEmail } from './helpers';

let dbUp = false;
let token = '';
let invoiceId = 0;
let shareToken = '';

const SHARE_PASSWORD = 'sharepass';

before(async () => {
  dbUp = await databaseAvailable();
  if (!dbUp) return;

  await resetDatabase();

  const user = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Owner', email: uniqueEmail('share'), password: 'secret123' });
  token = user.body.token;

  const invoice = await request(app)
    .post('/api/invoices')
    .set('Authorization', `Bearer ${token}`)
    .send({
      invoice_number: '0001',
      date: '2026-01-01',
      items: [{ description: 'Task one', hours: 4, rate: 25 }],
    });
  invoiceId = invoice.body.id;

  const link = await request(app)
    .post(`/api/invoices/${invoiceId}/share`)
    .set('Authorization', `Bearer ${token}`)
    .send({ password: SHARE_PASSWORD });
  shareToken = link.body.token;
});

after(async () => {
  await pool.end().catch(() => undefined);
});

describe('POST /api/public/share/:token', () => {
  test('a wrong password is rejected', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app).post(`/api/public/share/${shareToken}`).send({ password: 'wrong' });
    assert.equal(res.status, 401);
  });

  test('an unknown token is a 404', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app).post('/api/public/share/deadbeef').send({ password: SHARE_PASSWORD });
    assert.equal(res.status, 404);
  });

  test('the right password returns the items and a session token', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app)
      .post(`/api/public/share/${shareToken}`)
      .send({ password: SHARE_PASSWORD });

    assert.equal(res.status, 200);
    assert.ok(res.body.session_token, 'autosave needs a session token');
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].wp_number, null);
  });
});

describe('PUT /api/public/share/:token/wp', () => {
  async function newSession(): Promise<string> {
    const res = await request(app)
      .post(`/api/public/share/${shareToken}`)
      .send({ password: SHARE_PASSWORD });
    return res.body.session_token;
  }

  test('saves a WP number and reads it back', async (t) => {
    if (!dbUp) return t.skip('no database');

    const session = await newSession();
    const items = await pool.query('SELECT id FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

    const save = await request(app)
      .put(`/api/public/share/${shareToken}/wp`)
      .send({ session_token: session, items: [{ id: items.rows[0].id, wp_number: '3097' }] });
    assert.equal(save.status, 200);

    const reload = await request(app)
      .post(`/api/public/share/${shareToken}`)
      .send({ password: SHARE_PASSWORD });
    assert.equal(reload.body.items[0].wp_number, '3097');
    assert.equal(reload.body.items[0].description_clean, 'Task one', 'the tag must not leak into the text');
  });

  test('rejects a non-numeric WP that could not be read back', async (t) => {
    if (!dbUp) return t.skip('no database');

    const session = await newSession();
    const items = await pool.query('SELECT id FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

    const res = await request(app)
      .put(`/api/public/share/${shareToken}/wp`)
      .send({ session_token: session, items: [{ id: items.rows[0].id, wp_number: 'WP-1' }] });

    assert.equal(res.status, 400);

    const reload = await request(app)
      .post(`/api/public/share/${shareToken}`)
      .send({ password: SHARE_PASSWORD });
    assert.equal(reload.body.items[0].wp_number, '3097', 'the previous value must survive');
  });

  test('a session token from another share link is refused', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app)
      .put(`/api/public/share/${shareToken}/wp`)
      .send({ session_token: 'forged.token.here', items: [] });

    assert.equal(res.status, 401);
  });

  test('items belonging to another invoice are ignored', async (t) => {
    if (!dbUp) return t.skip('no database');

    const session = await newSession();
    const res = await request(app)
      .put(`/api/public/share/${shareToken}/wp`)
      .send({ session_token: session, items: [{ id: 999999, wp_number: '1' }] });

    assert.equal(res.status, 200, 'unknown ids are skipped, not fatal');
  });
});
