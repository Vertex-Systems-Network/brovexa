#!/usr/bin/env node
/**
 * Native M04 live authorization acceptance against full Brovexa PG18 schema.
 * Disposable localhost *_test database only. All fixture data is rolled back.
 * No HTTP/DNS, queue invocation, production secrets or live reads.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPgPool, applyPendingMigrations, purgeExpiredWebsiteLiveInspectionEvidenceForWork } from '../packages/db/dist/index.js';
import { resolve } from 'node:path';
import { validateM04QaEnvironment } from './verify-m04-qa-guard.mjs';

const check = validateM04QaEnvironment({
  nodeVersion: process.version,
  pnpmVersion: process.env.BROVEXA_M04_QA_PNPM_VERSION,
  databaseUrl: process.env.DATABASE_URL,
  isolated: process.env.BROVEXA_M04_QA_ISOLATED,
  resetOptIn: process.env.BROVEXA_DB_TEST_ALLOW_RESET,
});
if (!check.allowed) throw new Error(`M04 QA preflight denied: ${check.errors.join('; ')}`);

const pool = createPgPool({connectionString: process.env.DATABASE_URL, max: 3});
const client = await pool.connect();
const slug = randomUUID().slice(0, 8);
const workspaceA = randomUUID(), workspaceB = randomUUID();
const userA = randomUUID(), userB = randomUUID(), otherMember = randomUUID();
const membershipA = randomUUID(), membershipB = randomUUID(), nonOwnerMembership = randomUUID();
const roleA = randomUUID(), roleB = randomUUID(), memberRole = randomUUID();
const capabilityId = randomUUID(), connectorId = randomUUID(), policyId = randomUUID();
const businessA=`m04.qa.${slug}.a`, businessB=`m04.qa.${slug}.b`;
const admissionA=`m04.qa.${slug}.admit.a`, admissionB=`m04.qa.${slug}.admit.b`;
const domainA=`m04.qa.${slug}.domain.a`, domainB=`m04.qa.${slug}.domain.b`;
const evidenceA=`m04.qa.${slug}.evidence.a`, evidenceB=`m04.qa.${slug}.evidence.b`;
const SOURCE='source.m04qa', POLICY='policy.m04qa', CONNECTOR='connector.m04qa';
const BLOCKED_POLICY='policy.m04qa.blocked';
const blockedPolicyId=randomUUID(), blockedConnectorId=randomUUID();
const blockedAdmission=`m04.qa.${slug}.admit.blocked`;
let checks = 0;

async function insertSeed(){
  await client.query(`INSERT INTO workspaces(id,slug,display_name) VALUES ($1,$3,'M04 Security A'),($2,$4,'M04 Security B')`,
    [workspaceA,workspaceB,`m04-qa-a-${slug}`,`m04-qa-b-${slug}`]);
  await client.query(`INSERT INTO users(id,status) VALUES ($1,'active'),($2,'active'),($3,'active')`, [userA,userB,otherMember]);
  await client.query(`INSERT INTO workspace_memberships(id,workspace_id,user_id,status) VALUES
    ($1,$4,$6,'active'),($2,$5,$7,'active'),($3,$4,$8,'active')`,
    [membershipA,membershipB,nonOwnerMembership,workspaceA,workspaceB,userA,userB,otherMember]);
  await client.query(`INSERT INTO workspace_roles(id,workspace_id,key,display_name,kind) VALUES
    ($1,$4,'owner','Owner','owner'),($2,$5,'owner','Owner','owner'),($3,$4,'member','Member','custom')`,
    [roleA,roleB,memberRole,workspaceA,workspaceB]);
  await client.query(`INSERT INTO workspace_membership_roles(membership_id,role_id,workspace_id) VALUES
    ($1,$4,$7),($2,$5,$8),($3,$6,$7)`,
    [membershipA,membershipB,nonOwnerMembership,roleA,roleB,memberRole,workspaceA,workspaceB]);
  await client.query(`INSERT INTO canonical_businesses(id,workspace_id,display_name) VALUES
    ($1,$3,'M04 A'),($2,$4,'M04 B')`,[businessA,businessB,workspaceA,workspaceB]);
  for(const [i,w,b,d,e,host] of [
    ['a',workspaceA,businessA,domainA,evidenceA,'example.com'],
    ['b',workspaceB,businessB,domainB,evidenceB,'example.org']
  ]){
    await client.query(`INSERT INTO business_domain_evidence
      (id,workspace_id,canonical_business_id,normalized_domain,kind,effect,source_key,source_reference_ids,
       source_policy_id,source_policy_version,source_admission_decision_ref,storage_class,retention_ttl_seconds,
       deletion_required,observed_at,recorded_at)
       VALUES($1,$2,$3,$4,'official_website','supports_domain',$5,$6::jsonb,$7,'1.0.0',$8,
         'EVIDENCE_MINIMAL',3600,true,clock_timestamp()-interval '10 seconds',clock_timestamp()-interval '9 seconds')`,
      [e,w,b,host,SOURCE,JSON.stringify([`m04-ref-${i}`]),POLICY,`source-proof-${i}`]);
    await client.query(`INSERT INTO business_domain_verification_decisions
      (id,workspace_id,canonical_business_id,normalized_domain,decision,method,confidence,evidence_ids,reason_codes,evaluated_at)
      VALUES($1,$2,$3,$4,'verified','deterministic',0.99,$5::jsonb,'["domain_independent_support"]'::jsonb,clock_timestamp())`,
      [d,w,b,host,JSON.stringify([e])]);
  }
  const capability={sourceKey:SOURCE,version:'1.0.0',sourceClass:'company_first_party'};
  await client.query(`INSERT INTO source_capabilities(id,source_key,version,source_class,envelope)
    VALUES($1,$2,'1.0.0','company_first_party',$3::jsonb)`,[capabilityId,SOURCE,JSON.stringify(capability)]);
  const policyEnvelope={policyId:POLICY,version:'1.0.0',sourceKey:SOURCE,connectorKey:CONNECTOR,state:'APPROVED',accessMethod:'public_web'};
  await client.query(`INSERT INTO connector_policies(id,policy_id,version,source_key,connector_key,state,access_method,reviewed_at,next_review_at,envelope)
    VALUES($1,$2,'1.0.0',$3,$4,'APPROVED','public_web',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',$5::jsonb)`,
    [policyId,POLICY,SOURCE,CONNECTOR,JSON.stringify(policyEnvelope)]);
  const connectorEnvelope={connectorKey:CONNECTOR,version:'1.0.0',sourceKey:SOURCE,capabilityVersion:'1.0.0',policyId:POLICY,
     policyVersion:'1.0.0',accessMethod:'public_web',credentialMode:'none',status:'approved',activation:'enabled',implementationVersion:'1.0.0'};
  await client.query(`INSERT INTO connector_definitions(id,connector_key,version,source_key,capability_version,policy_id,policy_version,
    access_method,credential_mode,status,activation,implementation_version,envelope)
    VALUES($1,$2,'1.0.0',$3,'1.0.0',$4,'1.0.0','public_web','none','approved','enabled','1.0.0',$5::jsonb)`,
    [connectorId,CONNECTOR,SOURCE,POLICY,JSON.stringify(connectorEnvelope)]);
  for(const [workspace,admissionId,host,tail] of [[workspaceA,admissionA,'example.com','a'],[workspaceB,admissionB,'example.org','b']]){
    const taskId=`m04-qa-task-${slug}-${tail}`;
    const requestId=`m04-qa-req-${slug}-${tail}`;
    const policySnapshot={policyId:POLICY,policyVersion:'1.0.0'};
    const request={requestId,workspaceId:workspace,sourceTaskId:taskId,sourceKey:SOURCE,connectorKey:CONNECTOR,
     connectorVersion:'1.0.0',policySnapshot,operation:'fetch',storageClass:'REFERENCE_ONLY',
     executionIntent:'execute',targetUrl:`https://${host}/`,robotsDecision:'allowed',rawPayloadRequested:false,exportRequested:false};
    const evaluatedAt=new Date().toISOString();
    const admission={decision:'allow',sourceKey:SOURCE,connectorKey:CONNECTOR,connectorVersion:'1.0.0',policySnapshot,
     reasonCodes:[],warnings:[],operation:'fetch',storageClass:'REFERENCE_ONLY',evaluatedAt};
    await client.query(`INSERT INTO source_admission_snapshots(id,workspace_id,source_task_id,request_id,source_capability_id,
      connector_policy_db_id,connector_definition_id,source_key,capability_version,connector_key,connector_version,
      policy_id,policy_version,decision,reason_codes,warnings,request,admission,evaluated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'1.0.0',$9,'1.0.0',$10,'1.0.0','allow','[]'::jsonb,'[]'::jsonb,$11::jsonb,$12::jsonb,$13::timestamptz)`,
      [admissionId,workspace,taskId,requestId,capabilityId,policyId,connectorId,SOURCE,CONNECTOR,POLICY,JSON.stringify(request),JSON.stringify(admission),evaluatedAt]);
  }

  // A historical allow snapshot can outlive a subsequently blocked registry policy.
  // Separate immutable registry revision: never bypass append-only triggers or mutate source rows.
  const blockedEnvelope={policyId:BLOCKED_POLICY,version:'1.0.0',sourceKey:SOURCE,connectorKey:CONNECTOR,
    state:'BLOCKED',accessMethod:'public_web'};
  await client.query(`INSERT INTO connector_policies(id,policy_id,version,source_key,connector_key,state,access_method,reviewed_at,next_review_at,envelope)
    VALUES($1,$2,'1.0.0',$3,$4,'BLOCKED','public_web',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',$5::jsonb)`,
    [blockedPolicyId,BLOCKED_POLICY,SOURCE,CONNECTOR,JSON.stringify(blockedEnvelope)]);
  const blockedDefinition={connectorKey:CONNECTOR,version:'2.0.0',sourceKey:SOURCE,capabilityVersion:'1.0.0',
    policyId:BLOCKED_POLICY,policyVersion:'1.0.0',accessMethod:'public_web',credentialMode:'none',
    status:'approved',activation:'enabled',implementationVersion:'2.0.0'};
  await client.query(`INSERT INTO connector_definitions(id,connector_key,version,source_key,capability_version,policy_id,policy_version,
    access_method,credential_mode,status,activation,implementation_version,envelope)
    VALUES($1,$2,'2.0.0',$3,'1.0.0',$4,'1.0.0','public_web','none','approved','enabled','2.0.0',$5::jsonb)`,
    [blockedConnectorId,CONNECTOR,SOURCE,BLOCKED_POLICY,JSON.stringify(blockedDefinition)]);
  const reqId=`m04-qa-req-${slug}-blocked`, taskId=`m04-qa-task-${slug}-blocked`;
  const policySnapshot={policyId:BLOCKED_POLICY,policyVersion:'1.0.0'};
  const request={requestId:reqId,workspaceId:workspaceA,sourceTaskId:taskId,sourceKey:SOURCE,
    connectorKey:CONNECTOR,connectorVersion:'2.0.0',policySnapshot,operation:'fetch',storageClass:'REFERENCE_ONLY',
    executionIntent:'execute',targetUrl:'https://example.com/',robotsDecision:'allowed',rawPayloadRequested:false,exportRequested:false};
  const evaluatedAt=new Date().toISOString();
  const admission={decision:'allow',sourceKey:SOURCE,connectorKey:CONNECTOR,connectorVersion:'2.0.0',
    policySnapshot,reasonCodes:[],warnings:[],operation:'fetch',storageClass:'REFERENCE_ONLY',evaluatedAt};
  await client.query(`INSERT INTO source_admission_snapshots(id,workspace_id,source_task_id,request_id,source_capability_id,
    connector_policy_db_id,connector_definition_id,source_key,capability_version,connector_key,connector_version,
    policy_id,policy_version,decision,reason_codes,warnings,request,admission,evaluated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'1.0.0',$9,'2.0.0',$10,'1.0.0','allow','[]'::jsonb,'[]'::jsonb,
    $11::jsonb,$12::jsonb,$13::timestamptz)`,
    [blockedAdmission,workspaceA,taskId,reqId,capabilityId,blockedPolicyId,blockedConnectorId,SOURCE,CONNECTOR,
      BLOCKED_POLICY,JSON.stringify(request),JSON.stringify(admission),evaluatedAt]);

}

function grant(id,{workspace=workspaceA,business=businessA,domainId=domainA,host='example.com',admission=admissionA,
  approvalUser=userA,approvalMembership=membershipA,expiryMinutes=3,policy=POLICY}={}){
  return {id,workspace,business,domainId,host,admission,approvalUser,approvalMembership,expiryMinutes,policy};
}
async function insertGrant(g){
  await client.query(`INSERT INTO website_live_inspection_grants
   (inspection_id,workspace_id,canonical_business_id,domain_verification_id,verified_domain,source_admission_decision_ref,
    source_key,source_policy_id,source_policy_version,transport_policy_id,transport_policy_version,target_url,
    max_response_bytes,timeout_ms,retention_ttl_seconds,m02_transport_policy,approved_by_user_id,approved_by_membership_id,
    expires_at,grant_hash)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'1.0.0','transport.m04qa','1.0.0',$9,25000,1000,3600,
           '{"networkMode":"provider_network","transportPolicyId":"transport.m04qa","transportPolicyVersion":"1.0.0"}'::jsonb,
           $10,$11,clock_timestamp()+($12::numeric*interval '1 minute'),repeat('a',64))`,
  [g.id,g.workspace,g.business,g.domainId,g.host,g.admission,SOURCE,g.policy,`https://${g.host}/`,g.approvalUser,g.approvalMembership,g.expiryMinutes]);
  // Trigger is deferred until COMMIT; force evaluation while savepoint remains rollback-safe.
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
}

/** WEB-049: native v2 evidence DDL and deferred COMMIT guards, no network. */
async function insertLiveEvidence(inspectionId,{ip='8.8.8.8',maxBytes=25000,completedAfterMinutes=0,deferCommitFence=false}={}){
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  const sql=[
    'INSERT INTO website_live_inspection_runs',
    '(id,workspace_id,canonical_business_id,domain_verification_id,verified_domain,',
    'target_url,source_key,source_admission_decision_ref,source_policy_id,source_policy_version,',
    'transport_policy_id,transport_policy_version,max_response_bytes,timeout_ms,',
    'receipt_id,remote_ipv4,status_code,content_type,body_length,body_sha256,',
    'received_at,completed_at,reason_codes,payload_hash,retention_ttl_seconds)',
    "VALUES($1,$2,$3,$4,'example.com','https://example.com/',$5,$6,$7,'1.0.0',",
    "'transport.m04qa','1.0.0',$8,1000,$9,$10,200,'text/html',100,",
    "repeat('b',64),clock_timestamp()+($11::int*interval '1 minute'),",
    "clock_timestamp()+($11::int*interval '1 minute'),",
    "'[\"website.single_page_only\"]'::jsonb,repeat('c',64),3600)"
  ].join(' ');
  await client.query(sql,[
    inspectionId,workspaceA,businessA,domainA,SOURCE,admissionA,POLICY,maxBytes,
    inspectionId+'.receipt',ip,completedAfterMinutes
  ]);
  if(completedAfterMinutes===0 && ip==='8.8.8.8' && maxBytes===25000){
    await client.query([
      'INSERT INTO website_live_capability_observations',
      '(inspection_id,workspace_id,receipt_id,capability,observation,reason,confidence,evidence_reference_ids)',
      "VALUES($1,$2,$3,'contact_form','observed_present','detected',0.9,'[\"dom.e2e.form\"]'::jsonb)"
    ].join(' '),[inspectionId,workspaceA,inspectionId+'.receipt']);
  }
  // Force deferred authorization after children unless caller is testing an elapsed-time COMMIT fence.
  if (!deferCommitFence) await client.query('SET CONSTRAINTS ALL IMMEDIATE');
}

