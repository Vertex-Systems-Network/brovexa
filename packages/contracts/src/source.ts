import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = z.string().trim().min(1).max(64);
const DateTimeSchema = z.string().datetime();
const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
const SafeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const PositiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const UrlSchema = z.string().url().max(2048);

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function addDuplicateIssue(
  values: readonly string[],
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  if (hasDuplicates(values)) ctx.addIssue({ code: 'custom', path, message });
}

function isSubset(values: readonly string[], allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return values.every((value) => allowedSet.has(value));
}

export const sourceClassValues = [
  'maps_local_api',
  'official_registry_open_data',
  'industry_directory',
  'company_first_party',
  'careers_jobs',
  'procurement_tender',
  'news_search_index',
  'review_reputation',
  'social_community',
  'technical_technology',
  'funding_company_intelligence',
  'customer_first_party',
  'licensed_b2b',
  'customer_import',
  'browser_manual_capture',
  'partner_mcp',
] as const;
export const SourceClassSchema = z.enum(sourceClassValues);
export type SourceClass = z.infer<typeof SourceClassSchema>;

export const sourceOperationValues = [
  'discover',
  'search',
  'list',
  'lookup',
  'fetch',
  'detail',
  'import',
  'sync',
] as const;
export const SourceOperationSchema = z.enum(sourceOperationValues);
export type SourceOperation = z.infer<typeof SourceOperationSchema>;

export const connectorPolicyStateValues = [
  'APPROVED',
  'APPROVED_WITH_LIMITS',
  'TRANSIENT_ONLY',
  'REVIEW_REQUIRED',
  'BLOCKED',
  'EXPIRED',
] as const;
export const ConnectorPolicyStateSchema = z.enum(connectorPolicyStateValues);
export type ConnectorPolicyState = z.infer<typeof ConnectorPolicyStateSchema>;

export const sourceStorageClassValues = [
  'TRANSIENT',
  'REFERENCE_ONLY',
  'NORMALIZED_FACT',
  'EVIDENCE_MINIMAL',
  'SOURCE_CONTENT',
] as const;
export const SourceStorageClassSchema = z.enum(sourceStorageClassValues);
export type SourceStorageClass = z.infer<typeof SourceStorageClassSchema>;

export const sourceDataClassificationValues = [
  'PUBLIC_BUSINESS',
  'INTERNAL_WORKSPACE',
  'PERSONAL_BUSINESS_CONTACT',
  'CUSTOMER_FIRST_PARTY',
  'COMMERCIAL_CONFIDENTIAL',
  'SECURITY_SENSITIVE',
  'AUTH_SECRET',
] as const;
export const SourceDataClassificationSchema = z.enum(sourceDataClassificationValues);
export type SourceDataClassification = z.infer<typeof SourceDataClassificationSchema>;

export const sourceAccessMethodValues = [
  'official_api',
  'licensed_api',
  'public_web',
  'first_party_web',
  'open_data_dump',
  'customer_authorized',
  'user_import',
  'manual_capture',
  'webhook',
  'partner_protocol',
] as const;
export const SourceAccessMethodSchema = z.enum(sourceAccessMethodValues);
export type SourceAccessMethod = z.infer<typeof SourceAccessMethodSchema>;

export const connectorCredentialModeValues = [
  'none',
  'api_key_ref',
  'oauth_ref',
  'service_account_ref',
  'user_authorized_ref',
] as const;
export const ConnectorCredentialModeSchema = z.enum(connectorCredentialModeValues);
export type ConnectorCredentialMode = z.infer<typeof ConnectorCredentialModeSchema>;

export const SourceBudgetSchema = z.object({
  maxRequests: SafeIntegerSchema,
  maxPages: SafeIntegerSchema,
  maxBytes: SafeIntegerSchema,
  maxCurrencyMicros: SafeIntegerSchema,
  maxRuntimeMs: SafeIntegerSchema,
  maxConcurrency: z.number().int().min(1).max(256),
});
export type SourceBudget = z.infer<typeof SourceBudgetSchema>;

