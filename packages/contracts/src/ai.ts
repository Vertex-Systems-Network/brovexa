import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(128);
const VersionSchema = z.string().trim().min(1).max(64);
const DateTimeSchema = z.string().datetime();
const ConfidenceSchema = z.number().min(0).max(1);
const SafeIntegerBudgetSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const autonomyTierValues = ['T0', 'T1', 'T2', 'T3', 'T4'] as const;
export const AutonomyTierSchema = z.enum(autonomyTierValues);
export type AutonomyTier = z.infer<typeof AutonomyTierSchema>;

export const memoryTypeValues = [
  'working',
  'semantic',
  'episodic',
  'procedural',
  'entity',
  'lead',
  'research',
  'workspace_user',
] as const;
export const MemoryTypeSchema = z.enum(memoryTypeValues);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const memoryStatusValues = [
  'proposed',
  'active',
  'stale',
  'conflicted',
  'superseded',
  'rejected',
  'deleted',
] as const;
export const MemoryStatusSchema = z.enum(memoryStatusValues);
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

export const memoryAuthorityValues = [
  'platform_policy',
  'explicit_configuration',
  'verified_fact',
  'reviewed_human_decision',
  'evaluated_agent_conclusion',
  'agent_inference',
  'historical_context',
] as const;
export const MemoryAuthoritySchema = z.enum(memoryAuthorityValues);
export type MemoryAuthority = z.infer<typeof MemoryAuthoritySchema>;

export const dataClassificationValues = [
  'PUBLIC_SOURCE_TRANSIENT',
  'PUBLIC_SOURCE_STORABLE',
  'BUSINESS_DATA',
  'PERSONAL_BUSINESS_CONTACT',
  'WORKSPACE_CONFIDENTIAL',
  'SECURITY_SENSITIVE',
  'BILLING_FINANCIAL',
  'AUDIT_IMMUTABLE',
  'AI_DERIVED',
] as const;
export const DataClassificationSchema = z.enum(dataClassificationValues);
export type DataClassification = z.infer<typeof DataClassificationSchema>;

export const validationStateValues = ['pending', 'passed', 'failed', 'review'] as const;
export const ValidationStateSchema = z.enum(validationStateValues);
export type ValidationState = z.infer<typeof ValidationStateSchema>;

export const evaluatorStateValues = ['not_required', 'pending', 'accepted', 'rejected', 'review'] as const;
export const EvaluatorStateSchema = z.enum(evaluatorStateValues);
export type EvaluatorState = z.infer<typeof EvaluatorStateSchema>;

export const evidenceVerificationValues = [
  'verified',
  'insufficient',
  'contradicted',
  'stale',
  'policy_invalid',
] as const;
export const EvidenceVerificationSchema = z.enum(evidenceVerificationValues);
export type EvidenceVerification = z.infer<typeof EvidenceVerificationSchema>;

export const AgentBudgetSchema = z.object({
  maxTokens: SafeIntegerBudgetSchema,
  maxSearches: SafeIntegerBudgetSchema,
  maxApiCalls: SafeIntegerBudgetSchema,
  maxCredits: SafeIntegerBudgetSchema,
  maxCurrencyMicros: SafeIntegerBudgetSchema,
  maxRuntimeMs: SafeIntegerBudgetSchema,
  maxConcurrency: z.number().int().min(1).max(256),
});
export type AgentBudget = z.infer<typeof AgentBudgetSchema>;

export const AgentModelPolicySchema = z.object({
  routingMode: z.enum(['deterministic_only', 'approved_models']),
  allowedProviderIds: z.array(IdentifierSchema).max(32),
  allowedModelIds: z.array(IdentifierSchema).max(64),
  fallbackModelIds: z.array(IdentifierSchema).max(16),
});
export type AgentModelPolicy = z.infer<typeof AgentModelPolicySchema>;

export const AgentMemoryAccessSchema = z.object({
  read: z.array(z.string().trim().min(1).max(256)).max(64),
  propose: z.array(z.string().trim().min(1).max(256)).max(64),
  commit: z.array(z.string().trim().min(1).max(256)).max(64),
  supersede: z.array(z.string().trim().min(1).max(256)).max(64),
});
export type AgentMemoryAccess = z.infer<typeof AgentMemoryAccessSchema>;

function isProtectedProceduralWriteScope(scope: string): boolean {
  const normalized = scope.replace(/\*+$/, '');
  return normalized === 'system/procedural/' || normalized.startsWith('system/procedural/');
}

