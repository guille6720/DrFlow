import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const database = process.argv[2];
assert.match(database ?? '', /^storage_test_[a-z0-9_]{1,25}$/);
const pool = new pg.Pool({ host: '127.0.0.1', port: 55439, user: 'postgres', database, max: 16 });
const clinic = '00000000-0000-4000-8000-000000000001';
const digest = 'a'.repeat(64);
const reserve = (key, bytes = 10, hash = digest) => pool.query(
  'select * from nexclinic_storage.reserve($1,$2,$3,$4,$5,$6)',
  [clinic, key, `${clinic}/files/${key}`, 'application/pdf', bytes, hash],
);

try {
  const exists = await pool.query("select to_regnamespace('nexclinic_storage') as schema");
  assert.equal(exists.rows[0].schema, null, 'Use a fresh disposable database');
  await pool.query(await readFile(new URL('../supabase/tests/storage-reservation-candidate.sql', import.meta.url), 'utf8'));
  await pool.query('insert into nexclinic_storage.accounts values ($1,100,0,true)', [clinic]);
  const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => reserve(`parallel-${index}`)));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 10);
  for (const result of attempts.filter(result => result.status === 'rejected')) {
    assert.match(result.reason.message, /STORAGE_CAPACITY_EXCEEDED/);
  }
  const first = attempts.find(result => result.status === 'fulfilled').value.rows[0];
  const retries = await Promise.all(Array.from({ length: 12 }, () => reserve(first.request_key)));
  assert.ok(retries.every(result => result.rows[0].id === first.id));
  await assert.rejects(reserve(first.request_key, 10, 'b'.repeat(64)), /STORAGE_IDEMPOTENCY_CONFLICT/);
  await pool.query('select nexclinic_storage.mark_uncertain($1)', [first.id]);
  await assert.rejects(reserve('after-uncertainty'), /STORAGE_CAPACITY_EXCEEDED/);
  await assert.rejects(pool.query('select nexclinic_storage.finish($1,10,$2)', [first.id, 'b'.repeat(64)]), /STORAGE_INTEGRITY_MISMATCH/);
  await pool.query('select nexclinic_storage.finish($1,10,$2)', [first.id, digest]);
  await pool.query('select nexclinic_storage.finish($1,10,$2)', [first.id, digest]);
  await pool.query('select nexclinic_storage.mark_uncertain($1)', [first.id]);
  assert.equal((await reserve(first.request_key)).rows[0].state, 'verified');
  await pool.query('update nexclinic_storage.accounts set limit_bytes=0 where clinic_id=$1', [clinic]);
  assert.equal((await reserve(first.request_key)).rows[0].id, first.id);
  await assert.rejects(reserve('after-downgrade'), /STORAGE_CAPACITY_EXCEEDED/);
  await pool.query('update nexclinic_storage.accounts set limit_bytes=null where clinic_id=$1', [clinic]);
  await reserve('unlimited', 1000000);
  const changer = await pool.connect();
  try {
    await changer.query('begin');
    await changer.query('update nexclinic_storage.accounts set limit_bytes=1000105 where clinic_id=$1', [clinic]);
    const concurrentReservation = reserve('during-plan-change');
    await changer.query('commit');
    await assert.rejects(concurrentReservation, /STORAGE_CAPACITY_EXCEEDED/);
  } finally { changer.release(); }
  await pool.query('update nexclinic_storage.accounts set limit_bytes=null where clinic_id=$1', [clinic]);
  await assert.rejects(reserve('invalid-size', -1), /INVALID_STORAGE_OPERATION/);
  await assert.rejects(pool.query(
    'select * from nexclinic_storage.reserve($1,$2,$3,$4,$5,$6)',
    [clinic, 'foreign-path', '00000000-0000-4000-8000-000000000002/file', 'application/pdf', 1, digest],
  ), /check constraint/);
  await pool.query('update nexclinic_storage.accounts set inventoried=false where clinic_id=$1', [clinic]);
  await assert.rejects(reserve('without-inventory'), /STORAGE_INVENTORY_REQUIRED/);
  const roles = [`${database}_anon`, `${database}_authenticated`];
  for (const role of roles) await pool.query(`create role ${role}`);
  const client = await pool.connect();
  try {
    for (const role of roles) {
      await client.query(`set role ${role}`);
      await assert.rejects(client.query('select * from nexclinic_storage.accounts'), /permission denied/);
      await assert.rejects(client.query('select nexclinic_storage.mark_uncertain($1)', [first.id]), /permission denied/);
      await client.query('reset role');
    }
  } finally { client.release(); }
  console.log('PASS: 20 concurrent uploads, 12 identical retries, conflict, uncertainty, integrity, idempotent completion, downgrade, concurrent plan update, unlimited, invalid size, tenant path, missing inventory and fictitious roles');
} finally { await pool.end(); }
