#!/usr/bin/env node
/**
 * M04-WEB-062 — real PG18 negative acceptance of draft PR #174's immutable
 * alternate 0018 migration lineage. Dedicated disposable loopback database
 * only. Intentionally prove checksum-based integration FAILS CLOSED, never
 * adapt/mutate the journal or retrofit unreserved schema on a live target.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPgPool,applyPendingMigrations} from '../packages/db/dist/index.js';
import {validateM04QaEnvironment} from './verify-m04-qa-guard.mjs';
import {classifyM040018History,M04_WEBSITE_MIGRATION_ID,migrationSqlChecksum} from './m04-0018-provenance.mjs';

const guard=validateM04QaEnvironment({
  nodeVersion:process.version,pnpmVersion:process.env.BROVEXA_M04_QA_PNPM_VERSION,
  databaseUrl:process.env.DATABASE_URL,isolated:process.env.BROVEXA_M04_QA_ISOLATED,
  resetOptIn:process.env.BROVEXA_DB_TEST_ALLOW_RESET,
});
if(!guard.allowed)throw new Error('M04 PR174 divergence QA preflight denied: '+guard.errors.join('; '));

const official=resolve('packages/db/migrations');
const fixture=resolve('scripts/fixtures/m04-pr174-0018.up.sql');
const canonicalSql=await readFile(join(official,M04_WEBSITE_MIGRATION_ID+'.up.sql'),'utf8');
const draftSql=await readFile(fixture,'utf8');

// Git blob identity is pinned to PR #174 at head
// 3728223f87dde287779fc456530b7b6be424dbe1.
const gitBlob=createHash('sha1')
  .update('blob '+Buffer.byteLength(draftSql)+'\\0'+draftSql).digest('hex');
assert.equal(gitBlob,'41696665e6422b3a161476fbb3f5b1f5f17ec149',
  'Peer SQL fixture differs from the reviewed immutable PR #174 Git blob');
const expectedSha=migrationSqlChecksum(draftSql);
assert.notEqual(expectedSha,migrationSqlChecksum(canonicalSql),
  'Alternate PR174 0018 must never silently become canonical');

const scratch=await mkdtemp(join(tmpdir(),'brovexa-m04-pr174-'));
const pool=createPgPool({connectionString:process.env.DATABASE_URL,max:2});
try{
  // Fail instead of clearing any existing schema, even disposable. This job
  // must exclusively own a fresh dedicated PostgreSQL CI database.
  const preexisting=await pool.query(`SELECT
    to_regclass('brovexa_internal.schema_migrations') IS NOT NULL AS journal,
    to_regclass('public.website_inspection_runs') IS NOT NULL AS legacy_table`);
  assert.equal(preexisting.rows[0].journal,false,'This QA job requires a fresh uninitialized database');
  assert.equal(preexisting.rows[0].legacy_table,false,'Existing 0018 table cannot be overwritten');

  await cp(official,scratch,{recursive:true});
  for(const name of await readdir(scratch)){
    if(/^\\d{4}_.+\\.up\\.sql$/.test(name) && Number(name.slice(0,4))>18){
      await rm(join(scratch,name));
    }
  }
  await writeFile(join(scratch,M04_WEBSITE_MIGRATION_ID+'.up.sql'),draftSql);
  const peerApplied=await applyPendingMigrations(pool,scratch);
  assert.ok(peerApplied.includes(M04_WEBSITE_MIGRATION_ID),'Draft 0018 actually applied in real PostgreSQL');
  assert.ok(!peerApplied.some(id=>Number(id.slice(0,4))>18),'No future migrations can apply in peer phase');

  const before=await pool.query(
    'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id');
  const peer=before.rows.find(row=>row.id===M04_WEBSITE_MIGRATION_ID);
  assert.equal(peer?.checksum,expectedSha,'Journal must contain original PR174 SQL SHA256');
  const cols=(await pool.query(`SELECT column_name,data_type,is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='website_inspection_runs'`)).rows;
  const constraints=(await pool.query(`SELECT con.conname AS name,
      con.contype AS type,con.convalidated AS validated,pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid=con.conrelid
    JOIN pg_namespace ns ON ns.oid=rel.relnamespace
    WHERE ns.nspname='public' AND rel.relname='website_inspection_runs'`)).rows;

  const verdict=classifyM040018History({
    localSql:canonicalSql,alternateSql:draftSql,journalPresent:true,
    journalRows:before.rows,tablePresent:true,columns:cols,constraints,
  });
  assert.equal(verdict.status,'KNOWN_DIVERGENT_APPLIED');
  assert.equal(verdict.canUseCheckpointHistory,false);
  assert.deepEqual(verdict.missingColumns,
    ['max_pages','max_response_bytes','timeout_ms']);

  // The real migration runner must reject the mixed lineage before 0019+
  // regardless of any adapter/DDL ordering or previous PR approval.
  await assert.rejects(()=>applyPendingMigrations(pool,official),
    new RegExp('Applied migration checksum mismatch: '+M04_WEBSITE_MIGRATION_ID));
  const after=await pool.query('SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id');
  assert.deepEqual(after.rows,before.rows,'Refusal must preserve every applied migration checksum and ID');
  const later=await pool.query(`SELECT count(*)::int AS total
    FROM brovexa_internal.schema_migrations WHERE id >= '0019_'`);
  assert.equal(later.rows[0].total,0,'Canonical 0019–0026 must not partially apply after 0018 mismatch');

  console.log('M04 native PG18 PR174 alternate 0018 applied SHA256: '+expectedSha);
  console.log('M04 QA09 PR174: actual divergent 0018 journal classified KNOWN_DIVERGENT_APPLIED PASS');
  console.log('M04 QA09 PR174: canonical 0018 checksum collision rejected without journal mutation PASS');
  console.log('M04 QA09 PR174: no 0019+ applied; forward-migration decision remains integration-owner gated PASS');
}finally{
  await pool.end();
  await rm(scratch,{recursive:true,force:true});
}
