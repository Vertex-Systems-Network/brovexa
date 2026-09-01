import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { AgentPersistenceConflictError } from './agent-persistence';
import type { PersistedAgentRunStatus } from './agent-run-schema';
import { withPgTransaction } from './client';
import type { PersistedEvalDecision, PersistedEvidenceState } from './eval-result-schema';
import { persistEvalResult } from './memory-eval-persistence';

const terminalRunStatuses = new Set<PersistedAgentRunStatus>([
  'succeeded',
  'failed',
  'budget_stopped',
  'cancelled',
]);

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;

export interface ApplyAgentEvaluatorDecisionInput {
  workspaceId: string;
  dispatchId: string;
  evaluatorRunId: string;
  evaluationId: string;
  decision: PersistedEvalDecision;
  evidenceState: PersistedEvidenceState;
  reasonCodes: string[];
  evidenceRefs: string[];
  policyRefs: string[];
  confidence: number;
  occurredAt: Date;
}

export type AgentEvaluatorDecisionState = 'accepted' | 'rejected' | 'review_required';

export interface AgentEvaluatorDecisionResult {
  workspaceId: string;
  dispatchId: string;
  planId: string;
  subjectRunId: string;
  evaluatorRunId: string;
  evaluationId: string;
  requestedDecision: PersistedEvalDecision;
  decision: PersistedEvalDecision;
  state: AgentEvaluatorDecisionState;
  subjectStatus: PersistedAgentRunStatus;
  evaluatorStatus: PersistedAgentRunStatus;
  evidenceState: PersistedEvidenceState;
  confidence: number;
  reasonCodes: string[];
  evidenceRefs: string[];
  policyRefs: string[];
  issues: string[];
}

export interface ResolveAgentExecutionReviewInput {
  workspaceId: string;
  orchestratorRunId: string;
  resolutionId: string;
  actorUserId: string;
  decision: 'approve' | 'reject';
  reason: string;
  occurredAt: Date;
}

export interface AgentExecutionReviewResolutionResult {
  workspaceId: string;
  orchestratorRunId: string;
  resolutionId: string;
  decision: 'approve' | 'reject';
  status: 'succeeded' | 'failed';
  actorUserId: string;
  reason: string;
}

export type AgentEvaluatorDecisionErrorCode =
  | 'AGENT_EVALUATOR_INPUT_INVALID'
  | 'AGENT_EVALUATOR_DISPATCH_NOT_FOUND'
  | 'AGENT_EVALUATOR_AGGREGATION_NOT_PENDING'
  | 'AGENT_EVALUATOR_HANDOFF_MISMATCH'
  | 'AGENT_EVALUATOR_AUTHORIZATION_REQUIRED'
  | 'AGENT_EVALUATOR_DEFINITION_INVALID'
  | 'AGENT_EVALUATOR_RUN_STATE'
  | 'AGENT_EVALUATOR_CONTEXT_INVALID'
  | 'AGENT_EVALUATOR_EVIDENCE_SCOPE'
  | 'AGENT_EVALUATOR_POLICY_SCOPE'
  | 'AGENT_EVALUATOR_TIME_REGRESSION'
  | 'AGENT_REVIEW_OWNER_REQUIRED'
  | 'AGENT_REVIEW_STATE_INVALID'
  | 'AGENT_REVIEW_RESULT_REQUIRED';

export class AgentEvaluatorDecisionError extends Error {
  readonly code: AgentEvaluatorDecisionErrorCode;

  constructor(code: AgentEvaluatorDecisionErrorCode, message: string) {
    super(message);
    this.name = 'AgentEvaluatorDecisionError';
    this.code = code;
  }
}

interface DispatchProjectionRow {
  job_run_id: string;
  plan_id: string;
  plan_user_id: string;
  subject_run_id: string;
}

interface LockedRunRow {
  id: string;
  workspace_id: string;
  agent_definition_id: string;
  agent_key: string;
  agent_version: string;
  context_receipt_id: string;
  parent_run_id: string | null;
  handoff_id: string | null;
  execution_mode: string;
  provider_id: string | null;
  model_id: string | null;
  status: PersistedAgentRunStatus;
  envelope: Record<string, unknown>;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
}

interface DefinitionRow {
  id: string;
  agent_key: string;
  version: string;
  status: string;
  autonomy_tier: string;
  requires_human_approval: boolean;
  specification: Record<string, unknown>;
}

interface EvaluatorHandoff {
  handoffId: string;
  evaluatorRunId: string;
  contextReceiptId: string;
  agentKey: string;
  agentVersion: string;
  subjectRunId: string;
  evalSuiteId: string;
  evalThreshold: number;
}

interface StoredAggregation {
  version: string;
  dispatchId: string;
  planId: string;
  planVersion: number;
  jobRunId: string;
  state: string;
  aggregate: Record<string, unknown>;
  evaluatorHandoff: EvaluatorHandoff;
  issues: string[];
  occurredAt: string;
  evaluatorDecision?: Record<string, unknown> | undefined;
  manualReview?: Record<string, unknown> | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertIdentifier(value: string, field: string, max = 256): void {
  if (typeof value !== 'string' || value.length > max || !identifierPattern.test(value)) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_INPUT_INVALID',
      `${field} must use the canonical identifier format.`,
    );
  }
}

function assertDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new AgentEvaluatorDecisionError('AGENT_EVALUATOR_INPUT_INVALID', `${field} must be a valid Date.`);
  }
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_INPUT_INVALID',
      'confidence must be a finite number from 0 through 1.',
    );
  }
}

function normalizeUniqueStrings(values: string[], field: string, maxItems: number): string[] {
  if (!Array.isArray(values) || values.length > maxItems) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_INPUT_INVALID',
      `${field} must contain at most ${maxItems} identifiers.`,
    );
  }
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 256) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_INPUT_INVALID',
        `${field} entries must be non-empty strings of at most 256 characters.`,
      );
    }
    const trimmed = value.trim();
    if (!normalized.includes(trimmed)) normalized.push(trimmed);
  }
  return normalized.sort();
}

function deterministicId(prefix: string, ...parts: string[]): string {
  const digest = createHash('sha256').update(parts.join('\u001f')).digest('hex').slice(0, 32);
  return `${prefix}-${digest}`;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) return null;
  return [...new Set(value.map((item) => String(item).trim()))].sort();
}

function parseHandoff(value: unknown): EvaluatorHandoff | null {
  if (!isRecord(value)) return null;
  const requiredStrings = [
    value.handoffId,
    value.evaluatorRunId,
    value.contextReceiptId,
    value.agentKey,
    value.agentVersion,
    value.subjectRunId,
    value.evalSuiteId,
  ];
  if (requiredStrings.some((item) => typeof item !== 'string' || !item.trim())) return null;
  if (typeof value.evalThreshold !== 'number' || value.evalThreshold < 0 || value.evalThreshold > 1) return null;
  return {
    handoffId: String(value.handoffId),
    evaluatorRunId: String(value.evaluatorRunId),
    contextReceiptId: String(value.contextReceiptId),
    agentKey: String(value.agentKey),
    agentVersion: String(value.agentVersion),
    subjectRunId: String(value.subjectRunId),
    evalSuiteId: String(value.evalSuiteId),
    evalThreshold: value.evalThreshold,
  };
}

function parseStoredAggregation(
  subject: LockedRunRow,
  dispatchId: string,
  planId: string,
): StoredAggregation {
  const value = subject.envelope.executionAggregation;
  if (!isRecord(value) || value.dispatchId !== dispatchId || value.planId !== planId) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_AGGREGATION_NOT_PENDING',
      `Subject AgentRun ${subject.id} does not contain the expected execution aggregation.`,
    );
  }
  const handoff = parseHandoff(value.evaluatorHandoff);
  if (
    value.state !== 'evaluation_pending' ||
    !isRecord(value.aggregate) ||
    !handoff ||
    !Array.isArray(value.issues) ||
    typeof value.version !== 'string' ||
    typeof value.planVersion !== 'number' ||
    typeof value.jobRunId !== 'string' ||
    typeof value.occurredAt !== 'string'
  ) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_AGGREGATION_NOT_PENDING',
      `Subject AgentRun ${subject.id} is not in a valid evaluation-pending aggregation state.`,
    );
  }
  return {
    version: value.version,
    dispatchId,
    planId,
    planVersion: value.planVersion,
    jobRunId: value.jobRunId,
    state: value.state,
    aggregate: value.aggregate,
    evaluatorHandoff: handoff,
    issues: value.issues.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())),
    occurredAt: value.occurredAt,
    evaluatorDecision: isRecord(value.evaluatorDecision) ? value.evaluatorDecision : undefined,
    manualReview: isRecord(value.manualReview) ? value.manualReview : undefined,
  };
}

function nextRunEnvelope(
  current: Record<string, unknown>,
  toStatus: PersistedAgentRunStatus,
  patch: Record<string, unknown>,
  startedAt: Date | null,
  completedAt: Date | null,
): Record<string, unknown> {
  const envelope: Record<string, unknown> = { ...current, ...patch, status: toStatus };
  if (startedAt) envelope.startedAt = startedAt.toISOString();
  else delete envelope.startedAt;
  if (completedAt) envelope.completedAt = completedAt.toISOString();
  else delete envelope.completedAt;
  return envelope;
}

