import { sql } from 'drizzle-orm';
import { bigint, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { sourceTasks } from './source-task-schema';

export const sourceTransportAuditDecisionValues = ['allow', 'blocked'] as const;
export type SourceTransportAuditDecision = (typeof sourceTransportAuditDecisionValues)[number];

export const sourceTransportAuditRecords = pgTable(
  'source_transport_audit_records',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    transportRequestId: text('transport_request_id').notNull(),
    sourceRequestId: text('source_request_id').notNull(),
    sourceTaskId: text('source_task_id').notNull(),
    connectorKey: text('connector_key').notNull(),
    connectorVersion: text('connector_version').notNull(),
    transportPolicyId: text('transport_policy_id').notNull(),
    transportPolicyVersion: text('transport_policy_version').notNull(),
    decision: text('decision').$type<SourceTransportAuditDecision>().notNull(),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    warnings: jsonb('warnings').$type<string[]>().notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    hostname: text('hostname').notNull(),
    port: integer('port'),
    maxResponseBytes: bigint('max_response_bytes', { mode: 'number' }).notNull(),
    timeoutMs: bigint('timeout_ms', { mode: 'number' }).notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true, mode: 'date' }).notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'source_transport_audit_records_source_task_identity_fk',
      columns: [
        table.sourceTaskId,
        table.workspaceId,
        table.sourceRequestId,
        table.connectorKey,
        table.connectorVersion,
      ],
      foreignColumns: [
        sourceTasks.id,
        sourceTasks.workspaceId,
        sourceTasks.requestId,
        sourceTasks.connectorKey,
        sourceTasks.connectorVersion,
      ],
    }).onDelete('restrict'),
    index('source_transport_audit_records_task_time_idx').on(
      table.workspaceId,
      table.sourceTaskId,
      table.evaluatedAt,
      table.createdAt,
      table.id,
    ),
    check('source_transport_audit_records_id_check', sql`${table.id} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    check(
      'source_transport_audit_records_transport_request_id_check',
      sql`${table.transportRequestId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`,
    ),
    check(
      'source_transport_audit_records_source_request_id_check',
      sql`${table.sourceRequestId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`,
    ),
    check(
      'source_transport_audit_records_source_task_id_check',
      sql`${table.sourceTaskId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`,
    ),
    check('source_transport_audit_records_connector_key_check', sql`${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`),
    check(
      'source_transport_audit_records_response_bytes_check',
      sql`${table.maxResponseBytes} >= 1 AND ${table.maxResponseBytes} <= 9007199254740991`,
    ),
    check(
      'source_transport_audit_records_timeout_check',
      sql`${table.timeoutMs} >= 100 AND ${table.timeoutMs} <= 120000`,
    ),
    check('source_transport_audit_records_port_check', sql`${table.port} IS NULL OR (${table.port} >= 1 AND ${table.port} <= 65535)`),
  ],
);
