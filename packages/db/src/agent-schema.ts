import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

export const agentRunStatusValues = [
  'pending',
  'running',
  'paused',
  'review',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type AgentRunStatus = (typeof agentRunStatusValues)[number];

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
export type MemoryType = (typeof memoryTypeValues)[number];

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
export type MemoryStatus = (typeof memoryStatusValues)[number];

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    parentRunId: uuid('parent_run_id'),
    requestedByMembershipId: uuid('requested_by_membership_id'),
    agentKey: text('agent_key').notNull(),
    agentVersion: integer('agent_version').notNull(),
    definitionHash: text('definition_hash').notNull(),
    status: text('status').$type<AgentRunStatus>().notNull().default('pending'),
    correlationId: uuid('correlation_id').defaultRandom().notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('agent_runs_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('agent_runs_id_workspace_definition_unique').on(
      table.id,
      table.workspaceId,
      table.agentKey,
      table.agentVersion,
    ),
    index('agent_runs_workspace_status_created_idx').on(table.workspaceId, table.status, table.createdAt),
    index('agent_runs_workspace_agent_created_idx').on(
      table.workspaceId,
      table.agentKey,
      table.agentVersion,
      table.createdAt,
    ),
    check('agent_runs_key_check', sql`${table.agentKey} ~ '^agent\.[a-z][a-z0-9_.-]*$'`),
    check('agent_runs_version_check', sql`${table.agentVersion} > 0`),
    check('agent_runs_definition_hash_check', sql`${table.definitionHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'agent_runs_status_check',
      sql`${table.status} in ('pending', 'running', 'paused', 'review', 'succeeded', 'failed', 'cancelled')`,
    ),
  ],
);

export const agentCheckpoints = pgTable(
  'agent_checkpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    checkpointKey: text('checkpoint_key').notNull(),
    state: jsonb('state').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    stateHash: text('state_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('agent_checkpoints_run_sequence_unique').on(table.agentRunId, table.sequence),
    uniqueIndex('agent_checkpoints_run_state_unique').on(
      table.agentRunId,
      table.checkpointKey,
      table.stateHash,
    ),
    index('agent_checkpoints_workspace_run_created_idx').on(
      table.workspaceId,
      table.agentRunId,
      table.createdAt,
    ),
    check('agent_checkpoints_sequence_check', sql`${table.sequence} > 0`),
    check('agent_checkpoints_key_check', sql`${table.checkpointKey} ~ '^[a-z][a-z0-9_.-]*$'`),
    check('agent_checkpoints_state_hash_check', sql`${table.stateHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const memoryRecords = pgTable(
  'memory_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id'),
    agentRunId: uuid('agent_run_id'),
    revisionParentId: uuid('revision_parent_id'),
    namespace: text('namespace').notNull(),
    memoryType: text('memory_type').$type<MemoryType>().notNull(),
    subtype: text('subtype').notNull(),
    status: text('status').$type<MemoryStatus>().notNull().default('proposed'),
    authorityClass: integer('authority_class').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    provenance: jsonb('provenance').$type<Record<string, unknown>>().notNull(),
    writerKind: text('writer_kind').notNull(),
    writerAgentKey: text('writer_agent_key'),
    writerAgentVersion: integer('writer_agent_version'),
    confidenceBps: integer('confidence_bps').notNull(),
    dataClassification: text('data_classification').notNull().default('internal'),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true, mode: 'date' }),
    refreshAfter: timestamp('refresh_after', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('memory_records_id_workspace_unique').on(table.id, table.workspaceId),
    index('memory_records_workspace_status_type_idx').on(
      table.workspaceId,
      table.status,
      table.memoryType,
      table.updatedAt,
    ),
    index('memory_records_workspace_namespace_idx').on(table.workspaceId, table.namespace),
    check('memory_records_authority_check', sql`${table.authorityClass} between 1 and 7`),
    check('memory_records_confidence_check', sql`${table.confidenceBps} between 0 and 10000`),
    check('memory_records_subtype_check', sql`${table.subtype} ~ '^[a-z][a-z0-9_.-]*$'`),
  ],
);

export const memoryConflicts = pgTable(
  'memory_conflicts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    leftMemoryId: uuid('left_memory_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'cascade' }),
    rightMemoryId: uuid('right_memory_id')
      .notNull()
      .references(() => memoryRecords.id, { onDelete: 'cascade' }),
    conflictType: text('conflict_type').notNull(),
    status: text('status').notNull().default('open'),
    resolution: jsonb('resolution').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('memory_conflicts_workspace_status_idx').on(table.workspaceId, table.status, table.createdAt),
    check('memory_conflicts_distinct_records_check', sql`${table.leftMemoryId} <> ${table.rightMemoryId}`),
    check('memory_conflicts_type_check', sql`${table.conflictType} ~ '^[a-z][a-z0-9_.-]*$'`),
    check('memory_conflicts_status_check', sql`${table.status} in ('open', 'resolved')`),
  ],
);

export const contextReceipts = pgTable(
  'context_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    agentKey: text('agent_key').notNull(),
    agentVersion: integer('agent_version').notNull(),
    contextVersion: integer('context_version').notNull(),
    tokenBudget: integer('token_budget').notNull(),
    selectedTokenCost: integer('selected_token_cost').notNull(),
    selectedItems: jsonb('selected_items').$type<readonly Record<string, unknown>[]>().notNull(),
    selectionDigest: text('selection_digest').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('context_receipts_run_context_unique').on(table.agentRunId, table.contextVersion),
    index('context_receipts_workspace_run_created_idx').on(
      table.workspaceId,
      table.agentRunId,
      table.createdAt,
    ),
    check('context_receipts_agent_key_check', sql`${table.agentKey} ~ '^agent\.[a-z][a-z0-9_.-]*$'`),
    check('context_receipts_agent_version_check', sql`${table.agentVersion} > 0`),
    check('context_receipts_context_version_check', sql`${table.contextVersion} > 0`),
    check('context_receipts_token_budget_check', sql`${table.tokenBudget} > 0`),
    check(
      'context_receipts_selected_cost_check',
      sql`${table.selectedTokenCost} >= 0 and ${table.selectedTokenCost} <= ${table.tokenBudget}`,
    ),
    check('context_receipts_digest_check', sql`${table.selectionDigest} ~ '^[0-9a-f]{64}$'`),
  ],
);
