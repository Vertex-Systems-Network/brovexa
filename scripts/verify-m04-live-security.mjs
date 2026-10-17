#!/usr/bin/env node
/**
 * Native M04 live authorization acceptance against full Brovexa PG18 schema.
 * Disposable localhost *_test database only. Transactional fixtures roll back.
 * WEB-055's committed, append-only registry fixture is scoped to this isolated QA database.
 * No HTTP/DNS, queue invocation, production secrets or live reads.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {spawnSync} from 'node:child_process';
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
const SOURCE=`source.m04qa.${slug}`, POLICY=`policy.m04qa.${slug}`, CONNECTOR=`connector.m04qa.${slug}`;
const BLOCKED_POLICY=`policy.m04qa.blocked.${slug}`;
const BLOCKED_CONNECTOR=`${CONNECTOR}.blocked`;
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
  const blockedEnvelope={policyId:BLOCKED_POLICY,version:'1.0.0',sourceKey:SOURCE,connectorKey:BLOCKED_CONNECTOR,
    state:'BLOCKED',accessMethod:'public_web'};
  await client.query(`INSERT INTO connector_policies(id,policy_id,version,source_key,connector_key,state,access_method,reviewed_at,next_review_at,envelope)
    VALUES($1,$2,'1.0.0',$3,$4,'BLOCKED','public_web',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',$5::jsonb)`,
    [blockedPolicyId,BLOCKED_POLICY,SOURCE,BLOCKED_CONNECTOR,JSON.stringify(blockedEnvelope)]);
  const blockedDefinition={connectorKey:BLOCKED_CONNECTOR,version:'2.0.0',sourceKey:SOURCE,capabilityVersion:'1.0.0',
    policyId:BLOCKED_POLICY,policyVersion:'1.0.0',accessMethod:'public_web',credentialMode:'none',
    status:'approved',activation:'enabled',implementationVersion:'2.0.0'};
  await client.query(`INSERT INTO connector_definitions(id,connector_key,version,source_key,capability_version,policy_id,policy_version,
    access_method,credential_mode,status,activation,implementation_version,envelope)
    VALUES($1,$2,'2.0.0',$3,'1.0.0',$4,'1.0.0','public_web','none','approved','enabled','2.0.0',$5::jsonb)`,
    [blockedConnectorId,BLOCKED_CONNECTOR,SOURCE,BLOCKED_POLICY,JSON.stringify(blockedDefinition)]);
  const reqId=`m04-qa-req-${slug}-blocked`, taskId=`m04-qa-task-${slug}-blocked`;
  const policySnapshot={policyId:BLOCKED_POLICY,policyVersion:'1.0.0'};
  const request={requestId:reqId,workspaceId:workspaceA,sourceTaskId:taskId,sourceKey:SOURCE,
    connectorKey:BLOCKED_CONNECTOR,connectorVersion:'2.0.0',policySnapshot,operation:'fetch',storageClass:'REFERENCE_ONLY',
    executionIntent:'execute',targetUrl:'https://example.com/',robotsDecision:'allowed',rawPayloadRequested:false,exportRequested:false};
  const evaluatedAt=new Date().toISOString();
  const admission={decision:'allow',sourceKey:SOURCE,connectorKey:BLOCKED_CONNECTOR,connectorVersion:'2.0.0',
    policySnapshot,reasonCodes:[],warnings:[],operation:'fetch',storageClass:'REFERENCE_ONLY',evaluatedAt};
  await client.query(`INSERT INTO source_admission_snapshots(id,workspace_id,source_task_id,request_id,source_capability_id,
    connector_policy_db_id,connector_definition_id,source_key,capability_version,connector_key,connector_version,
    policy_id,policy_version,decision,reason_codes,warnings,request,admission,evaluated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'1.0.0',$9,'2.0.0',$10,'1.0.0','allow','[]'::jsonb,'[]'::jsonb,
    $11::jsonb,$12::jsonb,$13::timestamptz)`,
    [blockedAdmission,workspaceA,taskId,reqId,capabilityId,blockedPolicyId,blockedConnectorId,SOURCE,BLOCKED_CONNECTOR,
      BLOCKED_POLICY,JSON.stringify(request),JSON.stringify(admission),evaluatedAt]);

}


/** WEB-058: an append-only M02 allow snapshot with an approval review window
 * that will expire while the PostgreSQL transaction is open. Each caller
 * operates inside a savepoint, so no short-lived rows survive that scenario.
 */