async function transitionRun(
  client: PoolClient,
  run: LockedRunRow,
  input: {
    toStatus: PersistedAgentRunStatus;
    transitionId: string;
    reasonCode: string;
    actorType: 'system' | 'user';
    actorId?: string | undefined;
    occurredAt: Date;
    envelopePatch: Record<string, unknown>;
    metadata: Record<string, unknown>;
  },
): Promise<LockedRunRow> {
  if (run.status === input.toStatus || terminalRunStatuses.has(run.status)) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_RUN_STATE',
      `AgentRun ${run.id} cannot transition from ${run.status} to ${input.toStatus}.`,
    );
  }
  if (input.occurredAt < run.updated_at) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_TIME_REGRESSION',
      `Transition time precedes AgentRun ${run.id}.`,
    );
  }

  let startedAt = run.started_at;
  if (!startedAt && (input.toStatus === 'running' || terminalRunStatuses.has(input.toStatus))) {
    startedAt = input.occurredAt;
  }
  const completedAt = terminalRunStatuses.has(input.toStatus) ? input.occurredAt : null;
  const envelope = nextRunEnvelope(run.envelope, input.toStatus, input.envelopePatch, startedAt, completedAt);

  await client.query(
    `INSERT INTO agent_run_transitions (
       id, workspace_id, run_id, from_status, to_status, reason_code,
       actor_type, actor_id, metadata, occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
    [
      input.transitionId,
      run.workspace_id,
      run.id,
      run.status,
      input.toStatus,
      input.reasonCode,
      input.actorType,
      input.actorId ?? null,
      JSON.stringify(input.metadata),
      input.occurredAt,
    ],
  );

  await client.query(
    `UPDATE agent_runs
     SET status = $3,
         last_transition_id = $4,
         envelope = $5::jsonb,
         started_at = $6,
         completed_at = $7,
         updated_at = $8
     WHERE workspace_id = $1 AND id = $2`,
    [
      run.workspace_id,
      run.id,
      input.toStatus,
      input.transitionId,
      JSON.stringify(envelope),
      startedAt,
      completedAt,
      input.occurredAt,
    ],
  );

  return {
    ...run,
    status: input.toStatus,
    envelope,
    started_at: startedAt,
    completed_at: completedAt,
    updated_at: input.occurredAt,
  };
}

async function assertCurrentWorkspaceRead(client: PoolClient, workspaceId: string, userId: string): Promise<void> {
  const result = await client.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM workspace_memberships AS wm
       INNER JOIN users AS u ON u.id = wm.user_id
       INNER JOIN workspaces AS w ON w.id = wm.workspace_id
       INNER JOIN workspace_membership_roles AS wmr
         ON wmr.membership_id = wm.id AND wmr.workspace_id = wm.workspace_id
       INNER JOIN workspace_roles AS wr
         ON wr.id = wmr.role_id AND wr.workspace_id = wmr.workspace_id
       INNER JOIN workspace_role_permissions AS wrp ON wrp.role_id = wr.id
       WHERE wm.workspace_id = $1
         AND wm.user_id = $2
         AND wm.status = 'active'
         AND u.status = 'active'
         AND w.status = 'active'
         AND wrp.permission_key = 'workspace.read'
     ) AS allowed`,
    [workspaceId, userId],
  );
  if (!result.rows[0]?.allowed) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_AUTHORIZATION_REQUIRED',
      'Current active workspace.read authorization is required to apply an evaluator decision.',
    );
  }
}

