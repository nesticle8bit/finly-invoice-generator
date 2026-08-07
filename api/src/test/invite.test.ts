import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app';
import { pool } from '../config/database';
import { databaseAvailable, resetDatabase, uniqueEmail } from './helpers';

let dbUp = false;
let adminToken = '';
let memberToken = '';

before(async () => {
  dbUp = await databaseAvailable();
  if (!dbUp) return;

  await resetDatabase();

  // Only the first user ever registered administers invitation codes.
  const admin = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Admin', email: uniqueEmail('admin'), password: 'secret123' });
  adminToken = admin.body.token;

  await pool.query('INSERT INTO invitation_codes (code, created_by) VALUES ($1, $2)', [
    'MEMBER01',
    admin.body.user.id,
  ]);

  const member = await request(app).post('/api/auth/register').send({
    name: 'Member',
    email: uniqueEmail('member'),
    password: 'secret123',
    invite_code: 'MEMBER01',
  });
  memberToken = member.body.token;
});

after(async () => {
  await pool.end().catch(() => undefined);
});

function as(req: request.Test, bearer: string): request.Test {
  return req.set('Authorization', `Bearer ${bearer}`);
}

describe('invitation codes are admin-only', () => {
  test('an ordinary member cannot list, create or delete', async (t) => {
    if (!dbUp) return t.skip('no database');

    assert.equal((await as(request(app).get('/api/invite-codes'), memberToken)).status, 403);
    assert.equal((await as(request(app).post('/api/invite-codes'), memberToken)).status, 403);
    assert.equal((await as(request(app).delete('/api/invite-codes/1'), memberToken)).status, 403);
  });

  test('an anonymous caller gets 401', async (t) => {
    if (!dbUp) return t.skip('no database');

    assert.equal((await request(app).get('/api/invite-codes')).status, 401);
  });
});

describe('the admin manages codes', () => {
  let createdId = 0;

  test('creates a code in the XXXX-XXXX format', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await as(request(app).post('/api/invite-codes'), adminToken);
    assert.equal(res.status, 201);
    assert.match(res.body.code, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
    createdId = res.body.id;
  });

  test('lists codes with who consumed them', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await as(request(app).get('/api/invite-codes'), adminToken);
    assert.equal(res.status, 200);

    const spent = res.body.find((c: { code: string }) => c.code === 'MEMBER01');
    assert.equal(spent.used_by_name, 'Member', 'a spent code must show its user');
  });

  test('a spent code cannot be deleted', async (t) => {
    if (!dbUp) return t.skip('no database');

    const spent = await pool.query('SELECT id FROM invitation_codes WHERE code = $1', ['MEMBER01']);
    const res = await as(request(app).delete(`/api/invite-codes/${spent.rows[0].id}`), adminToken);

    assert.equal(res.status, 404, 'deleting it would orphan the account it let in');
  });

  test('an unused code can be deleted', async (t) => {
    if (!dbUp) return t.skip('no database');

    assert.equal((await as(request(app).delete(`/api/invite-codes/${createdId}`), adminToken)).status, 200);
  });

  test('a non-numeric id is a 400', async (t) => {
    if (!dbUp) return t.skip('no database');

    assert.equal((await as(request(app).delete('/api/invite-codes/abc'), adminToken)).status, 400);
  });
});
