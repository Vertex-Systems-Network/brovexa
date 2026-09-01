import { sql } from 'drizzle-orm';
import { bigint, check, doublePrecision, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { connectorDefinitions } from './source-schema';

export const connectorHealthStatusValues = [
  'ready',
  'degraded',
  'rate_limited',
  'circuit_open',
  'disabled',
  'unknown',
] as const;
export type PersistedConnectorHealthStatus = (typeof connectorHealthStatusValues)[number];

export const connectorHealthSnapshots = pgTable(
  'connector_health_snapshots',
  {
    id: text('id').primaryKey(),
    connectorDefinitionId: uuid('connector_definition_id')
      .notNull()
      .references(() => connectorDefinitions.id, { onDelete: 'restrict' }),
    connectorKey: text('connector_key').notNull(),
    connectorVersion: text('connector_version').notNull(),
    status: text('status').$type<PersistedConnectorHealthStatus>().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
    quotaRemaining: bigint('quota_remaining', { mode: 'number' }),
    rollingErrorRate: doublePrecision('rolling_error_rate').notNull(),
    p95LatencyMs: bigint('p95_latency_ms', { mode: 'number' }),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('connector_health_snapshots_latest_idx').on(
      table.connectorKey,
      table.connectorVersion,
      table.observedAt,
      table.createdAt,
      table.id,
    ),
    check(
      'connector_health_snapshots_id_check',
      sql`${table.id} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`,
    ),
    check(
      'connector_health_snapshots_connector_key_check',
      sql`${table.connectorKey} ~ '^connector\\.[a-z0-9_.-]+$'`,
    ),
    check('connector_health_snapshots_version_check', sql`length(btrim(${table.connectorVersion})) > 0`),
    check(
      'connector_health_snapshots_quota_check',
      sql`${table.quotaRemaining} IS NULL OR (${table.quotaRemaining} >= 0 AND ${table.quotaRemaining} <= 9007199254740991)`,
    ),
    check(
      'connector_health_snapshots_error_rate_check',
      sql`${table.rollingErrorRate} >= 0 AND ${table.rollingErrorRate} <= 1`,
    ),
    check(
      'connector_health_snapshots_latency_check',
      sql`${table.p95LatencyMs} IS NULL OR (${table.p95LatencyMs} >= 0 AND ${table.p95LatencyMs} <= 9007199254740991)`,
    ),
  ],
);