export const SourceCapabilitySchema = z
  .object({
    sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
    version: VersionSchema,
    sourceClass: SourceClassSchema,
    accessMethods: z.array(SourceAccessMethodSchema).min(1).max(16),
    operations: z.array(SourceOperationSchema).min(1).max(sourceOperationValues.length),
    supportedFields: z.array(IdentifierSchema).min(1).max(512),
    dataClassifications: z.array(SourceDataClassificationSchema).min(1).max(sourceDataClassificationValues.length),
    geography: z.object({
      mode: z.enum(['global', 'country_allowlist', 'provider_defined']),
      countryCodes: z.array(CountryCodeSchema).max(249),
      supportsRadius: z.boolean(),
      supportsPolygon: z.boolean(),
      supportsAdministrativeAreas: z.boolean(),
    }),
    pagination: z.object({
      mode: z.enum(['none', 'cursor', 'page', 'offset', 'token', 'stream']),
      maxPageSize: PositiveSafeIntegerSchema.max(10_000).optional(),
      maxCursorLength: PositiveSafeIntegerSchema.max(4096).optional(),
    }),
    hardLimits: SourceBudgetSchema,
    supportsAttribution: z.boolean(),
    supportsDeletion: z.boolean(),
    supportsRefresh: z.boolean(),
    supportsRawPayloadReference: z.boolean(),
  })
  .superRefine((capability, ctx) => {
    addDuplicateIssue(capability.accessMethods, ctx, ['accessMethods'], 'accessMethods must be unique.');
    addDuplicateIssue(capability.operations, ctx, ['operations'], 'operations must be unique.');
    addDuplicateIssue(capability.supportedFields, ctx, ['supportedFields'], 'supportedFields must be unique.');
    addDuplicateIssue(
      capability.dataClassifications,
      ctx,
      ['dataClassifications'],
      'dataClassifications must be unique.',
    );
    addDuplicateIssue(capability.geography.countryCodes, ctx, ['geography', 'countryCodes'], 'countryCodes must be unique.');
    if (capability.geography.mode === 'country_allowlist' && capability.geography.countryCodes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['geography', 'countryCodes'],
        message: 'country_allowlist capability requires at least one country code.',
      });
    }
    if (capability.geography.mode === 'global' && capability.geography.countryCodes.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['geography', 'countryCodes'],
        message: 'global capability must not declare a country allowlist.',
      });
    }
    if (capability.pagination.mode === 'none' && (capability.pagination.maxPageSize || capability.pagination.maxCursorLength)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pagination'],
        message: 'Non-paginated sources cannot declare pagination limits.',
      });
    }
  });
export type SourceCapability = z.infer<typeof SourceCapabilitySchema>;

