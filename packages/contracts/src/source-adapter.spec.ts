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

function fixture(): ConnectorAdmissionInput {
  const capability: SourceCapability = {
    sourceKey: 'source.company_sites',
    version: '1.0.0',
    sourceClass: 'company_first_party',
    accessMethods: ['first_party_web'],
    operations: ['fetch'],
    supportedFields: ['business.name', 'website.url', 'website.summary'],
    dataClassifications: ['PUBLIC_BUSINESS'],
    geography: {
      mode: 'global',
      countryCodes: [],
      supportsRadius: false,
      supportsPolygon: false,
      supportsAdministrativeAreas: true,
    },
    pagination: { mode: 'cursor', maxPageSize: 100, maxCursorLength: 128 },
    hardLimits: {
      maxRequests: 20,
      maxPages: 20,
      maxBytes: 1_000_000,
      maxCurrencyMicros: 20_000,
      maxRuntimeMs: 20_000,
      maxConcurrency: 2,
    },
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
    storage: {
      allowedClasses: ['EVIDENCE_MINIMAL'],
      defaultClass: 'EVIDENCE_MINIMAL',
      rawPayloadStorageAllowed: false,
      cacheTtlSeconds: 300,
      retentionTtlSeconds: 86_400,
      deletionRequired: true,
      refreshAfterSeconds: 3_600,
    },
    canonicalizationRule: 'independent_verification_required',
    attribution: { required: true, policyRef: 'attribution.company-sites.v1' },
    export: {
      mode: 'policy_filtered',
      allowedFields: ['business.name', 'website.url'],
      attributionRequired: true,
    },
    personalData: {
      allowed: false,
      allowedFields: [],
      requiresPurposeReview: false,
      exportAllowed: false,
    },
    geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
    robots: { mode: 'respect', barrierBypassProhibited: true },
    quotas: {
      maxRequests: 10,
      maxPages: 10,
      maxBytes: 500_000,
      maxCurrencyMicros: 10_000,
      maxRuntimeMs: 10_000,
      maxConcurrency: 1,
    },
    cost: { currency: 'USD', estimatedRequestMicros: 0 },
    credentials: {
      allowedModes: ['none'],
      secretLoggingProhibited: true,
      promptExposureProhibited: true,
    },
    fallback: { allowed: false, connectorKeys: [] },
    owner: 'platform.sources',
    reviewedAt: '2026-08-01T00:00:00.000Z',
    nextReviewAt: '2027-08-01T00:00:00.000Z',
  };

  const request: SourceRequestEnvelope = {
    version: '1.0.0',
    requestId: 'source-request-hardening-1',
    workspaceId: 'workspace-1',
    sourceTaskId: 'source-task-hardening-1',
    connectorKey: policy.connectorKey,
    connectorVersion: '1.0.0',
    sourceKey: capability.sourceKey,
    operation: 'fetch',
    executionIntent: 'execute',
    purpose: 'research.website',
    intendedUse: 'business.verification',
    requestedFields: ['business.name', 'website.url'],
    requestedDataClassifications: ['PUBLIC_BUSINESS'],
    geography: { countryCodes: ['TR'], areaRefs: [] },
    storageClass: 'EVIDENCE_MINIMAL',
    exportRequested: false,
    rawPayloadRequested: false,
    robotsDecision: 'allowed',
    targetUrl: 'https://example.com/',
    query: { categories: [], externalRefs: [], filters: {} },
    pagination: { pageSize: 25 },
    budget: {
      maxRequests: 5,
      maxPages: 5,
      maxBytes: 250_000,
      maxCurrencyMicros: 5_000,
      maxRuntimeMs: 5_000,
      maxConcurrency: 1,
    },
    policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
    requestedAt: '2026-09-01T10:00:00.000Z',
  };

  return {
    capability,
    policy,
    connector: {
      connectorKey: policy.connectorKey,
      version: '1.0.0',
      sourceKey: capability.sourceKey,
      capabilityVersion: capability.version,
      policyId: policy.policyId,
      policyVersion: policy.version,
      accessMethod: policy.accessMethod,
      credentialMode: 'none',
      status: 'approved',
      activation: 'enabled',
      implementationVersion: '1.0.0',
      owner: 'platform.sources',
      changeReason: 'M02 hardened adapter fixture.',
    },
    request,
    health: {
      connectorKey: policy.connectorKey,
      connectorVersion: '1.0.0',
      status: 'ready',
      observedAt: '2026-09-01T10:00:10.000Z',
      quotaRemaining: 10,
      rollingErrorRate: 0,
      p95LatencyMs: 100,
      reasonCodes: [],
    },
    evaluatedAt: '2026-09-01T10:00:20.000Z',
    maxHealthAgeSeconds: 300,
  };
}

