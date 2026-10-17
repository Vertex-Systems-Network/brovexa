#!/usr/bin/env node
/**
 * QA-09 / WEB-061 — read-only 0018 migration journal+schema audit.
 *
 * This executable deliberately uses the M04 disposable-loopback QA guard.
 * It cannot be repurposed for production or staging by a switch. A
 * separately authorized, read-only external-DB audit is a different gate.
 */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPgPool} from '../packages/db/dist/index.js';
import {validateM04QaEnvironment} from './verify-m04-qa-guard.mjs';
import {classifyM040018History} from './m04-0018-provenance.mjs';

const guard=validateM04QaEnvironment({
  nodeVersion:process.version,
  pnpmVersion:process.env.BROVEXA_M04_QA_PNPM_VERSION,
  databaseUrl:process.env.DATABASE_URL,
  isolated:process.env.BROVEXA_M04_QA_ISOLATED,
  resetOptIn:process.env.BROVEXA_DB_TEST_ALLOW_RESET,
});
if(!guard.allowed)throw new Error('M04 QA-09 read-only preflight denied: '+guard.errors.join('; '));
const localSql=await readFile(
  resolve('packages/db/migrations/0018_website_inspection_evidence.up.sql'),'utf8',
);
const alternatePath=process.env.BROVEXA_M04_ALTERNATE_0018_UP_FILE;
const alternateSql=alternatePath?await readFile(resolve(alternatePath),'utf8'):null;
const pool=createPgPool({connectionString:process.env.DATABASE_URL,max:1});
const client=await pool.connect();
try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const names=await client.query(`SELECT
    to_regclass('brovexa_internal.schema_migrations') IS NOT NULL AS journal_present,
    to_regclass('public.website_inspection_runs') IS NOT NULL AS table_present`);
  const {journal_present:journalPresent,table_present:tablePresent}=names.rows[0];
  const journalRows=journalPresent?(await client.query(
    "SELECT id,checksum FROM brovexa_internal.schema_migrations WHERE id LIKE '0018_%' OR id >= '0019_' ORDER BY id",
  )).rows:[];
  const columns=tablePresent?(await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='website_inspection_runs'`,
  )).rows.map(row=>row.column_name):[];
  const constraints=tablePresent?(await client.query(
    `SELECT con.conname FROM pg_constraint con
     JOIN pg_class rel ON rel.oid=con.conrelid
     JOIN pg_namespace ns ON ns.oid=rel.relnamespace
     WHERE ns.nspname='public' AND rel.relname='website_inspection_runs'`,
  )).rows.map(row=>row.conname):[];
  const result=classifyM040018History({
    localSql,alternateSql,journalPresent,journalRows,tablePresent,columns,constraints,
  });
  await client.query('COMMIT');
  // Only immutable SHA256 fingerprints, status and column names are output.
  // Never log DATABASE_URL, passwords, row contents or service endpoints.
  console.log('Brovexa M04 QA-09 read-only migration 0018 provenance: '+JSON.stringify(result));
  if(!result.canUseCheckpointHistory)process.exitCode=1;
}catch(error){
  try{await client.query('ROLLBACK')}catch{}
  throw error;
}finally{
  client.release();
  await pool.end();
}
