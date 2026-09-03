import { describe, expect, it } from 'vitest';
import {
  evaluateConnectorAdmission,
  validateSourceResultAgainstAdmission,
  type ConnectorAdmissionInput,
  type ConnectorPolicy,
  type SourceCapability,
  type SourceRequestEnvelope,
  type SourceResultEnvelope,
} from './source-adapter';

function flow(): ConnectorAdmissionInput {
  const capability: SourceCapability = {
    sourceKey: 'source.company_sites',
    version: '1.0.0',
    sourceClass: 'company_first_party',
    accessMethods: ['first_party_web'],
    operations: ['fetch'],
    supportedFields: ['business.name', 'website.url'],
    dataClassifications: ['PUBLIC_BUSINESS'],
    geography: { mode: 'global', countryCodes: [], supportsRadius: false, supportsPolygon: false, supportsAdministrativeAreas: true },
    pagination: { mode: 'cursor', maxPageSize: 100, maxCursorLength: 128 },
    hardLimits: { maxRequests: 10, maxPages: 10, maxBytes: 100_000, maxCurrencyMicros: 10_000, maxRuntimeMs: 10_000, maxConcurrency: 1 },
    supportsAttribution: true,
    supportsDeletion: true,
    supportsRefresh: true,
    supportsRawPayloadReference: false,
  };
  const policy: ConnectorPolicy = {
    policyId: 'policy.source.company_sites',
    version: '1.0.0',
    sourceKey: capability.sourceKey,
    connectorKey: 'connector.company_sites',
    state: 'APPROVED_WITH_LIMITS',
    accessMethod: 'first_party_web',
    policyLicenseRef: 'policy-ref.company-sites.v1',
    policyLicenseVersion: '1.0.0',
    allowedPurposes: ['research.website'],
    prohibitedPurposes: [],
    allowedFields: capability.supportedFields,
    allowedDataClassifications: ['PUBLIC_BUSINESS'],
    storage: { allowedClasses: ['EVIDENCE_MINIMAL'], defaultClass: 'EVIDENCE_MINIMAL', rawPayloadStorageAllowed: false, cacheTtlSeconds: 300, retentionTtlSeconds: 86_400, deletionRequired: true, refreshAfterSeconds: 3600 },
    canonicalizationRule: 'independent_verification_required',
    attribution: { required: true, policyRef: 'attribution.company-sites.v1' },
    export: { mode: 'policy_filtered', allowedFields: ['business.name', 'website.url'], attributionRequired: true },
    personalData: { allowed: false, allowedFields: [], requiresPurposeReview: false, exportAllowed: false },
    geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
    robots: { mode: 'respect', barrierBypassProhibited: true },
    quotas: { maxRequests: 5, maxPages: 5, maxBytes: 50_000, maxCurrencyMicros: 5_000, maxRuntimeMs: 5_000, maxConcurrency: 1 },
    cost: { currency: 'USD', estimatedRequestMicros: 100 },
    credentials: { allowedModes: ['none'], secretLoggingProhibited: true, promptExposureProhibited: true },
    fallback: { allowed: false, connectorKeys: [] },
    owner: 'platform.sources',
    reviewedAt: '2026-08-01T00:00:00.000Z',
    nextReviewAt: '2027-08-01T00:00:00.000Z',
  };
  const request: SourceRequestEnvelope = {
    version: '1.0.0',
    requestId: 'source-request-e2e-1',
    workspaceId: 'workspace-e2e-1',
    sourceTaskId: 'source-task-e2e-1',
    connectorKey: policy.connectorKey,
    connectorVersion: '1.0.0',
    sourceKey: capability.sourceKey,
    operation: 'fetch',
    executionIntent: 'execute',
    purpose: 'research.website',
    intendedUse: 'business.discovery',
    requestedFields: ['business.name', 'website.url'],
    requestedDataClassifications: ['PUBLIC_BUSINESS'],
    geography: { countryCodes: ['TR'], areaRefs: ['TR.34'] },
    storageClass: 'EVIDENCE_MINIMAL',
    exportRequested: false,
    rawPayloadRequested: false,
    robotsDecision: 'allowed',
    targetUrl: 'https://example.com/',
    query: { categories: ['dentist'], externalRefs: [], filters: { locality: 'Istanbul' } },
    pagination: { pageSize: 25 },
    budget: { maxRequests: 3, maxPages: 3, maxBytes: 25_000, maxCurrencyMicros: 1_000, maxRuntimeMs: 3_000, maxConcurrency: 1 },
    policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
    requestedAt: '2026-09-04T00:00:00.000Z',
  };
  return {
    capability,
    policy,
    connector: { connectorKey: policy.connectorKey, version: '1.0.0', sourceKey: capability.sourceKey, capabilityVersion: capability.version, policyId: policy.policyId, policyVersion: policy.version, accessMethod: policy.accessMethod, credentialMode: 'none', status: 'approved', activation: 'enabled', implementationVersion: '1.0.0', owner: 'platform.sources', changeReason: 'M02 E2E verification fixture.' },
    request,
    health: { connectorKey: policy.connectorKey, connectorVersion: '1.0.0', status: 'ready', observedAt: '2026-09-04T00:00:01.000Z', quotaRemaining: 5, rollingErrorRate: 0, p95LatencyMs: 50, reasonCodes: [] },
    evaluatedAt: '2026-09-04T00:00:02.000Z',
    maxHealthAgeSeconds: 300,
  };
}

