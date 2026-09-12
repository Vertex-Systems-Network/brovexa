"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceResultValidationSchema = exports.SourceResultEnvelopeSchema = exports.SourceCandidateSchema = exports.SourceReferenceSchema = exports.ConnectorAdmissionDecisionSchema = exports.ConnectorAdmissionInputSchema = exports.ConnectorHealthSnapshotSchema = exports.SourceRequestEnvelopeSchema = exports.ConnectorDefinitionSchema = exports.ConnectorPolicySchema = exports.SourceCapabilitySchema = exports.SourceBudgetSchema = exports.ConnectorCredentialModeSchema = exports.connectorCredentialModeValues = exports.SourceAccessMethodSchema = exports.sourceAccessMethodValues = exports.SourceDataClassificationSchema = exports.sourceDataClassificationValues = exports.SourceStorageClassSchema = exports.sourceStorageClassValues = exports.ConnectorPolicyStateSchema = exports.connectorPolicyStateValues = exports.SourceOperationSchema = exports.sourceOperationValues = exports.SourceClassSchema = exports.sourceClassValues = void 0;
exports.evaluateConnectorAdmission = evaluateConnectorAdmission;
exports.validateSourceResultAgainstAdmission = validateSourceResultAgainstAdmission;
const zod_1 = require("zod");
const IdentifierSchema = zod_1.z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = zod_1.z.string().trim().min(1).max(64);
const DateTimeSchema = zod_1.z.string().datetime();
const CountryCodeSchema = zod_1.z.string().regex(/^[A-Z]{2}$/);
const SafeIntegerSchema = zod_1.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const PositiveSafeIntegerSchema = zod_1.z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const UrlSchema = zod_1.z.string().url().max(2048);
function hasDuplicates(values) {
    return new Set(values).size !== values.length;
}
function addDuplicateIssue(values, ctx, path, message) {
    if (hasDuplicates(values))
        ctx.addIssue({ code: 'custom', path, message });
}
function isSubset(values, allowed) {
    const allowedSet = new Set(allowed);
    return values.every((value) => allowedSet.has(value));
}
exports.sourceClassValues = [
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
];
exports.SourceClassSchema = zod_1.z.enum(exports.sourceClassValues);
exports.sourceOperationValues = [
    'discover',
    'search',
    'list',
    'lookup',
    'fetch',
    'detail',
    'import',
    'sync',
];
exports.SourceOperationSchema = zod_1.z.enum(exports.sourceOperationValues);
exports.connectorPolicyStateValues = [
    'APPROVED',
    'APPROVED_WITH_LIMITS',
    'TRANSIENT_ONLY',
    'REVIEW_REQUIRED',
    'BLOCKED',
    'EXPIRED',
];
exports.ConnectorPolicyStateSchema = zod_1.z.enum(exports.connectorPolicyStateValues);
exports.sourceStorageClassValues = [
    'TRANSIENT',
    'REFERENCE_ONLY',
    'NORMALIZED_FACT',
    'EVIDENCE_MINIMAL',
    'SOURCE_CONTENT',
];
exports.SourceStorageClassSchema = zod_1.z.enum(exports.sourceStorageClassValues);
exports.sourceDataClassificationValues = [
    'PUBLIC_BUSINESS',
    'INTERNAL_WORKSPACE',
    'PERSONAL_BUSINESS_CONTACT',
    'CUSTOMER_FIRST_PARTY',
    'COMMERCIAL_CONFIDENTIAL',
    'SECURITY_SENSITIVE',
    'AUTH_SECRET',
];
exports.SourceDataClassificationSchema = zod_1.z.enum(exports.sourceDataClassificationValues);
exports.sourceAccessMethodValues = [
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
];
exports.SourceAccessMethodSchema = zod_1.z.enum(exports.sourceAccessMethodValues);
exports.connectorCredentialModeValues = [
    'none',
    'api_key_ref',
    'oauth_ref',
    'service_account_ref',
    'user_authorized_ref',
];
exports.ConnectorCredentialModeSchema = zod_1.z.enum(exports.connectorCredentialModeValues);
exports.SourceBudgetSchema = zod_1.z.object({
    maxRequests: SafeIntegerSchema,
    maxPages: SafeIntegerSchema,
    maxBytes: SafeIntegerSchema,
    maxCurrencyMicros: SafeIntegerSchema,
    maxRuntimeMs: SafeIntegerSchema,
    maxConcurrency: zod_1.z.number().int().min(1).max(256),
});
exports.SourceCapabilitySchema = zod_1.z
    .object({
    sourceKey: zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/),
    version: VersionSchema,
    sourceClass: exports.SourceClassSchema,
    accessMethods: zod_1.z.array(exports.SourceAccessMethodSchema).min(1).max(16),
    operations: zod_1.z.array(exports.SourceOperationSchema).min(1).max(exports.sourceOperationValues.length),
    supportedFields: zod_1.z.array(IdentifierSchema).min(1).max(512),
    dataClassifications: zod_1.z.array(exports.SourceDataClassificationSchema).min(1).max(exports.sourceDataClassificationValues.length),
    geography: zod_1.z.object({
        mode: zod_1.z.enum(['global', 'country_allowlist', 'provider_defined']),
        countryCodes: zod_1.z.array(CountryCodeSchema).max(249),
        supportsRadius: zod_1.z.boolean(),
        supportsPolygon: zod_1.z.boolean(),
        supportsAdministrativeAreas: zod_1.z.boolean(),
    }),
    pagination: zod_1.z.object({
        mode: zod_1.z.enum(['none', 'cursor', 'page', 'offset', 'token', 'stream']),
        maxPageSize: PositiveSafeIntegerSchema.max(10_000).optional(),
        maxCursorLength: PositiveSafeIntegerSchema.max(4096).optional(),
    }),
    hardLimits: exports.SourceBudgetSchema,
    supportsAttribution: zod_1.z.boolean(),
    supportsDeletion: zod_1.z.boolean(),
    supportsRefresh: zod_1.z.boolean(),
    supportsRawPayloadReference: zod_1.z.boolean(),
})
    .superRefine((capability, ctx) => {
    addDuplicateIssue(capability.accessMethods, ctx, ['accessMethods'], 'accessMethods must be unique.');
    addDuplicateIssue(capability.operations, ctx, ['operations'], 'operations must be unique.');
    addDuplicateIssue(capability.supportedFields, ctx, ['supportedFields'], 'supportedFields must be unique.');
    addDuplicateIssue(capability.dataClassifications, ctx, ['dataClassifications'], 'dataClassifications must be unique.');
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
exports.ConnectorPolicySchema = zod_1.z
    .object({
    policyId: IdentifierSchema,
    version: VersionSchema,
    sourceKey: zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/),
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    state: exports.ConnectorPolicyStateSchema,
    accessMethod: exports.SourceAccessMethodSchema,
    policyLicenseRef: zod_1.z.string().trim().min(1).max(512),
    policyLicenseVersion: VersionSchema,
    allowedPurposes: zod_1.z.array(IdentifierSchema).max(128),
    prohibitedPurposes: zod_1.z.array(IdentifierSchema).max(128),
    allowedFields: zod_1.z.array(IdentifierSchema).max(512),
    allowedDataClassifications: zod_1.z.array(exports.SourceDataClassificationSchema).max(exports.sourceDataClassificationValues.length),
    storage: zod_1.z.object({
        allowedClasses: zod_1.z.array(exports.SourceStorageClassSchema).min(1).max(exports.sourceStorageClassValues.length),
        defaultClass: exports.SourceStorageClassSchema,
        rawPayloadStorageAllowed: zod_1.z.boolean(),
        cacheTtlSeconds: SafeIntegerSchema.nullable(),
        retentionTtlSeconds: SafeIntegerSchema.nullable(),
        deletionRequired: zod_1.z.boolean(),
        refreshAfterSeconds: SafeIntegerSchema.nullable(),
    }),
    canonicalizationRule: zod_1.z.enum([
        'reference_only',
        'normalized_candidate',
        'independent_verification_required',
        'customer_authoritative_with_conflict_rules',
    ]),
    attribution: zod_1.z.object({
        required: zod_1.z.boolean(),
        policyRef: IdentifierSchema.optional(),
    }),
    export: zod_1.z.object({
        mode: zod_1.z.enum(['none', 'reference_only', 'policy_filtered', 'redistributable']),
        allowedFields: zod_1.z.array(IdentifierSchema).max(512),
        attributionRequired: zod_1.z.boolean(),
    }),
    personalData: zod_1.z.object({
        allowed: zod_1.z.boolean(),
        allowedFields: zod_1.z.array(IdentifierSchema).max(256),
        requiresPurposeReview: zod_1.z.boolean(),
        exportAllowed: zod_1.z.boolean(),
    }),
    geography: zod_1.z.object({
        mode: zod_1.z.enum(['global', 'country_allowlist', 'provider_defined']),
        allowedCountryCodes: zod_1.z.array(CountryCodeSchema).max(249),
        blockedCountryCodes: zod_1.z.array(CountryCodeSchema).max(249),
    }),
    robots: zod_1.z.object({
        mode: zod_1.z.enum(['not_applicable', 'respect', 'provider_terms']),
        barrierBypassProhibited: zod_1.z.literal(true),
    }),
    quotas: exports.SourceBudgetSchema,
    cost: zod_1.z.object({
        currency: zod_1.z.string().regex(/^[A-Z]{3}$/),
        estimatedRequestMicros: SafeIntegerSchema,
    }),
    credentials: zod_1.z.object({
        allowedModes: zod_1.z.array(exports.ConnectorCredentialModeSchema).min(1).max(exports.connectorCredentialModeValues.length),
        secretLoggingProhibited: zod_1.z.literal(true),
        promptExposureProhibited: zod_1.z.literal(true),
    }),
    fallback: zod_1.z.object({
        allowed: zod_1.z.boolean(),
        connectorKeys: zod_1.z.array(zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/)).max(32),
    }),
    owner: IdentifierSchema,
    reviewedAt: DateTimeSchema,
    nextReviewAt: DateTimeSchema,
})
    .superRefine((policy, ctx) => {
    addDuplicateIssue(policy.allowedPurposes, ctx, ['allowedPurposes'], 'allowedPurposes must be unique.');
    addDuplicateIssue(policy.prohibitedPurposes, ctx, ['prohibitedPurposes'], 'prohibitedPurposes must be unique.');
    addDuplicateIssue(policy.allowedFields, ctx, ['allowedFields'], 'allowedFields must be unique.');
    addDuplicateIssue(policy.allowedDataClassifications, ctx, ['allowedDataClassifications'], 'allowedDataClassifications must be unique.');
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
        const durable = policy.storage.allowedClasses.filter((storageClass) => storageClass !== 'TRANSIENT' && storageClass !== 'REFERENCE_ONLY');
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
exports.ConnectorDefinitionSchema = zod_1.z
    .object({
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    version: VersionSchema,
    sourceKey: zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/),
    capabilityVersion: VersionSchema,
    policyId: IdentifierSchema,
    policyVersion: VersionSchema,
    accessMethod: exports.SourceAccessMethodSchema,
    credentialMode: exports.ConnectorCredentialModeSchema,
    status: zod_1.z.enum(['draft', 'approved', 'disabled']),
    activation: zod_1.z.enum(['disabled', 'dry_run', 'enabled']),
    implementationVersion: VersionSchema,
    owner: IdentifierSchema,
    changeReason: zod_1.z.string().trim().min(1).max(2000),
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
exports.SourceRequestEnvelopeSchema = zod_1.z
    .object({
    version: zod_1.z.literal('1.0.0'),
    requestId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    researchJobId: IdentifierSchema.optional(),
    researchRunId: IdentifierSchema.optional(),
    workUnitId: IdentifierSchema.optional(),
    sourceTaskId: IdentifierSchema,
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourceKey: zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/),
    operation: exports.SourceOperationSchema,
    executionIntent: zod_1.z.enum(['preflight', 'execute']),
    purpose: IdentifierSchema,
    intendedUse: IdentifierSchema,
    requestedFields: zod_1.z.array(IdentifierSchema).min(1).max(512),
    requestedDataClassifications: zod_1.z.array(exports.SourceDataClassificationSchema).min(1).max(exports.sourceDataClassificationValues.length),
    geography: zod_1.z.object({
        countryCodes: zod_1.z.array(CountryCodeSchema).max(249),
        areaRefs: zod_1.z.array(IdentifierSchema).max(512),
    }),
    storageClass: exports.SourceStorageClassSchema,
    exportRequested: zod_1.z.boolean(),
    rawPayloadRequested: zod_1.z.boolean(),
    robotsDecision: zod_1.z.enum(['not_applicable', 'allowed', 'disallowed', 'unknown']),
    targetUrl: UrlSchema.optional(),
    query: zod_1.z.object({
        text: zod_1.z.string().trim().min(1).max(2000).optional(),
        categories: zod_1.z.array(IdentifierSchema).max(256),
        externalRefs: zod_1.z.array(IdentifierSchema).max(512),
        filters: zod_1.z.record(zod_1.z.string().max(128), zod_1.z.unknown()),
    }),
    pagination: zod_1.z.object({
        cursor: zod_1.z.string().max(4096).optional(),
        page: PositiveSafeIntegerSchema.optional(),
        pageSize: PositiveSafeIntegerSchema.max(10_000).optional(),
    }),
    budget: exports.SourceBudgetSchema,
    policySnapshot: zod_1.z.object({
        policyId: IdentifierSchema,
        policyVersion: VersionSchema,
    }),
    requestedAt: DateTimeSchema,
})
    .superRefine((request, ctx) => {
    addDuplicateIssue(request.requestedFields, ctx, ['requestedFields'], 'requestedFields must be unique.');
    addDuplicateIssue(request.requestedDataClassifications, ctx, ['requestedDataClassifications'], 'requestedDataClassifications must be unique.');
    addDuplicateIssue(request.geography.countryCodes, ctx, ['geography', 'countryCodes'], 'countryCodes must be unique.');
    addDuplicateIssue(request.geography.areaRefs, ctx, ['geography', 'areaRefs'], 'areaRefs must be unique.');
    addDuplicateIssue(request.query.categories, ctx, ['query', 'categories'], 'categories must be unique.');
    addDuplicateIssue(request.query.externalRefs, ctx, ['query', 'externalRefs'], 'externalRefs must be unique.');
    if (request.operation === 'fetch' && !request.targetUrl) {
        ctx.addIssue({ code: 'custom', path: ['targetUrl'], message: 'fetch operation requires targetUrl.' });
    }
});
exports.ConnectorHealthSnapshotSchema = zod_1.z.object({
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    status: zod_1.z.enum(['ready', 'degraded', 'rate_limited', 'circuit_open', 'disabled', 'unknown']),
    observedAt: DateTimeSchema,
    quotaRemaining: SafeIntegerSchema.nullable(),
    rollingErrorRate: zod_1.z.number().min(0).max(1),
    p95LatencyMs: SafeIntegerSchema.nullable(),
    reasonCodes: zod_1.z.array(IdentifierSchema).max(64),
});
exports.ConnectorAdmissionInputSchema = zod_1.z.object({
    capability: exports.SourceCapabilitySchema,
    policy: exports.ConnectorPolicySchema,
    connector: exports.ConnectorDefinitionSchema,
    request: exports.SourceRequestEnvelopeSchema,
    health: exports.ConnectorHealthSnapshotSchema,
    evaluatedAt: DateTimeSchema,
    maxHealthAgeSeconds: PositiveSafeIntegerSchema.max(86_400),
});
exports.ConnectorAdmissionDecisionSchema = zod_1.z.object({
    decision: zod_1.z.enum(['allow', 'review_required', 'blocked']),
    reasonCodes: zod_1.z.array(IdentifierSchema),
    warnings: zod_1.z.array(IdentifierSchema),
    policySnapshot: zod_1.z.object({ policyId: IdentifierSchema, policyVersion: VersionSchema }),
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourceKey: zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/),
    operation: exports.SourceOperationSchema,
    storageClass: exports.SourceStorageClassSchema,
    allowedStorageClasses: zod_1.z.array(exports.SourceStorageClassSchema),
    exportAllowed: zod_1.z.boolean(),
    rawPayloadAllowed: zod_1.z.boolean(),
    effectiveBudget: exports.SourceBudgetSchema,
    evaluatedAt: DateTimeSchema,
});
function budgetExceeds(requested, limit) {
    return (requested.maxRequests > limit.maxRequests ||
        requested.maxPages > limit.maxPages ||
        requested.maxBytes > limit.maxBytes ||
        requested.maxCurrencyMicros > limit.maxCurrencyMicros ||
        requested.maxRuntimeMs > limit.maxRuntimeMs ||
        requested.maxConcurrency > limit.maxConcurrency);
}
function minBudget(left, right) {
    return {
        maxRequests: Math.min(left.maxRequests, right.maxRequests),
        maxPages: Math.min(left.maxPages, right.maxPages),
        maxBytes: Math.min(left.maxBytes, right.maxBytes),
        maxCurrencyMicros: Math.min(left.maxCurrencyMicros, right.maxCurrencyMicros),
        maxRuntimeMs: Math.min(left.maxRuntimeMs, right.maxRuntimeMs),
        maxConcurrency: Math.min(left.maxConcurrency, right.maxConcurrency),
    };
}
function evaluateConnectorAdmission(rawInput) {
    const input = exports.ConnectorAdmissionInputSchema.parse(rawInput);
    const { capability, policy, connector, request, health } = input;
    const blocked = new Set();
    const review = new Set();
    const warnings = new Set();
    if (connector.sourceKey !== capability.sourceKey ||
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
        health.connectorVersion !== connector.version) {
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
    if (policy.state === 'BLOCKED' || policy.state === 'EXPIRED')
        blocked.add('source_policy_blocked');
    if (policy.state === 'REVIEW_REQUIRED')
        review.add('source_policy_review_required');
    if (Date.parse(input.evaluatedAt) >= Date.parse(policy.nextReviewAt))
        blocked.add('source_policy_review_expired');
    if (!capability.operations.includes(request.operation))
        blocked.add('source_operation_not_supported');
    if (!policy.allowedPurposes.includes(request.purpose) || policy.prohibitedPurposes.includes(request.purpose)) {
        blocked.add('source_purpose_not_allowed');
    }
    if (!isSubset(request.requestedFields, capability.supportedFields) || !isSubset(request.requestedFields, policy.allowedFields)) {
        blocked.add('source_field_not_allowed');
    }
    if (!isSubset(request.requestedDataClassifications, capability.dataClassifications) ||
        !isSubset(request.requestedDataClassifications, policy.allowedDataClassifications)) {
        blocked.add('source_data_classification_not_allowed');
    }
    if (request.requestedDataClassifications.includes('AUTH_SECRET'))
        blocked.add('source_auth_secret_forbidden');
    if (request.requestedDataClassifications.includes('PERSONAL_BUSINESS_CONTACT')) {
        if (!policy.personalData.allowed)
            blocked.add('source_personal_data_not_allowed');
        else if (policy.personalData.requiresPurposeReview)
            review.add('source_personal_data_review_required');
    }
    const requestedCountries = request.geography.countryCodes;
    const blockedCountries = new Set(policy.geography.blockedCountryCodes);
    if (requestedCountries.some((country) => blockedCountries.has(country)))
        blocked.add('source_geography_blocked');
    if (policy.geography.mode === 'country_allowlist' &&
        requestedCountries.some((country) => !policy.geography.allowedCountryCodes.includes(country))) {
        blocked.add('source_geography_not_allowed');
    }
    if (capability.geography.mode === 'country_allowlist' &&
        requestedCountries.some((country) => !capability.geography.countryCodes.includes(country))) {
        blocked.add('source_geography_not_supported');
    }
    if (!policy.storage.allowedClasses.includes(request.storageClass))
        blocked.add('source_storage_not_allowed');
    if (policy.state === 'TRANSIENT_ONLY' &&
        request.storageClass !== 'TRANSIENT' &&
        request.storageClass !== 'REFERENCE_ONLY') {
        blocked.add('source_transient_only_storage');
    }
    if (request.rawPayloadRequested && (!policy.storage.rawPayloadStorageAllowed || !capability.supportsRawPayloadReference)) {
        blocked.add('source_raw_payload_not_allowed');
    }
    if (request.exportRequested) {
        if (policy.export.mode === 'none')
            blocked.add('source_export_not_allowed');
        if (request.requestedDataClassifications.includes('PERSONAL_BUSINESS_CONTACT') &&
            !policy.personalData.exportAllowed) {
            blocked.add('source_personal_export_not_allowed');
        }
    }
    if (policy.robots.mode === 'respect') {
        if (request.robotsDecision === 'disallowed')
            blocked.add('source_robots_disallowed');
        if (request.robotsDecision === 'unknown')
            review.add('source_robots_unknown');
    }
    if (budgetExceeds(request.budget, capability.hardLimits))
        blocked.add('source_budget_exceeds_capability');
    if (budgetExceeds(request.budget, policy.quotas))
        blocked.add('source_budget_exceeds_policy');
    const healthAgeMs = Date.parse(input.evaluatedAt) - Date.parse(health.observedAt);
    if (healthAgeMs < 0 || healthAgeMs > input.maxHealthAgeSeconds * 1000)
        review.add('connector_health_stale');
    if (health.status === 'disabled' || health.status === 'circuit_open')
        blocked.add('connector_health_blocked');
    if (health.status === 'rate_limited' && request.executionIntent === 'execute')
        blocked.add('connector_rate_limited');
    if (health.status === 'unknown')
        review.add('connector_health_unknown');
    if (health.status === 'degraded')
        warnings.add('connector_health_degraded');
    if (health.quotaRemaining !== null && request.budget.maxRequests > health.quotaRemaining) {
        blocked.add('connector_quota_insufficient');
    }
    const decision = blocked.size > 0 ? 'blocked' : review.size > 0 ? 'review_required' : 'allow';
    return exports.ConnectorAdmissionDecisionSchema.parse({
        decision,
        reasonCodes: [...blocked, ...review].sort(),
        warnings: [...warnings].sort(),
        policySnapshot: { policyId: policy.policyId, policyVersion: policy.version },
        connectorKey: connector.connectorKey,
        connectorVersion: connector.version,
        sourceKey: capability.sourceKey,
        operation: request.operation,
        storageClass: request.storageClass,
        allowedStorageClasses: policy.state === 'TRANSIENT_ONLY'
            ? policy.storage.allowedClasses.filter((value) => value === 'TRANSIENT' || value === 'REFERENCE_ONLY')
            : policy.storage.allowedClasses,
        exportAllowed: request.exportRequested && policy.export.mode !== 'none' && blocked.size === 0,
        rawPayloadAllowed: request.rawPayloadRequested &&
            policy.storage.rawPayloadStorageAllowed &&
            capability.supportsRawPayloadReference &&
            blocked.size === 0,
        effectiveBudget: minBudget(capability.hardLimits, policy.quotas),
        evaluatedAt: input.evaluatedAt,
    });
}
exports.SourceReferenceSchema = zod_1.z.object({
    referenceId: IdentifierSchema,
    sourceKey: zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/),
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    externalId: zod_1.z.string().trim().min(1).max(512).optional(),
    url: UrlSchema.optional(),
    observedAt: DateTimeSchema.optional(),
    fetchedAt: DateTimeSchema,
    contentHash: zod_1.z.string().regex(/^[a-f0-9]{64}$/).optional(),
    attribution: zod_1.z.string().trim().min(1).max(2000).optional(),
});
exports.SourceCandidateSchema = zod_1.z.object({
    candidateId: IdentifierSchema,
    objectType: zod_1.z.enum([
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
    candidateState: zod_1.z.literal('unverified'),
    fields: zod_1.z.record(zod_1.z.string().max(128), zod_1.z.unknown()),
    fieldNames: zod_1.z.array(IdentifierSchema).min(1).max(512),
    dataClassifications: zod_1.z.array(exports.SourceDataClassificationSchema).min(1).max(exports.sourceDataClassificationValues.length),
    storageClass: exports.SourceStorageClassSchema,
    sourceReferenceIds: zod_1.z.array(IdentifierSchema).min(1).max(64),
    observedAt: DateTimeSchema,
});
exports.SourceResultEnvelopeSchema = zod_1.z
    .object({
    version: zod_1.z.literal('1.0.0'),
    requestId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    sourceTaskId: IdentifierSchema,
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourceKey: zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/),
    policySnapshot: zod_1.z.object({ policyId: IdentifierSchema, policyVersion: VersionSchema }),
    status: zod_1.z.enum(['complete', 'partial', 'empty', 'blocked', 'failed']),
    sourceReferences: zod_1.z.array(exports.SourceReferenceSchema).max(2048),
    candidates: zod_1.z.array(exports.SourceCandidateSchema).max(2048),
    rawPayloadRefs: zod_1.z.array(IdentifierSchema).max(256),
    nextCursor: zod_1.z.string().max(4096).optional(),
    usage: zod_1.z.object({
        requests: SafeIntegerSchema,
        pages: SafeIntegerSchema,
        bytes: SafeIntegerSchema,
        currencyMicros: SafeIntegerSchema,
        runtimeMs: SafeIntegerSchema,
    }),
    coverage: zod_1.z.object({
        state: zod_1.z.enum(['complete', 'partial', 'unknown']),
        returnedRecords: SafeIntegerSchema,
        estimatedTotalRecords: SafeIntegerSchema.nullable(),
        notes: zod_1.z.array(IdentifierSchema).max(64),
    }),
    errors: zod_1.z.array(zod_1.z.object({
        code: IdentifierSchema,
        classification: zod_1.z.enum(['retryable', 'permanent', 'policy', 'quota', 'partial']),
        message: zod_1.z.string().trim().min(1).max(1000),
    })).max(128),
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
        addDuplicateIssue(candidate.dataClassifications, ctx, ['candidates', index, 'dataClassifications'], 'candidate dataClassifications must be unique.');
        addDuplicateIssue(candidate.sourceReferenceIds, ctx, ['candidates', index, 'sourceReferenceIds'], 'candidate sourceReferenceIds must be unique.');
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
exports.SourceResultValidationSchema = zod_1.z.object({
    valid: zod_1.z.boolean(),
    issues: zod_1.z.array(IdentifierSchema),
});
function validateSourceResultAgainstAdmission(input) {
    const result = exports.SourceResultEnvelopeSchema.parse(input.result);
    const request = exports.SourceRequestEnvelopeSchema.parse(input.request);
    const capability = exports.SourceCapabilitySchema.parse(input.capability);
    const policy = exports.ConnectorPolicySchema.parse(input.policy);
    const admission = exports.ConnectorAdmissionDecisionSchema.parse(input.admission);
    const issues = new Set();
    if (admission.decision !== 'allow')
        issues.add('source_result_without_allowed_admission');
    if (result.requestId !== request.requestId ||
        result.workspaceId !== request.workspaceId ||
        result.sourceTaskId !== request.sourceTaskId ||
        result.connectorKey !== request.connectorKey ||
        result.connectorVersion !== request.connectorVersion ||
        result.sourceKey !== request.sourceKey ||
        result.policySnapshot.policyId !== request.policySnapshot.policyId ||
        result.policySnapshot.policyVersion !== request.policySnapshot.policyVersion) {
        issues.add('source_result_identity_mismatch');
    }
    if (result.usage.requests > admission.effectiveBudget.maxRequests ||
        result.usage.pages > admission.effectiveBudget.maxPages ||
        result.usage.bytes > admission.effectiveBudget.maxBytes ||
        result.usage.currencyMicros > admission.effectiveBudget.maxCurrencyMicros ||
        result.usage.runtimeMs > admission.effectiveBudget.maxRuntimeMs) {
        issues.add('source_result_budget_exceeded');
    }
    for (const reference of result.sourceReferences) {
        if (reference.sourceKey !== request.sourceKey ||
            reference.connectorKey !== request.connectorKey ||
            reference.connectorVersion !== request.connectorVersion) {
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
        if (!isSubset(candidate.dataClassifications, request.requestedDataClassifications) ||
            !isSubset(candidate.dataClassifications, capability.dataClassifications) ||
            !isSubset(candidate.dataClassifications, policy.allowedDataClassifications)) {
            issues.add('source_result_classification_violation');
        }
    }
    if (result.rawPayloadRefs.length > 0 && !admission.rawPayloadAllowed)
        issues.add('source_result_raw_payload_violation');
    if (result.nextCursor !== undefined && capability.pagination.mode === 'none')
        issues.add('source_result_pagination_violation');
    if (request.exportRequested && !admission.exportAllowed)
        issues.add('source_result_export_violation');
    return exports.SourceResultValidationSchema.parse({ valid: issues.size === 0, issues: [...issues].sort() });
}
//# sourceMappingURL=source.js.map