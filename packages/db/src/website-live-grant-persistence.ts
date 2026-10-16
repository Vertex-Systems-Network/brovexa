import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { withPgTransaction } from './client';

/** WEB-035: only an authenticated server path may call the owner approval write.
 * DB constraints independently check workspace owner, domain verification,
 * M02 source admission and immutable expiry. This is not a public API. */
export interface WebsiteLiveGrantApproval {
  inspectionId: string;
  workspaceId: string;
  canonicalBusinessId: string;
  domainVerificationId: string;
  verifiedDomain: string;
  sourceAdmissionDecisionRef: string;
  sourceKey: string;
  sourcePolicyId: string;
  sourcePolicyVersion: string;
  transportPolicyId: string;
  transportPolicyVersion: string;
  maxResponseBytes: number;
  timeoutMs: number;
  retentionTtlSeconds: number;
  m02TransportPolicy: Record<string, unknown>;
  approvedByUserId: string;
  approvedByMembershipId: string;
  expiresAt: string;
}
export interface WebsiteLiveTrustedGrant extends WebsiteLiveGrantApproval {
  sourceRequest: Record<string, unknown>;
  sourceAdmission: Record<string, unknown>;
}
export class WebsiteLiveGrantError extends Error {
  constructor(readonly code: 'M04_LIVE_GRANT_INVALID'|'M04_LIVE_GRANT_CONFLICT') {
    super(code);
    this.name='WebsiteLiveGrantError';
  }
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const domain=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const semver=/^\d+\.\d+\.\d+$/;
const invalid=():never=>{throw new WebsiteLiveGrantError('M04_LIVE_GRANT_INVALID');};
function data(raw:unknown,key:string):unknown {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return invalid();
  let descriptor:PropertyDescriptor|undefined;
  try{descriptor=Object.getOwnPropertyDescriptor(raw,key);}catch{return invalid();}
  if(!descriptor||!('value' in descriptor))return invalid();
  return descriptor.value;
}
/** Depth-, key-, and byte-bounded clone of JSON-safe own data only. Never invoke
 * approval input getters, toJSON hooks or inherited constructors. */
function safeJson(raw:unknown,depth=0,budget={keys:0}):unknown {
  if(raw===null||typeof raw==='string'||typeof raw==='boolean')return raw;
  if(typeof raw==='number'&&Number.isFinite(raw))return raw;
  if(!raw||typeof raw!=='object'||depth>8)return invalid();
  const isArray=Array.isArray(raw);
  let keys:PropertyKey[];
  try{keys=Reflect.ownKeys(raw);}catch{return invalid();}
  budget.keys+=keys.length;
  if(budget.keys>512)return invalid();
  if(isArray){
    const length=data(raw,'length');
    if(!Number.isSafeInteger(length)||(length as number)>256||
       keys.length!==(length as number)+1)return invalid();
    const values:unknown[]=[];
    for(let i=0;i<(length as number);i++)values.push(safeJson(data(raw,String(i)),depth+1,budget));
    return values;
  }
  if(keys.some(k=>typeof k!=='string'||k==='__proto__'||k==='constructor'||k==='prototype'))return invalid();
  const v:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const k of keys)v[k as string]=safeJson(data(raw,k as string),depth+1,budget);
  return v;
}
function stable(raw:unknown):WebsiteLiveGrantApproval {
  const fields=['inspectionId','workspaceId','canonicalBusinessId','domainVerificationId',
    'verifiedDomain','sourceAdmissionDecisionRef','sourceKey','sourcePolicyId','sourcePolicyVersion',
    'transportPolicyId','transportPolicyVersion','maxResponseBytes','timeoutMs','retentionTtlSeconds',
    'm02TransportPolicy','approvedByUserId','approvedByMembershipId','expiresAt'] as const;
  const v:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const k of fields)v[k]=data(raw,k);
  for(const k of ['inspectionId','canonicalBusinessId','domainVerificationId',
    'sourceAdmissionDecisionRef','sourcePolicyId','transportPolicyId'] as const)
    if(typeof v[k]!=='string'||!id.test(v[k]))return invalid();
  for(const k of ['workspaceId','approvedByUserId','approvedByMembershipId'] as const)
    if(typeof v[k]!=='string'||!uuid.test(v[k]))return invalid();
  if(typeof v.verifiedDomain!=='string'||!domain.test(v.verifiedDomain)||
     v.verifiedDomain.length>253||/\.(?:localhost|local|internal|invalid|test)$/.test(v.verifiedDomain)||
     typeof v.sourceKey!=='string'||!/^source\.[a-z0-9_.-]+$/.test(v.sourceKey)||
     typeof v.sourcePolicyVersion!=='string'||!semver.test(v.sourcePolicyVersion)||
     typeof v.transportPolicyVersion!=='string'||!semver.test(v.transportPolicyVersion)||
     !Number.isSafeInteger(v.maxResponseBytes)||(v.maxResponseBytes as number)<1||
     (v.maxResponseBytes as number)>1_000_000||!Number.isSafeInteger(v.timeoutMs)||
     (v.timeoutMs as number)<100||(v.timeoutMs as number)>30_000||
     !Number.isSafeInteger(v.retentionTtlSeconds)||(v.retentionTtlSeconds as number)<1||
     (v.retentionTtlSeconds as number)>31_536_000)return invalid();
  const expiresAt=v.expiresAt;
  const now=Date.now();
  if(typeof expiresAt!=='string'||!/Z$/.test(expiresAt)||
     !Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=now||
     Date.parse(expiresAt)>now+300_000)return invalid();
  const policy=safeJson(v.m02TransportPolicy) as Record<string,unknown>;
  if(policy.networkMode!=='provider_network'||
     policy.transportPolicyId!==v.transportPolicyId||
     policy.transportPolicyVersion!==v.transportPolicyVersion)return invalid();
  // No caller-controlled JSON serializers or getters can run after this boundary.
  try{
    const serialized=JSON.stringify(policy);
    if(serialized.length>32_768)return invalid();
    v.m02TransportPolicy=policy;
  }catch{return invalid();}
  return v as unknown as WebsiteLiveGrantApproval;
}
function identity(scope:{workspaceId:string;inspectionId:string}):void{
  if(!uuid.test(scope.workspaceId)||!id.test(scope.inspectionId))invalid();
}
/** Owner approval + M02 admission are rechecked by the PostgreSQL INSERT trigger. */
export async function persistWebsiteLiveGrant(pool:Pool,raw:WebsiteLiveGrantApproval):Promise<{inspectionId:string;replayed:boolean}> {
  const v=stable(raw);
  const canonicalUrl=`https://${v.verifiedDomain}/`;
  const payload=[v.inspectionId,v.workspaceId,v.canonicalBusinessId,v.domainVerificationId,
    v.verifiedDomain,v.sourceAdmissionDecisionRef,v.sourceKey,v.sourcePolicyId,
    v.sourcePolicyVersion,v.transportPolicyId,v.transportPolicyVersion,canonicalUrl,
    v.maxResponseBytes,v.timeoutMs,v.retentionTtlSeconds,JSON.stringify(v.m02TransportPolicy),
    v.approvedByUserId,v.approvedByMembershipId,v.expiresAt];
  const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return withPgTransaction(pool,async client=>{
    const row=await client.query<{inspection_id:string}>(
      `INSERT INTO website_live_inspection_grants (
        inspection_id,workspace_id,canonical_business_id,domain_verification_id,
        verified_domain,source_admission_decision_ref,source_key,source_policy_id,
        source_policy_version,transport_policy_id,transport_policy_version,target_url,
        max_response_bytes,timeout_ms,retention_ttl_seconds,m02_transport_policy,
        approved_by_user_id,approved_by_membership_id,expires_at,grant_hash
      ) VALUES (${Array.from({length:20},(_,i)=>'$'+(i+1)).join(',')})
      ON CONFLICT (inspection_id) DO NOTHING RETURNING inspection_id`,
      [...payload,digest],
    );
    if(row.rows.length)return {inspectionId:v.inspectionId,replayed:false};
    const previous=await client.query<{workspace_id:string;grant_hash:string}>(
      'SELECT workspace_id,grant_hash FROM website_live_inspection_grants WHERE inspection_id=$1',
      [v.inspectionId],
    );
    if(previous.rows[0]?.workspace_id!==v.workspaceId||previous.rows[0]?.grant_hash!==digest)
      throw new WebsiteLiveGrantError('M04_LIVE_GRANT_CONFLICT');
    return {inspectionId:v.inspectionId,replayed:true};
  });
}