export const ConnectorPolicySchema = z
  .object({
    policyId: IdentifierSchema,
    version: VersionSchema,
    sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    state: ConnectorPolicyStateSchema,
    accessMethod: SourceAccessMethodSchema,
    policyLicenseRef: z.string().trim().min(1).max(512),
    policyLicenseVersion: VersionSchema,
    allowedPurposes: z.array(IdentifierSchema).max(128),
    prohibitedPurposes: z.array(IdentifierSchema).max(128),
    allowedFields: z.array(IdentifierSchema).max(512),
    allowedDataClassifications: z.array(SourceDataClassificationSchema).max(sourceDataClassificationValues.length),
    storage: z.object({
      allowedClasses: z.array(SourceStorageClassSchema).min(1).max(sourceStorageClassValues.length),
      defaultClass: SourceStorageClassSchema,
      rawPayloadStorageAllowed: z.boolean(),
      cacheTtlSeconds: SafeIntegerSchema.nullable(),
      retentionTtlSeconds: SafeIntegerSchema.nullable(),
      deletionRequired: z.boolean(),
      refreshAfterSeconds: SafeIntegerSchema.nullable(),
    }),
    canonicalizationRule: z.enum([
      'reference_only',
      'normalized_candidate',
      'independent_verification_required',
      'customer_authoritative_with_conflict_rules',
    ]),
    attribution: z.object({
      required: z.boolean(),
      policyRef: IdentifierSchema.optional(),
    }),
    export: z.object({
      mode: z.enum(['none', 'reference_only', 'policy_filtered', 'redistributable']),
      allowedFields: z.array(IdentifierSchema).max(512),
      attributionRequired: z.boolean(),
    }),
    personalData: z.object({
      allowed: z.boolean(),
      allowedFields: z.array(IdentifierSchema).max(256),
      requiresPurposeReview: z.boolean(),
      exportAllowed: z.boolean(),
    }),
    geography: z.object({
      mode: z.enum(['global', 'country_allowlist', 'provider_defined']),
      allowedCountryCodes: z.array(CountryCodeSchema).max(249),
      blockedCountryCodes: z.array(CountryCodeSchema).max(249),
    }),
    robots: z.object({
      mode: z.enum(['not_applicable', 'respect', 'provider_terms']),
      barrierBypassProhibited: z.literal(true),
    }),
    quotas: SourceBudgetSchema,
    cost: z.object({
      currency: z.string().regex(/^[A-Z]{3}$/),
      estimatedRequestMicros: SafeIntegerSchema,
    }),
    credentials: z.object({
      allowedModes: z.array(ConnectorCredentialModeSchema).min(1).max(connectorCredentialModeValues.length),
      secretLoggingProhibited: z.literal(true),
      promptExposureProhibited: z.literal(true),
    }),
    fallback: z.object({
      allowed: z.boolean(),
      connectorKeys: z.array(z.string().regex(/^connector\.[a-z0-9_.-]+$/)).max(32),
    }),
    owner: IdentifierSchema,
    reviewedAt: DateTimeSchema,
    nextReviewAt: DateTimeSchema,
  })
  .superRefine((policy, ctx) => {
    addDuplicateIssue(policy.allowedPurposes, ctx, ['allowedPurposes'], 'allowedPurposes must be unique.');
    addDuplicateIssue(policy.prohibitedPurposes, ctx, ['prohibitedPurposes'], 'prohibitedPurposes must be unique.');
    addDuplicateIssue(policy.allowedFields, ctx, ['allowedFields'], 'allowedFields must be unique.');
    addDuplicateIssue(
      policy.allowedDataClassifications,
      ctx,
      ['allowedDataClassifications'],
      'allowedDataClassifications must be unique.',
    );
    addDuplicateIssue(policy.storage.allowedClasses, ctx, ['storage', 'allowedClasses'], 'allowed storage classes must be unique.');
    addDuplicateIssue(policy.export.allowedFields, ctx, ['export', 'allowedFields'], 'export fields must be unique.');
    addDuplicateIssue(policy.personalData.allowedFields, ctx, ['personalData', 'allowedFields'], 'personal data fields must be unique.');
    addDuplicateIssue(policy.geography.allowedCountryCodes, ctx, ['geography', 'allowedCountryCodes'], 'allowed countries must be unique.');
    addDuplicateIssue(policy.geography.blockedCountryCodes, ctx, ['geography', 'blockedCountryCodes'], 'blocked countries must be unique.');
    addDuplicateIssue(policy.credentials.allowedModes, ctx, ['credentials', 'allowedModes'], 'credential modes must be unique.');
    addDuplicateIssue(policy.fallback.connectorKeys, ctx, ['fallback', 'connectorKeys'], 'fallback connector keys must be unique.');

    const prohibited = new Set(policy.prohibitedPurposes);
    if (policy.allowedPurposes.some((purpose) => prohibited.has(purpose))) {
      ctx.addIssue({ code: 'custom', path: ['allowedPurposes'], message: 'A purpose cannot be both allowed and prohibited.' });
    }
    if (!policy.storage.allowedClasses.includes(policy.storage.defaultClass)) {
      ctx.addIssue({ code: 'custom', path: ['storage', 'defaultClass'], message: 'defaultClass must be allowed.' });
    }
    if (policy.storage.rawPayloadStorageAllowed && !policy.storage.allowedClasses.includes('SOURCE_CONTENT')) {
      ctx.addIssue({
        code: 'custom',
        path: ['storage', 'rawPayloadStorageAllowed'],
        message: 'Raw payload storage requires SOURCE_CONTENT rights.',
      });
    }
    if (!isSubset(policy.export.allowedFields, policy.allowedFields)) {
      ctx.addIssue({ code: 'custom', path: ['export', 'allowedFields'], message: 'Export fields must be a subset of allowed fields.' });
    }
    if (!policy.personalData.allowed && (policy.personalData.allowedFields.length > 0 || policy.personalData.exportAllowed)) {
      ctx.addIssue({
        code: 'custom',
        path: ['personalData'],
        message: 'Disallowed personal data cannot declare fields or export rights.',
      });
    }
    const blockedCountries = new Set(policy.geography.blockedCountryCodes);
    if (policy.geography.allowedCountryCodes.some((country) => blockedCountries.has(country))) {
      ctx.addIssue({
        code: 'custom',
        path: ['geography'],
        message: 'A country cannot be both allowed and blocked.',
      });
    }
    if (policy.geography.mode === 'country_allowlist' && policy.geography.allowedCountryCodes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['geography', 'allowedCountryCodes'],
        message: 'country_allowlist policy requires at least one allowed country.',
      });
    }
    if (!policy.fallback.allowed && policy.fallback.connectorKeys.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['fallback', 'connectorKeys'],
        message: 'Fallback connector keys require fallback.allowed=true.',
      });
    }
    if (Date.parse(policy.nextReviewAt) <= Date.parse(policy.reviewedAt)) {
      ctx.addIssue({ code: 'custom', path: ['nextReviewAt'], message: 'nextReviewAt must be after reviewedAt.' });
    }
    if (policy.state === 'TRANSIENT_ONLY') {
      const durable = policy.storage.allowedClasses.filter(
        (storageClass) => storageClass !== 'TRANSIENT' && storageClass !== 'REFERENCE_ONLY',
      );
      if (durable.length > 0 || policy.storage.rawPayloadStorageAllowed) {
        ctx.addIssue({
          code: 'custom',
          path: ['storage'],
          message: 'TRANSIENT_ONLY policy may allow only TRANSIENT and REFERENCE_ONLY storage.',
        });
      }
      if (policy.export.mode !== 'none' && policy.export.mode !== 'reference_only') {
        ctx.addIssue({
          code: 'custom',
          path: ['export', 'mode'],
          message: 'TRANSIENT_ONLY policy cannot permit content redistribution.',
        });
      }
    }
  });
