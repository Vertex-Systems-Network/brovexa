import { z } from 'zod';

const keyPattern = /^[a-z][a-z0-9_.-]*$/;
const agentKeyPattern = /^agent\.[a-z][a-z0-9_.-]*$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

export const agentAutonomyTierValues = ['T0', 'T1', 'T2', 'T3', 'T4'] as const;
export const AgentAutonomyTierSchema = z.enum(agentAutonomyTierValues);
export type AgentAutonomyTier = z.infer<typeof AgentAutonomyTierSchema>;

export const agentDefinitionStatusValues = ['draft', 'active', 'disabled'] as const;
export const AgentDefinitionStatusSchema = z.enum(agentDefinitionStatusValues);
export type AgentDefinitionStatus = z.infer<typeof AgentDefinitionStatusSchema>;

export const toolAccessValues = [
  'internal.read',
  'internal.write',
  'external.read',
  'external.write',
] as const;
export const ToolAccessSchema = z.enum(toolAccessValues);
export type ToolAccess = z.infer<typeof ToolAccessSchema>;

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
  'quarantined',
] as const;
export const MemoryStatusSchema = z.enum(memoryStatusValues);
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

export const memoryScopeValues = ['workspace', 'user.workspace', 'run', 'system.procedural'] as const;
export const MemoryScopeSchema = z.enum(memoryScopeValues);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const memoryCapabilityActionValues = ['read', 'propose', 'commit', 'supersede'] as const;
export const MemoryCapabilityActionSchema = z.enum(memoryCapabilityActionValues);
export type MemoryCapabilityAction = z.infer<typeof MemoryCapabilityActionSchema>;

export const agentRunStatusValues = [
  'pending',
  'running',
  'paused',
  'review',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export const AgentRunStatusSchema = z.enum(agentRunStatusValues);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const memoryWriterKindValues = ['user', 'agent', 'system', 'curator'] as const;
export const MemoryWriterKindSchema = z.enum(memoryWriterKindValues);
export type MemoryWriterKind = z.infer<typeof MemoryWriterKindSchema>;

export const dataClassificationValues = ['public', 'internal', 'confidential', 'restricted'] as const;
export const DataClassificationSchema = z.enum(dataClassificationValues);
export type DataClassification = z.infer<typeof DataClassificationSchema>;

export const AgentKeySchema = z.string().min(7).max(128).regex(agentKeyPattern);
export const AgentVersionSchema = z.number().int().positive().max(1_000_000);
export const BasisPointsSchema = z.number().int().min(0).max(10_000);
export const MemoryAuthorityClassSchema = z.number().int().min(1).max(7);

export const ToolCapabilitySchema = z.object({
  key: z.string().min(1).max(128).regex(keyPattern),
  access: ToolAccessSchema,
});
export type ToolCapability = z.infer<typeof ToolCapabilitySchema>;

export const MemoryCapabilitySchema = z.object({
  scope: MemoryScopeSchema,
  actions: z.array(MemoryCapabilityActionSchema).min(1).max(4),
  memoryTypes: z.array(MemoryTypeSchema).min(1).max(memoryTypeValues.length),
});
export type MemoryCapability = z.infer<typeof MemoryCapabilitySchema>;

export const AgentBudgetSchema = z.object({
  maxRuntimeMs: z.number().int().positive().max(86_400_000),
  maxConcurrency: z.number().int().positive().max(64),
  maxToolCalls: z.number().int().min(0).max(10_000),
  maxContextTokens: z.number().int().positive().max(1_000_000),
  maxMemoryRecords: z.number().int().min(0).max(10_000),
});
export type AgentBudget = z.infer<typeof AgentBudgetSchema>;

export const AgentDefinitionSchema = z
  .object({
    key: AgentKeySchema,
    version: AgentVersionSchema,
    status: AgentDefinitionStatusSchema,
    purpose: z.string().min(1).max(2_000),
    nonGoals: z.array(z.string().min(1).max(500)).max(64),
    autonomyTier: AgentAutonomyTierSchema,
    inputSchemaVersion: z.number().int().positive(),
    outputSchemaVersion: z.number().int().positive(),
    promptVersion: z.number().int().positive(),
    skillVersion: z.number().int().positive(),
    contextVersion: z.number().int().positive(),
    tools: z.array(ToolCapabilitySchema).max(128),
    canonicalCommands: z.array(z.string().min(1).max(128).regex(keyPattern)).max(128),
    memoryCapabilities: z.array(MemoryCapabilitySchema).max(64),
    allowedDataClassifications: z
      .array(DataClassificationSchema)
      .min(1)
      .max(dataClassificationValues.length),
    budgets: AgentBudgetSchema,
    evaluatorKey: AgentKeySchema.nullable(),
    requiresIndependentEvaluation: z.boolean(),
  })
  .superRefine((definition, context) => {
    if (definition.requiresIndependentEvaluation && !definition.evaluatorKey) {
      context.addIssue({
        code: 'custom',
        path: ['evaluatorKey'],
        message: 'An independent evaluator key is required when independent evaluation is enabled.',
      });
    }

    if (!definition.requiresIndependentEvaluation && definition.evaluatorKey) {
      context.addIssue({
        code: 'custom',
        path: ['evaluatorKey'],
        message: 'Evaluator key must be null when independent evaluation is disabled.',
      });
    }
  });
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export const AgentRunSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  parentRunId: z.string().uuid().nullable(),
  requestedByMembershipId: z.string().uuid().nullable(),
  agentKey: AgentKeySchema,
  agentVersion: AgentVersionSchema,
  definitionHash: z.string().regex(sha256Pattern),
  status: AgentRunStatusSchema,
  correlationId: z.string().uuid(),
  input: z.record(z.string(), z.unknown()),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const AgentCheckpointSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  agentRunId: z.string().uuid(),
  sequence: z.number().int().positive(),
  checkpointKey: z.string().min(1).max(128).regex(keyPattern),
  state: z.record(z.string(), z.unknown()),
  stateHash: z.string().regex(sha256Pattern),
  createdAt: z.string().datetime(),
});
export type AgentCheckpoint = z.infer<typeof AgentCheckpointSchema>;

