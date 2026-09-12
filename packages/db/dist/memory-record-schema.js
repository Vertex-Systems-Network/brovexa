"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryRecords = exports.persistedDataClassificationValues = exports.persistedMemoryStatusValues = exports.persistedMemoryAuthorityValues = exports.persistedMemoryWriterValues = exports.persistedMemoryTypeValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const agent_run_schema_1 = require("./agent-run-schema");
const schema_1 = require("./schema");
exports.persistedMemoryTypeValues = [
    'working',
    'semantic',
    'episodic',
    'procedural',
    'entity',
    'lead',
    'research',
    'workspace_user',
];
exports.persistedMemoryWriterValues = ['user', 'agent', 'system', 'curator'];
exports.persistedMemoryAuthorityValues = [
    'platform_policy',
    'explicit_configuration',
    'verified_fact',
    'reviewed_human_decision',
    'evaluated_agent_conclusion',
    'agent_inference',
    'historical_context',
];
exports.persistedMemoryStatusValues = [
    'proposed',
    'active',
    'stale',
    'conflicted',
    'superseded',
    'rejected',
    'deleted',
];
exports.persistedDataClassificationValues = [
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
exports.memoryRecords = (0, pg_core_1.pgTable)('memory_records', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    version: (0, pg_core_1.text)('version').notNull(),
    revisionParentId: (0, pg_core_1.text)('revision_parent_id'),
    namespace: (0, pg_core_1.text)('namespace').notNull(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').references(() => schema_1.users.id, { onDelete: 'set null' }),
    runId: (0, pg_core_1.text)('run_id').references(() => agent_run_schema_1.agentRuns.id, { onDelete: 'restrict' }),
    entityId: (0, pg_core_1.text)('entity_id'),
    leadId: (0, pg_core_1.text)('lead_id'),
    memoryType: (0, pg_core_1.text)('memory_type').$type().notNull(),
    subtype: (0, pg_core_1.text)('subtype').notNull(),
    writer: (0, pg_core_1.text)('writer').$type().notNull(),
    aiDerived: (0, pg_core_1.boolean)('ai_derived').notNull(),
    derivation: (0, pg_core_1.jsonb)('derivation').$type(),
    confidence: (0, pg_core_1.doublePrecision)('confidence').notNull(),
    authority: (0, pg_core_1.text)('authority').$type().notNull(),
    status: (0, pg_core_1.text)('status').$type().notNull(),
    retentionPolicyId: (0, pg_core_1.text)('retention_policy_id').notNull(),
    deletionReason: (0, pg_core_1.text)('deletion_reason'),
    lastLifecycleEventId: (0, pg_core_1.text)('last_lifecycle_event_id'),
    dataClassification: (0, pg_core_1.text)('data_classification').$type().notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('memory_records_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('memory_records_workspace_status_idx').on(table.workspaceId, table.status, table.updatedAt),
    (0, pg_core_1.index)('memory_records_workspace_namespace_idx').on(table.workspaceId, table.namespace, table.updatedAt),
    (0, pg_core_1.index)('memory_records_revision_parent_idx').on(table.workspaceId, table.revisionParentId),
    (0, pg_core_1.check)('memory_records_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('memory_records_version_check', (0, drizzle_orm_1.sql) `length(btrim(${table.version})) > 0`),
    (0, pg_core_1.check)('memory_records_namespace_check', (0, drizzle_orm_1.sql) `length(btrim(${table.namespace})) > 0`),
    (0, pg_core_1.check)('memory_records_confidence_check', (0, drizzle_orm_1.sql) `${table.confidence} >= 0 and ${table.confidence} <= 1`),
    (0, pg_core_1.check)('memory_records_protected_procedural_write_check', (0, drizzle_orm_1.sql) `not (${table.writer} = 'agent' and ${table.namespace} like 'system/procedural/%')`),
    (0, pg_core_1.check)('memory_records_revision_not_self_check', (0, drizzle_orm_1.sql) `${table.revisionParentId} is null or ${table.revisionParentId} <> ${table.id}`),
]);
//# sourceMappingURL=memory-record-schema.js.map