export const AgentDefinitionSchema = z
  .object({
    key: z.string().regex(/^agent\.[a-z0-9_.-]+$/),
    version: VersionSchema,
    status: z.enum(['draft', 'approved', 'disabled']),
    purpose: z.string().trim().min(1).max(2000),
    nonGoals: z.array(z.string().trim().min(1).max(1000)).max(64),
    triggerTypes: z.array(IdentifierSchema).min(1).max(64),
    inputSchemaId: IdentifierSchema,
    outputSchemaId: IdentifierSchema,
    allowedTools: z.array(IdentifierSchema).max(128),
    allowedCommands: z.array(IdentifierSchema).max(128),
    memory: AgentMemoryAccessSchema,
    autonomyTier: AutonomyTierSchema,
    humanInterrupts: z.array(IdentifierSchema).max(64),
    requiresHumanApproval: z.boolean(),
    modelPolicy: AgentModelPolicySchema,
    promptVersion: VersionSchema,
    skillVersions: z.record(IdentifierSchema, VersionSchema),
    contextVersion: VersionSchema,
    retryLimit: z.number().int().min(0).max(20),
    fallbackPolicyId: IdentifierSchema.optional(),
    budget: AgentBudgetSchema,
    deterministicValidators: z.array(IdentifierSchema).min(1).max(128),
    evidenceRequired: z.boolean(),
    minimumConfidence: ConfidenceSchema,
    reviewBelowConfidence: ConfidenceSchema,
    independentEvaluatorKey: z.string().regex(/^agent\.[a-z0-9_.-]+$/).optional(),
    evalSuiteId: IdentifierSchema,
    evalThreshold: ConfidenceSchema,
    dataClassifications: z.array(DataClassificationSchema).min(1),
    telemetryRedactionPolicyId: IdentifierSchema,
    owner: IdentifierSchema,
    changeReason: z.string().trim().min(1).max(2000),
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

    if (
      definition.modelPolicy.routingMode === 'deterministic_only' &&
      (definition.modelPolicy.allowedProviderIds.length > 0 ||
        definition.modelPolicy.allowedModelIds.length > 0 ||
        definition.modelPolicy.fallbackModelIds.length > 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['modelPolicy'],
        message: 'Deterministic-only agents cannot declare model/provider routes.',
      });
    }

    if (
      definition.modelPolicy.routingMode === 'approved_models' &&
      (definition.modelPolicy.allowedProviderIds.length === 0 || definition.modelPolicy.allowedModelIds.length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['modelPolicy'],
        message: 'Model-routed agents require at least one approved provider and model.',
      });
    }
  });
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export interface MemoryNamespaceScope {
  workspaceId: string;
  userId?: string;
  runId?: string;
}

export function isMemoryNamespaceAllowed(namespace: string, scope: MemoryNamespaceScope): boolean {
  const segments = namespace.split('/').filter(Boolean);

  if (segments[0] === 'system' && segments[1] === 'procedural' && segments.length >= 3) {
    return true;
  }

  if (segments[0] === 'workspace' && segments[1] === scope.workspaceId && segments.length >= 3) {
    return true;
  }

  if (
    scope.userId &&
    segments[0] === 'user' &&
    segments[1] === scope.userId &&
    segments[2] === 'workspace' &&
    segments[3] === scope.workspaceId &&
    segments.length >= 5
  ) {
    return true;
  }

  if (scope.runId && segments[0] === 'run' && segments[1] === scope.runId && segments.length >= 3) {
    return true;
  }

  return false;
}

export const ContextReceiptMemoryRefSchema = z.object({
  memoryId: IdentifierSchema,
  version: VersionSchema,
  namespace: z.string().trim().min(1).max(512),
  authority: MemoryAuthoritySchema,
  status: MemoryStatusSchema,
});

export const ContextReceiptSchema = z
  .object({
    id: IdentifierSchema,
    taskId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    userId: IdentifierSchema.optional(),
    runId: IdentifierSchema.optional(),
    agentKey: z.string().regex(/^agent\.[a-z0-9_.-]+$/),
    agentVersion: VersionSchema,
    policyRefs: z.array(IdentifierSchema).min(1).max(128),
    canonicalRefs: z.array(IdentifierSchema).max(512),
    memoryRefs: z.array(ContextReceiptMemoryRefSchema).max(512),
    tokenBudget: SafeIntegerBudgetSchema,
    maxCurrencyMicros: SafeIntegerBudgetSchema,
    createdAt: DateTimeSchema,
  })
  .superRefine((receipt, ctx) => {
    receipt.memoryRefs.forEach((memoryRef, index) => {
      if (
        !isMemoryNamespaceAllowed(memoryRef.namespace, {
          workspaceId: receipt.workspaceId,
          userId: receipt.userId,
          runId: receipt.runId,
        })
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['memoryRefs', index, 'namespace'],
          message: 'Memory namespace is outside the receipt tenant/user/run scope.',
        });
      }
    });
  });
export type ContextReceipt = z.infer<typeof ContextReceiptSchema>;

export const MemoryProvenanceSchema = z.object({
  kind: z.enum(['evidence', 'fact', 'activity', 'run', 'user_decision', 'policy']),
  refId: IdentifierSchema,
});