export const MemoryProvenanceSchema = z
  .object({
    evidenceIds: z.array(z.string().uuid()).max(256),
    factIds: z.array(z.string().uuid()).max(256),
    runIds: z.array(z.string().uuid()).max(256),
    userDecisionIds: z.array(z.string().uuid()).max(256),
  })
  .refine(
    (value) =>
      value.evidenceIds.length +
        value.factIds.length +
        value.runIds.length +
        value.userDecisionIds.length >
      0,
    { message: 'Durable memory requires at least one provenance reference.' },
  );
export type MemoryProvenance = z.infer<typeof MemoryProvenanceSchema>;

export const MemoryRecordSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  agentRunId: z.string().uuid().nullable(),
  revisionParentId: z.string().uuid().nullable(),
  namespace: z.string().min(1).max(512),
  memoryType: MemoryTypeSchema,
  subtype: z.string().min(1).max(128).regex(keyPattern),
  status: MemoryStatusSchema,
  authorityClass: MemoryAuthorityClassSchema,
  content: z.record(z.string(), z.unknown()),
  provenance: MemoryProvenanceSchema,
  writerKind: MemoryWriterKindSchema,
  writerAgentKey: AgentKeySchema.nullable(),
  writerAgentVersion: AgentVersionSchema.nullable(),
  confidenceBps: BasisPointsSchema,
  dataClassification: DataClassificationSchema,
  observedAt: z.string().datetime().nullable(),
  lastVerifiedAt: z.string().datetime().nullable(),
  refreshAfter: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

export const ContextReceiptItemSchema = z.object({
  sourceKind: z.enum(['policy', 'canonical', 'memory']),
  referenceType: z.string().min(1).max(128).regex(keyPattern),
  referenceId: z.string().min(1).max(256),
  authorityClass: MemoryAuthorityClassSchema,
  required: z.boolean(),
  tokenCost: z.number().int().min(0),
});
export type ContextReceiptItem = z.infer<typeof ContextReceiptItemSchema>;

export const ContextReceiptSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    agentRunId: z.string().uuid(),
    agentKey: AgentKeySchema,
    agentVersion: AgentVersionSchema,
    contextVersion: z.number().int().positive(),
    tokenBudget: z.number().int().positive(),
    selectedTokenCost: z.number().int().min(0),
    selectedItems: z.array(ContextReceiptItemSchema).max(10_000),
    selectionDigest: z.string().regex(sha256Pattern),
    createdAt: z.string().datetime(),
  })
  .refine((value) => value.selectedTokenCost <= value.tokenBudget, {
    path: ['selectedTokenCost'],
    message: 'Selected context cannot exceed the declared token budget.',
  });
export type ContextReceipt = z.infer<typeof ContextReceiptSchema>;
