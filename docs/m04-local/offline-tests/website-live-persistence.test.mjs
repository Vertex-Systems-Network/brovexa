import test from 'node:test';
import assert from 'node:assert/strict';
import {
 snapshotWebsiteLiveInspection,persistWebsiteLiveInspectionResult,
 deleteWebsiteLiveInspectionEvidence,purgeExpiredWebsiteLiveInspectionEvidence,
} from '../packages/db/src/website-live-persistence.ts';
const workspaceId='550e8400-e29b-41d4-a716-446655440000';
const base=()=>({
 version:'2.0.0',request:{version:'2.0.0',executionMode:'live',networkRequested:true,
 credentialedFetchRequested:false,rawPayloadRequested:false,outreachRequested:false,
 inspectionId:'inspect.live1',workspaceId,canonicalBusinessId:'business.1',domainVerificationId:'verify.1',
 verifiedDomain:'example.com',targetUrl:'https://example.com/',sourceKey:'source.approved_web',
 sourceAdmissionDecisionRef:'admission.1',sourcePolicyId:'policy.1',sourcePolicyVersion:'1.0.0',
 transportPolicyId:'transport.1',transportPolicyVersion:'1.0.0',maxResponseBytes:50000,timeoutMs:1000},
 status:'review_required',coverage:'partial',transportReceiptIds:['live.abc'],reasonCodes:['website.single_page_only'],
 observations:[{capability:'contact_form',observation:'observed_present',reason:'detected',confidence:0.9,
 evidenceReferenceIds:['evidence.1'],transportReceiptIds:['live.abc']}],
 receipt:{version:'2.0.0',executionMode:'live',networkRequested:true,rawBodyRetained:false,
 workspaceId,inspectionId:'inspect.live1',canonicalUrl:'https://example.com/',remoteIpv4:'8.8.8.8',
 status:200,contentType:'text/html',bodyLength:100,bodySha256:'c'.repeat(64),receiptId:'live.abc',
 receivedAt:'2026-10-16T12:00:00.000Z'},completedAt:'2026-10-16T12:00:01.000Z',bodyIncluded:false,
 retentionTtlSeconds:3600,deletionRequired:true,
});
function mock(handler){const calls=[];let releases=0;
 const query=async(sql,values=[])=>{calls.push({sql,values});
  if(handler)return handler(sql,values);
  if(sql.startsWith('INSERT INTO website_live_inspection_runs'))return {rows:[{id:'inspect.live1'}]};
  return {rows:[]};};
 const pool={async connect(){return{query,release(){releases++}}},query};
 return{calls,pool,get releases(){return releases}};}
