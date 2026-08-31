import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { agentRuns } from './agent-run-schema';
import { users, workspaces } from './schema';

export const persistedMemoryTypeValues = [
  'working',
  'semantic',
  'episodic',
  'procedural',
  'entity',
  'lead',
  'research',
  'workspace_user',
] as const;
export type PersistedMemoryType = (typeof persistedMemoryTypeValues)[number];

export const persistedMemoryWriterValues = ['user', 'agent', 'system', 'curator'] as const;
export type PersistedMemoryWriter = (typeof persistedMemoryWriterValues)[number];

export const persistedMemoryAuthorityValues = [
  'platform_policy',
  'explicit_configuration',
  'verified_fact',
  'reviewed_human_decision',
  'evaluated_agent_conclusion',
  'agent_inference',
  'historical_context',
] as const;
export type PersistedMemoryAuthority = (typeof persistedMemoryAuthorityValues)[number];

export const persistedMemoryStatusValues = [
  'proposed',
  'active',
  'stale',
  'conflicted',
  'superseded',
  'rejected',
  'deleted',
] as const;
export type PersistedMemoryStatus = (typeof persistedMemoryStatusValues)[number];

export const persistedDataClassificationValues = [
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
export type PersistedDataClassification = (typeof persistedDataClassificationValues)[number];

export const memoryRecords = pgTable(
  'memory_records',
  {
    id: text('id').primaryKey(),
    version: text('version').notNull(),
    revisionParentId: text('revision_parent_id'),
    namespace: text('namespace').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    runId: text('run_id').references(() => agentRuns.id, { onDelete: 'restrict' }),
    entityId: text('entity_id'),
    leadId: text('lead_id'),
    memoryType: text('memory_type').$type<PersistedMemoryType>().notNull(),
    subtype: text('subtype').notNull(),
    writer: text('writer').$type<PersistedMemoryWriter>().notNull(),
    aiDerived: boolean('ai_derived').notNull(),
    derivation: jsonb('derivation').$type<Record<string, unknown>>(),
    confidence: doublePrecision('confidence').notNull(),
    authority: text('authority').$type<PersistedMemoryAuthority>().notNull(),
    status: text('status').$type<PersistedMemoryStatus>().notNull(),
    retentionPolicyId: text('retention_policy_id').notNull(),
    deletionReason: text('deletion_reason'),
    dataClassification: text('data_classification').$type<PersistedDataClassification>().notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('memory_records_id_workspace_unique').on(table.id, table.workspaceId),
    index('memory_records_workspace_status_idx').on(table.workspaceId, table.status, table.updatedAt),
    index('memory_records_workspace_namespace_idx').on(table.workspaceId, table.namespace, table.updatedAt),
    index('memory_records_revision_parent_idx').on(table.workspaceId, table.revisionParentId),
    check('memory_records_id_check', sql`length(btrim(${table.id})) > 0`),
    check('memory_records_version_check', sql`length(btrim(${table.version})) > 0`),
    check('memory_records_namespace_check', sql`length(btrim(${table.namespace})) > 0`),
    check('memory_records_confidence_check', sql`${table.confidence} >= 0 and ${table.confidence} <= 1`),
    check(
      'memory_records_protected_procedural_write_check',
      sql`not (${table.writer} = 'agent' and ${table.namespace} like 'system/procedural/%')`,
    ),
    check(
      'memory_records_revision_not_self_check',
      sql`${table.revisionParentId} is null or ${table.revisionParentId} <> ${table.id}`,
    ),
  ],
);