export type ConnectorPolicy = z.infer<typeof ConnectorPolicySchema>;

export const ConnectorDefinitionSchema = z
  .object({
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    version: VersionSchema,
    sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
    capabilityVersion: VersionSchema,
    policyId: IdentifierSchema,
    policyVersion: VersionSchema,
    accessMethod: SourceAccessMethodSchema,
    credentialMode: ConnectorCredentialModeSchema,
    status: z.enum(['draft', 'approved', 'disabled']),
    activation: z.enum(['disabled', 'dry_run', 'enabled']),
    implementationVersion: VersionSchema,
    owner: IdentifierSchema,
    changeReason: z.string().trim().min(1).max(2000),
  })
  .superRefine((connector, ctx) => {
    if (connector.activation === 'enabled' && connector.status !== 'approved') {
      ctx.addIssue({
        code: 'custom',
        path: ['activation'],
        message: 'Only approved connectors may be enabled.',
      });
    }
  });
export type ConnectorDefinition = z.infer<typeof ConnectorDefinitionSchema>;

export const SourceRequestEnvelopeSchema = z
  .object({
    version: z.literal('1.0.0'),
    requestId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    researchJobId: IdentifierSchema.optional(),
    researchRunId: IdentifierSchema.optional(),
    workUnitId: IdentifierSchema.optional(),
    sourceTaskId: IdentifierSchema,
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
    operation: SourceOperationSchema,
    executionIntent: z.enum(['preflight', 'execute']),
    purpose: IdentifierSchema,
    intendedUse: IdentifierSchema,
    requestedFields: z.array(IdentifierSchema).min(1).max(512),
    requestedDataClassifications: z.array(SourceDataClassificationSchema).min(1).max(sourceDataClassificationValues.length),
    geography: z.object({
      countryCodes: z.array(CountryCodeSchema).max(249),
      areaRefs: z.array(IdentifierSchema).max(512),
    }),
    storageClass: SourceStorageClassSchema,
    exportRequested: z.boolean(),
    rawPayloadRequested: z.boolean(),
    robotsDecision: z.enum(['not_applicable', 'allowed', 'disallowed', 'unknown']),
    targetUrl: UrlSchema.optional(),
    query: z.object({
      text: z.string().trim().min(1).max(2000).optional(),
      categories: z.array(IdentifierSchema).max(256),
      externalRefs: z.array(IdentifierSchema).max(512),
      filters: z.record(z.string().max(128), z.unknown()),
    }),
    pagination: z.object({
      cursor: z.string().max(4096).optional(),
      page: PositiveSafeIntegerSchema.optional(),
      pageSize: PositiveSafeIntegerSchema.max(10_000).optional(),
    }),
    budget: SourceBudgetSchema,
    policySnapshot: z.object({
      policyId: IdentifierSchema,
      policyVersion: VersionSchema,
    }),
    requestedAt: DateTimeSchema,
  })
  .superRefine((request, ctx) => {
    addDuplicateIssue(request.requestedFields, ctx, ['requestedFields'], 'requestedFields must be unique.');
    addDuplicateIssue(
      request.requestedDataClassifications,
      ctx,
      ['requestedDataClassifications'],
      'requestedDataClassifications must be unique.',
    );
    addDuplicateIssue(request.geography.countryCodes, ctx, ['geography', 'countryCodes'], 'countryCodes must be unique.');
    addDuplicateIssue(request.geography.areaRefs, ctx, ['geography', 'areaRefs'], 'areaRefs must be unique.');
    addDuplicateIssue(request.query.categories, ctx, ['query', 'categories'], 'categories must be unique.');
    addDuplicateIssue(request.query.externalRefs, ctx, ['query', 'externalRefs'], 'externalRefs must be unique.');
    if (request.operation === 'fetch' && !request.targetUrl) {
      ctx.addIssue({ code: 'custom', path: ['targetUrl'], message: 'fetch operation requires targetUrl.' });
    }
  });
export type SourceRequestEnvelope = z.infer<typeof SourceRequestEnvelopeSchema>;

