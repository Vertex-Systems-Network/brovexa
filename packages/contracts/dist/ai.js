"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvalResultSchema = exports.AgentRunSchema = exports.AgentRunStatusSchema = exports.MemoryRecordSchema = exports.MemoryProvenanceSchema = exports.ContextReceiptSchema = exports.ContextReceiptMemoryRefSchema = exports.AgentDefinitionSchema = exports.AgentMemoryAccessSchema = exports.AgentModelPolicySchema = exports.AgentBudgetSchema = exports.EvidenceVerificationSchema = exports.evidenceVerificationValues = exports.EvaluatorStateSchema = exports.evaluatorStateValues = exports.ValidationStateSchema = exports.validationStateValues = exports.DataClassificationSchema = exports.dataClassificationValues = exports.MemoryAuthoritySchema = exports.memoryAuthorityValues = exports.MemoryStatusSchema = exports.memoryStatusValues = exports.MemoryTypeSchema = exports.memoryTypeValues = exports.AutonomyTierSchema = exports.autonomyTierValues = void 0;
exports.isMemoryNamespaceAllowed = isMemoryNamespaceAllowed;
const zod_1 = require("zod");
const IdentifierSchema = zod_1.z.string().trim().min(1).max(128);
const VersionSchema = zod_1.z.string().trim().min(1).max(64);
const DateTimeSchema = zod_1.z.string().datetime();
const ConfidenceSchema = zod_1.z.number().min(0).max(1);
const SafeIntegerBudgetSchema = zod_1.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
exports.autonomyTierValues = ['T0', 'T1', 'T2', 'T3', 'T4'];
exports.AutonomyTierSchema = zod_1.z.enum(exports.autonomyTierValues);
exports.memoryTypeValues = [
    'working',
    'semantic',
    'episodic',
    'procedural',
    'entity',
    'lead',
    'research',
    'workspace_user',
];
exports.MemoryTypeSchema = zod_1.z.enum(exports.memoryTypeValues);
exports.memoryStatusValues = [
    'proposed',
    'active',
    'stale',
    'conflicted',
    'superseded',
    'rejected',
    'deleted',
];
exports.MemoryStatusSchema = zod_1.z.enum(exports.memoryStatusValues);
exports.memoryAuthorityValues = [
    'platform_policy',
    'explicit_configuration',
    'verified_fact',
    'reviewed_human_decision',
    'evaluated_agent_conclusion',
    'agent_inference',
    'historical_context',
];
exports.MemoryAuthoritySchema = zod_1.z.enum(exports.memoryAuthorityValues);
exports.dataClassificationValues = [
    'PUBLIC_SOURCE_TRANSIENT',
    'PUBLIC_SOURCE_STORABLE',
    'BUSINESS_DATA',
    'PERSONAL_BUSINESS_CONTACT',
    'WORKSPACE_CONFIDENTIAL',
    'SECURITY_SENSITIVE',
    'BILLING_FINANCIAL',
    'AUDIT_IMMUTABLE',
    'AI_DERIVED',
];
exports.DataClassificationSchema = zod_1.z.enum(exports.dataClassificationValues);
exports.validationStateValues = ['pending', 'passed', 'failed', 'review'];
exports.ValidationStateSchema = zod_1.z.enum(exports.validationStateValues);
exports.evaluatorStateValues = ['not_required', 'pending', 'accepted', 'rejected', 'review'];
exports.EvaluatorStateSchema = zod_1.z.enum(exports.evaluatorStateValues);
exports.evidenceVerificationValues = [
    'verified',
    'insufficient',
    'contradicted',
    'stale',
    'policy_invalid',
];
exports.EvidenceVerificationSchema = zod_1.z.enum(exports.evidenceVerificationValues);
exports.AgentBudgetSchema = zod_1.z.object({
    maxTokens: SafeIntegerBudgetSchema,
    maxSearches: SafeIntegerBudgetSchema,
    maxApiCalls: SafeIntegerBudgetSchema,
    maxCredits: SafeIntegerBudgetSchema,
    maxCurrencyMicros: SafeIntegerBudgetSchema,
    maxRuntimeMs: SafeIntegerBudgetSchema,
    maxConcurrency: zod_1.z.number().int().min(1).max(256),
});
exports.AgentModelPolicySchema = zod_1.z.object({
    routingMode: zod_1.z.enum(['deterministic_only', 'approved_models']),
    allowedProviderIds: zod_1.z.array(IdentifierSchema).max(32),
    allowedModelIds: zod_1.z.array(IdentifierSchema).max(64),
    fallbackModelIds: zod_1.z.array(IdentifierSchema).max(16),
});
exports.AgentMemoryAccessSchema = zod_1.z.object({
    read: zod_1.z.array(zod_1.z.string().trim().min(1).max(256)).max(64),
    propose: zod_1.z.array(zod_1.z.string().trim().min(1).max(256)).max(64),
    commit: zod_1.z.array(zod_1.z.string().trim().min(1).max(256)).max(64),
    supersede: zod_1.z.array(zod_1.z.string().trim().min(1).max(256)).max(64),
});
function isProtectedProceduralWriteScope(scope) {
    const normalized = scope.replace(/\*+$/, '');
    return normalized === 'system/procedural/' || normalized.startsWith('system/procedural/');
}
exports.AgentDefinitionSchema = zod_1.z
    .object({
    key: zod_1.z.string().regex(/^agent\.[a-z0-9_.-]+$/),
    version: VersionSchema,
    status: zod_1.z.enum(['draft', 'approved', 'disabled']),
    purpose: zod_1.z.string().trim().min(1).max(2000),
    nonGoals: zod_1.z.array(zod_1.z.string().trim().min(1).max(1000)).max(64),
    triggerTypes: zod_1.z.array(IdentifierSchema).min(1).max(64),
    inputSchemaId: IdentifierSchema,
    outputSchemaId: IdentifierSchema,
    allowedTools: zod_1.z.array(IdentifierSchema).max(128),
    allowedCommands: zod_1.z.array(IdentifierSchema).max(128),
    memory: exports.AgentMemoryAccessSchema,
    autonomyTier: exports.AutonomyTierSchema,
    humanInterrupts: zod_1.z.array(IdentifierSchema).max(64),
    requiresHumanApproval: zod_1.z.boolean(),
    modelPolicy: exports.AgentModelPolicySchema,
    promptVersion: VersionSchema,
    skillVersions: zod_1.z.record(IdentifierSchema, VersionSchema),
    contextVersion: VersionSchema,
    retryLimit: zod_1.z.number().int().min(0).max(20),
    fallbackPolicyId: IdentifierSchema.optional(),
    budget: exports.AgentBudgetSchema,
    deterministicValidators: zod_1.z.array(IdentifierSchema).min(1).max(128),
    evidenceRequired: zod_1.z.boolean(),
    minimumConfidence: ConfidenceSchema,
    reviewBelowConfidence: ConfidenceSchema,
    independentEvaluatorKey: zod_1.z.string().regex(/^agent\.[a-z0-9_.-]+$/).optional(),
    evalSuiteId: IdentifierSchema,
    evalThreshold: ConfidenceSchema,
    dataClassifications: zod_1.z.array(exports.DataClassificationSchema).min(1),
    telemetryRedactionPolicyId: IdentifierSchema,
    owner: IdentifierSchema,
    changeReason: zod_1.z.string().trim().min(1).max(2000),
    rollbackToVersion: VersionSchema.optional(),
})
    .superRefine((definition, ctx) => {
    for (const scope of [...definition.memory.commit, ...definition.memory.supersede]) {
        if (isProtectedProceduralWriteScope(scope)) {
            ctx.addIssue({
                code: 'custom',
                path: ['memory'],
                message: 'Agents cannot directly commit or supersede system procedural memory.',
            });
        }
    }
    if (definition.autonomyTier === 'T4' && !definition.requiresHumanApproval) {
        ctx.addIssue({
            code: 'custom',
            path: ['requiresHumanApproval'],
            message: 'T4 agents require human approval.',
        });
    }
    if (definition.modelPolicy.routingMode === 'deterministic_only' &&
        (definition.modelPolicy.allowedProviderIds.length > 0 ||
            definition.modelPolicy.allowedModelIds.length > 0 ||
            definition.modelPolicy.fallbackModelIds.length > 0)) {
        ctx.addIssue({
            code: 'custom',
            path: ['modelPolicy'],
            message: 'Deterministic-only agents cannot declare model/provider routes.',
        });
    }
    if (definition.modelPolicy.routingMode === 'approved_models' &&
        (definition.modelPolicy.allowedProviderIds.length === 0 || definition.modelPolicy.allowedModelIds.length === 0)) {
        ctx.addIssue({
            code: 'custom',
            path: ['modelPolicy'],
            message: 'Model-routed agents require at least one approved provider and model.',
        });
    }
});
function isMemoryNamespaceAllowed(namespace, scope) {
    const segments = namespace.split('/').filter(Boolean);
    if (segments[0] === 'system' && segments[1] === 'procedural' && segments.length >= 3) {
        return true;
    }
    if (segments[0] === 'workspace' && segments[1] === scope.workspaceId && segments.length >= 3) {
        return true;
    }
    if (scope.userId &&
        segments[0] === 'user' &&
        segments[1] === scope.userId &&
        segments[2] === 'workspace' &&
        segments[3] === scope.workspaceId &&
        segments.length >= 5) {
        return true;
    }
    if (scope.runId && segments[0] === 'run' && segments[1] === scope.runId && segments.length >= 3) {
        return true;
    }
    return false;
}
exports.ContextReceiptMemoryRefSchema = zod_1.z.object({
    memoryId: IdentifierSchema,
    version: VersionSchema,
    namespace: zod_1.z.string().trim().min(1).max(512),
    authority: exports.MemoryAuthoritySchema,
    status: exports.MemoryStatusSchema,
});
exports.ContextReceiptSchema = zod_1.z
    .object({
    id: IdentifierSchema,
    taskId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    userId: IdentifierSchema.optional(),
    runId: IdentifierSchema.optional(),
    agentKey: zod_1.z.string().regex(/^agent\.[a-z0-9_.-]+$/),
    agentVersion: VersionSchema,
    policyRefs: zod_1.z.array(IdentifierSchema).min(1).max(128),
    canonicalRefs: zod_1.z.array(IdentifierSchema).max(512),
    memoryRefs: zod_1.z.array(exports.ContextReceiptMemoryRefSchema).max(512),
    tokenBudget: SafeIntegerBudgetSchema,
    maxCurrencyMicros: SafeIntegerBudgetSchema,
    createdAt: DateTimeSchema,
})
    .superRefine((receipt, ctx) => {
    receipt.memoryRefs.forEach((memoryRef, index) => {
        if (!isMemoryNamespaceAllowed(memoryRef.namespace, {
            workspaceId: receipt.workspaceId,
            userId: receipt.userId,
            runId: receipt.runId,
        })) {
            ctx.addIssue({
                code: 'custom',
                path: ['memoryRefs', index, 'namespace'],
                message: 'Memory namespace is outside the receipt tenant/user/run scope.',
            });
        }
    });
});
exports.MemoryProvenanceSchema = zod_1.z.object({
    kind: zod_1.z.enum(['evidence', 'fact', 'activity', 'run', 'user_decision', 'policy']),
    refId: IdentifierSchema,
});
exports.MemoryRecordSchema = zod_1.z
    .object({
    id: IdentifierSchema,
    version: VersionSchema,
    revisionParentId: IdentifierSchema.optional(),
    namespace: zod_1.z.string().trim().min(1).max(512),
    workspaceId: IdentifierSchema,
    userId: IdentifierSchema.optional(),
    runId: IdentifierSchema.optional(),
    entityId: IdentifierSchema.optional(),
    leadId: IdentifierSchema.optional(),
    type: exports.MemoryTypeSchema,
    subtype: IdentifierSchema,
    subjectRefs: zod_1.z.array(IdentifierSchema).max(128),
    contentSchemaId: IdentifierSchema,
    contentSchemaVersion: VersionSchema,
    content: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    provenance: zod_1.z.array(exports.MemoryProvenanceSchema).min(1).max(256),
    writer: zod_1.z.enum(['user', 'agent', 'system', 'curator']),
    aiDerived: zod_1.z.boolean(),
    derivation: zod_1.z
        .object({
        agentKey: zod_1.z.string().regex(/^agent\.[a-z0-9_.-]+$/),
        agentVersion: VersionSchema,
        modelId: IdentifierSchema,
        promptVersion: VersionSchema,
        toolVersions: zod_1.z.record(IdentifierSchema, VersionSchema),
    })
        .optional(),
    confidence: ConfidenceSchema,
    authority: exports.MemoryAuthoritySchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    observedAt: DateTimeSchema.optional(),
    lastVerifiedAt: DateTimeSchema.optional(),
    validFrom: DateTimeSchema.optional(),
    validTo: DateTimeSchema.optional(),
    refreshAfter: DateTimeSchema.optional(),
    expiresAt: DateTimeSchema.optional(),
    status: exports.MemoryStatusSchema,
    retentionPolicyId: IdentifierSchema,
    deletionReason: zod_1.z.string().trim().min(1).max(1000).optional(),
    readCapabilities: zod_1.z.array(IdentifierSchema).min(1).max(128),
    writeCapabilities: zod_1.z.array(IdentifierSchema).max(128),
    dataClassification: exports.DataClassificationSchema,
    sourcePolicyRefs: zod_1.z.array(IdentifierSchema).max(64),
    jurisdictionRefs: zod_1.z.array(IdentifierSchema).max(64),
})
    .superRefine((memory, ctx) => {
    if (!isMemoryNamespaceAllowed(memory.namespace, {
        workspaceId: memory.workspaceId,
        userId: memory.userId,
        runId: memory.runId,
    })) {
        ctx.addIssue({
            code: 'custom',
            path: ['namespace'],
            message: 'Memory namespace is inconsistent with canonical scope fields.',
        });
    }
    if (memory.aiDerived && !memory.derivation) {
        ctx.addIssue({
            code: 'custom',
            path: ['derivation'],
            message: 'AI-derived memory requires agent/model/prompt/tool derivation metadata.',
        });
    }
    if (!memory.aiDerived && memory.derivation) {
        ctx.addIssue({
            code: 'custom',
            path: ['derivation'],
            message: 'Non-AI memory must not claim AI derivation metadata.',
        });
    }
    if (memory.status === 'deleted' && !memory.deletionReason) {
        ctx.addIssue({
            code: 'custom',
            path: ['deletionReason'],
            message: 'Deleted memory requires an explicit deletion reason.',
        });
    }
    if (memory.status !== 'deleted' && memory.deletionReason) {
        ctx.addIssue({
            code: 'custom',
            path: ['deletionReason'],
            message: 'Deletion reason is only valid for deleted memory.',
        });
    }
});
exports.AgentRunStatusSchema = zod_1.z.enum([
    'queued',
    'running',
    'succeeded',
    'failed',
    'blocked',
    'budget_stopped',
    'cancelled',
    'review_required',
]);
exports.AgentRunSchema = zod_1.z
    .object({
    id: IdentifierSchema,
    workspaceId: IdentifierSchema,
    agentKey: zod_1.z.string().regex(/^agent\.[a-z0-9_.-]+$/),
    agentVersion: VersionSchema,
    parentRunId: IdentifierSchema.optional(),
    handoffId: IdentifierSchema.optional(),
    executionMode: zod_1.z.enum(['deterministic', 'model']),
    providerId: IdentifierSchema.optional(),
    modelId: IdentifierSchema.optional(),
    promptVersion: VersionSchema,
    skillVersions: zod_1.z.record(IdentifierSchema, VersionSchema),
    contextReceiptId: IdentifierSchema,
    status: exports.AgentRunStatusSchema,
    result: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    confidence: ConfidenceSchema.optional(),
    uncertainty: zod_1.z.array(zod_1.z.string().trim().min(1).max(1000)).max(128),
    evidenceIds: zod_1.z.array(IdentifierSchema).max(512),
    factIds: zod_1.z.array(IdentifierSchema).max(512),
    sourceIds: zod_1.z.array(IdentifierSchema).max(512),
    assumptions: zod_1.z.array(zod_1.z.string().trim().min(1).max(1000)).max(128),
    conflicts: zod_1.z.array(zod_1.z.string().trim().min(1).max(1000)).max(128),
    toolSummary: zod_1.z
        .array(zod_1.z.object({
        toolKey: IdentifierSchema,
        status: zod_1.z.enum(['succeeded', 'failed', 'blocked', 'skipped']),
        costMicros: SafeIntegerBudgetSchema,
    }))
        .max(512),
    cost: zod_1.z.object({
        inputTokens: SafeIntegerBudgetSchema,
        outputTokens: SafeIntegerBudgetSchema,
        searches: SafeIntegerBudgetSchema,
        apiCalls: SafeIntegerBudgetSchema,
        credits: SafeIntegerBudgetSchema,
        currencyMicros: SafeIntegerBudgetSchema,
    }),
    validationState: exports.ValidationStateSchema,
    evaluatorState: exports.EvaluatorStateSchema,
    proposedActions: zod_1.z
        .array(zod_1.z.object({
        commandKey: IdentifierSchema,
        payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
        evidenceRefs: zod_1.z.array(IdentifierSchema).max(128),
    }))
        .max(128),
    startedAt: DateTimeSchema.optional(),
    completedAt: DateTimeSchema.optional(),
})
    .superRefine((run, ctx) => {
    if (run.executionMode === 'model' && (!run.providerId || !run.modelId)) {
        ctx.addIssue({
            code: 'custom',
            path: ['executionMode'],
            message: 'Model execution requires explicit provider and model identifiers.',
        });
    }
    if (run.executionMode === 'deterministic' && (run.providerId || run.modelId)) {
        ctx.addIssue({
            code: 'custom',
            path: ['executionMode'],
            message: 'Deterministic execution cannot claim model/provider execution.',
        });
    }
    if (run.status === 'succeeded' && !run.result) {
        ctx.addIssue({
            code: 'custom',
            path: ['result'],
            message: 'Succeeded agent runs require a structured result.',
        });
    }
});
exports.EvalResultSchema = zod_1.z
    .object({
    id: IdentifierSchema,
    evaluatorRunId: IdentifierSchema,
    subjectRunId: IdentifierSchema,
    decision: zod_1.z.enum(['accept', 'reject', 'review']),
    evidenceState: exports.EvidenceVerificationSchema,
    reasonCodes: zod_1.z.array(IdentifierSchema).min(1).max(128),
    evidenceRefs: zod_1.z.array(IdentifierSchema).max(512),
    policyRefs: zod_1.z.array(IdentifierSchema).min(1).max(128),
    confidence: ConfidenceSchema,
    createdAt: DateTimeSchema,
})
    .superRefine((evaluation, ctx) => {
    if (evaluation.evaluatorRunId === evaluation.subjectRunId) {
        ctx.addIssue({
            code: 'custom',
            path: ['evaluatorRunId'],
            message: 'Independent evaluation cannot reuse the subject agent run.',
        });
    }
    if (evaluation.decision === 'accept' && evaluation.evidenceState !== 'verified') {
        ctx.addIssue({
            code: 'custom',
            path: ['decision'],
            message: 'Evaluation cannot accept a result unless evidence is verified.',
        });
    }
});
//# sourceMappingURL=ai.js.map