async function insertShortReviewRegistry(){
  const policy=`${POLICY}.review-short`;
  const admission=`m04.qa.${slug}.admit.review-short`;
  const definitionVersion='3.0.0';
  const policyDbId=randomUUID(),definitionId=randomUUID();
  const envelope={policyId:policy,version:'1.0.0',sourceKey:SOURCE,
    connectorKey:CONNECTOR,state:'APPROVED',accessMethod:'public_web'};
  await client.query(`INSERT INTO connector_policies
    (id,policy_id,version,source_key,connector_key,state,access_method,
     reviewed_at,next_review_at,envelope)
    VALUES($1,$2,'1.0.0',$3,$4,'APPROVED','public_web',
           clock_timestamp()-interval '1 hour',
           clock_timestamp()+interval '2 seconds',$5::jsonb)`,
    [policyDbId,policy,SOURCE,CONNECTOR,JSON.stringify(envelope)]);
  const definition={connectorKey:CONNECTOR,version:definitionVersion,
    sourceKey:SOURCE,capabilityVersion:'1.0.0',policyId:policy,
    policyVersion:'1.0.0',accessMethod:'public_web',credentialMode:'none',
    status:'approved',activation:'enabled',implementationVersion:definitionVersion};
  await client.query(`INSERT INTO connector_definitions
    (id,connector_key,version,source_key,capability_version,policy_id,policy_version,
     access_method,credential_mode,status,activation,implementation_version,envelope)
    VALUES($1,$2,$3,$4,'1.0.0',$5,'1.0.0','public_web','none',
           'approved','enabled',$3,$6::jsonb)`,
    [definitionId,CONNECTOR,definitionVersion,SOURCE,policy,JSON.stringify(definition)]);
  const requestId=`m04-qa-req-${slug}-review-short`;
  const sourceTaskId=`m04-qa-task-${slug}-review-short`;
  const policySnapshot={policyId:policy,policyVersion:'1.0.0'};
  const request={requestId,workspaceId:workspaceA,sourceTaskId,
    sourceKey:SOURCE,connectorKey:CONNECTOR,connectorVersion:definitionVersion,
    policySnapshot,operation:'fetch',storageClass:'REFERENCE_ONLY',
    executionIntent:'execute',targetUrl:'https://example.com/',
    robotsDecision:'allowed',rawPayloadRequested:false,exportRequested:false};
  const evaluatedAt=new Date().toISOString();
  const approved={decision:'allow',sourceKey:SOURCE,connectorKey:CONNECTOR,
    connectorVersion:definitionVersion,policySnapshot,
    reasonCodes:[],warnings:[],operation:'fetch',storageClass:'REFERENCE_ONLY',
    evaluatedAt};
  await client.query(`INSERT INTO source_admission_snapshots
    (id,workspace_id,source_task_id,request_id,source_capability_id,
     connector_policy_db_id,connector_definition_id,source_key,capability_version,
     connector_key,connector_version,policy_id,policy_version,decision,reason_codes,
     warnings,request,admission,evaluated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'1.0.0',$9,$10,$11,'1.0.0',
           'allow','[]'::jsonb,'[]'::jsonb,$12::jsonb,$13::jsonb,$14::timestamptz)`,
    [admission,workspaceA,sourceTaskId,requestId,capabilityId,policyDbId,
      definitionId,SOURCE,CONNECTOR,definitionVersion,policy,
      JSON.stringify(request),JSON.stringify(approved),evaluatedAt]);
  return {policy,admission};
}


/** M04-WEB-059: immutable superseding domain verification, never an UPDATE
 * to an existing M03 decision. Pass another PG client to exercise races.
 */
async function insertSupersedingDomainDecision(id,{db=client,decision='rejected'}={}){
  await db.query(`INSERT INTO business_domain_verification_decisions
    (id,workspace_id,canonical_business_id,normalized_domain,
     decision,method,confidence,evidence_ids,reason_codes,evaluated_at)
    VALUES($1,$2,$3,'example.com',$4,'deterministic',0.95,$5::jsonb,
           '["m04.domain_reassessed"]'::jsonb,clock_timestamp())`,
    [id,workspaceA,businessA,decision,JSON.stringify([evidenceA])]);
}