async function scenario(name, fn, expected={allowed:true,code:null}){
 const marker='m04scenario';
 await client.query(`SAVEPOINT ${marker}`);
 let observed=null;
 try {await fn();} catch(e){observed=e;}
 await client.query(`ROLLBACK TO SAVEPOINT ${marker}`);
 await client.query(`RELEASE SAVEPOINT ${marker}`);
 if(expected.allowed){assert.equal(observed,null,`${name}: expected success; got ${observed?.code}/${observed?.constraint}: ${observed?.message}`);}
 else {assert.ok(observed,`${name}: expected reject`); assert.equal(observed.code,expected.code,`${name}: wrong SQLSTATE`); if(expected.constraint)assert.equal(observed.constraint,expected.constraint,`${name}: wrong constraint`);}
 checks++;
 console.log(`M04 native PG18 live security: ${name} PASS`);
}
try{
 await applyPendingMigrations(pool,resolve('packages/db/migrations'));
 const major=await client.query('SHOW server_version_num');
 assert.equal(Math.floor(Number(major.rows[0].server_version_num)/10000),18);
 await client.query('BEGIN');
 await insertSeed();
 await scenario('active owner approved grant',()=>insertGrant(grant(`m04.qa.${slug}.valid`)));
 await scenario('non-owner membership blocked',()=>insertGrant(grant(`m04.qa.${slug}.member`,{approvalUser:otherMember,approvalMembership:nonOwnerMembership})),{allowed:false,code:'23514',constraint:'website_live_grant_owner_guard'});
 await scenario('cross-tenant verified domain rejected',()=>insertGrant(grant(`m04.qa.${slug}.crossdomain`,{domainId:domainB})),{allowed:false,code:'23503',constraint:'website_live_grants_domain_fk'});
 await scenario('cross-tenant source admission rejected',()=>insertGrant(grant(`m04.qa.${slug}.crossadmission`,{admission:admissionB})),{allowed:false,code:'23514',constraint:'website_live_grant_source_guard'});
 await scenario('five-minute maximum approval window enforced',()=>insertGrant(grant(`m04.qa.${slug}.long`,{expiryMinutes:6})),{allowed:false,code:'23514',constraint:'website_live_grants_bounds_check'});
 await scenario('blocked current connector policy denies historical allow snapshot',()=>
   insertGrant(grant(`m04.qa.${slug}.blocked`,{admission:blockedAdmission,policy:BLOCKED_POLICY})),
   {allowed:false,code:'23514',constraint:'website_live_registry_current_guard'});
 await scenario('immutable approved grant forbids UPDATE',async()=>{
   await insertGrant(grant(`m04.qa.${slug}.immutable`));
   await client.query('UPDATE website_live_inspection_grants SET timeout_ms=2000 WHERE inspection_id=$1',[`m04.qa.${slug}.immutable`]);
 },{allowed:false,code:'23514',constraint:'website_live_grant_immutable_guard'});

 await scenario('authorized evidence and same-tenant child observation',async()=>{
   const id='m04.qa.'+slug+'.evidence.valid';
   await insertGrant(grant(id));
   await insertLiveEvidence(id);
 });
 await scenario('evidence budget cannot exceed its approved grant',async()=>{
   const id='m04.qa.'+slug+'.evidence.budget';
   await insertGrant(grant(id));
   await insertLiveEvidence(id,{maxBytes:25001});
 },{allowed:false,code:'23514',constraint:'website_live_evidence_active_grant_guard'});
 await scenario('evidence completion after grant expiry is blocked',async()=>{
   const id='m04.qa.'+slug+'.evidence.expired';
   await insertGrant(grant(id));
   await insertLiveEvidence(id,{completedAfterMinutes:4});
 },{allowed:false,code:'23514',constraint:'website_live_evidence_active_grant_guard'});
 await scenario('private IPv4 live evidence is rejected',async()=>{
   const id='m04.qa.'+slug+'.evidence.private';
   await insertGrant(grant(id));
   await insertLiveEvidence(id,{ip:'127.0.0.1'});
 },{allowed:false,code:'23514',constraint:'website_live_address_check'});
 // WEB-051: a valid receipt can become unauthorized while a transaction stays open.
 // The SQL deferred fence must consult wall clock time, not PostgreSQL's
 // transaction-stable now(), and reject evidence staged before grant expiry.
 await scenario('real elapsed grant expiry is rejected at deferred commit fence',async()=>{
   const id='m04.qa.'+slug+'.evidence.clock-expired';
   await insertGrant(grant(id,{expiryMinutes:0.05}));
   await insertLiveEvidence(id,{deferCommitFence:true});
   await client.query('SELECT pg_sleep(3.5)');
   await client.query('SET CONSTRAINTS ALL IMMEDIATE');
 },{allowed:false,code:'23514',constraint:'website_live_evidence_active_grant_guard'});
 await scenario('persisted live evidence rejects in-place modification',async()=>{
   const id='m04.qa.'+slug+'.evidence.immutable';
   await insertGrant(grant(id));
   await insertLiveEvidence(id);
   await client.query('UPDATE website_live_inspection_runs SET timeout_ms=1500 WHERE id=$1',[id]);
 },{allowed:false,code:'23514',constraint:'website_live_immutable_guard'});
 await client.query('ROLLBACK');

 // WEB-052: two real PostgreSQL pool connections must serialize duplicate
 // retention work and persist only one idempotent receipt. The empty,
 // disposable tenant is committed for visibility across both connections
 // and deleted (with cascading receipt cleanup) regardless of outcome.
 const raceWorkspace = randomUUID();
 const raceOtherWorkspace = randomUUID();
 const raceWorkId = `m04.qa.${slug}.retention.concurrent`;
 await pool.query(
   'INSERT INTO workspaces(id,slug,display_name) VALUES ($1,$3,$5),($2,$4,$6)',
   [raceWorkspace,raceOtherWorkspace,`m04-qa-retention-${slug}`,
    `m04-qa-retention-other-${slug}`,
    'M04 Disposable Retention Concurrency','M04 Disposable Other Workspace'],
 );
 try {
   const results = await Promise.all([
     purgeExpiredWebsiteLiveInspectionEvidenceForWork(pool,raceWorkspace,raceWorkId,1),
     purgeExpiredWebsiteLiveInspectionEvidenceForWork(pool,raceWorkspace,raceWorkId,1),
   ]);
   assert.deepEqual(results.map(result=>result.deleted),[0,0]);
   assert.deepEqual(results.map(result=>result.replayed).sort(),[false,true],
     'exactly one concurrent delivery must be the committed original');
   const receipt = await pool.query(
     'SELECT workspace_id,max_rows,deleted_count FROM website_live_retention_work_receipts WHERE work_unit_id=$1',
     [raceWorkId],
   );
   assert.equal(receipt.rows.length,1);
   assert.equal(receipt.rows[0].workspace_id,raceWorkspace);
   assert.equal(receipt.rows[0].max_rows,1);
   assert.equal(receipt.rows[0].deleted_count,0);
   checks++;
   console.log('M04 native PG18 live security: concurrent retention replay is idempotent PASS');

   // WEB-053: a lost response after a real COMMIT must not replay the DELETE.
   // Calling the same work-id on a fresh checkout is a durable receipt lookup,
   // not a process-local deduplication cache.
   const recovered = await purgeExpiredWebsiteLiveInspectionEvidenceForWork(
     pool,raceWorkspace,raceWorkId,1,
   );
   assert.deepEqual(recovered,{deleted:0,replayed:true});
   const stillOne = await pool.query(
     'SELECT count(*)::int AS count FROM website_live_retention_work_receipts WHERE work_unit_id=$1',
     [raceWorkId],
   );
   assert.equal(stillOne.rows[0].count,1);
   checks++;
   console.log('M04 native PG18 live security: lost-ack redelivery uses durable receipt PASS');

   // A work-id is globally immutable in scope and budget. In particular,
   // a different workspace must not adopt an existing idempotency receipt.
   await assert.rejects(
     () => purgeExpiredWebsiteLiveInspectionEvidenceForWork(pool,raceWorkspace,raceWorkId,2),
     error => error?.code === 'M04_LIVE_DB_ID_CONFLICT',
   );
   checks++;
   console.log('M04 native PG18 live security: changed retention budget cannot replay PASS');

   await assert.rejects(
     () => purgeExpiredWebsiteLiveInspectionEvidenceForWork(pool,raceOtherWorkspace,raceWorkId,1),
     error => error?.code === 'M04_LIVE_DB_ID_CONFLICT',
   );
   const foreignRows = await pool.query(
     'SELECT count(*)::int AS count FROM website_live_retention_work_receipts WHERE workspace_id=$1',
     [raceOtherWorkspace],
   );
   assert.equal(foreignRows.rows[0].count,0);
   checks++;
   console.log('M04 native PG18 live security: cross-tenant retention receipt takeover denied PASS');
 } finally {
   await pool.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[raceWorkspace,raceOtherWorkspace]]);
 }
 console.log(`Brovexa M04 native full-schema grant authorization PASS (${checks} scenarios; disposable fixtures cleaned)`);
}catch(error){try{await client.query('ROLLBACK')}catch{} console.error(`Brovexa M04 native full-schema security FAILED after ${checks} passes: ${error?.message}`); process.exitCode=1;}
finally{client.release();await pool.end();}