export const ConnectorHealthSnapshotSchema = z.object({
  connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
  connectorVersion: VersionSchema,
  status: z.enum(['ready', 'degraded', 'rate_limited', 'circuit_open', 'disabled', 'unknown']),
  observedAt: DateTimeSchema,
  quotaRemaining: SafeIntegerSchema.nullable(),
  rollingErrorRate: z.number().min(0).max(1),
  p95LatencyMs: SafeIntegerSchema.nullable(),
  reasonCodes: z.array(IdentifierSchema).max(64),
});
export type ConnectorHealthSnapshot = z.infer<typeof ConnectorHealthSnapshotSchema>;

export const ConnectorAdmissionInputSchema = z.object({
  capability: SourceCapabilitySchema,
  policy: ConnectorPolicySchema,
  connector: ConnectorDefinitionSchema,
  request: SourceRequestEnvelopeSchema,
  health: ConnectorHealthSnapshotSchema,
  evaluatedAt: DateTimeSchema,
  maxHealthAgeSeconds: PositiveSafeIntegerSchema.max(86_400),
});
export type ConnectorAdmissionInput = z.infer<typeof ConnectorAdmissionInputSchema>;

export const ConnectorAdmissionDecisionSchema = z.object({
  decision: z.enum(['allow', 'review_required', 'blocked']),
  reasonCodes: z.array(IdentifierSchema),
  warnings: z.array(IdentifierSchema),
  policySnapshot: z.object({ policyId: IdentifierSchema, policyVersion: VersionSchema }),
  connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
  connectorVersion: VersionSchema,
  sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
  operation: SourceOperationSchema,
  storageClass: SourceStorageClassSchema,
  allowedStorageClasses: z.array(SourceStorageClassSchema),
  exportAllowed: z.boolean(),
  rawPayloadAllowed: z.boolean(),
  effectiveBudget: SourceBudgetSchema,
  evaluatedAt: DateTimeSchema,
});
export type ConnectorAdmissionDecision = z.infer<typeof ConnectorAdmissionDecisionSchema>;

function budgetExceeds(requested: SourceBudget, limit: SourceBudget): boolean {
  return (
    requested.maxRequests > limit.maxRequests ||
    requested.maxPages > limit.maxPages ||
    requested.maxBytes > limit.maxBytes ||
    requested.maxCurrencyMicros > limit.maxCurrencyMicros ||
    requested.maxRuntimeMs > limit.maxRuntimeMs ||
    requested.maxConcurrency > limit.maxConcurrency
  );
}

function minBudget(left: SourceBudget, right: SourceBudget): SourceBudget {
  return {
    maxRequests: Math.min(left.maxRequests, right.maxRequests),
    maxPages: Math.min(left.maxPages, right.maxPages),
    maxBytes: Math.min(left.maxBytes, right.maxBytes),
    maxCurrencyMicros: Math.min(left.maxCurrencyMicros, right.maxCurrencyMicros),
    maxRuntimeMs: Math.min(left.maxRuntimeMs, right.maxRuntimeMs),
    maxConcurrency: Math.min(left.maxConcurrency, right.maxConcurrency),
  };
}