/** WEB-060: new append-only connector revision for the same M02 connector.
 * No UPDATE/DELETE of historic registry records; a separate connection may
 * INSERT in order to adversarially interleave the deferred COMMIT fence.
 */
async function insertConnectorRevision({db=client,version='9.0.0',disabled=true}={}){
  const status=disabled?'disabled':'approved';
  const activation=disabled?'disabled':'enabled';
  const envelope={connectorKey:CONNECTOR,version,sourceKey:SOURCE,
    capabilityVersion:'1.0.0',policyId:POLICY,policyVersion:'1.0.0',
    accessMethod:'public_web',credentialMode:'none',status,activation,
    implementationVersion:version};
  await db.query(`INSERT INTO connector_definitions
    (id,connector_key,version,source_key,capability_version,policy_id,policy_version,
     access_method,credential_mode,status,activation,implementation_version,envelope)
    VALUES($1,$2,$3,$4,'1.0.0',$5,'1.0.0','public_web','none',$6,$7,$3,$8::jsonb)`,
    [randomUUID(),CONNECTOR,version,SOURCE,POLICY,status,activation,JSON.stringify(envelope)]);
}

function grant(id,{workspace=workspaceA,business=businessA,domainId=domainA,host='example.com',admission=admissionA,
  approvalUser=userA,approvalMembership=membershipA,expiryMinutes=3,policy=POLICY,retentionTtlSeconds=3600}={}){
  return {id,workspace,business,domainId,host,admission,approvalUser,approvalMembership,expiryMinutes,policy,retentionTtlSeconds};
}
async function insertGrant(g,{deferCommitFence=false}={}){
  await client.query(`INSERT INTO website_live_inspection_grants
   (inspection_id,workspace_id,canonical_business_id,domain_verification_id,verified_domain,source_admission_decision_ref,
    source_key,source_policy_id,source_policy_version,transport_policy_id,transport_policy_version,target_url,
    max_response_bytes,timeout_ms,retention_ttl_seconds,m02_transport_policy,approved_by_user_id,approved_by_membership_id,
    expires_at,grant_hash)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'1.0.0','transport.m04qa','1.0.0',$9,25000,1000,$13,
           '{"networkMode":"provider_network","transportPolicyId":"transport.m04qa","transportPolicyVersion":"1.0.0"}'::jsonb,
           $10,$11,clock_timestamp()+($12::numeric*interval '1 minute'),repeat('a',64))`,
  [g.id,g.workspace,g.business,g.domainId,g.host,g.admission,SOURCE,g.policy,`https://${g.host}/`,g.approvalUser,g.approvalMembership,g.expiryMinutes,g.retentionTtlSeconds]);
  // Trigger is deferred until COMMIT; tests may stage a genuine concurrent
  // revocation before triggering the final grant/evidence commit fence.
  if(!deferCommitFence) await client.query('SET CONSTRAINTS ALL IMMEDIATE');
}

