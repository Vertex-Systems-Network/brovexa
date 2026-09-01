import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

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
export type PersistedSourceClass = (typeof sourceClassValues)[number];

export const connectorPolicyStateValues = [
  'APPROVED',
  'APPROVED_WITH_LIMITS',
  'TRANSIENT_ONLY',
  'REVIEW_REQUIRED',
  'BLOCKED',
  'EXPIRED',
] as const;
export type PersistedConnectorPolicyState = (typeof connectorPolicyStateValues)[number];

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
export type PersistedSourceAccessMethod = (typeof sourceAccessMethodValues)[number];

export const connectorCredentialModeValues = [
  'none',
  'api_key_ref',
  'oauth_ref',
  'service_account_ref',
  'user_authorized_ref',
] as const;
export type PersistedConnectorCredentialMode = (typeof connectorCredentialModeValues)[number];

export const connectorDefinitionStatusValues = ['draft', 'approved', 'disabled'] as const;
export type PersistedConnectorDefinitionStatus = (typeof connectorDefinitionStatusValues)[number];

export const connectorActivationValues = ['disabled', 'dry_run', 'enabled'] as const;
export type PersistedConnectorActivation = (typeof connectorActivationValues)[number];

export const sourceAdmissionDecisionValues = ['allow', 'review_required', 'blocked'] as const;
export type PersistedSourceAdmissionDecision = (typeof sourceAdmissionDecisionValues)[number];

export const sourceCapabilities = pgTable(
  'source_capabilities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceKey: text('source_key').notNull(),
    version: text('version').notNull(),
    sourceClass: text('source_class').$type<PersistedSourceClass>().notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('source_capabilities_key_version_unique').on(table.sourceKey, table.version),
    uniqueIndex('source_capabilities_identity_unique').on(table.id, table.sourceKey, table.version),
    check('source_capabilities_source_key_check', sql`${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
    check('source_capabilities_version_check', sql`length(btrim(${table.version})) > 0`),
  ],
);

export const connectorPolicies = pgTable(
  'connector_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: text('policy_id').notNull(),
    version: text('version').notNull(),
    sourceKey: text('source_key').notNull(),
    connectorKey: text('connector_key').notNull(),
    state: text('state').$type<PersistedConnectorPolicyState>().notNull(),
    accessMethod: text('access_method').$type<PersistedSourceAccessMethod>().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }).notNull(),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true, mode: 'date' }).notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('connector_policies_key_version_unique').on(table.policyId, table.version),
    uniqueIndex('connector_policies_registry_identity_unique').on(
      table.policyId,
      table.version,
      table.sourceKey,
      table.connectorKey,
    ),
    uniqueIndex('connector_policies_identity_unique').on(
      table.id,
      table.policyId,
      table.version,
      table.sourceKey,
      table.connectorKey,
    ),
    index('connector_policies_connector_review_idx').on(table.connectorKey, table.nextReviewAt),
    check('connector_policies_source_key_check', sql`${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
    check('connector_policies_connector_key_check', sql`${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
  ],
);

export const connectorDefinitions = pgTable(
  'connector_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    connectorKey: text('connector_key').notNull(),
    version: text('version').notNull(),
    sourceKey: text('source_key').notNull(),
    capabilityVersion: text('capability_version').notNull(),
    policyId: text('policy_id').notNull(),
    policyVersion: text('policy_version').notNull(),
    accessMethod: text('access_method').$type<PersistedSourceAccessMethod>().notNull(),
    credentialMode: text('credential_mode').$type<PersistedConnectorCredentialMode>().notNull(),
    status: text('status').$type<PersistedConnectorDefinitionStatus>().notNull(),
    activation: text('activation').$type<PersistedConnectorActivation>().notNull(),
    implementationVersion: text('implementation_version').notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('connector_definitions_key_version_unique').on(table.connectorKey, table.version),
    uniqueIndex('connector_definitions_identity_unique').on(
      table.id,
      table.connectorKey,
      table.version,
      table.sourceKey,
      table.capabilityVersion,
      table.policyId,
      table.policyVersion,
    ),
    index('connector_definitions_source_status_idx').on(
      table.sourceKey,
      table.status,
      table.activation,
      table.connectorKey,
      table.version,
    ),
    check('connector_definitions_connector_key_check', sql`${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
    check('connector_definitions_source_key_check', sql`${table.sourceKey} ~ '^source\\.[a-z0-9_.-]+$'`),
  ],
);

export const sourceAdmissionSnapshots = pgTable(
  'source_admission_snapshots',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceTaskId: text('source_task_id').notNull(),
    requestId: text('request_id').notNull(),
    sourceCapabilityId: uuid('source_capability_id')
      .notNull()
      .references(() => sourceCapabilities.id, { onDelete: 'restrict' }),
    connectorPolicyDbId: uuid('connector_policy_db_id')
      .notNull()
      .references(() => connectorPolicies.id, { onDelete: 'restrict' }),
    connectorDefinitionId: uuid('connector_definition_id')
      .notNull()
      .references(() => connectorDefinitions.id, { onDelete: 'restrict' }),
    sourceKey: text('source_key').notNull(),
    capabilityVersion: text('capability_version').notNull(),
    connectorKey: text('connector_key').notNull(),
    connectorVersion: text('connector_version').notNull(),
    policyId: text('policy_id').notNull(),
    policyVersion: text('policy_version').notNull(),
    decision: text('decision').$type<PersistedSourceAdmissionDecision>().notNull(),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    warnings: jsonb('warnings').$type<string[]>().notNull(),
    request: jsonb('request').$type<Record<string, unknown>>().notNull(),
    admission: jsonb('admission').$type<Record<string, unknown>>().notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('source_admission_snapshots_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('source_admission_snapshots_task_request_unique').on(
      table.workspaceId,
      table.sourceTaskId,
      table.requestId,
    ),
    index('source_admission_snapshots_workspace_task_idx').on(
      table.workspaceId,
      table.sourceTaskId,
      table.evaluatedAt,
      table.id,
    ),
    check('source_admission_snapshots_id_check', sql`length(btrim(${table.id})) > 0`),
    check('source_admission_snapshots_task_id_check', sql`length(btrim(${table.sourceTaskId})) > 0`),
    check('source_admission_snapshots_request_id_check', sql`length(btrim(${table.requestId})) > 0`),
  ],
);
