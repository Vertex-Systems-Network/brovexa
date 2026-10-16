import type { WebsiteInspectionRequest } from '@brovexa/contracts';
import type { WebsiteAuthorizedFixture } from './website-inspection-runtime';

/**
 * M04-WEB-005: exact-identity, read-only TEST fixture approval seam.
 * The lookup MUST read from a trusted workspace-scoped store, NOT the request.
 * No provider APIs, DNS, HTTP or real network execution are supported here.
 */
export interface WebsiteStoredFixtureDecision extends WebsiteAuthorizedFixture {
  inspectionId: string;
}

export interface WebsiteFixtureIdentityKey {
  readonly workspaceId: string;
  readonly inspectionId: string;
}

export type WebsiteFixtureDecisionLookup = (
  key: WebsiteFixtureIdentityKey,
) => Promise<WebsiteStoredFixtureDecision | null>;

export class WebsiteFixtureAuthorizationError extends Error {
  readonly code: 'M04_FIXTURE_LOOKUP_SCOPE_INVALID' | 'M04_FIXTURE_RECORD_NOT_FOUND' |
    'M04_FIXTURE_RECORD_INVALID';
  constructor(code: WebsiteFixtureAuthorizationError['code']) {
    super(code);
    this.code = code;
    this.name = 'WebsiteFixtureAuthorizationError';
  }
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

/**
 * WEB-015: a trusted lookup is still an asynchronous object boundary. An
 * adapter may accidentally return accessors or a mutable reused row.
 * Snapshot the EXACT approved fields once without executing user getters.
 * Never read the lookup record again after the snapshot is constructed.
 */
function snapshotStoredDecision(value: unknown): WebsiteStoredFixtureDecision {
  const invalid = (): never => {
    throw new WebsiteFixtureAuthorizationError('M04_FIXTURE_RECORD_INVALID');
  };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
  const own = (object: object, field: string): unknown => {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(object, field); }
    catch { return invalid(); }
    if (!descriptor || !('value' in descriptor)) invalid();
    return descriptor.value;
  };
  const ids = own(value, 'domainEvidenceIds');
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 32) invalid();
  const evidence: unknown[] = [];
  for (let i = 0; i < ids.length; i++) evidence.push(own(ids, String(i)));
  const pinned: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const field of [
    'decision', 'transportKind', 'workspaceId', 'inspectionId',
    'canonicalBusinessId', 'verifiedDomain', 'verificationId',
    'sourceKey', 'sourceAdmissionDecisionRef', 'sourcePolicyId',
    'sourcePolicyVersion', 'transportPolicyId', 'transportPolicyVersion',
    'canonicalUrl', 'receiptId', 'fixtureBodySha256', 'fixtureStatus',
    'fixtureContentType', 'fixtureByteLength', 'maxResponseBytes',
    'timeoutMs', 'expiresAt',
  ] as const) pinned[field] = own(value, field);
  pinned.domainEvidenceIds = Object.freeze(evidence);
  return Object.freeze(pinned) as unknown as WebsiteStoredFixtureDecision;
}

/**
 * Never accept any approval field from the claimed request as the source of
 * truth. Compare the entire independent read to the frozen request and return
 * a new allow-listed approval snapshot. Runtime verifies dates, digest, limits.
 */
export function createWebsiteStoredFixtureAuthorizer(lookup: WebsiteFixtureDecisionLookup):
  (request: WebsiteInspectionRequest) => Promise<WebsiteAuthorizedFixture> {
  return async (request) => {
    if (!request || !identifier.test(request.inspectionId) ||
        !identifier.test(request.workspaceId) ||
        request.executionMode !== 'test_only' || request.networkRequested !== false ||
        request.credentialedFetchRequested !== false || request.outreachRequested !== false ||
        request.rawPayloadRequested !== false || request.sourceAdmissionDecision !== 'allow') {
      throw new WebsiteFixtureAuthorizationError('M04_FIXTURE_LOOKUP_SCOPE_INVALID');
    }
    // Snapshot all claimed identifiers BEFORE awaited store access. Do not let a
    // caller mutate the comparison target while the trusted lookup is pending.
    const expected = {
      canonicalBusinessId: request.canonicalBusinessId,
      verifiedDomain: request.verifiedDomain,
      verificationId: request.domainVerification.verificationId,
      domainEvidenceIds: [...request.domainVerification.evidenceIds],
      sourceKey: request.sourceKey,
      sourceAdmissionDecisionRef: request.sourceAdmissionDecisionRef,
      sourcePolicyId: request.sourcePolicySnapshot.policyId,
      sourcePolicyVersion: request.sourcePolicySnapshot.policyVersion,
      transportPolicyId: request.transportPolicyId,
      transportPolicyVersion: request.transportPolicyVersion,
      canonicalUrl: request.targetUrl,
    };
    const key = Object.freeze({ workspaceId: request.workspaceId, inspectionId: request.inspectionId });
    const stored = await lookup(key);
    if (!stored) throw new WebsiteFixtureAuthorizationError('M04_FIXTURE_RECORD_NOT_FOUND');
    const r = snapshotStoredDecision(stored);
    const verified = r.inspectionId === key.inspectionId &&
      r.workspaceId === key.workspaceId &&
      r.decision === 'allow' && r.transportKind === 'test' &&
      r.canonicalBusinessId === expected.canonicalBusinessId &&
      r.verifiedDomain === expected.verifiedDomain &&
      r.verificationId === expected.verificationId &&
      Array.isArray(r.domainEvidenceIds) &&
      r.domainEvidenceIds.length === expected.domainEvidenceIds.length &&
      new Set(r.domainEvidenceIds).size === r.domainEvidenceIds.length &&
      r.domainEvidenceIds.every(v => expected.domainEvidenceIds.includes(v)) &&
      r.sourceKey === expected.sourceKey &&
      r.sourceAdmissionDecisionRef === expected.sourceAdmissionDecisionRef &&
      r.sourcePolicyId === expected.sourcePolicyId &&
      r.sourcePolicyVersion === expected.sourcePolicyVersion &&
      r.transportPolicyId === expected.transportPolicyId &&
      r.transportPolicyVersion === expected.transportPolicyVersion &&
      r.canonicalUrl === expected.canonicalUrl;
    if (!verified) throw new WebsiteFixtureAuthorizationError('M04_FIXTURE_RECORD_INVALID');
    return {
      decision: 'allow', transportKind: 'test',
      workspaceId: r.workspaceId, inspectionId: r.inspectionId,
      canonicalBusinessId: r.canonicalBusinessId,
      verifiedDomain: r.verifiedDomain, verificationId: r.verificationId,
      domainEvidenceIds: [...r.domainEvidenceIds],
      sourceKey: r.sourceKey, sourceAdmissionDecisionRef: r.sourceAdmissionDecisionRef,
      sourcePolicyId: r.sourcePolicyId, sourcePolicyVersion: r.sourcePolicyVersion,
      transportPolicyId: r.transportPolicyId, transportPolicyVersion: r.transportPolicyVersion,
      canonicalUrl: r.canonicalUrl, receiptId: r.receiptId,
      fixtureBodySha256: r.fixtureBodySha256, fixtureStatus: r.fixtureStatus,
      fixtureContentType: r.fixtureContentType, fixtureByteLength: r.fixtureByteLength,
      maxResponseBytes: r.maxResponseBytes, timeoutMs: r.timeoutMs,
      expiresAt: r.expiresAt,
    };
  };
}