import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { withPgTransaction } from './client';

/** M04-WEB-027: versioned live evidence. Never insert v2 into WEB-002 v1 tables. */
type Capability = 'booking' | 'commerce' | 'contact_form' | 'business_contact' |
  'mobile_viewport' | 'structured_data' | 'social_link' | 'https';
type Observation = 'observed_present' | 'not_detected' | 'unknown';

export interface PersistWebsiteLiveInspectionInput {
  version: '2.0.0';
  request: {
    version: '2.0.0'; executionMode: 'live'; networkRequested: true;
    credentialedFetchRequested: false; rawPayloadRequested: false; outreachRequested: false;
    inspectionId: string; workspaceId: string; canonicalBusinessId: string;
    domainVerificationId: string; verifiedDomain: string; targetUrl: string;
    sourceKey: string; sourceAdmissionDecisionRef: string;
    sourcePolicyId: string; sourcePolicyVersion: string;
    transportPolicyId: string; transportPolicyVersion: string;
    maxResponseBytes: number; timeoutMs: number;
  };
  status: 'review_required'; coverage: 'partial';
  transportReceiptIds: readonly string[];
  reasonCodes: readonly string[];
  observations: readonly {
    capability: Capability; observation: Observation;
    reason: 'detected' | 'not_detected_with_bounded_coverage' | 'insufficient_evidence';
    confidence: number | null;
    evidenceReferenceIds: readonly string[];
    transportReceiptIds: readonly string[];
  }[];
  receipt: {
    version: '2.0.0'; executionMode: 'live'; networkRequested: true;
    rawBodyRetained: false; workspaceId: string; inspectionId: string;
    canonicalUrl: string; remoteIpv4: string; status: number;
    contentType: 'text/html'; bodyLength: number; bodySha256: string;
    receiptId: string; receivedAt: string;
  };
  completedAt: string; bodyIncluded: false;
  retentionTtlSeconds: number; deletionRequired: true;
}

export class WebsiteLivePersistenceError extends Error {
  readonly code: 'M04_LIVE_DB_INPUT_INVALID' | 'M04_LIVE_DB_ID_CONFLICT';
  constructor(code: 'M04_LIVE_DB_INPUT_INVALID' | 'M04_LIVE_DB_ID_CONFLICT', message: string) {
    super(message);
    this.code = code;
    this.name = 'WebsiteLivePersistenceError';
  }
}
function fail(message: string): never { throw new WebsiteLivePersistenceError('M04_LIVE_DB_INPUT_INVALID', message); }
const id = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const version = /^\d+\.\d+\.\d+$/;
const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const hex = /^[a-f0-9]{64}$/;
const capabilities = new Set<Capability>([
  'booking','commerce','contact_form','business_contact',
  'mobile_viewport','structured_data','social_link','https',
]);

/** Copy allowlisted *own data* fields, without invoking getters or iterators. */
function own(input: unknown, key: string): unknown {
  if (input === null || typeof input !== 'object') fail('Expected object.');
  let descriptor: PropertyDescriptor | undefined;
  try { descriptor = Object.getOwnPropertyDescriptor(input, key); }
  catch { fail('Untrusted object descriptor.'); }
  if (!descriptor || !('value' in descriptor)) fail(`Missing own data: ${key}.`);
  return descriptor.value;
}
function object(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (Array.isArray(input)) fail('Expected record, not array.');
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) out[key] = own(input, key);
  return out;
}
function array(input: unknown, limit: number, element: (value: unknown) => unknown): unknown[] {
  if (!Array.isArray(input) || input.length > limit) fail('Malformed or excessive array.');
  const length = input.length;
  const values: unknown[] = [];
  for (let i = 0; i < length; i++) values.push(element(own(input, String(i))));
  return values;
}
function ids(input: unknown, max: number, min = 0): string[] {
  const values = array(input, max, value => {
    if (typeof value !== 'string' || !id.test(value)) fail('Invalid evidence identifier.');
    return value;
  }) as string[];
  if (values.length < min || new Set(values).size !== values.length) fail('Duplicate or missing evidence.');
  return values;
}
function numberBetween(value: unknown, lower: number, upper: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= lower && value <= upper;
}
function timestamp(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) fail('Invalid UTC timestamp.');
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== new Date(value).toISOString()) fail('Invalid UTC timestamp.');
  return time;
}
function publicIpv4(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  const [a,b,c,d] = value.split('.').map(Number);
  if ([a,b,c,d].some(x => x === undefined || x > 255) || ![a,b,c,d].every(x=>Number.isInteger(x))) return false;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return false;
  if (value !== [a,b,c,d].join('.')) return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)) return false;
  return true;
}

