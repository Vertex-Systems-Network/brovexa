import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { researchJobs } from './research-job-schema';
import { workspaces } from './schema';

export const researchJobControlStateValues = [
  'active',
  'paused',
  'cancelled',
  'killed',
] as const;
export type ResearchJobControlState = (typeof researchJobControlStateValues)[number];

export const researchJobControls = pgTable(
  'research_job_controls',
  {
    researchJobId: text('research_job_id')
      .primaryKey()
      .references(() => researchJobs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    state: text('state').$type<ResearchJobControlState>().notNull().default('active'),
    reasonCode: text('reason_code'),
    changedAt: timestamp('changed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('research_job_controls_workspace_state_idx').on(
      table.workspaceId,
      table.state,
      table.changedAt,
      table.researchJobId,
    ),
    check('research_job_controls_version_check', sql`${table.version} > 0`),
    check(
      'research_job_controls_state_check',
      sql`${table.state} in ('active', 'paused', 'cancelled', 'killed')`,
    ),
    check(
      'research_job_controls_reason_code_check',
      sql`${table.reasonCode} is null or ${table.reasonCode} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'`,
    ),
  ],
);
