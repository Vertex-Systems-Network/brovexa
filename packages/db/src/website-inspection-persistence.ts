import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { withPgTransaction } from './client';

type Capability = 'booking' | 'commerce' | 'contact_form' | 'business_contact' |
  'mobile_viewport' | 'structured_data' | 'social_link' | 'https';
type Observation = 'observed_present' | 'not_detected' | 'unknown';

export interface PersistWebsiteInspectionInput {
  version: '1.0.0';
  request: {
    version: '1.0.0';
    inspectionId: string;
    workspaceId: string;
    canonicalBusinessId: string;
    verifiedDomain: string;
    domainVerification: { verificationId: string; decision: 'verified'; evidenceIds: readonly string[] };
    targetUrl: string;
    sourceKey: string;
    sourceAdmissionDecisionRef: string;
    sourceAdmissionDecision: 'allow';
    sourcePolicySnapshot: { policyId: string; policyVersion: string };
    transportPolicyId: string;
    transportPolicyVersion: string;
    limits: { maxPages: number; maxResponseBytes: number; timeoutMs: number };
    executionMode: 'test_only';
    networkRequested: false;
    credentialedFetchRequested: false;
    rawPayloadRequested: false;
    outreachRequested: false;
    requestedAt: string;
  };
  status: 'assessed' | 'review_required' | 'unavailable';
  coverage: 'none' | 'partial' | 'bounded';
  transportReceiptIds: readonly string[];
  reasonCodes: readonly string[];
  observations: readonly {
    capability: Capability;
    observation: Observation;
    reason: 'detected' | 'not_detected_with_bounded_coverage' | 'insufficient_evidence';
    confidence: number | null;
    evidenceReferenceIds: readonly string[];
    transportReceiptIds: readonly string[];
  }[];
  completedAt: string;
  bodyIncluded: false;
  retentionTtlSeconds: number | null;
  deletionRequired: boolean;
}

export class WebsiteInspectionPersistenceError extends Error {
  constructor(
    readonly code: 'WEBSITE_INSPECTION_INPUT_INVALID' | 'WEBSITE_INSPECTION_ID_CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'WebsiteInspectionPersistenceError';
  }
}

const id = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const version = /^\d+\.\d+\.\d+$/;
const capabilities = new Set<Capability>([
  'booking', 'commerce', 'contact_form', 'business_contact',
  'mobile_viewport', 'structured_data', 'social_link', 'https',
]);
function invalid(message: string): never {
  throw new WebsiteInspectionPersistenceError('WEBSITE_INSPECTION_INPUT_INVALID', message);
}
function ids(values: readonly string[], max: number, min = 0): boolean {
  return Array.isArray(values) && values.length >= min && values.length <= max &&
    values.every((v) => typeof v === 'string' && id.test(v)) &&
    new Set(values).size === values.length;
}