function result(): SourceResultEnvelope {
  return {
    version: '1.0.0',
    requestId: 'source-request-e2e-1',
    workspaceId: 'workspace-e2e-1',
    sourceTaskId: 'source-task-e2e-1',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    sourceKey: 'source.company_sites',
    policySnapshot: { policyId: 'policy.source.company_sites', policyVersion: '1.0.0' },
    status: 'complete',
    sourceReferences: [{ referenceId: 'source-ref-e2e-1', sourceKey: 'source.company_sites', connectorKey: 'connector.company_sites', connectorVersion: '1.0.0', url: 'https://example.com/', fetchedAt: '2026-09-04T00:00:03.000Z', attribution: 'Example company website' }],
    candidates: [{ candidateId: 'candidate-e2e-1', objectType: 'business', candidateState: 'unverified', fields: { 'business.name': 'Example Dental', 'website.url': 'https://example.com/' }, fieldNames: ['business.name', 'website.url'], dataClassifications: ['PUBLIC_BUSINESS'], storageClass: 'EVIDENCE_MINIMAL', sourceReferenceIds: ['source-ref-e2e-1'], observedAt: '2026-09-04T00:00:03.000Z' }],
    rawPayloadRefs: [],
    usage: { requests: 1, pages: 1, bytes: 1200, currencyMicros: 100, runtimeMs: 90 },
    coverage: { state: 'complete', returnedRecords: 1, estimatedTotalRecords: 1, notes: [] },
    errors: [],
    completedAt: '2026-09-04T00:00:04.000Z',
  };
}

describe('M02 source execution end-to-end evidence boundary', () => {
  it('admits a bounded geography+niche request and accepts only provenance-linked unverified evidence', () => {
    const input = flow();
    const admission = evaluateConnectorAdmission(input);
    expect(admission.decision).toBe('allow');
    const output = result();
    expect(output.candidates[0]?.candidateState).toBe('unverified');
    expect(output.usage).toMatchObject({ requests: 1, pages: 1, currencyMicros: 100 });
    expect(validateSourceResultAgainstAdmission({ result: output, request: input.request, capability: input.capability, policy: input.policy, admission })).toEqual({ valid: true, issues: [] });
  });

  it('rejects policy drift, missing provenance and canonical-by-ingestion claims', () => {
    const input = flow();
    const admission = evaluateConnectorAdmission(input);
    expect(admission.decision).toBe('allow');

    const policyDrift = result();
    policyDrift.policySnapshot = { policyId: input.policy.policyId, policyVersion: '2.0.0' };
    expect(validateSourceResultAgainstAdmission({ result: policyDrift, request: input.request, capability: input.capability, policy: input.policy, admission }).valid).toBe(false);

    const missingProvenance = result();
    missingProvenance.candidates[0]!.sourceReferenceIds = [];
    expect(validateSourceResultAgainstAdmission({ result: missingProvenance, request: input.request, capability: input.capability, policy: input.policy, admission }).valid).toBe(false);

    const canonicalClaim = result();
    canonicalClaim.candidates[0]!.candidateState = 'verified' as never;
    expect(validateSourceResultAgainstAdmission({ result: canonicalClaim, request: input.request, capability: input.capability, policy: input.policy, admission }).valid).toBe(false);
  });

  it('blocks requests whose declared budget exceeds policy quota', () => {
    const input = flow();
    input.request.budget.maxRequests = 6;
    const admission = evaluateConnectorAdmission(input);
    expect(admission.decision).toBe('blocked');
    expect(admission.reasonCodes.length).toBeGreaterThan(0);
  });
});