const rejected=async(row)=>{
 const m=mock();await assert.rejects(persistWebsiteLiveInspectionResult(m.pool,row),{code:'M04_LIVE_DB_INPUT_INVALID'});
 assert.equal(m.calls.length,0);
};
test('pins v2 root+receipt and removes extraneous HTML from persistence snapshot',()=>{
 const result=snapshotWebsiteLiveInspection({...base(),htmlBody:'<html>SECRET</html>'});
 assert.equal(JSON.stringify(result).includes('SECRET'),false);
 assert.equal(result.receipt.networkRequested,true);
 assert.equal(result.request.executionMode,'live');
});
test('writes parent and observation atomically without raw HTML',async()=>{
 const m=mock();assert.deepEqual(await persistWebsiteLiveInspectionResult(m.pool,base()),{inspectionId:'inspect.live1',replayed:false});
 assert.equal(m.calls[0].sql,'BEGIN');assert.match(m.calls[1].sql,/INSERT INTO website_live_inspection_runs/);
 assert.match(m.calls[2].sql,/INSERT INTO website_live_capability_observations/);
 assert.equal(m.calls[3].sql,'COMMIT');assert.equal(m.releases,1);
});
test('database insert failure rolls transaction back and releases client',async()=>{
 const m=mock(async(sql)=>{if(sql.startsWith('INSERT INTO website_live_capability_observations'))throw Error('CONSTRAINT');
 if(sql.startsWith('INSERT INTO website_live_inspection_runs'))return {rows:[{id:'inspect.live1'}]};return {rows:[]}});
 await assert.rejects(persistWebsiteLiveInspectionResult(m.pool,base()),/CONSTRAINT/);
 assert.equal(m.calls.at(-1).sql,'ROLLBACK');assert.equal(m.releases,1);
});
test('identical replay is idempotent and does not duplicate observation writes',async()=>{
 let hash;const m=mock(async(sql,params)=>{
  if(sql.startsWith('INSERT INTO website_live_inspection_runs')){hash=params[25];return {rows:[]}};
  if(sql.startsWith('SELECT workspace_id'))return{rows:[{workspace_id:workspaceId,payload_hash:hash}]};
  return{rows:[]};});
 assert.deepEqual(await persistWebsiteLiveInspectionResult(m.pool,base()),{inspectionId:'inspect.live1',replayed:true});
 assert.equal(m.calls.some(x=>x.sql.startsWith('INSERT INTO website_live_capability_observations')),false);
});
test('same ID with changed content or tenant never replays',async()=>{
 const m=mock(async(sql)=>sql.startsWith('INSERT INTO website_live_inspection_runs')?{rows:[]}:
  sql.startsWith('SELECT workspace_id')?{rows:[{workspace_id:'someone else',payload_hash:'f'.repeat(64)}]}:{rows:[]});
 await assert.rejects(persistWebsiteLiveInspectionResult(m.pool,base()),{code:'M04_LIVE_DB_ID_CONFLICT'});
 assert.equal(m.calls.at(-1).sql,'ROLLBACK');
});
test('rejects 1.x coercion, full-site assessed, negative absence, missing reason',async()=>{
 for(const row of [
  {...base(),version:'1.0.0'}, {...base(),status:'assessed'}, {...base(),coverage:'bounded'},
  {...base(),reasonCodes:[]}, {...base(),reasonCodes:['other']},
  {...base(),observations:[{...base().observations[0],observation:'not_detected'}]},
  {...base(),bodyIncluded:true}, {...base(),retentionTtlSeconds:0},
 ])await rejected(row);
});
test('rejects wrong workspace, IP host, nonpublic dial, content/budget mismatch',async()=>{
 for(const row of [
  {...base(),request:{...base().request,workspaceId:'other'}},
  {...base(),request:{...base().request,targetUrl:'https://evil.test/'}},
  {...base(),request:{...base().request,maxResponseBytes:1}},
  {...base(),receipt:{...base().receipt,remoteIpv4:'127.0.0.1'}},
  {...base(),receipt:{...base().receipt,remoteIpv4:'169.254.169.254'}},
  {...base(),receipt:{...base().receipt,receiptId:'live.foreign'}},
  {...base(),receipt:{...base().receipt,bodySha256:'xxx'}},
 ])await rejected(row);
});
test('blocks accessor-backed receipts, observations and sparse lists without invoking getter',()=>{
 const m=base();let n=0;
 const receipt=Object.defineProperty({...m.receipt},'bodySha256',{get(){n++;return 'c'.repeat(64)}});
 assert.throws(()=>snapshotWebsiteLiveInspection({...m,receipt}),{code:'M04_LIVE_DB_INPUT_INVALID'});
 assert.equal(n,0);
 const sparse=new Array(1);assert.throws(()=>snapshotWebsiteLiveInspection({...m,observations:sparse}),{code:'M04_LIVE_DB_INPUT_INVALID'});
});
test('explicit deletion must bind requested workspace',async()=>{
 const m=mock();assert.equal(await deleteWebsiteLiveInspectionEvidence(m.pool,{workspaceId,inspectionId:'inspect.live1'}),false);
 assert.match(m.calls[0].sql,/workspace_id=\$2/);assert.deepEqual(m.calls[0].values,['inspect.live1',workspaceId]);
 await assert.rejects(deleteWebsiteLiveInspectionEvidence(m.pool,{workspaceId:'other',inspectionId:'inspect.live1'}),{code:'M04_LIVE_DB_INPUT_INVALID'});
});
test('retention purge is bounded and tenant scoped',async()=>{
 const m=mock();assert.equal(await purgeExpiredWebsiteLiveInspectionEvidence(m.pool,workspaceId,100),0);
 assert.match(m.calls[1].sql,/FOR UPDATE SKIP LOCKED/);assert.deepEqual(m.calls[1].values,[workspaceId,100]);
 await assert.rejects(purgeExpiredWebsiteLiveInspectionEvidence(m.pool,workspaceId,501),{code:'M04_LIVE_DB_INPUT_INVALID'});
});