export function evaluateConnectorAdmission(rawInput: ConnectorAdmissionInput): ConnectorAdmissionDecision {
  const input = ConnectorAdmissionInputSchema.parse(rawInput);
  const { capability, policy, connector, request, health } = input;
  const blocked = new Set<string>();
  const review = new Set<string>();
  const warnings = new Set<string>();

  if (
    connector.sourceKey !== capability.sourceKey ||
    connector.capabilityVersion !== capability.version ||
    policy.sourceKey !== capability.sourceKey ||
    policy.connectorKey !== connector.connectorKey ||
    connector.policyId !== policy.policyId ||
    connector.policyVersion !== policy.version ||
    request.sourceKey !== capability.sourceKey ||
    request.connectorKey !== connector.connectorKey ||
    request.connectorVersion !== connector.version ||
    request.policySnapshot.policyId !== policy.policyId ||
    request.policySnapshot.policyVersion !== policy.version ||
    health.connectorKey !== connector.connectorKey ||
    health.connectorVersion !== connector.version
  ) {
    blocked.add('source_contract_identity_mismatch');
  }

  if (!capability.accessMethods.includes(connector.accessMethod) || connector.accessMethod !== policy.accessMethod) {
    blocked.add('source_access_method_not_approved');
  }
  if (!policy.credentials.allowedModes.includes(connector.credentialMode)) {
    blocked.add('source_credential_mode_not_approved');
  }
  if (connector.status !== 'approved' || connector.activation === 'disabled') {
    blocked.add('connector_not_active');
  }
  if (connector.activation === 'dry_run' && request.executionIntent === 'execute') {
    blocked.add('connector_dry_run_only');
  }

  if (policy.state === 'BLOCKED' || policy.state === 'EXPIRED') blocked.add('source_policy_blocked');
  if (policy.state === 'REVIEW_REQUIRED') review.add('source_policy_review_required');
  if (Date.parse(input.evaluatedAt) >= Date.parse(policy.nextReviewAt)) blocked.add('source_policy_review_expired');

  if (!capability.operations.includes(request.operation)) blocked.add('source_operation_not_supported');
  if (!policy.allowedPurposes.includes(request.purpose) || policy.prohibitedPurposes.includes(request.purpose)) {
    blocked.add('source_purpose_not_allowed');
  }
  if (!isSubset(request.requestedFields, capability.supportedFields) || !isSubset(request.requestedFields, policy.allowedFields)) {
    blocked.add('source_field_not_allowed');
  }
  if (
    !isSubset(request.requestedDataClassifications, capability.dataClassifications) ||
    !isSubset(request.requestedDataClassifications, policy.allowedDataClassifications)
  ) {
    blocked.add('source_data_classification_not_allowed');
  }
  if (request.requestedDataClassifications.includes('AUTH_SECRET')) blocked.add('source_auth_secret_forbidden');

  if (request.requestedDataClassifications.includes('PERSONAL_BUSINESS_CONTACT')) {
    if (!policy.personalData.allowed) blocked.add('source_personal_data_not_allowed');
    else if (policy.personalData.requiresPurposeReview) review.add('source_personal_data_review_required');
  }

  const requestedCountries = request.geography.countryCodes;
  const blockedCountries = new Set(policy.geography.blockedCountryCodes);
  if (requestedCountries.some((country) => blockedCountries.has(country))) blocked.add('source_geography_blocked');
  if (
    policy.geography.mode === 'country_allowlist' &&
    requestedCountries.some((country) => !policy.geography.allowedCountryCodes.includes(country))
  ) {
    blocked.add('source_geography_not_allowed');
  }
  if (
    capability.geography.mode === 'country_allowlist' &&
    requestedCountries.some((country) => !capability.geography.countryCodes.includes(country))
  ) {
    blocked.add('source_geography_not_supported');
  }

  if (!policy.storage.allowedClasses.includes(request.storageClass)) blocked.add('source_storage_not_allowed');
  if (
    policy.state === 'TRANSIENT_ONLY' &&
    request.storageClass !== 'TRANSIENT' &&
    request.storageClass !== 'REFERENCE_ONLY'
  ) {
    blocked.add('source_transient_only_storage');
  }
  if (request.rawPayloadRequested && (!policy.storage.rawPayloadStorageAllowed || !capability.supportsRawPayloadReference)) {
    blocked.add('source_raw_payload_not_allowed');
  }
  if (request.exportRequested) {
    if (policy.export.mode === 'none') blocked.add('source_export_not_allowed');
    if (
      request.requestedDataClassifications.includes('PERSONAL_BUSINESS_CONTACT') &&
      !policy.personalData.exportAllowed
    ) {
      blocked.add('source_personal_export_not_allowed');
    }
  }

  if (policy.robots.mode === 'respect') {
    if (request.robotsDecision === 'disallowed') blocked.add('source_robots_disallowed');
    if (request.robotsDecision === 'unknown') review.add('source_robots_unknown');
  }

  if (budgetExceeds(request.budget, capability.hardLimits)) blocked.add('source_budget_exceeds_capability');
  if (budgetExceeds(request.budget, policy.quotas)) blocked.add('source_budget_exceeds_policy');

  const healthAgeMs = Date.parse(input.evaluatedAt) - Date.parse(health.observedAt);
  if (healthAgeMs < 0 || healthAgeMs > input.maxHealthAgeSeconds * 1000) review.add('connector_health_stale');
  if (health.status === 'disabled' || health.status === 'circuit_open') blocked.add('connector_health_blocked');
  if (health.status === 'rate_limited' && request.executionIntent === 'execute') blocked.add('connector_rate_limited');
  if (health.status === 'unknown') review.add('connector_health_unknown');
  if (health.status === 'degraded') warnings.add('connector_health_degraded');
  if (health.quotaRemaining !== null && request.budget.maxRequests > health.quotaRemaining) {
    blocked.add('connector_quota_insufficient');
  }

  const decision = blocked.size > 0 ? 'blocked' : review.size > 0 ? 'review_required' : 'allow';
  return ConnectorAdmissionDecisionSchema.parse({
    decision,
    reasonCodes: [...blocked, ...review].sort(),
    warnings: [...warnings].sort(),
    policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
    connectorKey: connector.connectorKey,
    connectorVersion: connector.version,
    sourceKey: capability.sourceKey,
    operation: request.operation,
    storageClass: request.storageClass,
    allowedStorageClasses:
      policy.state === 'TRANSIENT_ONLY'
        ? policy.storage.allowedClasses.filter((value) => value === 'TRANSIENT' || value === 'REFERENCE_ONLY')
        : policy.storage.allowedClasses,
    exportAllowed: request.exportRequested && policy.export.mode !== 'none' && blocked.size === 0,
    rawPayloadAllowed:
      request.rawPayloadRequested &&
      policy.storage.rawPayloadStorageAllowed &&
      capability.supportsRawPayloadReference &&
      blocked.size === 0,
    effectiveBudget: minBudget(capability.hardLimits, policy.quotas),
    evaluatedAt: input.evaluatedAt,
  });
}