/** WEB-049: native v2 evidence DDL and deferred COMMIT guards, no network. */
async function insertLiveEvidence(inspectionId,{ip='8.8.8.8',maxBytes=25000,completedAfterMinutes=0,deferCommitFence=false,retentionTtlSeconds=3600,admission=admissionA,policy=POLICY,workspace=workspaceA,business=businessA,domainId=domainA,host='example.com'}={}){
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  const sql=[
    'INSERT INTO website_live_inspection_runs',
    '(id,workspace_id,canonical_business_id,domain_verification_id,verified_domain,',
    'target_url,source_key,source_admission_decision_ref,source_policy_id,source_policy_version,',
    'transport_policy_id,transport_policy_version,max_response_bytes,timeout_ms,',
    'receipt_id,remote_ipv4,status_code,content_type,body_length,body_sha256,',
    'received_at,completed_at,reason_codes,payload_hash,retention_ttl_seconds)',
    "VALUES($1,$2,$3,$4,$13,$14,$5,$6,$7,'1.0.0',",
    "'transport.m04qa','1.0.0',$8,1000,$9,$10,200,'text/html',100,",
    "repeat('b',64),clock_timestamp()+($11::int*interval '1 minute'),",
    "clock_timestamp()+($11::int*interval '1 minute'),",
    "'[\"website.single_page_only\"]'::jsonb,repeat('c',64),$12)"
  ].join(' ');
  await client.query(sql,[
    inspectionId,workspace,business,domainId,SOURCE,admission,policy,maxBytes,
    inspectionId+'.receipt',ip,completedAfterMinutes,retentionTtlSeconds,host,`https://${host}/`
  ]);
  if(completedAfterMinutes===0 && ip==='8.8.8.8' && maxBytes===25000){
    await client.query([
      'INSERT INTO website_live_capability_observations',
      '(inspection_id,workspace_id,receipt_id,capability,observation,reason,confidence,evidence_reference_ids)',
      "VALUES($1,$2,$3,'contact_form','observed_present','detected',0.9,'[\"dom.e2e.form\"]'::jsonb)"
    ].join(' '),[inspectionId,workspace,inspectionId+'.receipt']);
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
 // WEB-060: new immutable revision of the same source connector
 // must supersede historical approval, including when the new revision is
 // re-enabled. Both cases use SAVEPOINT rollback and do not touch baseline.
 await scenario('new disabled connector revision denies historic grant',async()=>{
   await insertConnectorRevision();
   await insertGrant(grant(`m04.qa.${slug}.connector.disabled.grant`));
 },{allowed:false,code:'23514',constraint:'website_live_current_connector_revision_guard'});

 await scenario('new enabled connector revision still requires fresh admission',async()=>{
   await insertConnectorRevision({disabled:false});
   await insertGrant(grant(`m04.qa.${slug}.connector.revision.grant`));
 },{allowed:false,code:'23514',constraint:'website_live_current_connector_revision_guard'});

 await scenario('new disabled connector revision denies previously approved evidence',async()=>{
   const id=`m04.qa.${slug}.connector.disabled.evidence`;
   await insertGrant(grant(id));
   await insertConnectorRevision();
   await insertLiveEvidence(id);
 },{allowed:false,code:'23514',constraint:'website_live_current_connector_revision_guard'});

 // WEB-059: A newer append-only domain decision must revoke the older
 // verified snapshot, even though its foreign key and evidence still exist.
 await scenario('newer rejected domain decision denies historical verified grant',async()=>{
   const id=`m04.qa.${slug}.domain.rejected.grant`;
   await insertSupersedingDomainDecision(`m04.qa.${slug}.domain.newer.reject.1`);
   await insertGrant(grant(id));
 },{allowed:false,code:'23514',constraint:'website_live_current_domain_decision_guard'});

 await scenario('newer rejected domain decision denies previously approved evidence',async()=>{
   const id=`m04.qa.${slug}.domain.rejected.evidence`;
   await insertGrant(grant(id));
   await insertSupersedingDomainDecision(`m04.qa.${slug}.domain.newer.reject.2`);
   await insertLiveEvidence(id);
 },{allowed:false,code:'23514',constraint:'website_live_current_domain_decision_guard'});

 await scenario('newer verified domain revision also requires a fresh grant',async()=>{
   const id=`m04.qa.${slug}.domain.reverified.grant`;
   await insertSupersedingDomainDecision(`m04.qa.${slug}.domain.newer.verified`,
     {decision:'verified'});
   await insertGrant(grant(id));
 },{allowed:false,code:'23514',constraint:'website_live_current_domain_decision_guard'});

 // WEB-058: current append-only connector policy expires while the grant
 // is staged in an open transaction. A historical allow snapshot must not
 // authorize a COMMIT after the review window ends.
 await scenario('connector policy review expiry denies deferred grant COMMIT',async()=>{
   const {policy,admission}=await insertShortReviewRegistry();
   const id=`m04.qa.${slug}.registry.review.grant`;
   await insertGrant(grant(id,{policy,admission}),{deferCommitFence:true});
   await client.query('SELECT pg_sleep(2.5)');
   await client.query('SET CONSTRAINTS ALL IMMEDIATE');
 },{allowed:false,code:'23514',constraint:'website_live_registry_current_guard'});

 // The same timestamp fence must also protect live EVIDENCE when a grant
 // originally passed and the registry becomes expired before evidence COMMIT.
 await scenario('connector policy review expiry denies deferred evidence COMMIT',async()=>{
   const {policy,admission}=await insertShortReviewRegistry();
   const id=`m04.qa.${slug}.registry.review.evidence`;
   await insertGrant(grant(id,{policy,admission}));
   await insertLiveEvidence(id,{policy,admission,deferCommitFence:true});
   await client.query('SELECT pg_sleep(2.5)');
   await client.query('SET CONSTRAINTS ALL IMMEDIATE');
 },{allowed:false,code:'23514',constraint:'website_live_registry_current_guard'});

 await client.query('ROLLBACK');

 // WEB-055: actually COMMIT bounded evidence, let it expire, and run the
 // maintenance function in a disposable child OS process which exits after
 // COMMIT before responding. A completely different process must recover
 // the durable nonzero receipt without deleting the next eligible row.
 const expiringIds=[
   `m04.qa.${slug}.retention.expired.1`,
   `m04.qa.${slug}.retention.expired.2`,
 ];
 const freshId=`m04.qa.${slug}.retention.fresh`;
 const droppedAckId=`m04.qa.${slug}.retention.lost-ack-nonzero`;
 const nextWorkId=`m04.qa.${slug}.retention.next-batch`;
 await client.query('BEGIN');
 try {
   await insertSeed();
   for(const id of expiringIds){
     await insertGrant(grant(id,{retentionTtlSeconds:1}));
     await insertLiveEvidence(id,{retentionTtlSeconds:1});
   }
   await insertGrant(grant(freshId));
   await insertLiveEvidence(freshId);
   await client.query('COMMIT');
 } catch (e) {
   await client.query('ROLLBACK');
   throw e;
 }
 try {
   // Sleep outside the fixture transaction so these rows are really expired
   // according to PostgreSQL's clock, not a mocked timestamp or fake cursor.
   await pool.query('SELECT pg_sleep(1.5)');
   const before=await pool.query(
     'SELECT id FROM website_live_inspection_runs WHERE workspace_id=$1 ORDER BY id',
     [workspaceA],
   );
   assert.deepEqual(before.rows.map(r=>r.id).sort(),[...expiringIds,freshId].sort());

   function retentionChild(workId,budget,mode='return-ack'){
     return spawnSync(process.execPath,[
       resolve('scripts/verify-m04-retention-child.mjs'),
       workspaceA,workId,String(budget),mode,
     ],{env:process.env,encoding:'utf8',timeout:30000});
   }
   const lost=retentionChild(droppedAckId,1,'drop-ack');
   assert.equal(lost.signal,null,`maintenance child unexpectedly signalled: ${lost.stderr}`);
   assert.equal(lost.status,37,`maintenance child did not exit after COMMIT: ${lost.stderr}`);
   const firstReceipt=await pool.query(
     'SELECT workspace_id,max_rows,deleted_count FROM website_live_retention_work_receipts WHERE work_unit_id=$1',
     [droppedAckId],
   );
   assert.equal(firstReceipt.rows.length,1);
   assert.equal(firstReceipt.rows[0].workspace_id,workspaceA);
   assert.equal(firstReceipt.rows[0].max_rows,1);
   assert.equal(firstReceipt.rows[0].deleted_count,1);
   const oneLeft=await pool.query(
     'SELECT id FROM website_live_inspection_runs WHERE id=ANY($1::text[]) ORDER BY id',
     [expiringIds],
   );
   assert.equal(oneLeft.rows.length,1);
   checks++;
   console.log('M04 native PG18 live security: nonzero bounded purge COMMIT survives dropped process ack PASS');

   const replay=retentionChild(droppedAckId,1);
   assert.equal(replay.status,0,`fresh replay process failed: ${replay.stderr}`);
   assert.deepEqual(JSON.parse(replay.stdout.trim()),{deleted:1,replayed:true});
   const afterReplay=await pool.query(
     'SELECT id FROM website_live_inspection_runs WHERE id=ANY($1::text[]) ORDER BY id',
     [expiringIds],
   );
   assert.deepEqual(afterReplay.rows,oneLeft.rows,
     'replay must not advance into the next expired evidence row');
   checks++;
   console.log('M04 native PG18 live security: new process replays durable nonzero receipt PASS');

   const next=retentionChild(nextWorkId,1);
   assert.equal(next.status,0,`fresh follow-up process failed: ${next.stderr}`);
   assert.deepEqual(JSON.parse(next.stdout.trim()),{deleted:1,replayed:false});
   const remaining=await pool.query(
     'SELECT id FROM website_live_inspection_runs WHERE workspace_id=$1 ORDER BY id',
     [workspaceA],
   );
   assert.deepEqual(remaining.rows.map(r=>r.id),[freshId],
     'retention must leave the nonexpired live inspection and its observations intact');
   const childEvidence=await pool.query(
     'SELECT count(*)::int AS total FROM website_live_capability_observations WHERE workspace_id=$1',
     [workspaceA],
   );
   assert.equal(childEvidence.rows[0].total,1,
     'expired children should cascade while the nonexpired observation stays');
   checks++;
   console.log('M04 native PG18 live security: fresh work ID purges next row, nonexpired evidence survives PASS');
 } finally {
   // Source registry and source admission lifecycle history is append-only:
   // committed test fixtures CANNOT be deleted via normal SQL. Never bypass
   // immutability triggers or truncate unrelated rows. Native checkpoint CI
   // destroys its entire dedicated *_test PostgreSQL service after the job.
   // Unique QA source/policy/connector keys permit safe repeat local runs.
   console.log('WEB-055 durable fixture remains in disposable QA database until database teardown');
 }

 // WEB-056: an owner can be active at INSERT yet suspended before
 // deferred COMMIT authorization. Revocation from another PG connection
 // must win and fail closed; the writer must not persist unauthorized rows.
 const revokeRaceId=`m04.qa.${slug}.owner.revocation-wins`;
 // Identity/RBAC requires at least one active owner. Promote the existing
 // secondary QA member before attempting to suspend the primary owner.
 // This is a valid owner handoff, not a bypass of the identity guard.
 await pool.query(
   'INSERT INTO workspace_membership_roles(membership_id,role_id,workspace_id) VALUES ($1,$2,$3)',
   [nonOwnerMembership,roleA,workspaceA],
 );
 await client.query('BEGIN');
 let ownerSuspended=false;
 try {
   await insertGrant(grant(revokeRaceId),{deferCommitFence:true});
   await insertLiveEvidence(revokeRaceId,{deferCommitFence:true});
   const revoker=await pool.connect();
   try {
     await revoker.query("SET lock_timeout='1500ms'");
     const changed=await revoker.query(
       "UPDATE workspace_memberships SET status='suspended' WHERE id=$1 RETURNING id",
       [membershipA],
     );
     assert.equal(changed.rowCount,1);
     ownerSuspended=true;
   } finally {
     revoker.release();
   }
   await assert.rejects(
     () => client.query('SET CONSTRAINTS ALL IMMEDIATE'),
     error=>error?.code==='23514' &&
       ['website_live_grant_commit_guard','website_live_evidence_active_grant_guard'].includes(error?.constraint),
     'deferred owner authorization must reject revocation that committed before its fence',
   );
   await client.query('ROLLBACK');
   const escaped=await pool.query(
     'SELECT count(*)::int AS total FROM website_live_inspection_grants WHERE inspection_id=$1',
     [revokeRaceId],
   );
   assert.equal(escaped.rows[0].total,0);
   checks++;
   console.log('M04 native PG18 live security: concurrent owner suspension before deferred fence rejects evidence PASS');
 } finally {
   await client.query('ROLLBACK');
   if(ownerSuspended){
     const restored=await pool.query(
       "UPDATE workspace_memberships SET status='active' WHERE id=$1 RETURNING id",
       [membershipA],
     );
     assert.equal(restored.rowCount,1);
   }
 }

 // WEB-057: once the evidence commit fence obtains FOR SHARE locks on
 // owner authority, a different connection cannot revoke that owner before
 // the approved evidence transaction commits. Use a bounded lock_timeout
 // to prove the revoker is blocked, never an unbounded race/sleep.
 const fenceRaceId=`m04.qa.${slug}.owner.fence-first`;
 await client.query('BEGIN');
 try {
   await insertGrant(grant(fenceRaceId));
   await client.query('COMMIT');
 } catch(e) {
   await client.query('ROLLBACK');
   throw e;
 }
 await client.query('BEGIN');
 try {
   await insertLiveEvidence(fenceRaceId);
   const revoker=await pool.connect();
   try {
     await revoker.query('BEGIN');
     await revoker.query("SET LOCAL lock_timeout='350ms'");
     await assert.rejects(
       () => revoker.query(
         "UPDATE workspace_memberships SET status='suspended' WHERE id=$1",
         [membershipA],
       ),
       error=>error?.code==='55P03',
       'concurrent owner revocation must wait for evidence COMMIT fence',
     );
   } finally {
     await revoker.query('ROLLBACK');
     revoker.release();
   }
   await client.query('COMMIT');
   const persisted=await pool.query(
     'SELECT count(*)::int AS total FROM website_live_inspection_runs WHERE id=$1',
     [fenceRaceId],
   );
   assert.equal(persisted.rows[0].total,1);
   checks++;
   console.log('M04 native PG18 live security: evidence fence locks owner against concurrent revocation until COMMIT PASS');
 } finally {
   await client.query('ROLLBACK');
 }

 // WEB-059: A deferred evidence fence owns the domain advisory lock
 // until COMMIT. A concurrent append-only newer decision must wait.
 const protectedDomainId=`m04.qa.${slug}.domain.fence-first`;
 await client.query('BEGIN');
 try {
   await insertGrant(grant(protectedDomainId));
   await client.query('COMMIT');
 } catch(e){await client.query('ROLLBACK');throw e;}
 await client.query('BEGIN');
 try {
   await insertLiveEvidence(protectedDomainId);
   const domainRevoker=await pool.connect();
   try {
     await domainRevoker.query('BEGIN');
     await domainRevoker.query("SET LOCAL lock_timeout='350ms'");
     await assert.rejects(
       ()=>insertSupersedingDomainDecision(
         `m04.qa.${slug}.domain.newer.blocked`,{db:domainRevoker}),
       error=>error?.code==='55P03',
       'new domain decision cannot pass a live authorization COMMIT fence',
     );
   } finally {
     await domainRevoker.query('ROLLBACK');
     domainRevoker.release();
   }
   await client.query('COMMIT');
   const preserved=await pool.query(
     'SELECT count(*)::int AS total FROM website_live_inspection_runs WHERE id=$1',
     [protectedDomainId],
   );
   assert.equal(preserved.rows[0].total,1);
   checks++;
   console.log('M04 native PG18 live security: current domain fence blocks concurrent supersession until COMMIT PASS');
 } finally {await client.query('ROLLBACK');}

 // Conversely, a newer rejected decision committed before the deferred
 // evidence fence must reject the pending grant/evidence transaction.
 const revokedDomainId=`m04.qa.${slug}.domain.supersession-wins`;
 await client.query('BEGIN');
 try {
   await insertGrant(grant(revokedDomainId),{deferCommitFence:true});
   await insertLiveEvidence(revokedDomainId,{deferCommitFence:true});
   await pool.query(
     `INSERT INTO business_domain_verification_decisions
       (id,workspace_id,canonical_business_id,normalized_domain,
        decision,method,confidence,evidence_ids,reason_codes,evaluated_at)
       VALUES($1,$2,$3,'example.com','rejected','deterministic',0.95,
              $4::jsonb,'["m04.domain_reassessed"]'::jsonb,clock_timestamp())`,
     [`m04.qa.${slug}.domain.newer.committed`,
       workspaceA,businessA,JSON.stringify([evidenceA])],
   );
   await assert.rejects(
     ()=>client.query('SET CONSTRAINTS ALL IMMEDIATE'),
     error=>error?.code==='23514' && error?.constraint==='website_live_current_domain_decision_guard',
     'newest rejected domain decision must prevent stale grant/evidence COMMIT',
   );
   await client.query('ROLLBACK');
   const missing=await pool.query(
     'SELECT count(*)::int AS total FROM website_live_inspection_runs WHERE id=$1',
     [revokedDomainId],
   );
   assert.equal(missing.rows[0].total,0);
   checks++;
   console.log('M04 native PG18 live security: concurrent newer rejected decision blocks pending evidence COMMIT PASS');
 } finally {await client.query('ROLLBACK');}

 // WEB-060: when evidence COMMIT validation wins the connector lock,
 // an append-only later registry revision cannot become effective until the
 // authorized evidence transaction has completed.
 const registryFenceId=`m04.qa.${slug}.connector.fence-first`;
 const workspaceBGrant={workspace:workspaceB,business:businessB,domainId:domainB,
   host:'example.org',admission:admissionB,approvalUser:userB,approvalMembership:membershipB};
 const workspaceBEvidence={workspace:workspaceB,business:businessB,domainId:domainB,
   host:'example.org',admission:admissionB};
 await client.query('BEGIN');
 try {
   await insertGrant(grant(registryFenceId,workspaceBGrant));
   await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
 await client.query('BEGIN');
 try {
   await insertLiveEvidence(registryFenceId,workspaceBEvidence);
   const connectorRevoker=await pool.connect();
   try {
     await connectorRevoker.query('BEGIN');
     await connectorRevoker.query("SET LOCAL lock_timeout='350ms'");
     await assert.rejects(
       ()=>insertConnectorRevision({db:connectorRevoker,version:'10.0.0'}),
       error=>error?.code==='55P03',
       'connector revision INSERT must wait until authorized evidence COMMIT',
     );
   }finally{
     await connectorRevoker.query('ROLLBACK');
     connectorRevoker.release();
   }
   await client.query('COMMIT');
   const persisted=await pool.query(
     'SELECT count(*)::int AS total FROM website_live_inspection_runs WHERE id=$1',
     [registryFenceId],
   );
   assert.equal(persisted.rows[0].total,1);
   checks++;
   console.log('M04 native PG18 live security: connector revision waits on current COMMIT fence PASS');
 }finally{await client.query('ROLLBACK');}

 // Opposite ordering: an independently committed disabled revision makes
 // the pending grant/evidence stale even though its pinned admission is allow.
 const registryRevokeId=`m04.qa.${slug}.connector.revocation-first`;
 await client.query('BEGIN');
 try{
   await insertGrant(grant(registryRevokeId,workspaceBGrant),{deferCommitFence:true});
   await insertLiveEvidence(registryRevokeId,{...workspaceBEvidence,deferCommitFence:true});
   await insertConnectorRevision({db:pool,version:'10.0.0'});
   await assert.rejects(
     ()=>client.query('SET CONSTRAINTS ALL IMMEDIATE'),
     error=>error?.code==='23514' &&
       error?.constraint==='website_live_current_connector_revision_guard',
     'stale admitted connector must not authorize an evidence COMMIT',
   );
   await client.query('ROLLBACK');
   const escaped=await pool.query(
     'SELECT count(*)::int AS total FROM website_live_inspection_runs WHERE id=$1',
     [registryRevokeId],
   );
   assert.equal(escaped.rows[0].total,0);
   checks++;
   console.log('M04 native PG18 live security: committed disabled revision rejects pending evidence PASS');
 }finally{await client.query('ROLLBACK');}

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

   // WEB-054: two different tenants racing the very same globally unique
   // work ID must serialize at the advisory lock and return a controlled
   // scope conflict, not an unhandled PostgreSQL primary-key violation.
   const sharedRaceId = `m04.qa.${slug}.retention.two-tenant-race`;
   const contested = await Promise.allSettled([
     purgeExpiredWebsiteLiveInspectionEvidenceForWork(pool,raceWorkspace,sharedRaceId,1),
     purgeExpiredWebsiteLiveInspectionEvidenceForWork(pool,raceOtherWorkspace,sharedRaceId,1),
   ]);
   const admitted = contested.filter(result=>result.status==='fulfilled');
   const denied = contested.filter(result=>result.status==='rejected');
   assert.equal(admitted.length,1,'one tenant must win the global work-id claim');
   assert.deepEqual(admitted[0].value,{deleted:0,replayed:false});
   assert.equal(denied.length,1,'one tenant must receive a controlled conflict');
   assert.equal(denied[0].reason?.code,'M04_LIVE_DB_ID_CONFLICT');
   const unique = await pool.query(
     'SELECT workspace_id,deleted_count,max_rows FROM website_live_retention_work_receipts WHERE work_unit_id=$1',
     [sharedRaceId],
   );
   assert.equal(unique.rows.length,1);
   assert.ok([raceWorkspace,raceOtherWorkspace].includes(unique.rows[0].workspace_id));
   assert.equal(unique.rows[0].deleted_count,0);
   assert.equal(unique.rows[0].max_rows,1);
   checks++;
   console.log('M04 native PG18 live security: simultaneous cross-tenant work-ID claim fails closed PASS');
 } finally {
   await pool.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[[raceWorkspace,raceOtherWorkspace]]);
 }
 console.log(`Brovexa M04 native full-schema grant authorization PASS (${checks} scenarios; rollback/race fixtures cleaned, durable WEB-055 fixture isolated)`);
}catch(error){try{await client.query('ROLLBACK')}catch{} console.error(`Brovexa M04 native full-schema security FAILED after ${checks} passes: ${error?.message}`); process.exitCode=1;}
finally{client.release();await pool.end();}