async function assertActiveOwner(client: PoolClient, workspaceId: string, actorUserId: string): Promise<void> {
  const result = await client.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM workspace_memberships AS wm
       INNER JOIN users AS u ON u.id = wm.user_id
       INNER JOIN workspaces AS w ON w.id = wm.workspace_id
       INNER JOIN workspace_membership_roles AS wmr
         ON wmr.membership_id = wm.id AND wmr.workspace_id = wm.workspace_id
       INNER JOIN workspace_roles AS wr
         ON wr.id = wmr.role_id AND wr.workspace_id = wmr.workspace_id
       WHERE wm.workspace_id = $1
         AND wm.user_id = $2
         AND wm.status = 'active'
         AND u.status = 'active'
         AND w.status = 'active'
         AND wr.kind = 'owner'
     ) AS allowed`,
    [workspaceId, actorUserId],
  );
  if (!result.rows[0]?.allowed) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_REVIEW_OWNER_REQUIRED',
      'An active workspace owner is required to resolve an execution review.',
    );
  }
}

async function loadRunForUpdate(client: PoolClient, workspaceId: string, runId: string): Promise<LockedRunRow | null> {
  const result = await client.query<LockedRunRow>(
    `SELECT id, workspace_id, agent_definition_id, agent_key, agent_version,
            context_receipt_id, parent_run_id, handoff_id, execution_mode,
            provider_id, model_id, status, envelope, started_at, completed_at, updated_at
     FROM agent_runs
     WHERE workspace_id = $1 AND id = $2
     FOR UPDATE`,
    [workspaceId, runId],
  );
  return result.rows[0] ?? null;
}

function normalizeDecision(
  input: ApplyAgentEvaluatorDecisionInput,
  threshold: number,
  aggregateEvidence: string[],
): { decision: PersistedEvalDecision; issues: string[] } {
  const issues: string[] = [];
  let decision = input.decision;

  if (input.confidence < threshold) issues.push('evaluation_confidence_below_threshold');
  if (input.decision === 'accept') {
    if (input.evidenceState !== 'verified') issues.push('evaluation_accept_requires_verified_evidence');
    if (aggregateEvidence.length > 0 && input.evidenceRefs.length === 0) {
      issues.push('evaluation_accept_requires_evidence_reference');
    }
  }
  if (
    input.decision === 'reject' &&
    input.evidenceState !== 'contradicted' &&
    input.evidenceState !== 'policy_invalid'
  ) {
    issues.push('evaluation_reject_requires_contradiction_or_policy_invalid');
  }

  if (issues.length > 0 && input.decision !== 'review') decision = 'review';
  return { decision, issues };
}

function stateForDecision(decision: PersistedEvalDecision): AgentEvaluatorDecisionState {
  if (decision === 'accept') return 'accepted';
  if (decision === 'reject') return 'rejected';
  return 'review_required';
}

function subjectStatusForDecision(decision: PersistedEvalDecision): PersistedAgentRunStatus {
  if (decision === 'accept') return 'succeeded';
  if (decision === 'reject') return 'failed';
  return 'review_required';
}

function evaluatorStateForDecision(decision: PersistedEvalDecision): 'accepted' | 'rejected' | 'review' {
  if (decision === 'accept') return 'accepted';
  if (decision === 'reject') return 'rejected';
  return 'review';
}

export async function applyAgentEvaluatorDecision(
  pool: Pool,
  input: ApplyAgentEvaluatorDecisionInput,
): Promise<AgentEvaluatorDecisionResult> {
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.dispatchId, 'dispatchId');
  assertIdentifier(input.evaluatorRunId, 'evaluatorRunId');
  assertIdentifier(input.evaluationId, 'evaluationId');
  assertDate(input.occurredAt, 'occurredAt');
  assertConfidence(input.confidence);
  const reasonCodes = normalizeUniqueStrings(input.reasonCodes, 'reasonCodes', 128);
  const evidenceRefs = normalizeUniqueStrings(input.evidenceRefs, 'evidenceRefs', 512);
  const policyRefs = normalizeUniqueStrings(input.policyRefs, 'policyRefs', 128);
  if (reasonCodes.length === 0 || policyRefs.length === 0) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_INPUT_INVALID',
      'Evaluator decisions require at least one reasonCode and policyRef.',
    );
  }

  return withPgTransaction(pool, async (client) => {
    const dispatch = await client.query<DispatchProjectionRow>(
      `SELECT DISTINCT
         job.id AS job_run_id,
         plan.id AS plan_id,
         plan.user_id AS plan_user_id,
         plan.run_id AS subject_run_id
       FROM job_work_units AS work
       INNER JOIN job_runs AS job ON job.id = work.job_run_id
       INNER JOIN agent_execution_plans AS plan
         ON plan.workspace_id = work.workspace_id AND plan.id = work.payload->>'planId'
       WHERE work.workspace_id = $1 AND work.payload->>'dispatchId' = $2`,
      [input.workspaceId, input.dispatchId],
    );
    const projection = dispatch.rows[0];
    if (dispatch.rows.length !== 1 || !projection) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_DISPATCH_NOT_FOUND',
        `Dispatch ${input.dispatchId} is missing or ambiguous.`,
      );
    }

    await assertCurrentWorkspaceRead(client, input.workspaceId, projection.plan_user_id);

    let subject = await loadRunForUpdate(client, input.workspaceId, projection.subject_run_id);
    if (!subject) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_AGGREGATION_NOT_PENDING',
        `Subject AgentRun ${projection.subject_run_id} is missing.`,
      );
    }

    const requestProjection = {
      evaluationId: input.evaluationId,
      evaluatorRunId: input.evaluatorRunId,
      requestedDecision: input.decision,
      evidenceState: input.evidenceState,
      reasonCodes,
      evidenceRefs,
      policyRefs,
      confidence: input.confidence,
      occurredAt: input.occurredAt.toISOString(),
    };
    const storedEvaluation = subject.envelope.executionEvaluation;
    if (storedEvaluation !== undefined) {
      if (!isRecord(storedEvaluation) || !isDeepStrictEqual(storedEvaluation.request, requestProjection)) {
        throw new AgentPersistenceConflictError(
          'AGENT_EVALUATION_DECISION_CONFLICT',
          `Subject AgentRun ${subject.id} already contains a different evaluator decision.`,
        );
      }
      const storedReasonCodes = stringArray(storedEvaluation.reasonCodes);
      const storedEvidenceRefs = stringArray(storedEvaluation.evidenceRefs);
      const storedPolicyRefs = stringArray(storedEvaluation.policyRefs);
      const storedIssues = stringArray(storedEvaluation.issues);
      if (
        typeof storedEvaluation.decision !== 'string' ||
        !['accept', 'reject', 'review'].includes(storedEvaluation.decision) ||
        typeof storedEvaluation.state !== 'string' ||
        !['accepted', 'rejected', 'review_required'].includes(storedEvaluation.state) ||
        typeof storedEvaluation.confidence !== 'number' ||
        typeof storedEvaluation.evidenceState !== 'string' ||
        !storedReasonCodes ||
        !storedEvidenceRefs ||
        !storedPolicyRefs ||
        !storedIssues
      ) {
        throw new AgentEvaluatorDecisionError(
          'AGENT_EVALUATOR_AGGREGATION_NOT_PENDING',
          `Stored evaluator decision on ${subject.id} is invalid.`,
        );
      }
      const evaluator = await loadRunForUpdate(client, input.workspaceId, input.evaluatorRunId);
      if (!evaluator || evaluator.status !== 'succeeded') {
        throw new AgentEvaluatorDecisionError(
          'AGENT_EVALUATOR_RUN_STATE',
          'Stored evaluator decision is missing its successful evaluator AgentRun projection.',
        );
      }
      const evalRow = await client.query<{ id: string }>(
        `SELECT id FROM agent_eval_results
         WHERE id = $1 AND workspace_id = $2 AND evaluator_run_id = $3 AND subject_run_id = $4`,
        [input.evaluationId, input.workspaceId, input.evaluatorRunId, subject.id],
      );
      if (!evalRow.rows[0]) {
        throw new AgentEvaluatorDecisionError(
          'AGENT_EVALUATOR_RUN_STATE',
          'Stored evaluator decision is missing its durable EvalResult.',
        );
      }
      return {
        workspaceId: input.workspaceId,
        dispatchId: input.dispatchId,
        planId: projection.plan_id,
        subjectRunId: subject.id,
        evaluatorRunId: evaluator.id,
        evaluationId: input.evaluationId,
        requestedDecision: input.decision,
        decision: storedEvaluation.decision as PersistedEvalDecision,
        state: storedEvaluation.state as AgentEvaluatorDecisionState,
        subjectStatus: subject.status,
        evaluatorStatus: evaluator.status,
        evidenceState: storedEvaluation.evidenceState as PersistedEvidenceState,
        confidence: storedEvaluation.confidence,
        reasonCodes: storedReasonCodes,
        evidenceRefs: storedEvidenceRefs,
        policyRefs: storedPolicyRefs,
        issues: storedIssues,
      };
    }

    if (subject.status !== 'running' || subject.envelope.evaluatorState !== 'pending') {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_AGGREGATION_NOT_PENDING',
        `Subject AgentRun ${subject.id} must be running with evaluatorState=pending.`,
      );
    }

    const aggregation = parseStoredAggregation(subject, input.dispatchId, projection.plan_id);
    const handoff = aggregation.evaluatorHandoff;
    if (
      handoff.evaluatorRunId !== input.evaluatorRunId ||
      handoff.subjectRunId !== subject.id
    ) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_HANDOFF_MISMATCH',
        'Evaluator decision does not match the frozen aggregation handoff.',
      );
    }

    let evaluator = await loadRunForUpdate(client, input.workspaceId, input.evaluatorRunId);
    if (!evaluator) {
      throw new AgentEvaluatorDecisionError('AGENT_EVALUATOR_HANDOFF_MISMATCH', 'Evaluator AgentRun is missing.');
    }
    if (
      evaluator.status !== 'queued' ||
      evaluator.parent_run_id !== subject.id ||
      evaluator.handoff_id !== handoff.handoffId ||
      evaluator.context_receipt_id !== handoff.contextReceiptId ||
      evaluator.agent_key !== handoff.agentKey ||
      evaluator.agent_version !== handoff.agentVersion ||
      evaluator.execution_mode !== 'deterministic' ||
      evaluator.provider_id !== null ||
      evaluator.model_id !== null
    ) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_RUN_STATE',
        'Evaluator AgentRun does not match the approved deterministic handoff.',
      );
    }
    if (input.occurredAt < evaluator.updated_at || input.occurredAt < subject.updated_at) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_TIME_REGRESSION',
        'Evaluator decision time cannot precede the subject or evaluator AgentRun projection.',
      );
    }

    const evaluationSubject = evaluator.envelope.evaluationSubject;
    if (
      !isRecord(evaluationSubject) ||
      evaluationSubject.subjectRunId !== subject.id ||
      evaluationSubject.dispatchId !== input.dispatchId ||
      evaluationSubject.planId !== projection.plan_id ||
      !isDeepStrictEqual(evaluationSubject.aggregate, aggregation.aggregate)
    ) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_HANDOFF_MISMATCH',
        'Evaluator AgentRun subject does not match the frozen aggregation.',
      );
    }

    const definition = await client.query<DefinitionRow>(
      `SELECT id, agent_key, version, status, autonomy_tier, requires_human_approval, specification
       FROM agent_definitions
       WHERE id = $1 AND agent_key = $2 AND version = $3
       FOR SHARE`,
      [evaluator.agent_definition_id, evaluator.agent_key, evaluator.agent_version],
    );
    const definitionRow = definition.rows[0];
    const modelPolicy = isRecord(definitionRow?.specification.modelPolicy)
      ? definitionRow?.specification.modelPolicy
      : null;
    if (
      !definitionRow ||
      definitionRow.status !== 'approved' ||
      definitionRow.autonomy_tier === 'T4' ||
      definitionRow.requires_human_approval ||
      !modelPolicy ||
      modelPolicy.routingMode !== 'deterministic_only' ||
      !Array.isArray(modelPolicy.allowedProviderIds) ||
      modelPolicy.allowedProviderIds.length !== 0 ||
      !Array.isArray(modelPolicy.allowedModelIds) ||
      modelPolicy.allowedModelIds.length !== 0
    ) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_DEFINITION_INVALID',
        'Evaluator definition is no longer approved for deterministic execution.',
      );
    }

    const context = await client.query<{
      user_id: string | null;
      run_scope_id: string | null;
      agent_definition_id: string;
      agent_key: string;
      agent_version: string;
      receipt: Record<string, unknown>;
      token_budget: string;
      max_currency_micros: string;
      created_at: Date;
    }>(
      `SELECT user_id, run_scope_id, agent_definition_id, agent_key, agent_version,
              receipt, token_budget::text, max_currency_micros::text, created_at
       FROM agent_context_receipts
       WHERE id = $1 AND workspace_id = $2
       FOR SHARE`,
      [handoff.contextReceiptId, input.workspaceId],
    );
    const contextRow = context.rows[0];
    const contextPolicyRefs = contextRow ? stringArray(contextRow.receipt.policyRefs) : null;
    if (
      !contextRow ||
      contextRow.user_id !== projection.plan_user_id ||
      contextRow.run_scope_id !== evaluator.id ||
      contextRow.agent_definition_id !== evaluator.agent_definition_id ||
      contextRow.agent_key !== evaluator.agent_key ||
      contextRow.agent_version !== evaluator.agent_version ||
      contextRow.token_budget !== '0' ||
      contextRow.max_currency_micros !== '0' ||
      !contextPolicyRefs
    ) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_CONTEXT_INVALID',
        'Evaluator ContextReceipt no longer matches the zero-provider-budget handoff.',
      );
    }

    const aggregateEvidence = stringArray(aggregation.aggregate.evidenceIds) ?? [];
    if (evidenceRefs.some((ref) => !aggregateEvidence.includes(ref))) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_EVIDENCE_SCOPE',
        'Evaluator evidenceRefs must be drawn from the frozen aggregate evidence set.',
      );
    }
    if (policyRefs.some((ref) => !contextPolicyRefs.includes(ref))) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_POLICY_SCOPE',
        'Evaluator policyRefs must be drawn from the evaluator ContextReceipt.',
      );
    }

    const normalizedInput = { ...input, reasonCodes, evidenceRefs, policyRefs };
    const normalized = normalizeDecision(normalizedInput, handoff.evalThreshold, aggregateEvidence);
    const finalReasonCodes = [...new Set([...reasonCodes, ...normalized.issues])].sort();
    const decision = normalized.decision;
    const state = stateForDecision(decision);
    const evaluatorStartedAt = input.occurredAt;
    const evaluatorSucceededAt = new Date(input.occurredAt.getTime() + 1);
    const subjectResolvedAt = new Date(input.occurredAt.getTime() + 2);

    evaluator = await transitionRun(client, evaluator, {
      toStatus: 'running',
      transitionId: deterministicId('agent-evaluator-transition', evaluator.id, input.evaluationId, 'start'),
      reasonCode: 'independent_evaluation_started',
      actorType: 'system',
      occurredAt: evaluatorStartedAt,
      envelopePatch: { validationState: 'pending' },
      metadata: { evaluationId: input.evaluationId, subjectRunId: subject.id, dispatchId: input.dispatchId },
    });

    const evaluationEnvelope = {
      id: input.evaluationId,
      evaluatorRunId: evaluator.id,
      subjectRunId: subject.id,
      evalSuiteId: handoff.evalSuiteId,
      evalThreshold: handoff.evalThreshold,
      requestedDecision: input.decision,
      decision,
      evidenceState: input.evidenceState,
      reasonCodes: finalReasonCodes,
      evidenceRefs,
      policyRefs,
      confidence: input.confidence,
      issues: normalized.issues,
      createdAt: evaluatorSucceededAt.toISOString(),
    };

    evaluator = await transitionRun(client, evaluator, {
      toStatus: 'succeeded',
      transitionId: deterministicId('agent-evaluator-transition', evaluator.id, input.evaluationId, 'success'),
      reasonCode: 'independent_evaluation_completed',
      actorType: 'system',
      occurredAt: evaluatorSucceededAt,
      envelopePatch: {
        result: evaluationEnvelope,
        confidence: input.confidence,
        uncertainty: normalized.issues,
        evidenceIds: evidenceRefs,
        validationState: 'passed',
        evaluatorState: 'not_required',
      },
      metadata: {
        evaluationId: input.evaluationId,
        subjectRunId: subject.id,
        decision,
        evidenceState: input.evidenceState,
      },
    });

    await persistEvalResult(client, {
      id: input.evaluationId,
      workspaceId: input.workspaceId,
      evaluatorRunId: evaluator.id,
      subjectRunId: subject.id,
      decision,
      evidenceState: input.evidenceState,
      reasonCodes: finalReasonCodes,
      evidenceRefs,
      policyRefs,
      confidence: input.confidence,
      envelope: evaluationEnvelope,
      createdAt: evaluatorSucceededAt,
    });

    const subjectStatus = subjectStatusForDecision(decision);
    const evaluationProjection = {
      version: '1.0.0',
      request: requestProjection,
      evaluationId: input.evaluationId,
      evaluatorRunId: evaluator.id,
      requestedDecision: input.decision,
      decision,
      state,
      evidenceState: input.evidenceState,
      reasonCodes: finalReasonCodes,
      evidenceRefs,
      policyRefs,
      confidence: input.confidence,
      issues: normalized.issues,
      resolvedAt: subjectResolvedAt.toISOString(),
    };
    const aggregationState = decision === 'accept' ? 'succeeded' : decision === 'reject' ? 'failed' : 'review_required';
    const aggregationProjection = {
      ...aggregation,
      state: aggregationState,
      evaluatorDecision: evaluationProjection,
      issues: [...new Set([
        ...aggregation.issues,
        ...(decision === 'reject' ? ['evaluator_rejected'] : []),
        ...(decision === 'review' ? ['evaluator_review_required'] : []),
        ...normalized.issues,
      ])].sort(),
      occurredAt: subjectResolvedAt.toISOString(),
    };

    subject = await transitionRun(client, subject, {
      toStatus: subjectStatus,
      transitionId: deterministicId('agent-evaluation-subject-transition', subject.id, input.evaluationId, decision),
      reasonCode:
        decision === 'accept'
          ? 'independent_evaluation_accepted'
          : decision === 'reject'
            ? 'independent_evaluation_rejected'
            : 'independent_evaluation_review_required',
      actorType: 'system',
      occurredAt: subjectResolvedAt,
      envelopePatch: {
        validationState: decision === 'accept' ? 'passed' : decision === 'reject' ? 'failed' : 'review',
        evaluatorState: evaluatorStateForDecision(decision),
        executionEvaluation: evaluationProjection,
        executionAggregation: aggregationProjection,
      },
      metadata: {
        evaluationId: input.evaluationId,
        evaluatorRunId: evaluator.id,
        dispatchId: input.dispatchId,
        decision,
        issues: normalized.issues,
      },
    });

    return {
      workspaceId: input.workspaceId,
      dispatchId: input.dispatchId,
      planId: projection.plan_id,
      subjectRunId: subject.id,
      evaluatorRunId: evaluator.id,
      evaluationId: input.evaluationId,
      requestedDecision: input.decision,
      decision,
      state,
      subjectStatus: subject.status,
      evaluatorStatus: evaluator.status,
      evidenceState: input.evidenceState,
      confidence: input.confidence,
      reasonCodes: finalReasonCodes,
      evidenceRefs,
      policyRefs,
      issues: normalized.issues,
    };
  });
}

export async function getAgentEvaluatorDecisionState(
  pool: Pool,
  workspaceId: string,
  dispatchId: string,
): Promise<AgentEvaluatorDecisionResult | null> {
  assertIdentifier(workspaceId, 'workspaceId');
  assertIdentifier(dispatchId, 'dispatchId');
  const projection = await pool.query<{
    plan_id: string;
    subject_run_id: string;
    subject_status: PersistedAgentRunStatus;
    subject_envelope: Record<string, unknown>;
  }>(
    `SELECT DISTINCT
       plan.id AS plan_id,
       plan.run_id AS subject_run_id,
       subject.status AS subject_status,
       subject.envelope AS subject_envelope
     FROM job_work_units AS work
     INNER JOIN agent_execution_plans AS plan
       ON plan.workspace_id = work.workspace_id AND plan.id = work.payload->>'planId'
     INNER JOIN agent_runs AS subject
       ON subject.workspace_id = plan.workspace_id AND subject.id = plan.run_id
     WHERE work.workspace_id = $1 AND work.payload->>'dispatchId' = $2`,
    [workspaceId, dispatchId],
  );
  const row = projection.rows[0];
  if (projection.rows.length !== 1 || !row) return null;
  const stored = row.subject_envelope.executionEvaluation;
  if (!isRecord(stored) || !isRecord(stored.request)) return null;
  const request = stored.request;
  const reasonCodes = stringArray(stored.reasonCodes);
  const evidenceRefs = stringArray(stored.evidenceRefs);
  const policyRefs = stringArray(stored.policyRefs);
  const issues = stringArray(stored.issues);
  if (
    typeof stored.evaluationId !== 'string' ||
    typeof stored.evaluatorRunId !== 'string' ||
    typeof stored.requestedDecision !== 'string' ||
    !['accept', 'reject', 'review'].includes(stored.requestedDecision) ||
    typeof stored.decision !== 'string' ||
    !['accept', 'reject', 'review'].includes(stored.decision) ||
    typeof stored.state !== 'string' ||
    !['accepted', 'rejected', 'review_required'].includes(stored.state) ||
    typeof stored.evidenceState !== 'string' ||
    typeof stored.confidence !== 'number' ||
    !reasonCodes ||
    !evidenceRefs ||
    !policyRefs ||
    !issues
  ) {
    return null;
  }
  const evaluator = await pool.query<{ status: PersistedAgentRunStatus }>(
    `SELECT status FROM agent_runs WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, stored.evaluatorRunId],
  );
  if (!evaluator.rows[0]) return null;
  return {
    workspaceId,
    dispatchId,
    planId: row.plan_id,
    subjectRunId: row.subject_run_id,
    evaluatorRunId: stored.evaluatorRunId,
    evaluationId: stored.evaluationId,
    requestedDecision: stored.requestedDecision as PersistedEvalDecision,
    decision: stored.decision as PersistedEvalDecision,
    state: stored.state as AgentEvaluatorDecisionState,
    subjectStatus: row.subject_status,
    evaluatorStatus: evaluator.rows[0].status,
    evidenceState: stored.evidenceState as PersistedEvidenceState,
    confidence: stored.confidence,
    reasonCodes,
    evidenceRefs,
    policyRefs,
    issues,
  };
}

