import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app';
import { pool } from '../config/database';
import { databaseAvailable, resetDatabase, uniqueEmail } from './helpers';

let dbUp = false;
let token = '';

before(async () => {
  dbUp = await databaseAvailable();
  if (!dbUp) return;

  await resetDatabase();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Profile Owner', email: uniqueEmail('profile'), password: 'secret123' });
  token = res.body.token;
});

after(async () => {
  await pool.end().catch(() => undefined);
});

function auth(req: request.Test): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('GET /api/profile', () => {
  test('requires a token', async (t) => {
    if (!dbUp) return t.skip('no database');

    assert.equal((await request(app).get('/api/profile')).status, 401);
  });

  test('returns the account without its password hash', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).get('/api/profile'));
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Profile Owner');
    assert.equal(res.body.password_hash, undefined);
  });
});

describe('PUT /api/profile', () => {
  test('saves the billing details and the account name together', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).put('/api/profile')).send({
      name: 'Julio',
      vat: '1017205178',
      iban: 'BE71 9670 3909 1669',
      default_rate: '30',
      currency: 'EUR',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Julio');
    assert.equal(Number(res.body.default_rate), 30, 'a numeric string must be stored as a number');
  });

  test('an empty body is a valid no-op', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).put('/api/profile')).send({});
    assert.equal(res.status, 200);
  });

  test('a non-numeric rate is refused instead of reaching the DECIMAL column', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).put('/api/profile')).send({ default_rate: 'twenty five' });
    assert.equal(res.status, 400);
  });

  test('the profile survives a second update', async (t) => {
    if (!dbUp) return t.skip('no database');

    await auth(request(app).put('/api/profile')).send({ swift: 'TRWIBEB1XXX' });
    const res = await auth(request(app).get('/api/profile'));

    assert.equal(res.body.swift, 'TRWIBEB1XXX');
  });
});