interface GrantRow {
  inspection_id:string;workspace_id:string;canonical_business_id:string;
  domain_verification_id:string;verified_domain:string;source_admission_decision_ref:string;
  source_key:string;source_policy_id:string;source_policy_version:string;
  transport_policy_id:string;transport_policy_version:string;max_response_bytes:number;
  timeout_ms:number;retention_ttl_seconds:number;m02_transport_policy:Record<string,unknown>;
  approved_by_user_id:string;approved_by_membership_id:string;expires_at:Date;
  request:Record<string,unknown>;admission:Record<string,unknown>;
}
/** Expiry and current owner identity are checked by DB, not queue payload values. */
export async function getWebsiteLiveGrant(pool:Pool,scope:{workspaceId:string;inspectionId:string}):Promise<WebsiteLiveTrustedGrant|null>{
  identity(scope);
  const result=await pool.query<GrantRow>(
    `SELECT g.inspection_id,g.workspace_id,g.canonical_business_id,
       g.domain_verification_id,g.verified_domain,g.source_admission_decision_ref,
       g.source_key,g.source_policy_id,g.source_policy_version,
       g.transport_policy_id,g.transport_policy_version,g.max_response_bytes,
       g.timeout_ms,g.retention_ttl_seconds,g.m02_transport_policy,
       g.approved_by_user_id,g.approved_by_membership_id,g.expires_at,
       s.request,s.admission
     FROM website_live_inspection_grants g
     JOIN source_admission_snapshots s
       ON s.id=g.source_admission_decision_ref AND s.workspace_id=g.workspace_id
     JOIN workspaces w ON w.id=g.workspace_id AND w.status='active'
     JOIN workspace_memberships wm ON wm.id=g.approved_by_membership_id
       AND wm.workspace_id=g.workspace_id AND wm.user_id=g.approved_by_user_id
       AND wm.status='active'
     JOIN users u ON u.id=wm.user_id AND u.status='active'
     JOIN workspace_membership_roles wmr ON wmr.membership_id=wm.id AND wmr.workspace_id=wm.workspace_id
     JOIN workspace_roles wr ON wr.id=wmr.role_id AND wr.workspace_id=wm.workspace_id AND wr.kind='owner'
     WHERE g.workspace_id=$1 AND g.inspection_id=$2
       AND g.expires_at>now() AND s.decision='allow'
       AND s.source_key=g.source_key AND s.policy_id=g.source_policy_id
       AND s.policy_version=g.source_policy_version
     LIMIT 1`,
    [scope.workspaceId,scope.inspectionId],
  );
  const row=result.rows[0];if(!row)return null;
  // Do not hand mutable pg JSONB objects to admission or worker callbacks.
  const output:WebsiteLiveTrustedGrant={
    inspectionId:row.inspection_id,workspaceId:row.workspace_id,
    canonicalBusinessId:row.canonical_business_id,domainVerificationId:row.domain_verification_id,
    verifiedDomain:row.verified_domain,sourceAdmissionDecisionRef:row.source_admission_decision_ref,
    sourceKey:row.source_key,sourcePolicyId:row.source_policy_id,
    sourcePolicyVersion:row.source_policy_version,transportPolicyId:row.transport_policy_id,
    transportPolicyVersion:row.transport_policy_version,maxResponseBytes:row.max_response_bytes,
    timeoutMs:row.timeout_ms,retentionTtlSeconds:row.retention_ttl_seconds,
    m02TransportPolicy:JSON.parse(JSON.stringify(row.m02_transport_policy)) as Record<string,unknown>,
    approvedByUserId:row.approved_by_user_id,approvedByMembershipId:row.approved_by_membership_id,
    expiresAt:row.expires_at.toISOString(),
    sourceRequest:JSON.parse(JSON.stringify(row.request)) as Record<string,unknown>,
    sourceAdmission:JSON.parse(JSON.stringify(row.admission)) as Record<string,unknown>,
  };
  if(output.workspaceId!==scope.workspaceId||output.inspectionId!==scope.inspectionId)return invalid();
  return output;
}