export async function resolveAgentExecutionReview(
  pool: Pool,
  input: ResolveAgentExecutionReviewInput,
): Promise<AgentExecutionReviewResolutionResult> {
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.orchestratorRunId, 'orchestratorRunId');
  assertIdentifier(input.resolutionId, 'resolutionId');
  assertIdentifier(input.actorUserId, 'actorUserId');
  assertDate(input.occurredAt, 'occurredAt');
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 1000) {
    throw new AgentEvaluatorDecisionError(
      'AGENT_EVALUATOR_INPUT_INVALID',
      'Review resolution requires a non-empty reason of at most 1000 characters.',
    );
  }
  const reason = input.reason.trim();

  return withPgTransaction(pool, async (client) => {
    await assertActiveOwner(client, input.workspaceId, input.actorUserId);
    let run = await loadRunForUpdate(client, input.workspaceId, input.orchestratorRunId);
    if (!run) {
      throw new AgentEvaluatorDecisionError('AGENT_REVIEW_STATE_INVALID', 'Reviewed orchestrator AgentRun was not found.');
    }

    const request = {
      resolutionId: input.resolutionId,
      actorUserId: input.actorUserId,
      decision: input.decision,
      reason,
      occurredAt: input.occurredAt.toISOString(),
    };
    const stored = run.envelope.reviewResolution;
    if (stored !== undefined) {
      if (!isRecord(stored) || !isDeepStrictEqual(stored.request, request)) {
        throw new AgentPersistenceConflictError(
          'AGENT_REVIEW_RESOLUTION_CONFLICT',
          `AgentRun ${run.id} already contains a different review resolution.`,
        );
      }
      if (stored.status !== 'succeeded' && stored.status !== 'failed') {
        throw new AgentEvaluatorDecisionError('AGENT_REVIEW_STATE_INVALID', 'Stored review resolution is invalid.');
      }
      return {
        workspaceId: input.workspaceId,
        orchestratorRunId: run.id,
        resolutionId: input.resolutionId,
        decision: input.decision,
        status: stored.status,
        actorUserId: input.actorUserId,
        reason,
      };
    }

    if (run.status !== 'review_required') {
      throw new AgentEvaluatorDecisionError(
        'AGENT_REVIEW_STATE_INVALID',
        `AgentRun ${run.id} must be review_required before owner resolution.`,
      );
    }
    if (input.occurredAt < run.updated_at) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_EVALUATOR_TIME_REGRESSION',
        `Review resolution time precedes AgentRun ${run.id}.`,
      );
    }
    if (!isRecord(run.envelope.executionAggregation)) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_REVIEW_STATE_INVALID',
        'Review resolution requires a governed execution aggregation projection.',
      );
    }
    if (input.decision === 'approve' && !isRecord(run.envelope.result)) {
      throw new AgentEvaluatorDecisionError(
        'AGENT_REVIEW_RESULT_REQUIRED',
        'Owner approval cannot succeed an AgentRun without a structured result.',
      );
    }

    const resumedAt = input.occurredAt;
    const resolvedAt = new Date(input.occurredAt.getTime() + 1);
    const previousEvaluatorState = run.envelope.evaluatorState;
    const resumedProjection = {
      version: '1.0.0',
      request,
      state: 'resumed',
      resumedAt: resumedAt.toISOString(),
    };
    run = await transitionRun(client, run, {
      toStatus: 'running',
      transitionId: deterministicId('agent-review-transition', run.id, input.resolutionId, 'resume'),
      reasonCode: 'execution_review_resumed',
      actorType: 'user',
      actorId: input.actorUserId,
      occurredAt: resumedAt,
      envelopePatch: {
        validationState: 'pending',
        reviewResolution: resumedProjection,
      },
      metadata: { resolutionId: input.resolutionId, decision: input.decision, reason },
    });

    const status: 'succeeded' | 'failed' = input.decision === 'approve' ? 'succeeded' : 'failed';
    const finalResolution = {
      version: '1.0.0',
      request,
      state: input.decision === 'approve' ? 'approved' : 'rejected',
      status,
      resumedAt: resumedAt.toISOString(),
      resolvedAt: resolvedAt.toISOString(),
    };
    const currentAggregation = run.envelope.executionAggregation;
    const finalAggregation = isRecord(currentAggregation)
      ? {
          ...currentAggregation,
          state: status,
          manualReview: finalResolution,
          occurredAt: resolvedAt.toISOString(),
        }
      : currentAggregation;
    run = await transitionRun(client, run, {
      toStatus: status,
      transitionId: deterministicId('agent-review-transition', run.id, input.resolutionId, status),
      reasonCode: input.decision === 'approve' ? 'execution_review_approved' : 'execution_review_rejected',
      actorType: 'user',
      actorId: input.actorUserId,
      occurredAt: resolvedAt,
      envelopePatch: {
        validationState: input.decision === 'approve' ? 'passed' : 'failed',
        evaluatorState:
          previousEvaluatorState === 'review'
            ? input.decision === 'approve'
              ? 'accepted'
              : 'rejected'
            : previousEvaluatorState,
        reviewResolution: finalResolution,
        executionAggregation: finalAggregation,
      },
      metadata: { resolutionId: input.resolutionId, decision: input.decision, reason },
    });

    return {
      workspaceId: input.workspaceId,
      orchestratorRunId: run.id,
      resolutionId: input.resolutionId,
      decision: input.decision,
      status,
      actorUserId: input.actorUserId,
      reason,
    };
  });
}