function validate(input: PersistWebsiteInspectionInput): void {
  if (!input || !input.request || input.version !== '1.0.0' ||
      input.request.version !== '1.0.0') invalid('Invalid website evidence version.');
  const r = input.request;
  if (!id.test(r.inspectionId) || !uuid.test(r.workspaceId) ||
      !id.test(r.canonicalBusinessId) || !r.domainVerification ||
      !id.test(r.domainVerification.verificationId) ||
      r.domainVerification.decision !== 'verified' ||
      !ids(r.domainVerification.evidenceIds, 32, 1)) {
    invalid('Website inspection requires verified tenant-bound identity.');
  }
  if (!domain.test(r.verifiedDomain) ||
      /^[0-9]+(?:\.[0-9]+){3}$/.test(r.verifiedDomain) ||
      /\.(?:localhost|local|internal|invalid|test)$/.test(r.verifiedDomain) ||
      r.targetUrl !== 'https://' + r.verifiedDomain + '/') {
    invalid('Website inspection requires the exact verified canonical HTTPS root.');
  }
  if (!/^source\.[a-z0-9_.-]+$/.test(r.sourceKey) ||
      !id.test(r.sourceAdmissionDecisionRef) || r.sourceAdmissionDecision !== 'allow' ||
      !r.sourcePolicySnapshot || !id.test(r.sourcePolicySnapshot.policyId) ||
      !version.test(r.sourcePolicySnapshot.policyVersion) ||
      !id.test(r.transportPolicyId) || !version.test(r.transportPolicyVersion) ||
      r.executionMode !== 'test_only' || r.networkRequested !== false ||
      r.credentialedFetchRequested !== false || r.rawPayloadRequested !== false ||
      r.outreachRequested !== false || input.bodyIncluded !== false ||
      !r.limits || !Number.isSafeInteger(r.limits.maxPages) ||
      r.limits.maxPages < 1 || r.limits.maxPages > 5 ||
      !Number.isSafeInteger(r.limits.maxResponseBytes) ||
      r.limits.maxResponseBytes < 1 || r.limits.maxResponseBytes > 1_000_000 ||
      !Number.isSafeInteger(r.limits.timeoutMs) ||
      r.limits.timeoutMs < 100 || r.limits.timeoutMs > 30_000) {
    invalid('Website evidence must preserve approved test-only no-body policy.');
  }
  const start = Date.parse(r.requestedAt);
  const end = Date.parse(input.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start ||
      input.deletionRequired !== true ||
      !Number.isSafeInteger(input.retentionTtlSeconds) ||
      input.retentionTtlSeconds === null ||
      input.retentionTtlSeconds < 1 || input.retentionTtlSeconds > 31_536_000) {
    invalid('Invalid timestamps or retention/deletion policy.');
  }
  if (!ids(input.transportReceiptIds, 5) || !ids(input.reasonCodes, 16) ||
      !Array.isArray(input.observations) || input.observations.length > 8) {
    invalid('Excessive or duplicate inspection evidence.');
  }
  const receipts = new Set(input.transportReceiptIds);
  const seen = new Set<Capability>();
  for (const o of input.observations) {
    if (!o || !capabilities.has(o.capability) || seen.has(o.capability) ||
        !ids(o.evidenceReferenceIds, 32) || !ids(o.transportReceiptIds, 5) ||
        o.transportReceiptIds.some((v: string) => !receipts.has(v))) {
      invalid('Malformed or foreign capability evidence.');
    }
    seen.add(o.capability);
    if (o.observation === 'unknown') {
      if (o.reason !== 'insufficient_evidence' || o.confidence !== null ||
          o.evidenceReferenceIds.length || o.transportReceiptIds.length) {
        invalid('Unknown capability cannot claim evidence.');
      }
    } else if (
      (o.observation !== 'observed_present' && o.observation !== 'not_detected') ||
      o.reason !== (o.observation === 'observed_present'
        ? 'detected' : 'not_detected_with_bounded_coverage') ||
      o.confidence === null || !Number.isFinite(o.confidence) ||
      o.confidence < 0 || o.confidence > 1 ||
      !o.evidenceReferenceIds.length || !o.transportReceiptIds.length ||
      (o.observation === 'not_detected' && input.coverage !== 'bounded')
    ) {
      invalid('Capability claim requires bounded evidence and explicit confidence.');
    }
  }
  if (!(['assessed','review_required','unavailable'] as string[]).includes(input.status) ||
      !(['none','partial','bounded'] as string[]).includes(input.coverage) ||
      (input.coverage === 'none' &&
        (input.transportReceiptIds.length > 0 ||
         input.observations.some((o) => o.observation !== 'unknown'))) ||
      (input.coverage !== 'none' && input.transportReceiptIds.length === 0) ||
      (input.status === 'assessed' &&
        (input.coverage !== 'bounded' || input.reasonCodes.length > 0 ||
         input.observations.length === 0 ||
         input.observations.some((o) => o.observation === 'unknown'))) ||
      (input.status === 'unavailable' &&
        (input.coverage !== 'none' || input.reasonCodes.length === 0)) ||
      (input.status === 'review_required' && input.coverage === 'bounded' &&
        input.reasonCodes.length === 0 && input.observations.length > 0 &&
        input.observations.every((o) => o.observation !== 'unknown'))) {
    invalid('Inspection status contradicts coverage or provenance.');
  }
}