/** Normalize once, enforce invariant, and persist only this immutable logical snapshot. */
export function snapshotWebsiteLiveInspection(input: unknown): PersistWebsiteLiveInspectionInput {
  const top = object(input, ['version','request','status','coverage','transportReceiptIds',
    'reasonCodes','observations','receipt','completedAt','bodyIncluded','retentionTtlSeconds','deletionRequired']);
  const req = object(top.request, [
    'version','executionMode','networkRequested','credentialedFetchRequested',
    'rawPayloadRequested','outreachRequested','inspectionId','workspaceId','canonicalBusinessId',
    'domainVerificationId','verifiedDomain','targetUrl','sourceKey','sourceAdmissionDecisionRef',
    'sourcePolicyId','sourcePolicyVersion','transportPolicyId','transportPolicyVersion',
    'maxResponseBytes','timeoutMs',
  ]);
  const receipt = object(top.receipt, [
    'version','executionMode','networkRequested','rawBodyRetained','workspaceId','inspectionId',
    'canonicalUrl','remoteIpv4','status','contentType','bodyLength','bodySha256','receiptId','receivedAt',
  ]);
  const reasonCodes = ids(top.reasonCodes, 16, 1);
  const transportReceiptIds = ids(top.transportReceiptIds, 1, 1);
  const observations = array(top.observations, 8, raw => {
    const obs = object(raw, ['capability','observation','reason','confidence','evidenceReferenceIds','transportReceiptIds']);
    obs.evidenceReferenceIds = ids(obs.evidenceReferenceIds,32);
    obs.transportReceiptIds = ids(obs.transportReceiptIds,1);
    return obs;
  }) as PersistWebsiteLiveInspectionInput['observations'];

  if (top.version !== '2.0.0' || req.version !== '2.0.0' || receipt.version !== '2.0.0' ||
      req.executionMode !== 'live' || receipt.executionMode !== 'live' ||
      req.networkRequested !== true || receipt.networkRequested !== true ||
      receipt.rawBodyRetained !== false || top.bodyIncluded !== false ||
      req.credentialedFetchRequested !== false || req.rawPayloadRequested !== false ||
      req.outreachRequested !== false || top.status !== 'review_required' || top.coverage !== 'partial' ||
      top.deletionRequired !== true || !numberBetween(top.retentionTtlSeconds,1,31_536_000)) {
    fail('Live evidence must retain explicit v2 provenance, bounded retention and no raw body.');
  }
  for (const field of ['inspectionId','canonicalBusinessId','domainVerificationId','sourceAdmissionDecisionRef',
    'sourcePolicyId','transportPolicyId'] as const) {
    if (typeof req[field] !== 'string' || !id.test(req[field])) fail('Invalid scope identifier.');
  }
  if (typeof req.workspaceId !== 'string' || !uuid.test(req.workspaceId) ||
      typeof req.verifiedDomain !== 'string' || !domain.test(req.verifiedDomain) ||
      req.verifiedDomain.length > 253 ||
      /\.(?:localhost|local|internal|invalid|test)$/.test(req.verifiedDomain) ||
      typeof req.sourceKey !== 'string' || !/^source\.[a-z0-9_.-]+$/.test(req.sourceKey) ||
      typeof req.sourcePolicyVersion !== 'string' || !version.test(req.sourcePolicyVersion) ||
      typeof req.transportPolicyVersion !== 'string' || !version.test(req.transportPolicyVersion) ||
      req.targetUrl !== 'https://' + req.verifiedDomain + '/' ||
      !numberBetween(req.maxResponseBytes,1,1_000_000) || !numberBetween(req.timeoutMs,100,30_000)) {
    fail('Live request lacks tenant-bound verified HTTPS root and allowed budgets.');
  }
  if (receipt.workspaceId !== req.workspaceId || receipt.inspectionId !== req.inspectionId ||
      receipt.canonicalUrl !== req.targetUrl || receipt.contentType !== 'text/html' ||
      receipt.status !== 200 || !publicIpv4(receipt.remoteIpv4) ||
      !numberBetween(receipt.bodyLength,0,req.maxResponseBytes as number) ||
      typeof receipt.bodySha256 !== 'string' || !hex.test(receipt.bodySha256) ||
      typeof receipt.receiptId !== 'string' || !id.test(receipt.receiptId) ||
      transportReceiptIds.length !== 1 || receipt.receiptId !== transportReceiptIds[0]) {
    fail('Live transport receipt is foreign or malformed.');
  }
  const received = timestamp(receipt.receivedAt);
  const completed = timestamp(top.completedAt);
  if (completed < received || completed - received > 30_000 ||
      !reasonCodes.includes('website.single_page_only')) fail('Live coverage and timestamps must preserve uncertainty.');
  const found = new Set<string>();
  for (const observation of observations) {
    if (!capabilities.has(observation.capability) || found.has(observation.capability)) fail('Invalid capability.');
    found.add(observation.capability);
    if (observation.observation === 'not_detected') fail('Single-root live read cannot support negative absence.');
    if (observation.observation === 'unknown') {
      if (observation.reason !== 'insufficient_evidence' || observation.confidence !== null ||
          observation.evidenceReferenceIds.length || observation.transportReceiptIds.length) {
        fail('Unknown observation must retain no confidence or evidence.');
      }
    } else if (observation.observation === 'observed_present') {
      if (observation.reason !== 'detected' || typeof observation.confidence !== 'number' ||
          !Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1 ||
          !observation.evidenceReferenceIds.length ||
          observation.transportReceiptIds.length !== 1 || observation.transportReceiptIds[0] !== receipt.receiptId) {
        fail('Positive observation requires pinned receipt and confidence.');
      }
    } else fail('Unsupported observation.');
  }
  return {
    version:'2.0.0', request: req as unknown as PersistWebsiteLiveInspectionInput['request'],
    status:'review_required', coverage:'partial', transportReceiptIds,
    reasonCodes, observations, receipt:receipt as unknown as PersistWebsiteLiveInspectionInput['receipt'],
    completedAt:top.completedAt as string, bodyIncluded:false,
    retentionTtlSeconds:top.retentionTtlSeconds as number, deletionRequired:true,
  };
}