export const SourceReferenceSchema = z.object({
  referenceId: IdentifierSchema,
  sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
  connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
  connectorVersion: VersionSchema,
  externalId: z.string().trim().min(1).max(512).optional(),
  url: UrlSchema.optional(),
  observedAt: DateTimeSchema.optional(),
  fetchedAt: DateTimeSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  attribution: z.string().trim().min(1).max(2000).optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const SourceCandidateSchema = z.object({
  candidateId: IdentifierSchema,
  objectType: z.enum([
    'business',
    'location',
    'domain',
    'website',
    'contact_channel',
    'person',
    'employment',
    'job',
    'procurement',
    'news_event',
    'signal_candidate',
    'custom',
  ]),
  candidateState: z.literal('unverified'),
  fields: z.record(z.string().max(128), z.unknown()),
  fieldNames: z.array(IdentifierSchema).min(1).max(512),
  dataClassifications: z.array(SourceDataClassificationSchema).min(1).max(sourceDataClassificationValues.length),
  storageClass: SourceStorageClassSchema,
  sourceReferenceIds: z.array(IdentifierSchema).min(1).max(64),
  observedAt: DateTimeSchema,
});
export type SourceCandidate = z.infer<typeof SourceCandidateSchema>;

export const SourceResultEnvelopeSchema = z
  .object({
    version: z.literal('1.0.0'),
    requestId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    sourceTaskId: IdentifierSchema,
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
    policySnapshot: z.object({ policyId: IdentifierSchema, policyVersion: VersionSchema }),
    status: z.enum(['complete', 'partial', 'empty', 'blocked', 'failed']),
    sourceReferences: z.array(SourceReferenceSchema).max(2048),
    candidates: z.array(SourceCandidateSchema).max(2048),
    rawPayloadRefs: z.array(IdentifierSchema).max(256),
    nextCursor: z.string().max(4096).optional(),
    usage: z.object({
      requests: SafeIntegerSchema,
      pages: SafeIntegerSchema,
      bytes: SafeIntegerSchema,
      currencyMicros: SafeIntegerSchema,
      runtimeMs: SafeIntegerSchema,
    }),
    coverage: z.object({
      state: z.enum(['complete', 'partial', 'unknown']),
      returnedRecords: SafeIntegerSchema,
      estimatedTotalRecords: SafeIntegerSchema.nullable(),
      notes: z.array(IdentifierSchema).max(64),
    }),
    errors: z.array(
      z.object({
        code: IdentifierSchema,
        classification: z.enum(['retryable', 'permanent', 'policy', 'quota', 'partial']),
        message: z.string().trim().min(1).max(1000),
      }),
    ).max(128),
    completedAt: DateTimeSchema,
  })
  .superRefine((result, ctx) => {
    const referenceIds = result.sourceReferences.map((reference) => reference.referenceId);
    addDuplicateIssue(referenceIds, ctx, ['sourceReferences'], 'source reference IDs must be unique.');
    const candidateIds = result.candidates.map((candidate) => candidate.candidateId);
    addDuplicateIssue(candidateIds, ctx, ['candidates'], 'candidate IDs must be unique.');
    addDuplicateIssue(result.rawPayloadRefs, ctx, ['rawPayloadRefs'], 'raw payload refs must be unique.');
    const referenceSet = new Set(referenceIds);
    result.candidates.forEach((candidate, index) => {
      addDuplicateIssue(candidate.fieldNames, ctx, ['candidates', index, 'fieldNames'], 'candidate fieldNames must be unique.');
      addDuplicateIssue(
        candidate.dataClassifications,
        ctx,
        ['candidates', index, 'dataClassifications'],
        'candidate dataClassifications must be unique.',
      );
      addDuplicateIssue(
        candidate.sourceReferenceIds,
        ctx,
        ['candidates', index, 'sourceReferenceIds'],
        'candidate sourceReferenceIds must be unique.',
      );
      if (candidate.sourceReferenceIds.some((referenceId) => !referenceSet.has(referenceId))) {
        ctx.addIssue({
          code: 'custom',
          path: ['candidates', index, 'sourceReferenceIds'],
          message: 'Every candidate source reference must exist in the result envelope.',
        });
      }
      if (candidate.fieldNames.some((field) => !(field in candidate.fields))) {
        ctx.addIssue({
          code: 'custom',
          path: ['candidates', index, 'fieldNames'],
          message: 'Every declared fieldName must exist in fields.',
        });
      }
      if (candidate.dataClassifications.includes('AUTH_SECRET')) {
        ctx.addIssue({
          code: 'custom',
          path: ['candidates', index, 'dataClassifications'],
          message: 'Source candidates cannot contain AUTH_SECRET data.',
        });
      }
    });
    if ((result.status === 'blocked' || result.status === 'failed') && result.candidates.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['candidates'], message: 'Blocked/failed results cannot emit candidates.' });
    }
    if (result.coverage.returnedRecords !== result.candidates.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['coverage', 'returnedRecords'],
        message: 'returnedRecords must equal the candidate count.',
      });
    }
  });
