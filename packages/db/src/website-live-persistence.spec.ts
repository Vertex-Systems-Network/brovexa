import {describe,it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
import {
  persistWebsiteLiveInspectionResult, snapshotWebsiteLiveInspection,
  deleteWebsiteLiveInspectionEvidence, purgeExpiredWebsiteLiveInspectionEvidence,
} from './website-live-persistence';
const workspaceId='550e8400-e29b-41d4-a716-446655440000';
const sample=()=>({
 version:'2.0.0' as const,
 request:{version:'2.0.0' as const,executionMode:'live' as const,networkRequested:true as const,
   credentialedFetchRequested:false as const,rawPayloadRequested:false as const,outreachRequested:false as const,
   inspectionId:'inspect.live1',workspaceId,canonicalBusinessId:'business.1',
   domainVerificationId:'verification.1',verifiedDomain:'example.com',targetUrl:'https://example.com/',
   sourceKey:'source.approved_web',sourceAdmissionDecisionRef:'admission.1',
   sourcePolicyId:'policy.1',sourcePolicyVersion:'1.0.0',transportPolicyId:'transport.1',transportPolicyVersion:'1.0.0',
   maxResponseBytes:50000,timeoutMs:1000},
 status:'review_required' as const,coverage:'partial' as const,
 transportReceiptIds:['live.abc'],reasonCodes:['website.single_page_only'],
 observations:[{capability:'contact_form' as const,observation:'observed_present' as const,
   reason:'detected' as const,confidence:0.9,evidenceReferenceIds:['evidence.1'],transportReceiptIds:['live.abc']}],
 receipt:{version:'2.0.0' as const,executionMode:'live' as const,networkRequested:true as const,
   rawBodyRetained:false as const,workspaceId,inspectionId:'inspect.live1',canonicalUrl:'https://example.com/',
   remoteIpv4:'8.8.8.8',status:200,contentType:'text/html' as const,bodyLength:100,
   bodySha256:'c'.repeat(64),receiptId:'live.abc',receivedAt:'2026-10-16T12:00:00.000Z'},
 completedAt:'2026-10-16T12:00:00.500Z',bodyIncluded:false as const,
 retentionTtlSeconds:3600,deletionRequired:true as const,
});
function mockPool(){
 const query=vi.fn(async(sql:string,_args?:unknown[])=>{
  if(sql.startsWith('INSERT INTO website_live_inspection_runs'))return {rows:[{id:'inspect.live1'}]};
  return {rows:[]};
 });
 const release=vi.fn();
 return {pool:{connect:vi.fn(async()=>({query,release})),query} as unknown as Pool,query,release};
}
describe('M04 live v2 persistence',()=>{
 it('atomic immutable parent/observations and no raw body',async()=>{
  const s=mockPool();await expect(persistWebsiteLiveInspectionResult(s.pool,sample()))
   .resolves.toEqual({inspectionId:'inspect.live1',replayed:false});
  expect(s.query.mock.calls.map(c=>c[0])).toEqual(['BEGIN',expect.stringContaining('INSERT INTO website_live_inspection_runs'),
   expect.stringContaining('INSERT INTO website_live_capability_observations'),'COMMIT']);
  const serialized=JSON.stringify(s.query.mock.calls);expect(serialized).not.toContain('<html');
 });
 it('rejects wrong tenant, fake receipt, external live target and full-site negative inference pre-DB',async()=>{
  const s=mockPool();const orig=sample();
  for(const item of [
   {...orig,request:{...orig.request,workspaceId:'other'}},
   {...orig,request:{...orig.request,targetUrl:'http://example.com/'}},
   {...orig,receipt:{...orig.receipt,remoteIpv4:'127.0.0.1'}},
   {...orig,receipt:{...orig.receipt,receiptId:'evil'}},
   {...orig,observations:[{...orig.observations[0]!,observation:'not_detected' as const}]},
   {...orig,reasonCodes:['unqualified']},
   {...orig,retentionTtlSeconds:0},
  ])await expect(persistWebsiteLiveInspectionResult(s.pool,item as never)).rejects.toMatchObject({code:'M04_LIVE_DB_INPUT_INVALID'});
  expect(s.query).not.toHaveBeenCalled();
 });
 it('copies own data, blocks accessors and strips unexpected body',()=>{
  const orig=sample();const got=snapshotWebsiteLiveInspection({...orig,body:'<html>SECRET</html>'});
  expect(JSON.stringify(got)).not.toContain('SECRET');
  const getter=Object.defineProperty({...orig.receipt},'bodySha256',{get(){throw Error('MALICIOUS_GETTER')}});
  expect(()=>snapshotWebsiteLiveInspection({...orig,receipt:getter})).toThrow('Missing own data');
 });
 it('blocks an identical replay after owner authorization expires; no new observations are written',async()=>{
  let hash='';
  const query=vi.fn(async(sql:string,args?:unknown[])=>{
    if(sql.startsWith('INSERT INTO website_live_inspection_runs')){
      hash=String(args?.[25]);return {rows:[]};
    }
    if(sql.startsWith('SELECT workspace_id,payload_hash'))
      return {rows:[{workspace_id:workspaceId,payload_hash:hash}]};
    if(sql.startsWith('SELECT g.inspection_id'))return {rows:[]};
    return {rows:[]};
  });
  const release=vi.fn();
  const pool={connect:vi.fn(async()=>({query,release}))} as unknown as Pool;
  await expect(persistWebsiteLiveInspectionResult(pool,sample()))
    .rejects.toMatchObject({code:'M04_LIVE_DB_GRANT_INACTIVE'});
  const sql=query.mock.calls.map(c=>c[0]);
  expect(sql.some(x=>x.includes('FOR SHARE OF g,w,wm,u,wmr,wr,d,s'))).toBe(true);
  expect(sql.some(x=>x.includes('g.expires_at > clock_timestamp()'))).toBe(true);
  expect(sql.some(x=>x.includes('INSERT INTO website_live_capability_observations'))).toBe(false);
  expect(sql.at(-1)).toBe('ROLLBACK');
  expect(release).toHaveBeenCalledOnce();
 });
 it('allows a hash-identical replay with current owner, domain and M02 grant under transaction locks',async()=>{
  let hash='';
  const query=vi.fn(async(sql:string,args?:unknown[])=>{
    if(sql.startsWith('INSERT INTO website_live_inspection_runs')){
      hash=String(args?.[25]);return {rows:[]};
    }
    if(sql.startsWith('SELECT workspace_id,payload_hash'))
      return {rows:[{workspace_id:workspaceId,payload_hash:hash}]};
    if(sql.startsWith('SELECT g.inspection_id'))return {rows:[{inspection_id:'inspect.live1'}]};
    return {rows:[]};
  });
  const pool={connect:vi.fn(async()=>({query,release:vi.fn()}))} as unknown as Pool;
  await expect(persistWebsiteLiveInspectionResult(pool,sample()))
    .resolves.toEqual({inspectionId:'inspect.live1',replayed:true});
  expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  const auth=query.mock.calls.find(c=>c[0].startsWith('SELECT g.inspection_id'));
  expect(auth?.[1]).toEqual([
    'inspect.live1',workspaceId,'business.1','verification.1','example.com',
    'https://example.com/','source.approved_web','admission.1','policy.1','1.0.0',
    'transport.1','1.0.0',50000,1000,3600,
    '2026-10-16T12:00:00.000Z','2026-10-16T12:00:00.500Z',
  ]);
 });
 it('rejects same inspection ID with different tenant or evidence before checking replay grants',async()=>{
  const query=vi.fn(async(sql:string)=>{
    if(sql.startsWith('INSERT INTO website_live_inspection_runs'))return {rows:[]};
    if(sql.startsWith('SELECT workspace_id,payload_hash'))
      return {rows:[{workspace_id:'other-tenant',payload_hash:'0'.repeat(64)}]};
    return {rows:[]};
  });
  const pool={connect:vi.fn(async()=>({query,release:vi.fn()}))} as unknown as Pool;
  await expect(persistWebsiteLiveInspectionResult(pool,sample()))
    .rejects.toMatchObject({code:'M04_LIVE_DB_ID_CONFLICT'});
  expect(query.mock.calls.some(c=>c[0].startsWith('SELECT g.inspection_id'))).toBe(false);
 });
 it('workspace-scoped RBAC deletion and capped expiry cleanup',async()=>{
  const s=mockPool();await deleteWebsiteLiveInspectionEvidence(s.pool,{workspaceId,inspectionId:'inspect.live1'});
  expect(s.query.mock.calls.at(-1)?.[0]).toContain('deletion_required=true');
  await expect(purgeExpiredWebsiteLiveInspectionEvidence(s.pool,workspaceId,501)).rejects.toMatchObject({code:'M04_LIVE_DB_INPUT_INVALID'});
 });
});