/** Atomic parent+receipt+observation write; same-ID replay is content-addressed. */
export async function persistWebsiteLiveInspectionResult(
  pool: Pool, rawInput: PersistWebsiteLiveInspectionInput,
): Promise<{inspectionId:string; replayed:boolean}> {
  const input = snapshotWebsiteLiveInspection(rawInput);
  const r=input.request, receipt=input.receipt;
  const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return withPgTransaction(pool, async client=>{
    const inserted=await client.query<{id:string}>(
      `INSERT INTO website_live_inspection_runs (
        id,workspace_id,canonical_business_id,domain_verification_id,verified_domain,target_url,
        source_key,source_admission_decision_ref,source_policy_id,source_policy_version,
        transport_policy_id,transport_policy_version,max_response_bytes,timeout_ms,
        receipt_id,remote_ipv4,status_code,content_type,body_length,body_sha256,received_at,
        completed_at,status,coverage,reason_codes,payload_hash,retention_ttl_seconds,deletion_required
      ) VALUES (${Array.from({length:28},(_,i)=>'$'+(i+1)).join(',')})
      ON CONFLICT (id) DO NOTHING RETURNING id`, [
        r.inspectionId,r.workspaceId,r.canonicalBusinessId,r.domainVerificationId,
        r.verifiedDomain,r.targetUrl,r.sourceKey,r.sourceAdmissionDecisionRef,
        r.sourcePolicyId,r.sourcePolicyVersion,r.transportPolicyId,r.transportPolicyVersion,
        r.maxResponseBytes,r.timeoutMs,receipt.receiptId,receipt.remoteIpv4,receipt.status,
        receipt.contentType,receipt.bodyLength,receipt.bodySha256,receipt.receivedAt,
        input.completedAt,input.status,input.coverage,JSON.stringify(input.reasonCodes),digest,
        input.retentionTtlSeconds,input.deletionRequired,
      ]);
    if (inserted.rows.length===0) {
      const existing=await client.query<{workspace_id:string;payload_hash:string}>(
        'SELECT workspace_id,payload_hash FROM website_live_inspection_runs WHERE id = $1',[r.inspectionId]);
      if (existing.rows[0]?.workspace_id !== r.workspaceId || existing.rows[0]?.payload_hash!==digest) {
        throw new WebsiteLivePersistenceError('M04_LIVE_DB_ID_CONFLICT','Inspection replay mismatch.');
      }
      return {inspectionId:r.inspectionId,replayed:true};
    }
    for (const o of input.observations) await client.query(
      `INSERT INTO website_live_capability_observations (
        inspection_id,workspace_id,receipt_id,capability,observation,reason,confidence,evidence_reference_ids
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[
        r.inspectionId,r.workspaceId,o.observation==='unknown'?null:receipt.receiptId,
        o.capability,o.observation,o.reason,o.confidence,JSON.stringify(o.evidenceReferenceIds),
      ]);
    return {inspectionId:r.inspectionId,replayed:false};
  });
}

/** Caller must independently authorize RBAC; storage enforces workspace and deletion flag. */
export async function deleteWebsiteLiveInspectionEvidence(
  pool: Pool, scope: {workspaceId:string;inspectionId:string},
):Promise<boolean> {
  if (!uuid.test(scope.workspaceId) || !id.test(scope.inspectionId)) fail('Invalid deletion scope.');
  const result=await pool.query<{id:string}>(
    `DELETE FROM website_live_inspection_runs
     WHERE id=$1 AND workspace_id=$2 AND deletion_required=true RETURNING id`,
    [scope.inspectionId,scope.workspaceId]);
  return result.rows.length>0;
}

/** Deterministic, bounded expiry sweep; must be called by authorized maintenance job. */
export async function purgeExpiredWebsiteLiveInspectionEvidence(
  pool: Pool, workspaceId: string, maxRows = 100,
):Promise<number> {
  if (!uuid.test(workspaceId) || !numberBetween(maxRows,1,500)) fail('Invalid cleanup scope.');
  return withPgTransaction(pool,async client=>{
    const rows=await client.query<{id:string}>(
      `SELECT id FROM website_live_inspection_runs WHERE workspace_id=$1
       AND received_at + retention_ttl_seconds * interval '1 second' <= now()
       ORDER BY received_at,id LIMIT $2 FOR UPDATE SKIP LOCKED`,[workspaceId,maxRows]);
    if(!rows.rows.length)return 0;
    const ids=rows.rows.map(r=>r.id);
    const removed=await client.query<{id:string}>(
      'DELETE FROM website_live_inspection_runs WHERE workspace_id=$1 AND id=ANY($2::text[]) AND deletion_required=true RETURNING id',
      [workspaceId,ids]);
    return removed.rows.length;
  });
}