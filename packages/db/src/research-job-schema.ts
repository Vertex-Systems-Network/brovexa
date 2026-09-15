import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { jobRuns, jobWorkUnits, workspaces } from './schema';
import { researchJobPreflights } from './source-task-schema';

export const researchJobs = pgTable(
  'research_jobs',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    preflightId: text('preflight_id')
      .notNull()
      .references(() => researchJobPreflights.id, { onDelete: 'restrict' }),
    jobRunId: uuid('job_run_id')
      .notNull()
      .references(() => jobRuns.id, { onDelete: 'restrict' }),
    spec: jsonb('spec').$type<Record<string, unknown>>().notNull(),
    approvedSourceKeys: jsonb('approved_source_keys').$type<string[]>().notNull(),
    budget: jsonb('budget').$type<Record<string, number>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('research_jobs_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('research_jobs_run_workspace_unique').on(table.jobRunId, table.workspaceId),
    uniqueIndex('research_jobs_identity_unique').on(table.id, table.workspaceId, table.jobRunId),
    index('research_jobs_workspace_created_idx').on(table.workspaceId, table.createdAt, table.id),
    check('research_jobs_id_check', sql`${table.id} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    check('research_jobs_preflight_id_check', sql`${table.preflightId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    check('research_jobs_spec_object_check', sql`jsonb_typeof(${table.spec}) = 'object'`),
    check('research_jobs_sources_array_check', sql`jsonb_typeof(${table.approvedSourceKeys}) = 'array'`),
    check('research_jobs_sources_nonempty_check', sql`jsonb_array_length(${table.approvedSourceKeys}) > 0`),
    check('research_jobs_budget_object_check', sql`jsonb_typeof(${table.budget}) = 'object'`),
  ],
);

export const acquisitionShards = pgTable(
  'acquisition_shards',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    researchJobId: text('research_job_id')
      .notNull()
      .references(() => researchJobs.id, { onDelete: 'restrict' }),
    jobRunId: uuid('job_run_id')
      .notNull()
      .references(() => jobRuns.id, { onDelete: 'restrict' }),
    workUnitId: uuid('work_unit_id')
      .notNull()
      .references(() => jobWorkUnits.id, { onDelete: 'restrict' }),
    shardKey: text('shard_key').notNull(),
    ordinal: integer('ordinal').notNull(),
    sourceKeys: jsonb('source_keys').$type<string[]>().notNull(),
    budget: jsonb('budget').$type<Record<string, number>>().notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('acquisition_shards_id_workspace_unique').on(table.id, table.workspaceId),
    uniqueIndex('acquisition_shards_workspace_work_unique').on(table.workspaceId, table.workUnitId),
    uniqueIndex('acquisition_shards_workspace_job_key_unique').on(table.workspaceId, table.researchJobId, table.shardKey),
    index('acquisition_shards_workspace_job_ordinal_idx').on(table.workspaceId, table.researchJobId, table.ordinal, table.id),
    check('acquisition_shards_id_check', sql`${table.id} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    check('acquisition_shards_job_id_check', sql`${table.researchJobId} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    check('acquisition_shards_key_check', sql`${table.shardKey} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`),
    check('acquisition_shards_ordinal_check', sql`${table.ordinal} >= 0`),
    check('acquisition_shards_sources_array_check', sql`jsonb_typeof(${table.sourceKeys}) = 'array'`),
    check('acquisition_shards_sources_nonempty_check', sql`jsonb_array_length(${table.sourceKeys}) > 0`),
    check('acquisition_shards_budget_object_check', sql`jsonb_typeof(${table.budget}) = 'object'`),
    check('acquisition_shards_envelope_object_check', sql`jsonb_typeof(${table.envelope}) = 'object'`),
  ],
);
