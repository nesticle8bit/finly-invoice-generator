import { before, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app';
import { pool } from '../config/database';
import { databaseAvailable, resetDatabase, uniqueEmail } from './helpers';

let dbUp = false;
let token = '';
let intruderToken = '';
let clientId = 0;

before(async () => {
  dbUp = await databaseAvailable();
  if (!dbUp) return;

  await resetDatabase();

  const owner = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Owner', email: uniqueEmail('client-owner'), password: 'secret123' });
  token = owner.body.token;

  await pool.query('INSERT INTO invitation_codes (code, created_by) VALUES ($1, $2)', [
    'CLIENTS1',
    owner.body.user.id,
  ]);

  const intruder = await request(app).post('/api/auth/register').send({
    name: 'Intruder',
    email: uniqueEmail('client-intruder'),
    password: 'secret123',
    invite_code: 'CLIENTS1',
  });
  intruderToken = intruder.body.token;
});

after(async () => {
  await pool.end().catch(() => undefined);
});

function auth(req: request.Test, bearer = token): request.Test {
  return req.set('Authorization', `Bearer ${bearer}`);
}

describe('POST /api/clients', () => {
  test('a client without a name is refused', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/clients')).send({ city: 'Kaiserslautern' });
    assert.equal(res.status, 400);
  });

  test('creates the client and trims its fields', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/clients')).send({
      name: '  SMARTEC GmbH  ',
      city: 'Kaiserslautern',
      country: 'Germany',
      currency: 'EUR',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'SMARTEC GmbH');
    clientId = res.body.id;
  });

  test('an oversized name is rejected rather than truncated by Postgres', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).post('/api/clients')).send({ name: 'x'.repeat(300) });
    assert.equal(res.status, 400, 'VARCHAR(255) would have raised a 500');
  });
});

describe('GET /api/clients', () => {
  test('lists only the caller own clients', async (t) => {
    if (!dbUp) return t.skip('no database');

    const mine = await auth(request(app).get('/api/clients'));
    assert.equal(mine.status, 200);
    assert.ok(mine.body.some((c: { id: number }) => c.id === clientId));

    const theirs = await auth(request(app).get('/api/clients'), intruderToken);
    assert.equal(theirs.body.length, 0, 'another account must not see these clients');
  });

  test('a non-numeric id is a 400, not a database error', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).get('/api/clients/abc'));
    assert.equal(res.status, 400);
  });

  test('another user cannot read this client', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).get(`/api/clients/${clientId}`), intruderToken);
    assert.equal(res.status, 404);
  });
});

describe('PUT /api/clients/:id', () => {
  test('updates the fields it is given', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).put(`/api/clients/${clientId}`)).send({ city: 'Berlin' });
    assert.equal(res.status, 200);
    assert.equal(res.body.city, 'Berlin');
    assert.equal(res.body.name, 'SMARTEC GmbH', 'omitted fields keep their value');
  });

  test('another user cannot update this client', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).put(`/api/clients/${clientId}`), intruderToken).send({ city: 'Nowhere' });
    assert.equal(res.status, 404);
  });
});

describe('DELETE /api/clients/:id', () => {
  test('another user cannot delete this client', async (t) => {
    if (!dbUp) return t.skip('no database');

    const res = await auth(request(app).delete(`/api/clients/${clientId}`), intruderToken);
    assert.equal(res.status, 404);
  });

  test('the owner can delete it, once', async (t) => {
    if (!dbUp) return t.skip('no database');

    assert.equal((await auth(request(app).delete(`/api/clients/${clientId}`))).status, 200);
    assert.equal((await auth(request(app).delete(`/api/clients/${clientId}`))).status, 404);
  });
});