export const MemoryRecordSchema = z
  .object({
    id: IdentifierSchema,
    version: VersionSchema,
    revisionParentId: IdentifierSchema.optional(),
    namespace: z.string().trim().min(1).max(512),
    workspaceId: IdentifierSchema,
    userId: IdentifierSchema.optional(),
    runId: IdentifierSchema.optional(),
    entityId: IdentifierSchema.optional(),
    leadId: IdentifierSchema.optional(),
    type: MemoryTypeSchema,
    subtype: IdentifierSchema,
    subjectRefs: z.array(IdentifierSchema).max(128),
    contentSchemaId: IdentifierSchema,
    contentSchemaVersion: VersionSchema,
    content: z.record(z.string(), z.unknown()),
    provenance: z.array(MemoryProvenanceSchema).min(1).max(256),
    writer: z.enum(['user', 'agent', 'system', 'curator']),
    aiDerived: z.boolean(),
    derivation: z
      .object({
        agentKey: z.string().regex(/^agent\.[a-z0-9_.-]+$/),
        agentVersion: VersionSchema,
        modelId: IdentifierSchema,
        promptVersion: VersionSchema,
        toolVersions: z.record(IdentifierSchema, VersionSchema),
      })
      .optional(),
    confidence: ConfidenceSchema,
    authority: MemoryAuthoritySchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    observedAt: DateTimeSchema.optional(),
    lastVerifiedAt: DateTimeSchema.optional(),
    validFrom: DateTimeSchema.optional(),
    validTo: DateTimeSchema.optional(),
    refreshAfter: DateTimeSchema.optional(),
    expiresAt: DateTimeSchema.optional(),
    status: MemoryStatusSchema,
    retentionPolicyId: IdentifierSchema,
    deletionReason: z.string().trim().min(1).max(1000).optional(),
    readCapabilities: z.array(IdentifierSchema).min(1).max(128),
    writeCapabilities: z.array(IdentifierSchema).max(128),
    dataClassification: DataClassificationSchema,
    sourcePolicyRefs: z.array(IdentifierSchema).max(64),
    jurisdictionRefs: z.array(IdentifierSchema).max(64),
  })
  .superRefine((memory, ctx) => {
    if (
      !isMemoryNamespaceAllowed(memory.namespace, {
        workspaceId: memory.workspaceId,
        userId: memory.userId,
        runId: memory.runId,
      })
    ) {
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
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

export const AgentRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'blocked',
  'budget_stopped',
  'cancelled',
  'review_required',
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunSchema = z
  .object({
    id: IdentifierSchema,
    workspaceId: IdentifierSchema,
    agentKey: z.string().regex(/^agent\.[a-z0-9_.-]+$/),
    agentVersion: VersionSchema,
    parentRunId: IdentifierSchema.optional(),
    handoffId: IdentifierSchema.optional(),
    executionMode: z.enum(['deterministic', 'model']),
    providerId: IdentifierSchema.optional(),
    modelId: IdentifierSchema.optional(),
    promptVersion: VersionSchema,
    skillVersions: z.record(IdentifierSchema, VersionSchema),
    contextReceiptId: IdentifierSchema,
    status: AgentRunStatusSchema,
    result: z.record(z.string(), z.unknown()).optional(),
    confidence: ConfidenceSchema.optional(),
    uncertainty: z.array(z.string().trim().min(1).max(1000)).max(128),
    evidenceIds: z.array(IdentifierSchema).max(512),
    factIds: z.array(IdentifierSchema).max(512),
    sourceIds: z.array(IdentifierSchema).max(512),
    assumptions: z.array(z.string().trim().min(1).max(1000)).max(128),
    conflicts: z.array(z.string().trim().min(1).max(1000)).max(128),
    toolSummary: z
      .array(
        z.object({
          toolKey: IdentifierSchema,
          status: z.enum(['succeeded', 'failed', 'blocked', 'skipped']),
          costMicros: SafeIntegerBudgetSchema,
        }),
      )
      .max(512),
    cost: z.object({
      inputTokens: SafeIntegerBudgetSchema,
      outputTokens: SafeIntegerBudgetSchema,
      searches: SafeIntegerBudgetSchema,
      apiCalls: SafeIntegerBudgetSchema,
      credits: SafeIntegerBudgetSchema,
      currencyMicros: SafeIntegerBudgetSchema,
    }),
    validationState: ValidationStateSchema,
    evaluatorState: EvaluatorStateSchema,
    proposedActions: z
      .array(
        z.object({
          commandKey: IdentifierSchema,
          payload: z.record(z.string(), z.unknown()),
          evidenceRefs: z.array(IdentifierSchema).max(128),
        }),
      )
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
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const EvalResultSchema = z
  .object({
    id: IdentifierSchema,
    evaluatorRunId: IdentifierSchema,
    subjectRunId: IdentifierSchema,
    decision: z.enum(['accept', 'reject', 'review']),
    evidenceState: EvidenceVerificationSchema,
    reasonCodes: z.array(IdentifierSchema).min(1).max(128),
    evidenceRefs: z.array(IdentifierSchema).max(512),
    policyRefs: z.array(IdentifierSchema).min(1).max(128),
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
export type EvalResult = z.infer<typeof EvalResultSchema>;