export type SourceResultEnvelope = z.infer<typeof SourceResultEnvelopeSchema>;

export const SourceResultValidationSchema = z.object({
  valid: z.boolean(),
  issues: z.array(IdentifierSchema),
});
export type SourceResultValidation = z.infer<typeof SourceResultValidationSchema>;

export function validateSourceResultAgainstAdmission(input: {
  result: SourceResultEnvelope;
  request: SourceRequestEnvelope;
  capability: SourceCapability;
  policy: ConnectorPolicy;
  admission: ConnectorAdmissionDecision;
}): SourceResultValidation {
  const result = SourceResultEnvelopeSchema.parse(input.result);
  const request = SourceRequestEnvelopeSchema.parse(input.request);
  const capability = SourceCapabilitySchema.parse(input.capability);
  const policy = ConnectorPolicySchema.parse(input.policy);
  const admission = ConnectorAdmissionDecisionSchema.parse(input.admission);
  const issues = new Set<string>();

  if (admission.decision !== 'allow') issues.add('source_result_without_allowed_admission');
  if (
    result.requestId !== request.requestId ||
    result.workspaceId !== request.workspaceId ||
    result.sourceTaskId !== request.sourceTaskId ||
    result.connectorKey !== request.connectorKey ||
    result.connectorVersion !== request.connectorVersion ||
    result.sourceKey !== request.sourceKey ||
    result.policySnapshot.policyId !== request.policySnapshot.policyId ||
    result.policySnapshot.policyVersion !== request.policySnapshot.policyVersion
  ) {
    issues.add('source_result_identity_mismatch');
  }

  if (
    result.usage.requests > admission.effectiveBudget.maxRequests ||
    result.usage.pages > admission.effectiveBudget.maxPages ||
    result.usage.bytes > admission.effectiveBudget.maxBytes ||
    result.usage.currencyMicros > admission.effectiveBudget.maxCurrencyMicros ||
    result.usage.runtimeMs > admission.effectiveBudget.maxRuntimeMs
  ) {
    issues.add('source_result_budget_exceeded');
  }

  for (const reference of result.sourceReferences) {
    if (
      reference.sourceKey !== request.sourceKey ||
      reference.connectorKey !== request.connectorKey ||
      reference.connectorVersion !== request.connectorVersion
    ) {
      issues.add('source_reference_identity_mismatch');
    }
  }

  for (const candidate of result.candidates) {
    if (candidate.storageClass !== request.storageClass || !admission.allowedStorageClasses.includes(candidate.storageClass)) {
      issues.add('source_result_storage_violation');
    }
    if (!isSubset(candidate.fieldNames, request.requestedFields) || !isSubset(candidate.fieldNames, policy.allowedFields)) {
      issues.add('source_result_field_violation');
    }
    if (
      !isSubset(candidate.dataClassifications, request.requestedDataClassifications) ||
      !isSubset(candidate.dataClassifications, capability.dataClassifications) ||
      !isSubset(candidate.dataClassifications, policy.allowedDataClassifications)
    ) {
      issues.add('source_result_classification_violation');
    }
  }

  if (result.rawPayloadRefs.length > 0 && !admission.rawPayloadAllowed) issues.add('source_result_raw_payload_violation');
  if (result.nextCursor !== undefined && capability.pagination.mode === 'none') issues.add('source_result_pagination_violation');
  if (request.exportRequested && !admission.exportAllowed) issues.add('source_result_export_violation');

  return SourceResultValidationSchema.parse({ valid: issues.size === 0, issues: [...issues].sort() });
}