function result(): SourceResultEnvelope {
  return {
    version: '1.0.0',
    requestId: 'source-request-hardening-1',
    workspaceId: 'workspace-1',
    sourceTaskId: 'source-task-hardening-1',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    sourceKey: 'source.company_sites',
    policySnapshot: { policyId: 'policy.source.company_sites', policyVersion: '1.0.0' },
    status: 'complete',
    sourceReferences: [
      {
        referenceId: 'source-ref-hardening-1',
        sourceKey: 'source.company_sites',
        connectorKey: 'connector.company_sites',
        connectorVersion: '1.0.0',
        url: 'https://example.com/',
        fetchedAt: '2026-09-01T10:00:21.000Z',
        attribution: 'Example company website',
      },
    ],
    candidates: [
      {
        candidateId: 'candidate-hardening-1',
        objectType: 'business',
        candidateState: 'unverified',
        fields: { 'business.name': 'Example', 'website.url': 'https://example.com/' },
        fieldNames: ['business.name', 'website.url'],
        dataClassifications: ['PUBLIC_BUSINESS'],
        storageClass: 'EVIDENCE_MINIMAL',
        sourceReferenceIds: ['source-ref-hardening-1'],
        observedAt: '2026-09-01T10:00:21.000Z',
      },
    ],
    rawPayloadRefs: [],
    usage: { requests: 1, pages: 1, bytes: 1_000, currencyMicros: 0, runtimeMs: 100 },
    coverage: { state: 'complete', returnedRecords: 1, estimatedTotalRecords: 1, notes: [] },
    errors: [],
    completedAt: '2026-09-01T10:00:22.000Z',
  };
}

describe('M02 hardened public source adapter boundary', () => {
  it('blocks export when requested fields exceed export rights', () => {
    const input = fixture();
    input.request.exportRequested = true;
    input.request.requestedFields = ['business.name', 'website.summary'];
    const decision = evaluateConnectorAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('source_export_field_not_allowed');
    expect(decision.exportAllowed).toBe(false);
  });

  it('blocks attribution-required sources whose capability cannot provide attribution', () => {
    const input = fixture();
    input.capability.supportsAttribution = false;
    const decision = evaluateConnectorAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('source_attribution_unsupported');
  });

  it('enforces capability-specific pagination limits', () => {
    const input = fixture();
    input.request.pagination.pageSize = 101;
    input.request.pagination.cursor = 'x'.repeat(129);
    const decision = evaluateConnectorAdmission(input);
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('source_page_size_exceeds_capability');
    expect(decision.reasonCodes).toContain('source_cursor_exceeds_capability');
  });

  it('rejects undeclared result fields and missing required attribution', () => {
    const input = fixture();
    const admission = evaluateConnectorAdmission(input);
    expect(admission.decision).toBe('allow');
    const unsafe = result();
    unsafe.candidates[0]!.fields['website.summary'] = 'undeclared';
    unsafe.sourceReferences[0]!.attribution = undefined;

    const validation = validateSourceResultAgainstAdmission({
      result: unsafe,
      request: input.request,
      capability: input.capability,
      policy: input.policy,
      admission,
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain('source_result_field_declaration_mismatch');
    expect(validation.issues).toContain('source_result_attribution_missing');
  });
});
