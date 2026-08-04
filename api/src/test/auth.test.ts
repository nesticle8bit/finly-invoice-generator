import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app';
import { pool } from '../config/database';
import { databaseAvailable, resetDatabase, uniqueEmail } from './helpers';

let dbUp = false;

before(async () => {
  dbUp = await databaseAvailable();
  if (dbUp) await resetDatabase();
});

after(async () => {
  await pool.end().catch(() => undefined);
});

describe('POST /api/auth/register', () => {
  test('rejects a request without credentials', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.c' });
    assert.equal(res.status, 400);
  });

  test('first user is created without an invite code', async (t) => {
    if (!dbUp) return t.skip('no database');
    await resetDatabase();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'First', email: uniqueEmail('first'), password: 'secret123' });

    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'expected a JWT');
    assert.equal(res.body.user.password_hash, undefined, 'must never return the hash');
  });

  test('later users need a valid invite code', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Second', email: uniqueEmail('second'), password: 'secret123' });

    assert.equal(res.status, 400);
  });

  test('an invite code cannot be consumed twice', async (t) => {
    if (!dbUp) return t.skip('no database');

    const owner = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
    await pool.query(
      `INSERT INTO invitation_codes (code, created_by) VALUES ($1, $2)`,
      ['ONESHOT', owner.rows[0].id]
    );

    const first = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: uniqueEmail('a'), password: 'secret123', invite_code: 'ONESHOT' });
    assert.equal(first.status, 201);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ name: 'B', email: uniqueEmail('b'), password: 'secret123', invite_code: 'ONESHOT' });
    assert.equal(second.status, 400, 'the code must already be spent');

    // The rolled-back registration must not have left a user behind.
    const leftovers = await pool.query('SELECT id FROM users WHERE name = $1', ['B']);
    assert.equal(leftovers.rows.length, 0);
  });
});

describe('POST /api/auth/login', () => {
  test('rejects a wrong password without leaking which field failed', async (t) => {
    if (!dbUp) return t.skip('no database');
    await resetDatabase();

    const email = uniqueEmail('login');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Login', email, password: 'secret123' });

    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'nope' });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, 'Invalid credentials');

    const missing = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.local', password: 'nope' });
    assert.equal(missing.body.error, 'Invalid credentials', 'same message for unknown users');
  });

  test('returns a token for valid credentials', async (t) => {
    if (!dbUp) return t.skip('no database');

    const email = uniqueEmail('ok');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ok', email, password: 'secret123', invite_code: 'none' })
      .catch(() => undefined);

    await resetDatabase();
    await request(app).post('/api/auth/register').send({ name: 'Ok', email, password: 'secret123' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });
});

describe('GET /api/auth/me', () => {
  test('requires a bearer token', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  test('rejects a forged token', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    assert.equal(res.status, 401);
  });
});
