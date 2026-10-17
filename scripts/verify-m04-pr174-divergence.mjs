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

  const insertLegacy=async (withBudget,{db=pool}={})=>{
    const names=withBudget?[...inputColumns,'max_pages','max_response_bytes','timeout_ms']:inputColumns;
    const vals=withBudget?[...inspectionValues,1,1024,500]:inspectionValues;
    const placeholders=vals.map((_,i)=>String.fromCharCode(36)+(i+1)).join(',');
    return db.query(
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


  // WEB-067: real two-connection persistence idempotency and tenant-ID
  // collision on the PR174-preserving *bounded* candidate tree. Two workers
  // may race for the same inspection; only one parent/child must be created.
  const repeatId='m04.qa.parallel.same.'+randomUUID().slice(0,8);
  const makeResult=(newId,limits=adapterInput.request.limits)=>({
    ...adapterInput,
    request:{...adapterInput.request,inspectionId:newId,limits},
  });
  const concurrentSame=await Promise.all([
    persistWebsiteInspectionResult(pool,makeResult(repeatId)),
    persistWebsiteInspectionResult(pool,makeResult(repeatId)),
  ]);
  assert.deepEqual(concurrentSame.map(v=>v.replayed).sort(),[false,true],
    'Two independent inserts must resolve to one first write and one replay');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_inspection_runs WHERE id=$1',[repeatId],
  )).rows[0].total,1);
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [repeatId],
  )).rows[0].total,1,'Concurrent identical replay cannot duplicate child observations');

  const raceId='m04.qa.parallel.conflict.'+randomUUID().slice(0,8);
  const raceInputs=[
    makeResult(raceId,{maxPages:1,maxResponseBytes:50000,timeoutMs:2500}),
    makeResult(raceId,{maxPages:3,maxResponseBytes:50000,timeoutMs:2500}),
  ];
  const raced=await Promise.allSettled(raceInputs.map(row=>persistWebsiteInspectionResult(pool,row)));
  const winner=raced.findIndex(result=>result.status==='fulfilled');
  const loser=raced.findIndex(result=>result.status==='rejected');
  assert.ok(winner===0||winner===1,'One raced payload must win');
  assert.ok(loser===0||loser===1,'One raced payload must be rejected');
  assert.deepEqual(raced[winner].value,{inspectionId:raceId,replayed:false});
  assert.equal(raced[loser].reason?.code,'WEBSITE_INSPECTION_ID_CONFLICT');
  assert.deepEqual((await pool.query(
    'SELECT max_pages FROM website_inspection_runs WHERE id=$1',[raceId],
  )).rows,[{max_pages:raceInputs[winner].request.limits.maxPages}]);
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [raceId],
  )).rows[0].total,1,'Rejected race cannot append foreign or conflicting observations');

  // A separately verified business in a different *real* tenant attempts to
  // reuse that same globally unique inspection ID. Storage must report an
  // ID conflict, without exposing, changing or reassigning the first row.
  const otherWorkspace=randomUUID();
  const otherBusiness='m04.qa.other.biz.'+randomUUID().slice(0,8);
  const otherEvidence='m04.qa.other.evidence.'+randomUUID().slice(0,8);
  const otherDecision='m04.qa.other.verified.'+randomUUID().slice(0,8);
  await pool.query(
    "INSERT INTO workspaces(id,slug,display_name) VALUES ($1,$2,'M04 Parallel Other Workspace')",
    [otherWorkspace,'m04-parallel-'+randomUUID().slice(0,8)],
  );
  await pool.query(
    "INSERT INTO canonical_businesses(id,workspace_id,display_name) VALUES ($1,$2,'Other Business')",
    [otherBusiness,otherWorkspace],
  );
  await pool.query(`INSERT INTO business_domain_evidence
    (id,workspace_id,canonical_business_id,normalized_domain,kind,effect,source_key,
     source_reference_ids,source_policy_id,source_policy_version,
     source_admission_decision_ref,storage_class,retention_ttl_seconds,
     deletion_required,observed_at,recorded_at)
    VALUES ($1,$2,$3,'example.com','official_website','supports_domain',
     'source.m04.preview','["m04.parallel.other.reference"]'::jsonb,
     'policy.m04.preview','1.0.0','m04.qa.other.admission','EVIDENCE_MINIMAL',
     3600,true,clock_timestamp()-interval '10 seconds',clock_timestamp()-interval '9 seconds')`,
    [otherEvidence,otherWorkspace,otherBusiness],
  );
  await pool.query(`INSERT INTO business_domain_verification_decisions
    (id,workspace_id,canonical_business_id,normalized_domain,decision,method,
     confidence,evidence_ids,reason_codes,evaluated_at)
    VALUES ($1,$2,$3,'example.com','verified','deterministic',0.99,$4::jsonb,
    '["domain_independent_support"]'::jsonb,clock_timestamp())`,
    [otherDecision,otherWorkspace,otherBusiness,JSON.stringify([otherEvidence])],
  );
  await assert.rejects(()=>persistWebsiteInspectionResult(pool,{
    ...makeResult(repeatId),
    request:{
      ...makeResult(repeatId).request,
      workspaceId:otherWorkspace,canonicalBusinessId:otherBusiness,
      domainVerification:{
        verificationId:otherDecision,decision:'verified',evidenceIds:[otherEvidence],
      },
    },
  }),error=>error?.code==='WEBSITE_INSPECTION_ID_CONFLICT',
  'A second valid tenant cannot use another tenant inspection ID');
  assert.deepEqual((await pool.query(
    'SELECT workspace_id FROM website_inspection_runs WHERE id=$1',[repeatId],
  )).rows,[{workspace_id:w}]);
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [repeatId],
  )).rows[0].total,1);
  assert.equal((await pool.query(
    'SELECT checksum FROM brovexa_internal.schema_migrations WHERE id=$1',
    [M04_WEBSITE_MIGRATION_ID],
  )).rows[0].checksum,expectedSha,
  'Raced persistence cannot alter the PR174 applied migration history');

  // WEB-068: Neither workspace may pre-own an ID. Two distinct, fully
  // verified tenants race for one globally unique inspection ID. This tests
  // the actual database uniqueness/transaction boundary, not a sequential
  // foreign-tenant lookup against an already-existing parent.
  const twoTenantRaceId='m04.qa.parallel.tenants.'+randomUUID().slice(0,8);
  const ownerRaceInput=makeResult(twoTenantRaceId);
  const foreignRaceInput={
    ...makeResult(twoTenantRaceId),
    request:{
      ...makeResult(twoTenantRaceId).request,
      workspaceId:otherWorkspace,
      canonicalBusinessId:otherBusiness,
      sourceAdmissionDecisionRef:'m04.qa.other.admission',
      domainVerification:{
        verificationId:otherDecision,decision:'verified',evidenceIds:[otherEvidence],
      },
    },
  };
  const twoTenantResults=await Promise.allSettled([
    persistWebsiteInspectionResult(pool,ownerRaceInput),
    persistWebsiteInspectionResult(pool,foreignRaceInput),
  ]);
  const acceptedTenant=twoTenantResults.findIndex(x=>x.status==='fulfilled');
  const deniedTenant=twoTenantResults.findIndex(x=>x.status==='rejected');
  assert.ok([0,1].includes(acceptedTenant),'Exactly one valid tenant must win the fresh ID');
  assert.ok([0,1].includes(deniedTenant),'Exactly one valid tenant must lose the fresh ID');
  assert.notEqual(acceptedTenant,deniedTenant);
  assert.deepEqual(twoTenantResults[acceptedTenant].value,{
    inspectionId:twoTenantRaceId,replayed:false,
  });
  assert.equal(twoTenantResults[deniedTenant].reason?.code,
    'WEBSITE_INSPECTION_ID_CONFLICT',
    'Different verified tenant must receive deterministic global ID conflict');
  const acceptedWorkspace=acceptedTenant===0?w:otherWorkspace;
  const deniedWorkspace=acceptedTenant===0?otherWorkspace:w;
  assert.deepEqual((await pool.query(
    'SELECT workspace_id FROM website_inspection_runs WHERE id=$1',
    [twoTenantRaceId],
  )).rows,[{workspace_id:acceptedWorkspace}]);
  assert.deepEqual((await pool.query(
    'SELECT workspace_id,capability FROM website_capability_observations WHERE inspection_id=$1',
    [twoTenantRaceId],
  )).rows,[{workspace_id:acceptedWorkspace,capability:'contact_form'}]);
  assert.equal(await deleteWebsiteInspectionEvidence(pool,{
    inspectionId:twoTenantRaceId,workspaceId:deniedWorkspace,
  }),false,'Losing tenant must not delete the winning tenant evidence');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_inspection_runs WHERE id=$1',
    [twoTenantRaceId],
  )).rows[0].total,1,'Losing tenant deletion cannot erase the winner');
  assert.equal(await deleteWebsiteInspectionEvidence(pool,{
    inspectionId:twoTenantRaceId,workspaceId:acceptedWorkspace,
  }),true,'Winning tenant must be able to delete its own fixture');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [twoTenantRaceId],
  )).rows[0].total,0,'Winner-owned cleanup must cascade the only child');
  console.log('M04 QA09 WEB-068: two verified tenants race for unowned inspection ID; only winner can delete PASS');

  console.log('M04 QA09 WEB-067: parallel identical replay, changed payload conflict and cross-tenant ID collision PASS');
  // These successful concurrent fixtures must not contaminate the subsequent
  // WEB-065 empty-table DDL acceptance. Delete only explicitly owned IDs;
  // assert cascaded observations are gone before testing DOWN/UP races.
  for(const completedId of [repeatId,raceId]){
    assert.equal(await deleteWebsiteInspectionEvidence(pool,{
      inspectionId:completedId,workspaceId:w,
    }),true,'WEB-067 owned fixture must be safely removable');
  }
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_inspection_runs WHERE id = ANY($1::text[])',
    [[repeatId,raceId]],
  )).rows[0].total,0,'No parallel parent fixture may leak into WEB-065 DDL');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id = ANY($1::text[])',
    [[repeatId,raceId]],
  )).rows[0].total,0,'No parallel observation fixture may leak into WEB-065 DDL');


  // WEB-069: Assert that database constraints and immutable triggers still
  // reject *direct SQL* when an application writer bypasses TypeScript input
  // validation. Use a genuine assessed inspection as a source-of-truth row,
  // and clone its persisted shape while changing exactly one unsafe field.
  // Each direct-write probe runs in a separate real PostgreSQL transaction.
  const guardParentId='m04.qa.sql.guard.'+randomUUID().slice(0,8);
  assert.deepEqual(await persistWebsiteInspectionResult(pool,makeResult(guardParentId)),
    {inspectionId:guardParentId,replayed:false});
  const guardCols=[
    'id','workspace_id','canonical_business_id','domain_verification_id',
    'verified_domain','target_url','source_key','source_admission_decision_ref',
    'source_policy_id','source_policy_version','transport_policy_id',
    'transport_policy_version','max_pages','max_response_bytes','timeout_ms',
    'status','coverage','transport_receipt_ids','reason_codes','payload_hash',
    'retention_ttl_seconds','deletion_required','requested_at','completed_at',
    'body_included','network_requested','credentialed_fetch_requested',
    'outreach_requested',
  ];
  const guardJournalBefore=(await pool.query(
    'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id',
  )).rows;
  const unsafeParents=[
    {field:'max_pages',value:0,constraint:'website_runs_budget_check'},
    {field:'max_pages',value:6,constraint:'website_runs_budget_check'},
    {field:'max_response_bytes',value:1000001,constraint:'website_runs_budget_check'},
    {field:'timeout_ms',value:99,constraint:'website_runs_budget_check'},
    {field:'retention_ttl_seconds',value:0,constraint:'website_runs_retention_check'},
    {field:'retention_ttl_seconds',value:null,constraint:'not_null_violation'},
    {field:'deletion_required',value:false,constraint:'website_runs_retention_check'},
    {field:'body_included',value:true,constraint:'website_runs_safety_check'},
    {field:'network_requested',value:true,constraint:'website_runs_safety_check'},
    {field:'credentialed_fetch_requested',value:true,constraint:'website_runs_safety_check'},
    {field:'outreach_requested',value:true,constraint:'website_runs_safety_check'},
    {field:'target_url',value:'http://example.com/',constraint:'website_runs_url_check'},
    {field:'payload_hash',value:'not-a-sha256',constraint:'website_runs_payload_hash_check'},
    {field:'coverage',value:'none',constraint:'website_runs_result_check'},
  ];
  for(const [i,test] of unsafeParents.entries()){
    const newId='m04.qa.sql.invalid.'+i+'.'+randomUUID().slice(0,8);
    const selectFields=guardCols.map(column=>{
      if(column==='id')return '$1';
      if(column===test.field)return '$3';
      return column;
    });
    const badInsert='INSERT INTO website_inspection_runs ('+
      guardCols.join(',')+') SELECT '+selectFields.join(',')+
      ' FROM website_inspection_runs WHERE id=$2';
    await assert.rejects(()=>pool.query(badInsert,[newId,guardParentId,test.value]),
      err=>test.constraint==='not_null_violation'
        ? err?.code==='23502' && err?.column===test.field
        : err?.code==='23514' && err?.constraint===test.constraint,
      'Database must directly reject unsafe '+test.field+' probe #'+i);
    assert.equal((await pool.query(
      'SELECT count(*)::int AS total FROM website_inspection_runs WHERE id=$1',
      [newId],
    )).rows[0].total,0,'Rejected direct SQL may never leave parent evidence');
  }

  await assert.rejects(
    ()=>pool.query('UPDATE website_inspection_runs SET max_pages=3 WHERE id=$1',
      [guardParentId]),
    err=>err?.code==='23514' &&
      err?.constraint==='website_inspection_evidence_immutable_guard',
    'No existing approved budget may be changed through direct SQL');
  await assert.rejects(
    ()=>pool.query(`INSERT INTO website_capability_observations
      (inspection_id,workspace_id,coverage,capability,observation,reason,confidence,
       evidence_reference_ids,transport_receipt_ids)
      VALUES ($1,$2,'bounded','https','observed_present','detected',0.9,
        '["m04.qa.fake.reference"]'::jsonb,'["m04.qa.foreign.receipt"]'::jsonb)`,
      [guardParentId,w]),
    err=>err?.code==='23514' &&
      err?.constraint==='website_observations_receipt_binding_guard',
    'Foreign receipt evidence may not be injected directly into a valid parent');
  await assert.rejects(
    ()=>pool.query(`UPDATE website_capability_observations SET confidence=0.1
       WHERE inspection_id=$1 AND capability='contact_form'`,[guardParentId]),
    err=>err?.code==='23514' &&
      err?.constraint==='website_inspection_evidence_immutable_guard',
    'Direct SQL cannot mutate immutable child evidence');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [guardParentId],
  )).rows[0].total,1);
  assert.equal(await deleteWebsiteInspectionEvidence(pool,{
    inspectionId:guardParentId,workspaceId:w,
  }),true,'Direct-DML guard parent must be deletable by its owner');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_capability_observations WHERE inspection_id=$1',
    [guardParentId],
  )).rows[0].total,0,'Guard parent deletion must cascade observation');
  assert.deepEqual((await pool.query(
    'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id',
  )).rows,guardJournalBefore,'Unsafe DML attempts must not change applied migration journal');
  console.log('M04 QA09 WEB-069: 14 direct SQL bypasses + immutable/receipt triggers reject and preserve journal PASS');


  // WEB-070: A malicious direct SQL writer must not escape composite
  // tenant/business/domain-verification FKs or insert poisoned child evidence.
  // Seed real independently verified workspaces, not fake or disabled keys.
  const scopedParentId='m04.qa.sql.scope.'+randomUUID().slice(0,8);
  assert.deepEqual(await persistWebsiteInspectionResult(pool,makeResult(scopedParentId)),
    {inspectionId:scopedParentId,replayed:false});
  const badScopeParents=[
    {field:'workspace_id',value:otherWorkspace,
      code:'23503',constraint:'website_runs_business_fk'},
    {field:'canonical_business_id',value:otherBusiness,
      code:'23503',constraint:'website_runs_business_fk'},
    {field:'domain_verification_id',value:otherDecision,
      code:'23503',constraint:'website_runs_verified_domain_fk'},
    {field:'source_admission_decision',value:'deny',
      code:'23514',constraint:'website_runs_source_check'},
    {field:'source_key',value:'source:unverified',
      code:'23514',constraint:'website_runs_source_check'},
    {field:'verification_decision',value:'rejected',
      code:'23514',constraint:'website_runs_verified_check'},
  ];
  for(const [i,test] of badScopeParents.entries()){
    const rejectedId='m04.qa.sql.scope.denied.'+i+'.'+randomUUID().slice(0,8);
    const parentColumns=guardCols.map(column=>
      column==='id'?'$1':column===test.field?'$3':column);
    const query='INSERT INTO website_inspection_runs ('+guardCols.join(',')+
      ') SELECT '+parentColumns.join(',')+' FROM website_inspection_runs WHERE id=$2';
    await assert.rejects(()=>pool.query(query,
      [rejectedId,scopedParentId,test.value]),
      err=>err?.code===test.code && err?.constraint===test.constraint,
      'Raw parent SQL cannot bypass '+test.field+' composite binding');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM website_inspection_runs WHERE id=$1',
      [rejectedId],
    )).rows[0].n,0,'Denied tenant/domain insert must not leave a parent');
  }
  const childColumns=[
    'inspection_id','workspace_id','coverage','capability','observation',
    'reason','confidence','evidence_reference_ids','transport_receipt_ids',
  ];
  const childValues=[
    scopedParentId,w,'bounded','https','observed_present','detected',0.9,
    JSON.stringify(['m04.qa.page.scope']),JSON.stringify(['m04.qa.receipt.one']),
  ];
  const badChildCases=[
    {field:'workspace_id',value:otherWorkspace,
      code:'23514',constraint:'website_observations_receipt_binding_guard'},
    {field:'coverage',value:'partial',
      code:'23503',constraint:'website_observations_inspection_fk'},
    {field:'capability',value:'unsupported_capability',
      code:'23514',constraint:'website_observations_capability_check'},
    {field:'observation',value:'unknown',
      code:'23514',constraint:'website_observations_shape_check'},
    {field:'confidence',value:2.0,
      code:'23514',constraint:'website_observations_shape_check'},
    {field:'evidence_reference_ids',value:JSON.stringify([]),
      code:'23514',constraint:'website_observations_shape_check'},
  ];
  for(const test of badChildCases){
    const args=childValues.map((value,i)=>
      childColumns[i]===test.field?test.value:value);
    const childInsert='INSERT INTO website_capability_observations ('+
      childColumns.join(',')+') VALUES ('+
      args.map((_,i)=>'$'+(i+1)).join(',')+')';
    await assert.rejects(()=>pool.query(childInsert,args),
      err=>err?.code===test.code && err?.constraint===test.constraint,
      'Database must reject direct child '+test.field+' poisoning');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM website_capability_observations WHERE inspection_id=$1',
      [scopedParentId],
    )).rows[0].n,1,'Rejected child poison must not append evidence');
  }
  // Deferred assessed-result trigger must fire at actual COMMIT, not merely
  // INSERT. This guards raw SQL paths which omit the required child evidence.
  const emptyAssessedId='m04.qa.sql.empty.assessed.'+randomUUID().slice(0,8);
  const tx=await pool.connect();
  try{
    await tx.query('BEGIN');
    const fields=guardCols.map(c=>c==='id'?'$1':c);
    await tx.query('INSERT INTO website_inspection_runs ('+guardCols.join(',')+
      ') SELECT '+fields.join(',')+
      ' FROM website_inspection_runs WHERE id=$2',
      [emptyAssessedId,scopedParentId]);
    await assert.rejects(()=>tx.query('COMMIT'),
      err=>err?.code==='23514' &&
        err?.constraint==='website_runs_assessed_observations_guard',
      'Assessed without any child observation must fail at transaction COMMIT');
  }finally{
    try{await tx.query('ROLLBACK')}catch{}
    tx.release();
  }
  assert.equal((await pool.query(
    'SELECT count(*)::int AS n FROM website_inspection_runs WHERE id=$1',
    [emptyAssessedId],
  )).rows[0].n,0,'Deferred COMMIT rejection must roll back the entire parent');
  assert.equal(await deleteWebsiteInspectionEvidence(pool,{
    inspectionId:scopedParentId,workspaceId:w,
  }),true,'Owner must safely clean the tenant/domain guard fixture');
  assert.equal((await pool.query(
    'SELECT count(*)::int AS n FROM website_capability_observations WHERE inspection_id=$1',
    [scopedParentId],
  )).rows[0].n,0,'Owner cleanup must cascade its trusted child');
  assert.deepEqual((await pool.query(
    'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id',
  )).rows,guardJournalBefore,'Direct tenant/child SQL probes must not mutate journal');
  console.log('M04 QA09 WEB-070: composite tenant/domain bindings, poisoned children and deferred assessed COMMIT reject PASS');

  // WEB-066: Original PR174 adapter is a different code lineage, not just
  // alternate migration SQL. Freeze its *exact* Git blob and execute the
  // literal SQL it would send to a real repaired PostgreSQL schema.
  // The unbounded 21-column INSERT must fail; only the checkpoint adapter
  // with explicit approved source budgets can write a 24-column record.
  const peerAdapterSource=await readFile(
    resolve('scripts/fixtures/m04-pr174-website-inspection-persistence.ts'),'utf8');
  const peerAdapterGitBlob=createHash('sha1')
    .update('blob '+Buffer.byteLength(peerAdapterSource))
    .update(Buffer.from([0]))
    .update(peerAdapterSource).digest('hex');
  assert.equal(peerAdapterGitBlob,'d9e6e560f85a8361a643246312a862288e72d590',
    'Original PR174 persistence adapter fixture diverged from audited source blob');
  const peerInsert=peerAdapterSource.match(
    /'(INSERT INTO website_inspection_runs \([^'\n]+\) VALUES \([^'\n]+\) ON CONFLICT \(id\) DO NOTHING RETURNING id)'/);
  assert.ok(peerInsert?.[1],'Expected to find exact original PR174 adapter parent INSERT SQL');
  const peerSql=peerInsert[1];
  const peerColumns=peerSql.split('(')[1]?.split(')')[0]?.split(',');
  assert.equal(peerColumns?.length,21,'Original PR174 SQL insert shape has changed; re-audit required');
  for(const budgetField of ['max_pages','max_response_bytes','timeout_ms']){
    assert.ok(!peerColumns.includes(budgetField),
      'Legacy adapter unexpectedly contains '+budgetField+'; re-audit required');
  }
  const oldShapeId='m04.qa.legacy.sql.'+randomUUID().slice(0,8);
  const oldShapeArgs=[
    oldShapeId,w,b,d,'example.com','https://example.com/',
    'source.m04.preview','m04.qa.legacy.admission',
    'policy.m04.preview','1.0.0','transport.m04.preview','1.0.0',
    'unavailable','none','[]','["website.unavailable"]',
    createHash('sha256').update(oldShapeId).digest('hex'),3600,true,
    requestedAt,completedAt,
  ];
  assert.equal(oldShapeArgs.length,21);
  await assert.rejects(
    ()=>pool.query(peerSql,oldShapeArgs),
    error=>error?.code==='23502' && error?.column==='max_pages',
    'Original PR174 adapter must never appear compatible with repaired NOT NULL budget schema',
  );
  assert.equal((await pool.query(
    'SELECT count(*)::int AS total FROM website_inspection_runs WHERE id=$1',
    [oldShapeId])).rows[0].total,0,
    'Rejected original PR174 adapter write must leave no website inspection row');
  console.log('M04 QA09 WEB-066: exact PR174 legacy 21-column adapter write fails real PG18 NOT NULL budget guard PASS');




  // WEB-065: the transaction that writes a historical row must serialize
  // against the candidate's validation+DDL. A naive COUNT followed by ALTER
  // without LOCK TABLE loses this race. Exercise both DDL directions using
  // separate real PostgreSQL connections, without any unsafe trigger bypass.
  const writer=await pool.connect();
  try{
    await writer.query('BEGIN');
    await insertLegacy(true,{db:writer});
    await assert.rejects(
      ()=>rollbackLatestMigration(pool,candidateDir),
      error=>error?.code==='55P03',
      'Preview DOWN must block on an uncommitted concurrent evidence writer',
    );
    await writer.query('COMMIT');
    await assert.rejects(
      ()=>rollbackLatestMigration(pool,candidateDir),
      error=>error?.code==='23514' &&
        error?.constraint==='website_legacy_budget_rollback_requires_empty',
      'A subsequently committed legacy row must prevent budget column removal',
    );
    await pool.query('DELETE FROM website_inspection_runs WHERE id=$1',[inspection]);
    assert.equal(await rollbackLatestMigration(pool,candidateDir),previewName);
    await writer.query('BEGIN');
    await insertLegacy(false,{db:writer});
    await assert.rejects(
      ()=>applyPendingMigrations(pool,candidateDir),
      error=>error?.code==='55P03',
      'Preview UP must block on an uncommitted concurrent legacy evidence writer',
    );
    await writer.query('COMMIT');
    await assert.rejects(
      ()=>applyPendingMigrations(pool,candidateDir),
      error=>error?.code==='23514' &&
        error?.constraint==='website_legacy_budget_provenance_required',
      'A subsequently committed legacy row must prevent ungrounded budget repair',
    );
    const guardRows=await pool.query(
      'SELECT id,checksum FROM brovexa_internal.schema_migrations ORDER BY id');
    assert.equal(
      guardRows.rows.find(row=>row.id===M04_WEBSITE_MIGRATION_ID)?.checksum,
      expectedSha,'Concurrent writer and failed DDL must not alter PR174 0018 history');
    assert.equal(guardRows.rows.some(row=>row.id===previewName),false,
      'Failed concurrent UP must not write preview migration receipt');
    await pool.query('DELETE FROM website_inspection_runs WHERE id=$1',[inspection]);
    assert.deepEqual(await applyPendingMigrations(pool,candidateDir),[previewName]);
    console.log('M04 QA09 WEB-065: both concurrent legacy-write/DDL orderings block, then reject safely PASS');
  }finally{
    try{await writer.query('ROLLBACK')}catch{}
    writer.release();
  }

  console.log('M04 native PG18 PR174 alternate 0018 applied SHA256: '+expectedSha);
  console.log('M04 QA09 PR174: actual divergent 0018 journal classified KNOWN_DIVERGENT_APPLIED PASS');
  console.log('M04 QA09 PR174: canonical 0018 checksum collision rejected without journal mutation PASS');
  console.log('M04 QA09 PR174: initial mismatched lineage halted before 0019+, then scratch-only compatibility path verified PASS');
}finally{
  await pool.end();
  await rm(scratch,{recursive:true,force:true});
}
