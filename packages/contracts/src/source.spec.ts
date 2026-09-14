import { describe, expect, it } from 'vitest';
import {
  ConnectorAdmissionInputSchema,
  ConnectorDefinitionSchema,
  ConnectorPolicySchema,
  SourceCapabilitySchema,
  SourceResultEnvelopeSchema,
  evaluateConnectorAdmission,
  validateSourceResultAgainstAdmission,
  type ConnectorAdmissionInput,
  type ConnectorDefinition,
  type ConnectorHealthSnapshot,
  type ConnectorPolicy,
  type SourceCapability,
  type SourceRequestEnvelope,
  type SourceResultEnvelope,
} from './source';

const evaluatedAt = '2026-09-01T10:00:00.000Z';

function capability(overrides: Partial<SourceCapability> = {}): SourceCapability {
  return {
    sourceKey: 'source.company_sites',
    version: '1.0.0',
    sourceClass: 'company_first_party',
    accessMethods: ['first_party_web'],
    operations: ['fetch', 'detail'],
    supportedFields: ['business.name', 'website.url', 'website.summary', 'contact.generic_email'],
    dataClassifications: ['PUBLIC_BUSINESS', 'PERSONAL_BUSINESS_CONTACT'],
    geography: {
      mode: 'global',
      countryCodes: [],
      supportsRadius: false,
      supportsPolygon: false,
      supportsAdministrativeAreas: true,
    },
    pagination: { mode: 'cursor', maxPageSize: 100, maxCursorLength: 512 },
    hardLimits: {
      maxRequests: 100,
      maxPages: 100,
      maxBytes: 5_000_000,
      maxCurrencyMicros: 100_000,
      maxRuntimeMs: 60_000,
      maxConcurrency: 4,
    },
    supportsAttribution: true,
    supportsDeletion: true,
    supportsRefresh: true,
    supportsRawPayloadReference: false,
    ...overrides,
  };
}

