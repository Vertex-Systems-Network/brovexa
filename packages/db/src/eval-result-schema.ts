import { sql } from 'drizzle-orm';
import {
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
import { workspaces } from './schema';

export const persistedEvalDecisionValues = ['accept', 'reject', 'review'] as const;
export type PersistedEvalDecision = (typeof persistedEvalDecisionValues)[number];

export const persistedEvidenceStateValues = [
  'verified',
  'insufficient',
  'contradicted',
  'stale',
  'policy_invalid',
] as const;
export type PersistedEvidenceState = (typeof persistedEvidenceStateValues)[number];

export const agentEvalResults = pgTable(
  'agent_eval_results',
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    evaluatorRunId: text('evaluator_run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'restrict' }),
    subjectRunId: text('subject_run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'restrict' }),
    decision: text('decision').$type<PersistedEvalDecision>().notNull(),
    evidenceState: text('evidence_state').$type<PersistedEvidenceState>().notNull(),
    reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
    evidenceRefs: jsonb('evidence_refs').$type<string[]>().notNull(),
    policyRefs: jsonb('policy_refs').$type<string[]>().notNull(),
    confidence: doublePrecision('confidence').notNull(),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('agent_eval_results_id_workspace_unique').on(table.id, table.workspaceId),
    index('agent_eval_results_workspace_subject_idx').on(
      table.workspaceId,
      table.subjectRunId,
      table.createdAt,
    ),
    index('agent_eval_results_workspace_evaluator_idx').on(
      table.workspaceId,
      table.evaluatorRunId,
      table.createdAt,
    ),
    check('agent_eval_results_id_check', sql`length(btrim(${table.id})) > 0`),
    check(
      'agent_eval_results_independent_run_check',
      sql`${table.evaluatorRunId} <> ${table.subjectRunId}`,
    ),
    check(
      'agent_eval_results_accept_verified_check',
      sql`${table.decision} <> 'accept' or ${table.evidenceState} = 'verified'`,
    ),
    check('agent_eval_results_confidence_check', sql`${table.confidence} >= 0 and ${table.confidence} <= 1`),
  ],
);
