"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentEvalResults = exports.persistedEvidenceStateValues = exports.persistedEvalDecisionValues = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const agent_run_schema_1 = require("./agent-run-schema");
const schema_1 = require("./schema");
exports.persistedEvalDecisionValues = ['accept', 'reject', 'review'];
exports.persistedEvidenceStateValues = [
    'verified',
    'insufficient',
    'contradicted',
    'stale',
    'policy_invalid',
];
exports.agentEvalResults = (0, pg_core_1.pgTable)('agent_eval_results', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => schema_1.workspaces.id, { onDelete: 'cascade' }),
    evaluatorRunId: (0, pg_core_1.text)('evaluator_run_id')
        .notNull()
        .references(() => agent_run_schema_1.agentRuns.id, { onDelete: 'restrict' }),
    subjectRunId: (0, pg_core_1.text)('subject_run_id')
        .notNull()
        .references(() => agent_run_schema_1.agentRuns.id, { onDelete: 'restrict' }),
    decision: (0, pg_core_1.text)('decision').$type().notNull(),
    evidenceState: (0, pg_core_1.text)('evidence_state').$type().notNull(),
    reasonCodes: (0, pg_core_1.jsonb)('reason_codes').$type().notNull(),
    evidenceRefs: (0, pg_core_1.jsonb)('evidence_refs').$type().notNull(),
    policyRefs: (0, pg_core_1.jsonb)('policy_refs').$type().notNull(),
    confidence: (0, pg_core_1.doublePrecision)('confidence').notNull(),
    envelope: (0, pg_core_1.jsonb)('envelope').$type().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('agent_eval_results_id_workspace_unique').on(table.id, table.workspaceId),
    (0, pg_core_1.index)('agent_eval_results_workspace_subject_idx').on(table.workspaceId, table.subjectRunId, table.createdAt),
    (0, pg_core_1.index)('agent_eval_results_workspace_evaluator_idx').on(table.workspaceId, table.evaluatorRunId, table.createdAt),
    (0, pg_core_1.check)('agent_eval_results_id_check', (0, drizzle_orm_1.sql) `length(btrim(${table.id})) > 0`),
    (0, pg_core_1.check)('agent_eval_results_independent_run_check', (0, drizzle_orm_1.sql) `${table.evaluatorRunId} <> ${table.subjectRunId}`),
    (0, pg_core_1.check)('agent_eval_results_accept_verified_check', (0, drizzle_orm_1.sql) `${table.decision} <> 'accept' or ${table.evidenceState} = 'verified'`),
    (0, pg_core_1.check)('agent_eval_results_confidence_check', (0, drizzle_orm_1.sql) `${table.confidence} >= 0 and ${table.confidence} <= 1`),
]);
//# sourceMappingURL=eval-result-schema.js.map