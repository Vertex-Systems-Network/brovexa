import { describe,it,expect,vi } from 'vitest';
import type { Pool } from 'pg';
import {persistWebsiteLiveGrant,getWebsiteLiveGrant} from './website-live-grant-persistence';
const workspaceId='550e8400-e29b-41d4-a716-446655440000';
const owner='550e8400-e29b-41d4-a716-446655440001';
const membership='550e8400-e29b-41d4-a716-446655440002';
function approval(){return {
 inspectionId:'inspect.1',workspaceId,canonicalBusinessId:'business.1',
 domainVerificationId:'verify.1',verifiedDomain:'example.com',
 sourceAdmissionDecisionRef:'admission.1',sourceKey:'source.web',
 sourcePolicyId:'policy.web',sourcePolicyVersion:'1.0.0',
 transportPolicyId:'transport.web',transportPolicyVersion:'1.0.0',
 maxResponseBytes:100_000,timeoutMs:5000,retentionTtlSeconds:86400,
 m02TransportPolicy:{networkMode:'provider_network',transportPolicyId:'transport.web',
 transportPolicyVersion:'1.0.0'},approvedByUserId:owner,
 approvedByMembershipId:membership,
 expiresAt:new Date(Date.now()+180_000).toISOString(),
};}
function fakePool(){
 const query=vi.fn(async(sql:string)=>sql.startsWith('INSERT INTO website_live_inspection_grants')?
  {rows:[{inspection_id:'inspect.1'}]}:{rows:[]});
 const release=vi.fn();
 const connect=vi.fn(async()=>({query,release}));
 return {pool:{connect,query} as unknown as Pool,query,connect,release};
}
describe('WEB-035 owner-grant persistence',()=>{
 it('rejects oversized and invalid grants before accessing PostgreSQL',async()=>{
  const p=fakePool();const a=approval();
  await expect(persistWebsiteLiveGrant(p.pool,{...a,maxResponseBytes:1_000_001}))
   .rejects.toMatchObject({code:'M04_LIVE_GRANT_INVALID'});
  await expect(persistWebsiteLiveGrant(p.pool,{...a,verifiedDomain:'localhost'}))
   .rejects.toMatchObject({code:'M04_LIVE_GRANT_INVALID'});
  await expect(persistWebsiteLiveGrant(p.pool,{...a,expiresAt:new Date(Date.now()+3600_000).toISOString()}))
   .rejects.toMatchObject({code:'M04_LIVE_GRANT_INVALID'});
  expect(p.connect).not.toHaveBeenCalled();
 });
 it('inserts only owner identity, approval provenance and bounded scope in a transaction',async()=>{
  const p=fakePool(),a=approval();
  await expect(persistWebsiteLiveGrant(p.pool,a)).resolves.toEqual({inspectionId:'inspect.1',replayed:false});
  expect(p.query.mock.calls.map(c=>c[0])).toEqual(['BEGIN',expect.stringContaining('INSERT INTO website_live_inspection_grants'),'COMMIT']);
  expect(p.release).toHaveBeenCalledOnce();
 });
 it('never calls nested toJSON or accessor properties from injected M02 policies',async()=>{
  const p=fakePool(),a=approval();const toJSON=vi.fn(()=>{throw Error('evil serializer');});
  const unsafe={...a,m02TransportPolicy:{...a.m02TransportPolicy,toJSON}};
  await expect(persistWebsiteLiveGrant(p.pool,unsafe))
   .rejects.toMatchObject({code:'M04_LIVE_GRANT_INVALID'});
  expect(toJSON).not.toHaveBeenCalled();
  expect(p.connect).not.toHaveBeenCalled();
 });
 it('refuses a hash-identical grant replay after expiry or revoked owner authority',async()=>{
  let hash='';
  const query=vi.fn(async(sql:string,args?:unknown[])=>{
    if(sql.startsWith('INSERT INTO website_live_inspection_grants')){
      hash=String(args?.[19]);return {rows:[]};
    }
    if(sql.startsWith('SELECT workspace_id,grant_hash'))
      return {rows:[{workspace_id:workspaceId,grant_hash:hash}]};
    if(sql.startsWith('SELECT g.inspection_id FROM website_live_inspection_grants'))
      return {rows:[]};
    return {rows:[]};
  });
  const release=vi.fn();
  const pool={connect:vi.fn(async()=>({query,release}))} as unknown as Pool;
  await expect(persistWebsiteLiveGrant(pool,approval()))
    .rejects.toMatchObject({code:'M04_LIVE_GRANT_INACTIVE'});
  const statements=query.mock.calls.map(c=>c[0]);
  expect(statements.some(x=>x.includes('g.expires_at>clock_timestamp()'))).toBe(true);
  expect(statements.some(x=>x.includes("wr.kind='owner'"))).toBe(true);
  expect(statements.some(x=>x.includes("s.decision='allow'"))).toBe(true);
  expect(statements.some(x=>x.includes('FOR SHARE OF g,w,wm,u,wmr,wr,d,s'))).toBe(true);
  expect(statements.at(-1)).toBe('ROLLBACK');
  expect(release).toHaveBeenCalledOnce();
 });
 it('allows an identical grant replay only when current authority survives DB row locking',async()=>{
  let hash='';
  const query=vi.fn(async(sql:string,args?:unknown[])=>{
    if(sql.startsWith('INSERT INTO website_live_inspection_grants')){
      hash=String(args?.[19]);return {rows:[]};
    }
    if(sql.startsWith('SELECT workspace_id,grant_hash'))
      return {rows:[{workspace_id:workspaceId,grant_hash:hash}]};
    if(sql.startsWith('SELECT g.inspection_id FROM website_live_inspection_grants'))
      return {rows:[{inspection_id:'inspect.1'}]};
    return {rows:[]};
  });
  const pool={connect:vi.fn(async()=>({query,release:vi.fn()}))} as unknown as Pool;
  await expect(persistWebsiteLiveGrant(pool,approval()))
    .resolves.toEqual({inspectionId:'inspect.1',replayed:true});
  expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  const auth=query.mock.calls.find(c=>c[0].startsWith('SELECT g.inspection_id FROM website_live_inspection_grants'));
  expect(auth?.[1]).toEqual(['inspect.1',workspaceId,hash]);
 });
 it('denies changed tenant or grant hash before active replay admission',async()=>{
  const query=vi.fn(async(sql:string)=>{
    if(sql.startsWith('SELECT workspace_id,grant_hash'))
      return {rows:[{workspace_id:workspaceId,grant_hash:'f'.repeat(64)}]};
    return {rows:[]};
  });
  const pool={connect:vi.fn(async()=>({query,release:vi.fn()}))} as unknown as Pool;
  await expect(persistWebsiteLiveGrant(pool,approval()))
    .rejects.toMatchObject({code:'M04_LIVE_GRANT_CONFLICT'});
  expect(query.mock.calls.some(c=>c[0].startsWith('SELECT g.inspection_id FROM website_live_inspection_grants'))).toBe(false);
 });
 it('denies lookup outside canonical UUID workspace scope',async()=>{
  const p=fakePool();
  await expect(getWebsiteLiveGrant(p.pool,{workspaceId:'bad',inspectionId:'inspect.1'}))
   .rejects.toMatchObject({code:'M04_LIVE_GRANT_INVALID'});
  expect(p.query).not.toHaveBeenCalled();
 });
 it('requires active owner, admitted source and unexpired grant when reading',async()=>{
  const p=fakePool();
  await getWebsiteLiveGrant(p.pool,{workspaceId,inspectionId:'inspect.1'});
  const sql=p.query.mock.calls.at(-1)?.[0]??'';
  expect(sql).toContain("wr.kind='owner'");
  expect(sql).toContain("s.decision='allow'");
  expect(sql).toContain('g.expires_at>now()');
  expect(sql).toContain('g.workspace_id=$1 AND g.inspection_id=$2');
  expect(sql).toContain("d.normalized_domain=g.verified_domain AND d.decision='verified'");
  expect(sql).toContain("s.request->>'targetUrl'=g.target_url");
  expect(sql).toContain("s.request->>'workspaceId'=g.workspace_id::text");
  expect(sql).toContain("s.request->>'requestId'=s.request_id");
  expect(sql).toContain("s.request->>'sourceTaskId'=s.source_task_id");
  expect(sql).toContain("s.request->>'robotsDecision' IN ('allowed','not_applicable')");
  expect(sql).toContain("s.request->>'rawPayloadRequested'='false'");
  expect(sql).toContain("s.request->>'exportRequested'='false'");
  expect(sql).toContain('g.approved_at<=now()');
 });
 it('never returns an approved grant if the tenant-scoped authorization query returns no matching row',async()=>{
  const p=fakePool();
  await expect(getWebsiteLiveGrant(p.pool,{workspaceId,inspectionId:'inspect.1'}))
   .resolves.toBeNull();
  expect(p.query).toHaveBeenCalledOnce();
  expect(p.query.mock.calls[0]?.[1]).toEqual([workspaceId,'inspect.1']);
 });
});