/** Atomic, immutable, workspace-scoped write with deterministic replay guard. */
export async function persistWebsiteInspectionResult(
  pool: Pool,
  input: PersistWebsiteInspectionInput,
): Promise<{ inspectionId: string; replayed: boolean }> {
  validate(input);
  const r = input.request;
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return withPgTransaction(pool, async (client) => {
    const inserted = await client.query<{ id: string }>(
      'INSERT INTO website_inspection_runs (id,workspace_id,canonical_business_id,domain_verification_id,verified_domain,target_url,source_key,source_admission_decision_ref,source_policy_id,source_policy_version,transport_policy_id,transport_policy_version,max_pages,max_response_bytes,timeout_ms,status,coverage,transport_receipt_ids,reason_codes,payload_hash,retention_ttl_seconds,deletion_required,requested_at,completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) ON CONFLICT (id) DO NOTHING RETURNING id',
      [
        r.inspectionId, r.workspaceId, r.canonicalBusinessId,
        r.domainVerification.verificationId, r.verifiedDomain, r.targetUrl,
        r.sourceKey, r.sourceAdmissionDecisionRef,
        r.sourcePolicySnapshot.policyId, r.sourcePolicySnapshot.policyVersion,
        r.transportPolicyId, r.transportPolicyVersion,
        r.limits.maxPages, r.limits.maxResponseBytes, r.limits.timeoutMs,
        input.status, input.coverage,
        JSON.stringify(input.transportReceiptIds), JSON.stringify(input.reasonCodes),
        hash, input.retentionTtlSeconds, input.deletionRequired,
        r.requestedAt, input.completedAt,
      ],
    );
    if (inserted.rows.length === 0) {
      const existing = await client.query<{ workspace_id: string; payload_hash: string }>(
        'SELECT workspace_id, payload_hash FROM website_inspection_runs WHERE id = $1',
        [r.inspectionId],
      );
      if (existing.rows[0]?.workspace_id !== r.workspaceId ||
          existing.rows[0]?.payload_hash !== hash) {
        throw new WebsiteInspectionPersistenceError('WEBSITE_INSPECTION_ID_CONFLICT',
          'Inspection ID exists with different evidence or tenant.');
      }
      return { inspectionId: r.inspectionId, replayed: true };
    }
    for (const o of input.observations) {
      await client.query(
        'INSERT INTO website_capability_observations (inspection_id,workspace_id,coverage,capability,observation,reason,confidence,evidence_reference_ids,transport_receipt_ids) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          r.inspectionId, r.workspaceId, input.coverage, o.capability,
          o.observation, o.reason, o.confidence,
          JSON.stringify(o.evidenceReferenceIds), JSON.stringify(o.transportReceiptIds),
        ],
      );
    }
    return { inspectionId: r.inspectionId, replayed: false };
  });
}

/** Caller authorizes workspace RBAC; storage enforces workspace and deletionRequired. */
export async function deleteWebsiteInspectionEvidence(
  pool: Pool,
  input: { inspectionId: string; workspaceId: string },
): Promise<boolean> {
  if (!id.test(input.inspectionId) || !uuid.test(input.workspaceId)) invalid('Invalid deletion scope.');
  const row = await pool.query<{ id: string }>(
    'DELETE FROM website_inspection_runs WHERE id = $1 AND workspace_id = $2 AND deletion_required = true RETURNING id',
    [input.inspectionId, input.workspaceId],
  );
  return row.rows.length > 0;
}