function policy(overrides: Partial<ConnectorPolicy> = {}): ConnectorPolicy {
  const base: ConnectorPolicy = {
    policyId: 'policy.source.company_sites',
    version: '1.0.0',
    sourceKey: 'source.company_sites',
    connectorKey: 'connector.company_sites',
    state: 'APPROVED_WITH_LIMITS',
    accessMethod: 'first_party_web',
    policyLicenseRef: 'policy-ref.company-sites.v1',
    policyLicenseVersion: '1.0.0',
    allowedPurposes: ['research.website', 'research.discovery'],
    prohibitedPurposes: ['bulk.redistribution'],
    allowedFields: ['business.name', 'website.url', 'website.summary', 'contact.generic_email'],
    allowedDataClassifications: ['PUBLIC_BUSINESS', 'PERSONAL_BUSINESS_CONTACT'],
    storage: {
      allowedClasses: ['TRANSIENT', 'REFERENCE_ONLY', 'EVIDENCE_MINIMAL'],
      defaultClass: 'EVIDENCE_MINIMAL',
      rawPayloadStorageAllowed: false,
      cacheTtlSeconds: 3_600,
      retentionTtlSeconds: 2_592_000,
      deletionRequired: true,
      refreshAfterSeconds: 604_800,
    },
    canonicalizationRule: 'independent_verification_required',
    attribution: { required: true, policyRef: 'attribution.company-sites.v1' },
    export: {
      mode: 'policy_filtered',
      allowedFields: ['business.name', 'website.url'],
      attributionRequired: true,
    },
    personalData: {
      allowed: true,
      allowedFields: ['contact.generic_email'],
      requiresPurposeReview: false,
      exportAllowed: false,
    },
    geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
    robots: { mode: 'respect', barrierBypassProhibited: true },
    quotas: {
      maxRequests: 50,
      maxPages: 50,
      maxBytes: 2_000_000,
      maxCurrencyMicros: 50_000,
      maxRuntimeMs: 30_000,
      maxConcurrency: 2,
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
  return {
    ...base,
    ...overrides,
    storage: { ...base.storage, ...(overrides.storage ?? {}) },
    attribution: { ...base.attribution, ...(overrides.attribution ?? {}) },
    export: { ...base.export, ...(overrides.export ?? {}) },
    personalData: { ...base.personalData, ...(overrides.personalData ?? {}) },
    geography: { ...base.geography, ...(overrides.geography ?? {}) },
    robots: { ...base.robots, ...(overrides.robots ?? {}) },
    quotas: { ...base.quotas, ...(overrides.quotas ?? {}) },
    cost: { ...base.cost, ...(overrides.cost ?? {}) },
    credentials: { ...base.credentials, ...(overrides.credentials ?? {}) },
    fallback: { ...base.fallback, ...(overrides.fallback ?? {}) },
  };
}

function connector(overrides: Partial<ConnectorDefinition> = {}): ConnectorDefinition {
  return {
    connectorKey: 'connector.company_sites',
    version: '1.0.0',
    sourceKey: 'source.company_sites',
    capabilityVersion: '1.0.0',
    policyId: 'policy.source.company_sites',
    policyVersion: '1.0.0',
    accessMethod: 'first_party_web',
    credentialMode: 'none',
    status: 'approved',
    activation: 'enabled',
    implementationVersion: '1.0.0',
    owner: 'platform.sources',
    changeReason: 'Source adapter foundation verification fixture.',
    ...overrides,
  };
}

function request(overrides: Partial<SourceRequestEnvelope> = {}): SourceRequestEnvelope {
  const base: SourceRequestEnvelope = {
    version: '1.0.0',
    requestId: 'source-request-1',
    workspaceId: 'workspace-1',
    researchJobId: 'research-job-1',
    researchRunId: 'research-run-1',
    workUnitId: 'work-unit-1',
    sourceTaskId: 'source-task-1',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    sourceKey: 'source.company_sites',
    operation: 'fetch',
    executionIntent: 'execute',
    purpose: 'research.website',
    intendedUse: 'business.verification',
    requestedFields: ['business.name', 'website.url'],
    requestedDataClassifications: ['PUBLIC_BUSINESS'],
    geography: { countryCodes: ['TR'], areaRefs: ['geo.tr.antalya'] },
    storageClass: 'EVIDENCE_MINIMAL',
    exportRequested: false,
    rawPayloadRequested: false,
    robotsDecision: 'allowed',
    targetUrl: 'https://example.com/',
    query: { text: 'Example business', categories: [], externalRefs: [], filters: {} },
    pagination: { pageSize: 25 },
    budget: {
      maxRequests: 10,
      maxPages: 10,
      maxBytes: 500_000,
      maxCurrencyMicros: 5_000,
      maxRuntimeMs: 10_000,
      maxConcurrency: 1,
    },
    policySnapshot: { policyId: 'policy.source.company_sites', policyVersion: '1.0.0' },
    requestedAt: '2026-09-01T09:59:00.000Z',
  };
  return {
    ...base,
    ...overrides,
    geography: { ...base.geography, ...(overrides.geography ?? {}) },
    query: { ...base.query, ...(overrides.query ?? {}) },
    pagination: { ...base.pagination, ...(overrides.pagination ?? {}) },
    budget: { ...base.budget, ...(overrides.budget ?? {}) },
    policySnapshot: { ...base.policySnapshot, ...(overrides.policySnapshot ?? {}) },
  };
}

function health(overrides: Partial<ConnectorHealthSnapshot> = {}): ConnectorHealthSnapshot {
  return {
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    status: 'ready',
    observedAt: '2026-09-01T09:59:30.000Z',
    quotaRemaining: 100,
    rollingErrorRate: 0,
    p95LatencyMs: 120,
    reasonCodes: [],
    ...overrides,
  };
}

function admissionInput(overrides: Partial<ConnectorAdmissionInput> = {}): ConnectorAdmissionInput {
  return {
    capability: capability(),
    policy: policy(),
    connector: connector(),
    request: request(),
    health: health(),
    evaluatedAt,
    maxHealthAgeSeconds: 300,
    ...overrides,
  };
}

function result(overrides: Partial<SourceResultEnvelope> = {}): SourceResultEnvelope {
  const base: SourceResultEnvelope = {
    version: '1.0.0',
    requestId: 'source-request-1',
    workspaceId: 'workspace-1',
    sourceTaskId: 'source-task-1',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    sourceKey: 'source.company_sites',
    policySnapshot: { policyId: 'policy.source.company_sites', policyVersion: '1.0.0' },
    status: 'complete',
    sourceReferences: [
      {
        referenceId: 'source-ref-1',
        sourceKey: 'source.company_sites',
        connectorKey: 'connector.company_sites',
        connectorVersion: '1.0.0',
        externalId: 'example-homepage',
        url: 'https://example.com/',
        fetchedAt: '2026-09-01T10:00:01.000Z',
        contentHash: 'a'.repeat(64),
        attribution: 'Example company website',
      },
    ],
    candidates: [
      {
        candidateId: 'candidate-1',
        objectType: 'business',
        candidateState: 'unverified',
        fields: { 'business.name': 'Example', 'website.url': 'https://example.com/' },
        fieldNames: ['business.name', 'website.url'],
        dataClassifications: ['PUBLIC_BUSINESS'],
        storageClass: 'EVIDENCE_MINIMAL',
        sourceReferenceIds: ['source-ref-1'],
        observedAt: '2026-09-01T10:00:01.000Z',
      },
    ],
    rawPayloadRefs: [],
    usage: { requests: 1, pages: 1, bytes: 10_000, currencyMicros: 0, runtimeMs: 200 },
    coverage: { state: 'complete', returnedRecords: 1, estimatedTotalRecords: 1, notes: [] },
    errors: [],
    completedAt: '2026-09-01T10:00:02.000Z',
  };
  return {
    ...base,
    ...overrides,
    policySnapshot: { ...base.policySnapshot, ...(overrides.policySnapshot ?? {}) },
    usage: { ...base.usage, ...(overrides.usage ?? {}) },
    coverage: { ...base.coverage, ...(overrides.coverage ?? {}) },
  };
}

describe('M02 source contracts', () => {
  it('accepts bounded source capability, connector policy and definition contracts', () => {
    expect(SourceCapabilitySchema.parse(capability()).sourceClass).toBe('company_first_party');
    expect(ConnectorPolicySchema.parse(policy()).state).toBe('APPROVED_WITH_LIMITS');
    expect(ConnectorDefinitionSchema.parse(connector()).activation).toBe('enabled');
  });

  it('rejects transient-only policy that claims durable source-content rights', () => {
    expect(
      ConnectorPolicySchema.safeParse(
        policy({
          state: 'TRANSIENT_ONLY',
          storage: {
            ...policy().storage,
            allowedClasses: ['TRANSIENT', 'SOURCE_CONTENT'],
            defaultClass: 'TRANSIENT',
            rawPayloadStorageAllowed: true,
          },
          export: { ...policy().export, mode: 'redistributable' },
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects overlapping allowed/prohibited purposes and export fields outside source rights', () => {
    expect(
      ConnectorPolicySchema.safeParse(
        policy({ allowedPurposes: ['research.website'], prohibitedPurposes: ['research.website'] }),
      ).success,
    ).toBe(false);
    expect(
      ConnectorPolicySchema.safeParse(
        policy({ export: { ...policy().export, allowedFields: ['field.not_allowed'] } }),
      ).success,
    ).toBe(false);
  });

  it('rejects enabled connectors that are not approved', () => {
    expect(ConnectorDefinitionSchema.safeParse(connector({ status: 'draft', activation: 'enabled' })).success).toBe(false);
  });

  it('rejects fetch requests without a target URL', () => {
    expect(ConnectorAdmissionInputSchema.safeParse(admissionInput({ request: request({ targetUrl: undefined }) })).success).toBe(false);
  });
});

describe('deterministic connector admission', () => {
  it('allows an exact approved-with-limits request and exposes the policy-bounded budget', () => {
    const decision = evaluateConnectorAdmission(admissionInput());
    expect(decision.decision).toBe('allow');
    expect(decision.reasonCodes).toEqual([]);
    expect(decision.effectiveBudget.maxRequests).toBe(50);
    expect(decision.effectiveBudget.maxConcurrency).toBe(2);
    expect(decision.rawPayloadAllowed).toBe(false);
  });

  it('fails closed for review-required, blocked and expired policy states', () => {
    expect(evaluateConnectorAdmission(admissionInput({ policy: policy({ state: 'REVIEW_REQUIRED' }) })).decision).toBe(
      'review_required',
    );
    expect(evaluateConnectorAdmission(admissionInput({ policy: policy({ state: 'BLOCKED' }) })).decision).toBe('blocked');
    const expired = evaluateConnectorAdmission(
      admissionInput({
        policy: policy({
          state: 'APPROVED',
          reviewedAt: '2026-01-01T00:00:00.000Z',
          nextReviewAt: '2026-08-31T00:00:00.000Z',
        }),
      }),
    );
    expect(expired.decision).toBe('blocked');
    expect(expired.reasonCodes).toContain('source_policy_review_expired');
  });

  it('blocks execution through a dry-run connector', () => {
    const decision = evaluateConnectorAdmission(admissionInput({ connector: connector({ activation: 'dry_run' }) }));
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('connector_dry_run_only');
  });

  it('blocks unsupported operations, fields, purposes and budgets instead of widening scope', () => {
    const unsupported = evaluateConnectorAdmission(
      admissionInput({
        request: request({
          operation: 'search',
          targetUrl: undefined,
          purpose: 'bulk.redistribution',
          requestedFields: ['field.not_allowed'],
          budget: { ...request().budget, maxRequests: 999 },
        }),
      }),
    );
    expect(unsupported.decision).toBe('blocked');
    expect(unsupported.reasonCodes).toContain('source_operation_not_supported');
    expect(unsupported.reasonCodes).toContain('source_purpose_not_allowed');
    expect(unsupported.reasonCodes).toContain('source_field_not_allowed');
    expect(unsupported.reasonCodes).toContain('source_budget_exceeds_capability');
    expect(unsupported.reasonCodes).toContain('source_budget_exceeds_policy');
  });

  it('enforces transient-only storage and export boundaries', () => {
    const transientPolicy = policy({
      state: 'TRANSIENT_ONLY',
      storage: {
        allowedClasses: ['TRANSIENT', 'REFERENCE_ONLY'],
        defaultClass: 'TRANSIENT',
        rawPayloadStorageAllowed: false,
        cacheTtlSeconds: 300,
        retentionTtlSeconds: 300,
        deletionRequired: true,
        refreshAfterSeconds: null,
      },
      export: { mode: 'reference_only', allowedFields: ['website.url'], attributionRequired: true },
    });
    const decision = evaluateConnectorAdmission(
      admissionInput({
        policy: transientPolicy,
        request: request({ storageClass: 'EVIDENCE_MINIMAL', exportRequested: true }),
      }),
    );
    expect(decision.decision).toBe('blocked');
    expect(decision.reasonCodes).toContain('source_storage_not_allowed');
    expect(decision.reasonCodes).toContain('source_transient_only_storage');
  });

  it('turns personal-data review and unknown robots/health into explicit review', () => {
    const decision = evaluateConnectorAdmission(
      admissionInput({
        policy: policy({ personalData: { ...policy().personalData, requiresPurposeReview: true } }),
        request: request({
          requestedFields: ['contact.generic_email'],
          requestedDataClassifications: ['PERSONAL_BUSINESS_CONTACT'],
          robotsDecision: 'unknown',
        }),
        health: health({ status: 'unknown' }),
      }),
    );
    expect(decision.decision).toBe('review_required');
    expect(decision.reasonCodes).toContain('source_personal_data_review_required');
    expect(decision.reasonCodes).toContain('source_robots_unknown');
    expect(decision.reasonCodes).toContain('connector_health_unknown');
  });

  it('blocks robots denial, rate limits, circuit-open health and insufficient live quota', () => {
    expect(
      evaluateConnectorAdmission(admissionInput({ request: request({ robotsDecision: 'disallowed' }) })).reasonCodes,
    ).toContain('source_robots_disallowed');
    expect(
      evaluateConnectorAdmission(admissionInput({ health: health({ status: 'rate_limited' }) })).reasonCodes,
    ).toContain('connector_rate_limited');
    expect(
      evaluateConnectorAdmission(admissionInput({ health: health({ status: 'circuit_open' }) })).reasonCodes,
    ).toContain('connector_health_blocked');
    expect(
      evaluateConnectorAdmission(admissionInput({ health: health({ quotaRemaining: 5 }) })).reasonCodes,
    ).toContain('connector_quota_insufficient');
  });

  it('allows degraded health with an explicit warning but reviews stale health', () => {
    const degraded = evaluateConnectorAdmission(admissionInput({ health: health({ status: 'degraded' }) }));
    expect(degraded.decision).toBe('allow');
    expect(degraded.warnings).toContain('connector_health_degraded');

    const stale = evaluateConnectorAdmission(
      admissionInput({ health: health({ observedAt: '2026-09-01T09:00:00.000Z' }) }),
    );
    expect(stale.decision).toBe('review_required');
    expect(stale.reasonCodes).toContain('connector_health_stale');
  });
});

describe('normalized source-result safety', () => {
  it('accepts a candidate-only result whose provenance, fields, storage and usage stay inside admission', () => {
    const input = admissionInput();
    const admission = evaluateConnectorAdmission(input);
    const validation = validateSourceResultAgainstAdmission({
      result: result(),
      request: input.request,
      capability: input.capability,
      policy: input.policy,
      admission,
    });
    expect(validation).toEqual({ valid: true, issues: [] });
  });

  it('rejects malformed provenance and AUTH_SECRET candidates at schema level', () => {
    const missingRef = result({
      candidates: [
        {
          ...result().candidates[0]!,
          sourceReferenceIds: ['missing-reference'],
        },
      ],
    });
    expect(SourceResultEnvelopeSchema.safeParse(missingRef).success).toBe(false);

    const secret = result({
      candidates: [
        {
          ...result().candidates[0]!,
          dataClassifications: ['AUTH_SECRET'],
        },
      ],
    });
    expect(SourceResultEnvelopeSchema.safeParse(secret).success).toBe(false);
  });

  it('detects field, storage, budget and raw-payload policy violations', () => {
    const input = admissionInput();
    const admission = evaluateConnectorAdmission(input);
    const unsafe = result({
      candidates: [
        {
          ...result().candidates[0]!,
          fields: { ...result().candidates[0]!.fields, 'website.summary': 'extra' },
          fieldNames: ['business.name', 'website.url', 'website.summary'],
          storageClass: 'REFERENCE_ONLY',
        },
      ],
      rawPayloadRefs: ['payload-ref-1'],
      usage: { ...result().usage, requests: 51 },
    });
    const validation = validateSourceResultAgainstAdmission({
      result: unsafe,
      request: input.request,
      capability: input.capability,
      policy: input.policy,
      admission,
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain('source_result_field_violation');
    expect(validation.issues).toContain('source_result_storage_violation');
    expect(validation.issues).toContain('source_result_budget_exceeded');
    expect(validation.issues).toContain('source_result_raw_payload_violation');
  });

  it('does not validate results produced without an allowed admission', () => {
    const input = admissionInput({ policy: policy({ state: 'REVIEW_REQUIRED' }) });
    const admission = evaluateConnectorAdmission(input);
    const validation = validateSourceResultAgainstAdmission({
      result: result(),
      request: input.request,
      capability: input.capability,
      policy: input.policy,
      admission,
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain('source_result_without_allowed_admission');
  });
});
