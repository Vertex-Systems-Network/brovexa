#!/usr/bin/env node
/**
 * M04-WEB-062 — real PG18 negative acceptance of draft PR #174's immutable
 * alternate 0018 migration lineage. Dedicated disposable loopback database
 * only. Intentionally prove checksum-based integration FAILS CLOSED, never
 * adapt/mutate the journal or retrofit unreserved schema on a live target.
 */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {cp,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPgPool,applyPendingMigrations,rollbackLatestMigration,
  persistWebsiteInspectionResult,deleteWebsiteInspectionEvidence} from '../packages/db/dist/index.js';
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
  .update('blob '+Buffer.byteLength(draftSql)).update(Buffer.from([0]))
  .update(draftSql).digest('hex');
assert.equal(gitBlob,'41696665e6422b3a161476fbb3f5b1f5f17ec149',
  'Peer SQL fixture differs from the reviewed immutable PR #174 Git blob');
const expectedSha=migrationSqlChecksum(draftSql);
assert.notEqual(expectedSha,migrationSqlChecksum(canonicalSql),
  'Alternate PR174 0018 must never silently become canonical');

const scratch=await mkdtemp(join(tmpdir(),'brovexa-m04-pr174-'));
const peerDir=join(scratch,'migrations');
const pool=createPgPool({connectionString:process.env.DATABASE_URL,max:2});
try{
  // Fail instead of clearing any existing schema, even disposable. This job
  // must exclusively own a fresh dedicated PostgreSQL CI database.
  const preexisting=await pool.query(`SELECT
    to_regclass('brovexa_internal.schema_migrations') IS NOT NULL AS journal,
    to_regclass('public.website_inspection_runs') IS NOT NULL AS legacy_table`);
  assert.equal(preexisting.rows[0].journal,false,'This QA job requires a fresh uninitialized database');
  assert.equal(preexisting.rows[0].legacy_table,false,'Existing 0018 table cannot be overwritten');

  await cp(official,peerDir,{recursive:true});
  for(const name of await readdir(peerDir)){
    if(/^[0-9]{4}_.+[.]up[.]sql$/.test(name) && Number(name.slice(0,4))>18){
      await rm(join(peerDir,name));
    }
  }
  await writeFile(join(peerDir,M04_WEBSITE_MIGRATION_ID+'.up.sql'),draftSql);
  const peerApplied=await applyPendingMigrations(pool,peerDir);
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

  // WEB-063: Construct an EPHEMERAL candidate combined-tree migration set
  // without changing official 0018, draft PR #174, main or the shared ledger.
  // The already-applied draft 0018 SQL stays byte-identical and journal-safe;
  // all checkpoint 0019-0026 are then migrated through the normal runner.
  const candidateDir=join(scratch,'candidate-migrations');
  const previewName='0027_website_inspection_legacy_budget_compatibility';
  await cp(official,candidateDir,{recursive:true});
  await writeFile(join(candidateDir,M04_WEBSITE_MIGRATION_ID+'.up.sql'),draftSql);
  for(const extension of ['up','down']){
    await cp(resolve('scripts/fixtures/m04-pr174-budget-forward-preview.'+extension+'.sql'),
      join(extension==='down'?join(candidateDir,'down'):candidateDir,
        previewName+'.'+extension+'.sql'));
  }
  const continuation=await applyPendingMigrations(pool,candidateDir);
  assert.equal(continuation.length,9,'Preview must apply checkpoint 0019-0026 plus 0027 candidate');
  assert.equal(continuation[0].slice(0,4),'0019');
  assert.equal(continuation.at(-1),previewName);
  const upgraded=await pool.query(
    'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id');
  assert.equal(
    upgraded.rows.find(row=>row.id===M04_WEBSITE_MIGRATION_ID)?.checksum,
    expectedSha,'Original draft migration 0018 SHA256 must remain unchanged');
  assert.equal(upgraded.rows.length,before.rows.length+9,
    'Candidate must not skip or rewrite any earlier migrations');
  const budgetCols=await pool.query(`SELECT column_name,data_type,is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='website_inspection_runs'
      AND column_name IN ('max_pages','max_response_bytes','timeout_ms','retention_ttl_seconds')
    ORDER BY column_name`);
  assert.deepEqual(budgetCols.rows,[
    {column_name:'max_pages',data_type:'smallint',is_nullable:'NO'},
    {column_name:'max_response_bytes',data_type:'integer',is_nullable:'NO'},
    {column_name:'retention_ttl_seconds',data_type:'bigint',is_nullable:'NO'},
    {column_name:'timeout_ms',data_type:'integer',is_nullable:'NO'},
  ]);
  const budgetChecks=await pool.query(`SELECT con.conname,con.convalidated,
       pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid=con.conrelid
    WHERE rel.relname='website_inspection_runs'
      AND con.conname IN ('website_runs_budget_check','website_runs_retention_check')
    ORDER BY con.conname`);
  assert.deepEqual(budgetChecks.rows.map(row=>row.conname),[
    'website_runs_budget_check','website_runs_retention_check']);
  assert.ok(budgetChecks.rows.every(row=>row.convalidated));
  assert.ok(budgetChecks.rows.find(row=>row.conname==='website_runs_budget_check')
    ?.definition.includes('max_response_bytes'));
  assert.ok(budgetChecks.rows.find(row=>row.conname==='website_runs_retention_check')
    ?.definition.includes('31536000'));
  console.log('M04 QA09 PR174: draft 0018 checksum retained through normal 0019-0026 migrations PASS');
  console.log('M04 QA09 PR174: scratch 0027 preview adds bounded NOT NULL columns and validated checks PASS');
  const undone=await rollbackLatestMigration(pool,candidateDir);
  assert.equal(undone,previewName,'Preview DOWN must reverse only candidate 0027');
  const redone=await applyPendingMigrations(pool,candidateDir);
  assert.deepEqual(redone,[previewName],'Only preview 0027 should reapply after rollback');
  console.log('M04 QA09 PR174: empty-table 0027 DOWN/reapply is reversible without 0018 history rewrite PASS');

  // Retained prior inspection evidence makes a rollback unsafe, even if it
  // originally entered after the new limits were enforced. Use only real,
  // valid test rows; never disable FKs, defer retention or forge admissions.
  const w=randomUUID(),b='m04.qa.legacy.'+randomUUID().slice(0,8);
  const e='m04.qa.evidence.'+randomUUID().slice(0,8);
  const d='m04.qa.verified.'+randomUUID().slice(0,8);
  const inspection='m04.qa.legacy.inspection.'+randomUUID().slice(0,8);
  await pool.query(
    "INSERT INTO workspaces(id,slug,display_name) VALUES($1,$2,'M04 Legacy Compatibility Test')",
    [w,'m04-legacy-'+randomUUID().slice(0,8)],
  );
  await pool.query(
    "INSERT INTO canonical_businesses(id,workspace_id,display_name) VALUES($1,$2,'M04 Legacy Business')",
    [b,w],
  );
  await pool.query(`INSERT INTO business_domain_evidence
     (id,workspace_id,canonical_business_id,normalized_domain,kind,effect,
      source_key,source_reference_ids,source_policy_id,source_policy_version,
      source_admission_decision_ref,storage_class,retention_ttl_seconds,
      deletion_required,observed_at,recorded_at)
     VALUES($1,$2,$3,'example.com','official_website','supports_domain',
      'source.m04.preview','["m04.qa.legacy.reference"]'::jsonb,
      'policy.m04.preview','1.0.0','m04.qa.legacy.admission',
      'EVIDENCE_MINIMAL',3600,true,
      clock_timestamp()-interval '10 seconds',clock_timestamp()-interval '9 seconds')`,
    [e,w,b]);
  await pool.query(`INSERT INTO business_domain_verification_decisions
     (id,workspace_id,canonical_business_id,normalized_domain,decision,method,
      confidence,evidence_ids,reason_codes,evaluated_at)
     VALUES($1,$2,$3,'example.com','verified','deterministic',0.99,
      $4::jsonb,'["domain_independent_support"]'::jsonb,clock_timestamp())`,
    [d,w,b,JSON.stringify([e])]);
  const inputColumns=[
    'id','workspace_id','canonical_business_id','domain_verification_id',
    'verified_domain','target_url','source_key','source_admission_decision_ref',
    'source_policy_id','source_policy_version','transport_policy_id',
    'transport_policy_version','status','coverage','transport_receipt_ids',
    'reason_codes','payload_hash','retention_ttl_seconds','deletion_required',
    'requested_at','completed_at',
  ];
  const inspectionValues=[
    inspection,w,b,d,'example.com','https://example.com/','source.m04.preview',
    'm04.qa.legacy.admission','policy.m04.preview','1.0.0',
    'transport.m04.preview','1.0.0','unavailable','none','[]',
    '["website.unavailable"]','a'.repeat(64),3600,true,
    new Date(Date.now()-1000).toISOString(),new Date().toISOString(),
  ];

  const insertLegacy=async withBudget=>{
    const names=withBudget?[...inputColumns,'max_pages','max_response_bytes','timeout_ms']:inputColumns;
    const vals=withBudget?[...inspectionValues,1,1024,500]:inspectionValues;
    const placeholders=vals.map((_,i)=>String.fromCharCode(36)+(i+1)).join(',');
    return pool.query(
      'INSERT INTO website_inspection_runs ('+names.join(',')+') VALUES ('+placeholders+')',
      vals,
    );
  };
  await insertLegacy(true);
  await assert.rejects(()=>rollbackLatestMigration(pool,candidateDir),
    error=>error?.code==='23514' &&
      error?.constraint==='website_legacy_budget_rollback_requires_empty',
    'Cannot discard budget columns while valid website evidence is retained');
  await pool.query('DELETE FROM website_inspection_runs WHERE id='+String.fromCharCode(36)+'1',[inspection]);
  assert.equal(await rollbackLatestMigration(pool,candidateDir),previewName);
  await insertLegacy(false);
  const journalBeforeBlocked=await pool.query(
    'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id');
  await assert.rejects(()=>applyPendingMigrations(pool,candidateDir),
    error=>error?.code==='23514' &&
      error?.constraint==='website_legacy_budget_provenance_required',
    'Cannot invent absent page/byte/timeout limits for a historical row');
  const journalAfterBlocked=await pool.query(
    'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id');
  assert.deepEqual(journalAfterBlocked.rows,journalBeforeBlocked.rows,
    'Blocked upgrade cannot write a new migration receipt or alter applied 0018');
  const unchangedLegacy=await pool.query(
    'SELECT count(*)::int AS total FROM website_inspection_runs WHERE id='+String.fromCharCode(36)+'1',
    [inspection]);
  assert.equal(unchangedLegacy.rows[0].total,1,'A blocked repair must preserve historical evidence');
  await pool.query('DELETE FROM website_inspection_runs WHERE id='+String.fromCharCode(36)+'1',[inspection]);
  assert.deepEqual(await applyPendingMigrations(pool,candidateDir),[previewName]);
  console.log('M04 QA09 PR174: populated-evidence upgrade and rollback both fail closed, journal unchanged PASS');

  // WEB-064: Prove the actual *checkpoint* TypeScript persistence adapter
  // works against a PR174-original 0018 journal repaired by scratch 0027.
  // This is not a mock: every write runs normal PG transactions/triggers.
  const adapterId='m04.qa.adapter.'+randomUUID().slice(0,8);
  const requestedAt=new Date(Date.now()-12000).toISOString();
  const completedAt=new Date(Date.now()-10000).toISOString();
  const adapterInput={
    version:'1.0.0',
    request:{
      version:'1.0.0',inspectionId:adapterId,workspaceId:w,canonicalBusinessId:b,
      verifiedDomain:'example.com',
      domainVerification:{verificationId:d,decision:'verified',evidenceIds:[e]},
      targetUrl:'https://example.com/',
      sourceKey:'source.m04.preview',
      sourceAdmissionDecisionRef:'m04.qa.legacy.admission',
      sourceAdmissionDecision:'allow',
      sourcePolicySnapshot:{policyId:'policy.m04.preview',policyVersion:'1.0.0'},
      transportPolicyId:'transport.m04.preview',transportPolicyVersion:'1.0.0',
      limits:{maxPages:2,maxResponseBytes:50000,timeoutMs:2500},
      executionMode:'test_only',networkRequested:false,
      credentialedFetchRequested:false,rawPayloadRequested:false,
      outreachRequested:false,requestedAt,
    },
    status:'assessed',coverage:'bounded',
    transportReceiptIds:['m04.qa.receipt.one'],reasonCodes:[],
    observations:[{
      capability:'contact_form',observation:'observed_present',reason:'detected',
      confidence:0.95,evidenceReferenceIds:['m04.qa.page.one'],
      transportReceiptIds:['m04.qa.receipt.one'],
    }],
    completedAt,bodyIncluded:false,retentionTtlSeconds:3600,deletionRequired:true,
  };
  assert.deepEqual(await persistWebsiteInspectionResult(pool,adapterInput),
    {inspectionId:adapterId,replayed:false});
  const stored=await pool.query(
    'SELECT max_pages,max_response_bytes,timeout_ms,network_requested,body_included,'+
    'retention_ttl_seconds,deletion_required FROM website_inspection_runs WHERE id=$1',
    [adapterId]);
  assert.deepEqual(stored.rows,[{
    max_pages:2,max_response_bytes:50000,timeout_ms:2500,
    network_requested:false,body_included:false,
    retention_ttl_seconds:'3600',deletion_required:true,
  }]);
  const observed=await pool.query(
    'SELECT capability,observation,reason FROM website_capability_observations WHERE inspection_id=$1',
    [adapterId]);
  assert.deepEqual(observed.rows,[{
    capability:'contact_form',observation:'observed_present',reason:'detected',
  }]);
  assert.deepEqual(await persistWebsiteInspectionResult(pool,adapterInput),
    {inspectionId:adapterId,replayed:true});
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [adapterId])).rows[0].total,1,'Replaying same parent cannot duplicate child observations');

  await assert.rejects(
    ()=>persistWebsiteInspectionResult(pool,{
      ...adapterInput,request:{...adapterInput.request,
        limits:{...adapterInput.request.limits,maxPages:3}},
    }),
    error=>error?.code==='WEBSITE_INSPECTION_ID_CONFLICT',
    'Same inspection ID with different safe budgets cannot replace immutable evidence',
  );
  for(const limits of [
    {...adapterInput.request.limits,maxPages:6},
    {...adapterInput.request.limits,maxResponseBytes:1000001},
    {...adapterInput.request.limits,timeoutMs:99},
  ]){
    await assert.rejects(
      ()=>persistWebsiteInspectionResult(pool,{
        ...adapterInput,request:{...adapterInput.request,
          inspectionId:'m04.qa.invalid.'+randomUUID().slice(0,8),limits},
      }),
      error=>error?.code==='WEBSITE_INSPECTION_INPUT_INVALID',
      'Unsafe transport limits must be rejected before database insertion',
    );
  }
  const missingTenant=randomUUID();
  assert.equal(await deleteWebsiteInspectionEvidence(pool,{
    inspectionId:adapterId,workspaceId:missingTenant}),false,
    'Another tenant cannot delete persisted inspection evidence');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_inspection_runs WHERE id=$1',[adapterId])
  ).rows[0].total,1,'Foreign deletion must leave original evidence intact');
  assert.equal(await deleteWebsiteInspectionEvidence(pool,{
    inspectionId:adapterId,workspaceId:w}),true);
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [adapterId])).rows[0].total,0,'Scoped parent deletion must cascade observation evidence');
  assert.equal(await deleteWebsiteInspectionEvidence(pool,{
    inspectionId:adapterId,workspaceId:w}),false);
  assert.equal((await pool.query(
    'SELECT checksum FROM brovexa_internal.schema_migrations WHERE id=$1',
    [M04_WEBSITE_MIGRATION_ID])).rows[0].checksum,expectedSha,
    'Successful adapter writes must never change historical PR174 0018 checksum');
  console.log('M04 QA09 WEB-064: real adapter assessed observation, exact budget fields and idempotent replay PASS');
  console.log('M04 QA09 WEB-064: conflicting replay, unsafe limits and tenant-isolated delete/cascade PASS');


  console.log('M04 native PG18 PR174 alternate 0018 applied SHA256: '+expectedSha);
  console.log('M04 QA09 PR174: actual divergent 0018 journal classified KNOWN_DIVERGENT_APPLIED PASS');
  console.log('M04 QA09 PR174: canonical 0018 checksum collision rejected without journal mutation PASS');
  console.log('M04 QA09 PR174: initial mismatched lineage halted before 0019+, then scratch-only compatibility path verified PASS');
}finally{
  await pool.end();
  await rm(scratch,{recursive:true,force:true});
}
