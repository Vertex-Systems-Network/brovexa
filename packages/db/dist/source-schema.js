"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceAdmissionSnapshots = exports.connectorDefinitions = exports.connectorPolicies = exports.sourceCapabilities = exports.sourceAdmissionDecisionValues = exports.connectorActivationValues = exports.connectorDefinitionStatusValues = exports.connectorCredentialModeValues = exports.sourceAccessMethodValues = exports.connectorPolicyStateValues = exports.sourceClassValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const schema_1 = require("./schema");
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
exports.connectorPolicyStateValues = [
    'APPROVED',
    'APPROVED_WITH_LIMITS',
    'TRANSIENT_ONLY',
    'REVIEW_REQUIRED',
    'BLOCKED',
    'EXPIRED',
];
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
exports.connectorCredentialModeValues = [
    'none',
    'api_key_ref',
    'oauth_ref',
    'service_account_ref',
    'user_authorized_ref',
];
exports.connectorDefinitionStatusValues = ['draft', 'approved', 'disabled'];
exports.connectorActivationValues = ['disabled', 'dry_run', 'enabled'];
exports.sourceAdmissionDecisionValues = ['allow', 'review_required', 'blocked'];
exports.sourceCapabilities = (0, pg_core_1.pgTable)('source_capabilities', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    sourceKey: (0, pg_core_1.text)('source_key').notNull(),
    version: (0, pg_core_1.text)('version').notNull(),
    sourceClass: (0, pg_core_1.text)('source_class').$type().notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('source_capabilities_key_version_unique').on(table.sourceKey, table.version),
    (0, pg_core_1.uniqueIndex)('source_capabilities_identity_unique').on(table.id, table.sourceKey, table.version),
    (0, pg_core_1.check)('source_capabilities_source_key_check', (0, drizzle_orm_1.sql) `${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('source_capabilities_version_check', (0, drizzle_orm_1.sql) `length(btrim(${table.version})) > 0`),
]);
exports.connectorPolicies = (0, pg_core_1.pgTable)('connector_policies', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    policyId: (0, pg_core_1.text)('policy_id').notNull(),
    version: (0, pg_core_1.text)('version').notNull(),
    sourceKey: (0, pg_core_1.text)('source_key').notNull(),
    connectorKey: (0, pg_core_1.text)('connector_key').notNull(),
    state: (0, pg_core_1.text)('state').$type().notNull(),
    accessMethod: (0, pg_core_1.text)('access_method').$type().notNull(),
    reviewedAt: (0, pg_core_1.timestamp)('reviewed_at', { withTimezone: true, mode: 'date' }).notNull(),
    nextReviewAt: (0, pg_core_1.timestamp)('next_review_at', { withTimezone: true, mode: 'date' }).notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('connector_policies_key_version_unique').on(table.policyId, table.version),
    (0, pg_core_1.uniqueIndex)('connector_policies_registry_identity_unique').on(table.policyId, table.version, table.sourceKey, table.connectorKey),
    (0, pg_core_1.uniqueIndex)('connector_policies_identity_unique').on(table.id, table.policyId, table.version, table.sourceKey, table.connectorKey),
    (0, pg_core_1.index)('connector_policies_connector_review_idx').on(table.connectorKey, table.nextReviewAt),
    (0, pg_core_1.check)('connector_policies_source_key_check', (0, drizzle_orm_1.sql) `${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('connector_policies_connector_key_check', (0, drizzle_orm_1.sql) `${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
]);
exports.connectorDefinitions = (0, pg_core_1.pgTable)('connector_definitions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    connectorKey: (0, pg_core_1.text)('connector_key').notNull(),
    version: (0, pg_core_1.text)('version').notNull(),
    sourceKey: (0, pg_core_1.text)('source_key').notNull(),
    capabilityVersion: (0, pg_core_1.text)('capability_version').notNull(),
    policyId: (0, pg_core_1.text)('policy_id').notNull(),
    policyVersion: (0, pg_core_1.text)('policy_version').notNull(),
    accessMethod: (0, pg_core_1.text)('access_method').$type().notNull(),
    credentialMode: (0, pg_core_1.text)('credential_mode').$type().notNull(),
    status: (0, pg_core_1.text)('status').$type().notNull(),
    activation: (0, pg_core_1.text)('activation').$type().notNull(),
    implementationVersion: (0, pg_core_1.text)('implementation_version').notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('connector_definitions_key_version_unique').on(table.connectorKey, table.version),
    (0, pg_core_1.uniqueIndex)('connector_definitions_identity_unique').on(table.id, table.connectorKey, table.version, table.sourceKey, table.capabilityVersion, table.policyId, table.policyVersion),
    (0, pg_core_1.index)('connector_definitions_source_status_idx').on(table.sourceKey, table.status, table.activation, table.connectorKey, table.version),
    (0, pg_core_1.check)('connector_definitions_connector_key_check', (0, drizzle_orm_1.sql) `${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
    (0, pg_core_1.check)('connector_definitions_source_key_check', (0, drizzle_orm_1.sql) `${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
]);
exports.sourceAdmissionSnapshots = (0, pg_core_1.pgTable)('source_admission_snapshots', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    sourceTaskId: (0, pg_core_1.text)('source_task_id').notNull(),
    requestId: (0, pg_core_1.text)('request_id').notNull(),
    sourceCapabilityId: (0, pg_core_1.uuid)('source_capability_id')
        .notNull()
        .references(() => exports.sourceCapabilities.id, { onDelete: 'restrict' }),
    connectorPolicyDbId: (0, pg_core_1.uuid)('connector_policy_db_id')
        .notNull()
        .references(() => exports.connectorPolicies.id, { onDelete: 'restrict' }),
    connectorDefinitionId: (0, pg_core_1.uuid)('connector_definition_id')
        .notNull()
        .references(() => exports.connectorDefinitions.id, { onDelete: 'restrict' }),
    sourceKey: (0, pg_core_1.text)('source_key').notNull(),
    capabilityVersion: (0, pg_core_1.text)('capability_version').notNull(),
    connectorKey: (0, pg_core_1.text)('connector_key').notNull(),
    connectorVersion: (0, pg_core_1.text)('connector_version').notNull(),
    policyId: (0, pg_core_1.text)('policy_id').notNull(),
    policyVersion: (0, pg_core_1.text)('policy_version').notNull(),
    decision: (0, pg_core_1.text)('decision').$type().notNull(),
    reasonCodes: (0, pg_core_1.jsonb)('reason_codes').$type().notNull(),
    warnings: (0, pg_core_1.jsonb)('warnings').$type().notNull(),
    request: (0, pg_core_1.jsonb)('request').$type().notNull(),
    admission: (0, pg_core_1.jsonb)('admission').$type().notNull(),
    evaluatedAt: (0, pg_core_1.timestamp)('evaluated_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('source_admission_snapshots_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.uniqueIndex)('source_admission_snapshots_task_request_unique').on(table.workspaceId, table.sourceTaskId, table.requestId),
    (0, pg_core_1.index)('source_admission_snapshots_workspace_task_idx').on(table.workspaceId, table.sourceTaskId, table.evaluatedAt, table.id),
    (0, pg_core_1.check)('source_admission_snapshots_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('source_admission_snapshots_task_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.sourceTaskId})) > 0`),
    (0, pg_core_1.check)('source_admission_snapshots_request_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.requestId})) > 0`),
]);
//# sourceMappingURL=source-schema.js.map