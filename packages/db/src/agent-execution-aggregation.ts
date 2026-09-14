import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { AgentPersistenceConflictError } from './agent-persistence';
import type { PersistedAgentRunStatus } from './agent-run-schema';
import { withPgTransaction } from './client';

const resultEffectKey = 'agent.execution.specialist.result';
const supportedOrchestratorValidators = new Set(['tenant_scope', 'policy_scope', 'budget_scope']);
const terminalRunStatuses = new Set<PersistedAgentRunStatus>([
  'succeeded',
  'failed',
  'budget_stopped',
  'cancelled',
]);

export type AgentExecutionAggregationState =
  | 'succeeded'
  | 'evaluation_pending'
  | 'review_required'
  | 'failed'
  | 'cancelled';

export interface AggregateAgentExecutionInput {
  workspaceId: string;
  dispatchId: string;
  evaluatorAgentVersion?: string | undefined;
  occurredAt: Date;
}

export interface AgentExecutionAggregateStep {
  stepKey: string;
  workUnitId: string;
  specialistRunId: string;
  agentKey: string;
  agentVersion: string;
  attempt: number;
  confidence: number;
  result: Record<string, unknown>;
  evidenceIds: string[];
  factIds: string[];
  sourceIds: string[];
}

export interface AgentEvaluatorHandoff {
  handoffId: string;
  evaluatorRunId: string;
  contextReceiptId: string;
  agentKey: string;
  agentVersion: string;
  subjectRunId: string;
  evalSuiteId: string;
  evalThreshold: number;
}

export interface AgentExecutionAggregationResult {
  workspaceId: string;
  dispatchId: string;
  planId: string;
  planVersion: number;
  jobRunId: string;
  orchestratorRunId: string;
  state: AgentExecutionAggregationState;
  orchestratorStatus: PersistedAgentRunStatus;
  aggregate: Record<string, unknown> | null;
  evaluatorHandoff: AgentEvaluatorHandoff | null;
  issues: string[];
}

export type AgentExecutionAggregationErrorCode =
  | 'AGENT_AGGREGATION_INPUT_INVALID'
  | 'AGENT_AGGREGATION_DISPATCH_NOT_FOUND'
  | 'AGENT_AGGREGATION_PROJECTION_CONFLICT'
  | 'AGENT_AGGREGATION_AUTHORIZATION_REQUIRED'
  | 'AGENT_AGGREGATION_NOT_READY'
  | 'AGENT_AGGREGATION_ORCHESTRATOR_STATE'
  | 'AGENT_AGGREGATION_DEFINITION_INVALID'
  | 'AGENT_AGGREGATION_EVALUATOR_VERSION_REQUIRED'
  | 'AGENT_AGGREGATION_EVALUATOR_NOT_APPROVED'
  | 'AGENT_AGGREGATION_EVALUATOR_ROUTE_UNAVAILABLE';

export class AgentExecutionAggregationError extends Error {
  readonly code: AgentExecutionAggregationErrorCode;

  constructor(code: AgentExecutionAggregationErrorCode, message: string) {
    super(message);
    this.name = 'AgentExecutionAggregationError';
    this.code = code;
  }
}

interface DispatchJobRow {
  job_run_id: string;
  job_status: string;
  plan_id: string;
  orchestrator_run_id: string;
}

interface PlanRow {
  id: string;
  user_id: string;
  run_id: string;
  context_receipt_id: string;
  plan_version: number;
  step_count: number;
  envelope: Record<string, unknown>;
  created_at: Date;
}

interface PlanBudget {
  maxTokens: number;
  maxSearches: number;
  maxApiCalls: number;
  maxCredits: number;
  maxCurrencyMicros: number;
  maxRuntimeMs: number;
  maxConcurrency: number;
}

interface PlanStep {
  key: string;
  agentKey: string;
  agentVersion: string;
  dependencies: string[];
  toolKeys: string[];
  commandKeys: string[];
  policyRefs: string[];
  canonicalRefs: string[];
  memoryRefs: string[];
  budget: PlanBudget;
}

interface WorkRow {
  id: string;
  status: string;
  attempt_count: number;
  payload: Record<string, unknown>;
  result_effect: Record<string, unknown> | null;
  used_tokens: string;
  used_searches: string;
  used_api_calls: string;
  used_credits: string;
  used_currency_micros: string;
  used_runtime_ms: string;
}

interface LockedRunRow {
  id: string;
  agent_definition_id: string;
  agent_key: string;
  agent_version: string;
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

interface ParsedOrchestratorDefinition {
  id: string;
  agentKey: string;
  version: string;
  deterministicValidators: string[];
  evidenceRequired: boolean;
  minimumConfidence: number;
  reviewBelowConfidence: number;
  independentEvaluatorKey: string | null;
  evalSuiteId: string;
  evalThreshold: number;
}

interface ParsedEvaluatorDefinition {
  id: string;
  agentKey: string;
  version: string;
  promptVersion: string;
  skillVersions: Record<string, string>;
}

interface SpecialistResult {
  result: Record<string, unknown>;
  confidence: number;
  validationState: 'passed';
  uncertainty: string[];
  evidenceIds: string[];
  factIds: string[];
  sourceIds: string[];
  assumptions: string[];
  conflicts: string[];
  toolSummary: Array<{ toolKey: string; status: string; costMicros: number }>;
  cost: {
    inputTokens: number;
    outputTokens: number;
    searches: number;
    apiCalls: number;
    credits: number;
    currencyMicros: number;
  };
  proposedActions: Array<{ commandKey: string; payload: Record<string, unknown>; evidenceRefs: string[] }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readUniqueStrings(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems || value.some((entry) => !isNonEmptyString(entry))) return null;
  const normalized = value.map((entry) => entry.trim());
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function readStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([key, entry]) => !isNonEmptyString(key) || !isNonEmptyString(entry))) return null;
  return Object.fromEntries(entries.map(([key, entry]) => [key.trim(), (entry as string).trim()]));
}

function readSafeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function readConfidence(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function assertIdentifier(value: string, field: string, maxLength = 128): void {
  if (!value.trim() || value.length > maxLength) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_INPUT_INVALID',
      `${field} must be a non-empty identifier no longer than ${maxLength} characters.`,
    );
  }
}

function readBudget(value: unknown): PlanBudget | null {
  if (!isRecord(value)) return null;
  const maxTokens = readSafeInteger(value.maxTokens);
  const maxSearches = readSafeInteger(value.maxSearches);
  const maxApiCalls = readSafeInteger(value.maxApiCalls);
  const maxCredits = readSafeInteger(value.maxCredits);
  const maxCurrencyMicros = readSafeInteger(value.maxCurrencyMicros);
  const maxRuntimeMs = readSafeInteger(value.maxRuntimeMs);
  const maxConcurrency = readSafeInteger(value.maxConcurrency);
  if (
    maxTokens === null ||
    maxSearches === null ||
    maxApiCalls === null ||
    maxCredits === null ||
    maxCurrencyMicros === null ||
    maxRuntimeMs === null ||
    maxConcurrency !== 1
  ) {
    return null;
  }
  return { maxTokens, maxSearches, maxApiCalls, maxCredits, maxCurrencyMicros, maxRuntimeMs, maxConcurrency };
}

function parsePlanSteps(plan: PlanRow): PlanStep[] {
  if (
    plan.envelope.id !== plan.id ||
    plan.envelope.runId !== plan.run_id ||
    plan.envelope.contextReceiptId !== plan.context_receipt_id ||
    plan.envelope.planVersion !== plan.plan_version ||
    !Array.isArray(plan.envelope.steps) ||
    plan.envelope.steps.length !== plan.step_count
  ) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_PROJECTION_CONFLICT',
      `Execution plan ${plan.id} has an invalid canonical envelope projection.`,
    );
  }

  const steps: PlanStep[] = [];
  const keys = new Set<string>();
  for (const value of plan.envelope.steps) {
    if (!isRecord(value)) {
      throw new AgentExecutionAggregationError('AGENT_AGGREGATION_PROJECTION_CONFLICT', 'Execution plan step is invalid.');
    }
    const dependencies = readUniqueStrings(value.dependencies, 64);
    const toolKeys = readUniqueStrings(value.toolKeys, 128);
    const commandKeys = readUniqueStrings(value.commandKeys, 128);
    const policyRefs = readUniqueStrings(value.policyRefs, 128);
    const canonicalRefs = readUniqueStrings(value.canonicalRefs, 512);
    const memoryRefs = readUniqueStrings(value.memoryRefs, 512);
    const budget = readBudget(value.budget);
    if (
      !isNonEmptyString(value.key) ||
      !isNonEmptyString(value.agentKey) ||
      !isNonEmptyString(value.agentVersion) ||
      !dependencies ||
      !toolKeys ||
      !commandKeys ||
      !policyRefs ||
      !canonicalRefs ||
      !memoryRefs ||
      !budget ||
      keys.has(value.key)
    ) {
      throw new AgentExecutionAggregationError(
        'AGENT_AGGREGATION_PROJECTION_CONFLICT',
        `Execution plan ${plan.id} contains an invalid or duplicate step.`,
      );
    }
    keys.add(value.key);
    steps.push({
      key: value.key,
      agentKey: value.agentKey,
      agentVersion: value.agentVersion,
      dependencies,
      toolKeys,
      commandKeys,
      policyRefs,
      canonicalRefs,
      memoryRefs,
      budget,
    });
  }
  return steps;
}

function parseSpecialistResult(value: unknown): SpecialistResult | null {
  if (!isRecord(value) || !isRecord(value.result) || value.validationState !== 'passed') return null;
  const confidence = readConfidence(value.confidence);
  const uncertainty = readUniqueStrings(value.uncertainty, 128);
  const evidenceIds = readUniqueStrings(value.evidenceIds, 512);
  const factIds = readUniqueStrings(value.factIds, 512);
  const sourceIds = readUniqueStrings(value.sourceIds, 512);
  const assumptions = readUniqueStrings(value.assumptions, 128);
  const conflicts = readUniqueStrings(value.conflicts, 128);
  if (
    confidence === null ||
    !uncertainty ||
    !evidenceIds ||
    !factIds ||
    !sourceIds ||
    !assumptions ||
    !conflicts ||
    !Array.isArray(value.toolSummary) ||
    value.toolSummary.length > 512 ||
    !isRecord(value.cost) ||
    !Array.isArray(value.proposedActions) ||
    value.proposedActions.length > 128
  ) {
    return null;
  }

  const inputTokens = readSafeInteger(value.cost.inputTokens);
  const outputTokens = readSafeInteger(value.cost.outputTokens);
  const searches = readSafeInteger(value.cost.searches);
  const apiCalls = readSafeInteger(value.cost.apiCalls);
  const credits = readSafeInteger(value.cost.credits);
  const currencyMicros = readSafeInteger(value.cost.currencyMicros);
  if ([inputTokens, outputTokens, searches, apiCalls, credits, currencyMicros].some((entry) => entry === null)) return null;

  const toolSummary: SpecialistResult['toolSummary'] = [];
  for (const entry of value.toolSummary) {
    if (
      !isRecord(entry) ||
      !isNonEmptyString(entry.toolKey) ||
      !['succeeded', 'failed', 'blocked', 'skipped'].includes(String(entry.status)) ||
      readSafeInteger(entry.costMicros) === null
    ) {
      return null;
    }
    toolSummary.push({
      toolKey: entry.toolKey,
      status: String(entry.status),
      costMicros: Number(entry.costMicros),
    });
  }

  const proposedActions: SpecialistResult['proposedActions'] = [];
  for (const action of value.proposedActions) {
    if (!isRecord(action) || !isNonEmptyString(action.commandKey) || !isRecord(action.payload)) return null;
    const evidenceRefs = readUniqueStrings(action.evidenceRefs, 128);
    if (!evidenceRefs) return null;
    proposedActions.push({ commandKey: action.commandKey, payload: action.payload, evidenceRefs });
  }

  return {
    result: value.result,
    confidence,
    validationState: 'passed',
    uncertainty,
    evidenceIds,
    factIds,
    sourceIds,
    assumptions,
    conflicts,
    toolSummary,
    cost: {
      inputTokens: Number(inputTokens),
      outputTokens: Number(outputTokens),
      searches: Number(searches),
      apiCalls: Number(apiCalls),
      credits: Number(credits),
      currencyMicros: Number(currencyMicros),
    },
    proposedActions,
  };
}

function parseOrchestratorDefinition(row: DefinitionRow, run: LockedRunRow): ParsedOrchestratorDefinition {
  const specification = row.specification;
  const validators = readUniqueStrings(specification.deterministicValidators, 128);
  const minimumConfidence = readConfidence(specification.minimumConfidence);
  const reviewBelowConfidence = readConfidence(specification.reviewBelowConfidence);
  const evalThreshold = readConfidence(specification.evalThreshold);
  const modelPolicy = isRecord(specification.modelPolicy) ? specification.modelPolicy : null;
  if (
    row.status !== 'approved' ||
    row.id !== run.agent_definition_id ||
    row.agent_key !== run.agent_key ||
    row.version !== run.agent_version ||
    row.agent_key !== 'agent.control.orchestrator' ||
    row.autonomy_tier !== 'T2' ||
    row.requires_human_approval ||
    specification.key !== row.agent_key ||
    specification.version !== row.version ||
    specification.status !== row.status ||
    !validators ||
    validators.length === 0 ||
    typeof specification.evidenceRequired !== 'boolean' ||
    minimumConfidence === null ||
    reviewBelowConfidence === null ||
    !isNonEmptyString(specification.evalSuiteId) ||
    evalThreshold === null ||
    !modelPolicy ||
    modelPolicy.routingMode !== 'deterministic_only' ||
    !Array.isArray(modelPolicy.allowedProviderIds) ||
    modelPolicy.allowedProviderIds.length !== 0 ||
    !Array.isArray(modelPolicy.allowedModelIds) ||
    modelPolicy.allowedModelIds.length !== 0 ||
    !Array.isArray(modelPolicy.fallbackModelIds) ||
    modelPolicy.fallbackModelIds.length !== 0 ||
    (specification.independentEvaluatorKey !== undefined && !isNonEmptyString(specification.independentEvaluatorKey))
  ) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_DEFINITION_INVALID',
      `Orchestrator definition ${row.agent_key}@${row.version} is invalid for deterministic aggregation.`,
    );
  }

  return {
    id: row.id,
    agentKey: row.agent_key,
    version: row.version,
    deterministicValidators: validators,
    evidenceRequired: specification.evidenceRequired,
    minimumConfidence,
    reviewBelowConfidence,
    independentEvaluatorKey:
      typeof specification.independentEvaluatorKey === 'string' ? specification.independentEvaluatorKey : null,
    evalSuiteId: specification.evalSuiteId,
    evalThreshold,
  };
}

function parseEvaluatorDefinition(row: DefinitionRow, expectedKey: string): ParsedEvaluatorDefinition {
  const specification = row.specification;
  const modelPolicy = isRecord(specification.modelPolicy) ? specification.modelPolicy : null;
  const skillVersions = readStringRecord(specification.skillVersions);
  if (
    row.status !== 'approved' ||
    row.agent_key !== expectedKey ||
    specification.key !== row.agent_key ||
    specification.version !== row.version ||
    specification.status !== row.status ||
    row.requires_human_approval ||
    row.autonomy_tier === 'T4' ||
    !modelPolicy ||
    !isNonEmptyString(specification.promptVersion) ||
    !skillVersions ||
    specification.independentEvaluatorKey !== undefined
  ) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_EVALUATOR_NOT_APPROVED',
      `Evaluator definition ${row.agent_key}@${row.version} is unavailable or invalid.`,
    );
  }
  if (
    modelPolicy.routingMode !== 'deterministic_only' ||
    !Array.isArray(modelPolicy.allowedProviderIds) ||
    modelPolicy.allowedProviderIds.length !== 0 ||
    !Array.isArray(modelPolicy.allowedModelIds) ||
    modelPolicy.allowedModelIds.length !== 0 ||
    !Array.isArray(modelPolicy.fallbackModelIds) ||
    modelPolicy.fallbackModelIds.length !== 0
  ) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_EVALUATOR_ROUTE_UNAVAILABLE',
      `Evaluator ${row.agent_key}@${row.version} requires a provider/model route that is not enabled in this slice.`,
    );
  }
  return {
    id: row.id,
    agentKey: row.agent_key,
    version: row.version,
    promptVersion: specification.promptVersion,
    skillVersions,
  };
}

function deterministicId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 48)}`;
}

function safeAdd(left: number, right: number): number | null {
  const value = left + right;
  return Number.isSafeInteger(value) ? value : null;
}

function appendUnique(target: string[], values: readonly string[], maxItems: number, issue: string, issues: string[]): void {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
  target.sort();
  if (target.length > maxItems && !issues.includes(issue)) issues.push(issue);
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
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_AUTHORIZATION_REQUIRED',
      'Current active workspace.read authorization is required to aggregate execution results.',
    );
  }
}

function parseStoredAggregation(
  workspaceId: string,
  dispatchId: string,
  planId: string,
  planVersion: number,
  jobRunId: string,
  orchestratorRunId: string,
  run: LockedRunRow,
): AgentExecutionAggregationResult | null {
  const stored = run.envelope.executionAggregation;
  if (stored === undefined) return null;
  if (!isRecord(stored) || stored.dispatchId !== dispatchId || stored.planId !== planId || stored.planVersion !== planVersion) {
    throw new AgentPersistenceConflictError(
      'AGENT_EXECUTION_AGGREGATION_CONFLICT',
      `Orchestrator AgentRun ${orchestratorRunId} already contains a different execution aggregation.`,
    );
  }
  if (!isNonEmptyString(stored.state) || !Array.isArray(stored.issues)) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_PROJECTION_CONFLICT',
      `Orchestrator AgentRun ${orchestratorRunId} contains an invalid aggregation projection.`,
    );
  }
  const state = stored.state as AgentExecutionAggregationState;
  if (!['succeeded', 'evaluation_pending', 'review_required', 'failed', 'cancelled'].includes(state)) {
    throw new AgentExecutionAggregationError('AGENT_AGGREGATION_PROJECTION_CONFLICT', 'Stored aggregation state is invalid.');
  }
  const handoff = isRecord(stored.evaluatorHandoff) ? (stored.evaluatorHandoff as unknown as AgentEvaluatorHandoff) : null;
  const aggregate = isRecord(stored.aggregate) ? stored.aggregate : null;
  return {
    workspaceId,
    dispatchId,
    planId,
    planVersion,
    jobRunId,
    orchestratorRunId,
    state,
    orchestratorStatus: run.status,
    aggregate,
    evaluatorHandoff: handoff,
    issues: stored.issues.filter(isNonEmptyString),
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
    occurredAt: Date;
    envelopePatch: Record<string, unknown>;
    metadata: Record<string, unknown>;
  },
): Promise<LockedRunRow> {
  if (run.status === input.toStatus || terminalRunStatuses.has(run.status)) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_ORCHESTRATOR_STATE',
      `Orchestrator AgentRun ${run.id} cannot transition from ${run.status} to ${input.toStatus}.`,
    );
  }
  if (input.occurredAt < run.updated_at) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_INPUT_INVALID',
      `Aggregation transition time precedes orchestrator AgentRun ${run.id}.`,
    );
  }

  let startedAt = run.started_at;
  if (!startedAt && (input.toStatus === 'running' || terminalRunStatuses.has(input.toStatus))) startedAt = input.occurredAt;
  const completedAt = terminalRunStatuses.has(input.toStatus) ? input.occurredAt : null;
  const envelope = nextRunEnvelope(run.envelope, input.toStatus, input.envelopePatch, startedAt, completedAt);

  await client.query(
    `INSERT INTO agent_run_transitions (
       id, workspace_id, run_id, from_status, to_status, reason_code,
       actor_type, actor_id, metadata, occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'system', NULL, $7::jsonb, $8)`,
    [
      input.transitionId,
      run.envelope.workspaceId,
      run.id,
      run.status,
      input.toStatus,
      input.reasonCode,
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
      run.envelope.workspaceId,
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

function stateForTerminalJob(jobStatus: string): { state: AgentExecutionAggregationState; runStatus: PersistedAgentRunStatus } | null {
  if (jobStatus === 'failed') return { state: 'failed', runStatus: 'failed' };
  if (jobStatus === 'cancelled') return { state: 'cancelled', runStatus: 'cancelled' };
  if (jobStatus === 'review') return { state: 'review_required', runStatus: 'review_required' };
  return null;
}

async function createEvaluatorHandoff(
  client: PoolClient,
  input: AggregateAgentExecutionInput,
  plan: PlanRow,
  orchestrator: ParsedOrchestratorDefinition,
  evaluatorKey: string,
  aggregate: Record<string, unknown>,
): Promise<AgentEvaluatorHandoff> {
  if (!input.evaluatorAgentVersion) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_EVALUATOR_VERSION_REQUIRED',
      `Evaluator ${evaluatorKey} requires an exact evaluatorAgentVersion.`,
    );
  }
  assertIdentifier(input.evaluatorAgentVersion, 'evaluatorAgentVersion', 64);

  const definitionResult = await client.query<DefinitionRow>(
    `SELECT id, agent_key, version, status, autonomy_tier, requires_human_approval, specification
     FROM agent_definitions
     WHERE agent_key = $1 AND version = $2
     FOR SHARE`,
    [evaluatorKey, input.evaluatorAgentVersion],
  );
  const definitionRow = definitionResult.rows[0];
  if (!definitionRow) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_EVALUATOR_NOT_APPROVED',
      `Evaluator ${evaluatorKey}@${input.evaluatorAgentVersion} was not found.`,
    );
  }
  const evaluator = parseEvaluatorDefinition(definitionRow, evaluatorKey);

  const parentContextResult = await client.query<{ receipt: Record<string, unknown>; created_at: Date }>(
    `SELECT receipt, created_at
     FROM agent_context_receipts
     WHERE id = $1 AND workspace_id = $2
     FOR SHARE`,
    [plan.context_receipt_id, input.workspaceId],
  );
  const parentContext = parentContextResult.rows[0];
  if (!parentContext || input.occurredAt < parentContext.created_at) {
    throw new AgentExecutionAggregationError(
      'AGENT_AGGREGATION_PROJECTION_CONFLICT',
      `Parent ContextReceipt ${plan.context_receipt_id} is unavailable or newer than the aggregation.`,
    );
  }
  const policyRefs = readUniqueStrings(parentContext.receipt.policyRefs, 128);
  const canonicalRefs = readUniqueStrings(parentContext.receipt.canonicalRefs, 512);
  if (!policyRefs || policyRefs.length === 0 || !canonicalRefs) {
    throw new AgentExecutionAggregationError('AGENT_AGGREGATION_PROJECTION_CONFLICT', 'Parent ContextReceipt scope is invalid.');
  }

  const evaluatorRunId = deterministicId('agent-evaluator', plan.run_id, input.dispatchId, evaluatorKey, evaluator.version);
  const contextReceiptId = deterministicId('ctx-evaluator', evaluatorRunId);
  const handoffId = deterministicId('eval-handoff', plan.run_id, input.dispatchId, evaluatorRunId);
  const taskId = deterministicId('task-evaluator', plan.id, evaluatorRunId);
  const receipt = {
    id: contextReceiptId,
    taskId,
    workspaceId: input.workspaceId,
    userId: plan.user_id,
    runId: evaluatorRunId,
    agentKey: evaluator.agentKey,
    agentVersion: evaluator.version,
    policyRefs,
    canonicalRefs,
    memoryRefs: [],
    tokenBudget: 0,
    maxCurrencyMicros: 0,
    createdAt: input.occurredAt.toISOString(),
  };

  const contextInsert = await client.query<{ id: string }>(
    `INSERT INTO agent_context_receipts (
       id, workspace_id, user_id, run_scope_id, agent_definition_id,
       agent_key, agent_version, receipt, token_budget, max_currency_micros, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 0, 0, $9)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      contextReceiptId,
      input.workspaceId,
      plan.user_id,
      evaluatorRunId,
      evaluator.id,
      evaluator.agentKey,
      evaluator.version,
      JSON.stringify(receipt),
      input.occurredAt,
    ],
  );
  if (!contextInsert.rows[0]) {
    const existing = await client.query<{ same_context: boolean }>(
      `SELECT workspace_id = $2::uuid
          AND user_id = $3::uuid
          AND run_scope_id = $4
          AND agent_definition_id = $5::uuid
          AND agent_key = $6
          AND agent_version = $7
          AND receipt = $8::jsonb
          AND token_budget = 0
          AND max_currency_micros = 0
          AND created_at = $9::timestamptz AS same_context
       FROM agent_context_receipts WHERE id = $1`,
      [
        contextReceiptId,
        input.workspaceId,
        plan.user_id,
        evaluatorRunId,
        evaluator.id,
        evaluator.agentKey,
        evaluator.version,
        JSON.stringify(receipt),
        input.occurredAt,
      ],
    );
    if (!existing.rows[0]?.same_context) {
      throw new AgentPersistenceConflictError('AGENT_EVALUATOR_CONTEXT_ID_CONFLICT', 'Evaluator ContextReceipt identity conflict.');
    }
  }

  const runEnvelope = {
    id: evaluatorRunId,
    workspaceId: input.workspaceId,
    agentKey: evaluator.agentKey,
    agentVersion: evaluator.version,
    parentRunId: plan.run_id,
    handoffId,
    executionMode: 'deterministic',
    promptVersion: evaluator.promptVersion,
    skillVersions: evaluator.skillVersions,
    contextReceiptId,
    status: 'queued',
    uncertainty: [],
    evidenceIds: [],
    factIds: [],
    sourceIds: [],
    assumptions: [],
    conflicts: [],
    toolSummary: [],
    cost: { inputTokens: 0, outputTokens: 0, searches: 0, apiCalls: 0, credits: 0, currencyMicros: 0 },
    validationState: 'pending',
    evaluatorState: 'not_required',
    proposedActions: [],
    evaluationSubject: {
      subjectRunId: plan.run_id,
      dispatchId: input.dispatchId,
      planId: plan.id,
      aggregate,
    },
  };

  const runInsert = await client.query<{ id: string }>(
    `INSERT INTO agent_runs (
       id, workspace_id, agent_definition_id, agent_key, agent_version,
       context_receipt_id, parent_run_id, handoff_id, execution_mode,
       provider_id, model_id, status, envelope, started_at, completed_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'deterministic', NULL, NULL, 'queued', $9::jsonb, NULL, NULL, $10, $10)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      evaluatorRunId,
      input.workspaceId,
      evaluator.id,
      evaluator.agentKey,
      evaluator.version,
      contextReceiptId,
      plan.run_id,
      handoffId,
      JSON.stringify(runEnvelope),
      input.occurredAt,
    ],
  );
  if (!runInsert.rows[0]) {
    const existing = await client.query<{ same_run: boolean }>(
      `SELECT workspace_id = $2::uuid
          AND agent_definition_id = $3::uuid
          AND agent_key = $4
          AND agent_version = $5
          AND context_receipt_id = $6
          AND parent_run_id = $7
          AND handoff_id = $8
          AND execution_mode = 'deterministic'
          AND provider_id IS NULL
          AND model_id IS NULL
          AND status = 'queued'
          AND envelope = $9::jsonb AS same_run
       FROM agent_runs WHERE id = $1`,
      [
        evaluatorRunId,
        input.workspaceId,
        evaluator.id,
        evaluator.agentKey,
        evaluator.version,
        contextReceiptId,
        plan.run_id,
        handoffId,
        JSON.stringify(runEnvelope),
      ],
    );
    if (!existing.rows[0]?.same_run) {
      throw new AgentPersistenceConflictError('AGENT_EVALUATOR_RUN_ID_CONFLICT', 'Evaluator AgentRun identity conflict.');
    }
  }

  return {
    handoffId,
    evaluatorRunId,
    contextReceiptId,
    agentKey: evaluator.agentKey,
    agentVersion: evaluator.version,
    subjectRunId: plan.run_id,
    evalSuiteId: orchestrator.evalSuiteId,
    evalThreshold: orchestrator.evalThreshold,
  };
}

export async function aggregateAgentExecutionPlan(
  pool: Pool,
  input: AggregateAgentExecutionInput,
): Promise<AgentExecutionAggregationResult> {
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.dispatchId, 'dispatchId');
  if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) {
    throw new AgentExecutionAggregationError('AGENT_AGGREGATION_INPUT_INVALID', 'occurredAt must be a valid Date.');
  }

  return withPgTransaction(pool, async (client) => {
    const jobs = await client.query<DispatchJobRow>(
      `SELECT DISTINCT
         job.id AS job_run_id,
         job.status AS job_status,
         work.payload->>'planId' AS plan_id,
         work.payload->>'orchestratorRunId' AS orchestrator_run_id
       FROM job_work_units AS work
       INNER JOIN job_runs AS job ON job.id = work.job_run_id
       WHERE work.workspace_id = $1 AND work.payload->>'dispatchId' = $2`,
      [input.workspaceId, input.dispatchId],
    );
    const job = jobs.rows[0];
    if (jobs.rows.length !== 1 || !job || !job.plan_id || !job.orchestrator_run_id) {
      throw new AgentExecutionAggregationError(
        'AGENT_AGGREGATION_DISPATCH_NOT_FOUND',
        `Dispatch ${input.dispatchId} is missing or has an invalid JobRun projection.`,
      );
    }

    const planResult = await client.query<PlanRow>(
      `SELECT id, user_id, run_id, context_receipt_id, plan_version, step_count, envelope, created_at
       FROM agent_execution_plans
       WHERE id = $1 AND workspace_id = $2
       FOR SHARE`,
      [job.plan_id, input.workspaceId],
    );
    const plan = planResult.rows[0];
    if (!plan || plan.run_id !== job.orchestrator_run_id) {
      throw new AgentExecutionAggregationError(
        'AGENT_AGGREGATION_PROJECTION_CONFLICT',
        `Dispatch ${input.dispatchId} does not match its immutable execution plan.`,
      );
    }
    if (input.occurredAt < plan.created_at) {
      throw new AgentExecutionAggregationError(
        'AGENT_AGGREGATION_INPUT_INVALID',
        'Aggregation time cannot precede its execution plan.',
      );
    }
    const steps = parsePlanSteps(plan);
    await assertCurrentWorkspaceRead(client, input.workspaceId, plan.user_id);

    const runResult = await client.query<LockedRunRow>(
      `SELECT id, agent_definition_id, agent_key, agent_version, status, envelope,
              started_at, completed_at, updated_at
       FROM agent_runs
       WHERE id = $1 AND workspace_id = $2
       FOR UPDATE`,
      [plan.run_id, input.workspaceId],
    );
    let orchestratorRun = runResult.rows[0];
    if (!orchestratorRun) {
      throw new AgentExecutionAggregationError(
        'AGENT_AGGREGATION_PROJECTION_CONFLICT',
        `Orchestrator AgentRun ${plan.run_id} is missing.`,
      );
    }

    const stored = parseStoredAggregation(
      input.workspaceId,
      input.dispatchId,
      plan.id,
      plan.plan_version,
      job.job_run_id,
      plan.run_id,
      orchestratorRun,
    );
    if (stored) return stored;

    if (orchestratorRun.status !== 'queued') {
      throw new AgentExecutionAggregationError(
        'AGENT_AGGREGATION_ORCHESTRATOR_STATE',
        `Orchestrator AgentRun ${plan.run_id} is ${orchestratorRun.status} without an aggregation projection.`,
      );
    }

    const terminalJob = stateForTerminalJob(job.job_status);
    if (terminalJob) {
      const issues = [`job_${job.job_status}`];
      const aggregation = {
        version: '1.0.0',
        dispatchId: input.dispatchId,
        planId: plan.id,
        planVersion: plan.plan_version,
        jobRunId: job.job_run_id,
        state: terminalJob.state,
        aggregate: null,
        evaluatorHandoff: null,
        issues,
        occurredAt: input.occurredAt.toISOString(),
      };
      orchestratorRun = await transitionRun(client, orchestratorRun, {
        toStatus: terminalJob.runStatus,
        transitionId: deterministicId('agent-aggregate-transition', plan.run_id, input.dispatchId, terminalJob.state),
        reasonCode: `execution_aggregation_${terminalJob.state}`,
        occurredAt: input.occurredAt,
        envelopePatch: {
          executionAggregation: aggregation,
          validationState: terminalJob.state === 'review_required' ? 'review' : 'failed',
          evaluatorState: 'not_required',
        },
        metadata: { dispatchId: input.dispatchId, planId: plan.id, jobRunId: job.job_run_id },
      });
      return {
        workspaceId: input.workspaceId,
        dispatchId: input.dispatchId,
        planId: plan.id,
        planVersion: plan.plan_version,
        jobRunId: job.job_run_id,
        orchestratorRunId: plan.run_id,
        state: terminalJob.state,
        orchestratorStatus: orchestratorRun.status,
        aggregate: null,
        evaluatorHandoff: null,
        issues,
      };
    }
    if (job.job_status !== 'succeeded') {
      throw new AgentExecutionAggregationError(
        'AGENT_AGGREGATION_NOT_READY',
        `Dispatch ${input.dispatchId} JobRun is ${job.job_status}; completed-DAG aggregation requires a terminal JobRun.`,
      );
    }

    const definitionResult = await client.query<DefinitionRow>(
      `SELECT id, agent_key, version, status, autonomy_tier, requires_human_approval, specification
       FROM agent_definitions
       WHERE id = $1 AND agent_key = $2 AND version = $3
       FOR SHARE`,
      [orchestratorRun.agent_definition_id, orchestratorRun.agent_key, orchestratorRun.agent_version],
    );
    const definitionRow = definitionResult.rows[0];
    if (!definitionRow) {
      throw new AgentExecutionAggregationError('AGENT_AGGREGATION_DEFINITION_INVALID', 'Orchestrator definition is missing.');
    }
    const orchestrator = parseOrchestratorDefinition(definitionRow, orchestratorRun);

    const workResult = await client.query<WorkRow>(
      `SELECT
         work.id,
         work.status,
         work.attempt_count,
         work.payload,
         result_effect.data AS result_effect,
         COALESCE(sum((usage_effect.data->'usage'->>'tokens')::bigint) FILTER (WHERE usage_effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_tokens,
         COALESCE(sum((usage_effect.data->'usage'->>'searches')::bigint) FILTER (WHERE usage_effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_searches,
         COALESCE(sum((usage_effect.data->'usage'->>'apiCalls')::bigint) FILTER (WHERE usage_effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_api_calls,
         COALESCE(sum((usage_effect.data->'usage'->>'credits')::bigint) FILTER (WHERE usage_effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_credits,
         COALESCE(sum((usage_effect.data->'usage'->>'currencyMicros')::bigint) FILTER (WHERE usage_effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_currency_micros,
         COALESCE(sum((usage_effect.data->'usage'->>'runtimeMs')::bigint) FILTER (WHERE usage_effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_runtime_ms
       FROM job_work_units AS work
       LEFT JOIN job_effects AS result_effect
         ON result_effect.work_unit_id = work.id AND result_effect.effect_key = $3
       LEFT JOIN job_effects AS usage_effect
         ON usage_effect.work_unit_id = work.id AND usage_effect.data->>'kind' = 'agent_execution_budget_usage'
       WHERE work.workspace_id = $1 AND work.job_run_id = $2 AND work.payload->>'dispatchId' = $4
       GROUP BY work.id, result_effect.data
       ORDER BY work.payload->>'stepKey' ASC`,
      [input.workspaceId, job.job_run_id, resultEffectKey, input.dispatchId],
    );

    const issues: string[] = [];
    if (workResult.rows.length !== steps.length) issues.push('plan_work_count_mismatch');
    for (const validator of orchestrator.deterministicValidators) {
      if (!supportedOrchestratorValidators.has(validator)) issues.push(`unsupported_validator:${validator}`);
    }

    const byStep = new Map(steps.map((step) => [step.key, step]));
    const aggregateSteps: AgentExecutionAggregateStep[] = [];
    const evidenceIds: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];
    const assumptions: string[] = [];
    const conflicts: string[] = [];
    const toolSummary: SpecialistResult['toolSummary'] = [];
    const proposedActions: SpecialistResult['proposedActions'] = [];
    let aggregateConfidence = 1;
    const cost = { inputTokens: 0, outputTokens: 0, searches: 0, apiCalls: 0, credits: 0, currencyMicros: 0 };
    const resourceUsage = { tokens: 0, searches: 0, apiCalls: 0, credits: 0, currencyMicros: 0, runtimeMs: 0 };

    for (const work of workResult.rows) {
      const payload = work.payload;
      const stepKey = isNonEmptyString(payload.stepKey) ? payload.stepKey : '';
      const step = byStep.get(stepKey);
      if (!step || work.status !== 'succeeded' || !isRecord(work.result_effect)) {
        issues.push(`invalid_work_projection:${stepKey || work.id}`);
        continue;
      }

      const expectedStep = {
        dependencies: step.dependencies,
        toolKeys: step.toolKeys,
        commandKeys: step.commandKeys,
        policyRefs: step.policyRefs,
        canonicalRefs: step.canonicalRefs,
        memoryRefs: step.memoryRefs,
        budget: step.budget,
      };
      const projectedStep = {
        dependencies: payload.dependencies,
        toolKeys: payload.toolKeys,
        commandKeys: payload.commandKeys,
        policyRefs: payload.policyRefs,
        canonicalRefs: payload.canonicalRefs,
        memoryRefs: payload.memoryRefs,
        budget: payload.budget,
      };
      if (
        payload.dispatchId !== input.dispatchId ||
        payload.planId !== plan.id ||
        payload.planVersion !== plan.plan_version ||
        payload.workspaceId !== input.workspaceId ||
        payload.orchestratorRunId !== plan.run_id ||
        payload.contextReceiptId !== plan.context_receipt_id ||
        payload.agentKey !== step.agentKey ||
        payload.agentVersion !== step.agentVersion ||
        !isDeepStrictEqual(projectedStep, expectedStep)
      ) {
        issues.push(`work_plan_mismatch:${stepKey}`);
        continue;
      }

      const effect = work.result_effect;
      const result = parseSpecialistResult(effect.result);
      if (
        effect.kind !== 'agent_specialist_execution_result' ||
        effect.dispatchId !== input.dispatchId ||
        effect.planId !== plan.id ||
        effect.stepKey !== step.key ||
        effect.agentKey !== step.agentKey ||
        effect.agentVersion !== step.agentVersion ||
        effect.attempt !== work.attempt_count ||
        !isNonEmptyString(effect.runId) ||
        !isNonEmptyString(effect.contextReceiptId) ||
        !result
      ) {
        issues.push(`invalid_specialist_result:${stepKey}`);
        continue;
      }

      const childResult = await client.query<{
        id: string;
        status: PersistedAgentRunStatus;
        parent_run_id: string | null;
        handoff_id: string | null;
        context_receipt_id: string;
        agent_key: string;
        agent_version: string;
        envelope: Record<string, unknown>;
      }>(
        `SELECT id, status, parent_run_id, handoff_id, context_receipt_id, agent_key, agent_version, envelope
         FROM agent_runs
         WHERE id = $1 AND workspace_id = $2
         FOR SHARE`,
        [effect.runId, input.workspaceId],
      );
      const child = childResult.rows[0];
      const projectedResult = child
        ? {
            result: child.envelope.result,
            confidence: child.envelope.confidence,
            uncertainty: child.envelope.uncertainty,
            evidenceIds: child.envelope.evidenceIds,
            factIds: child.envelope.factIds,
            sourceIds: child.envelope.sourceIds,
            assumptions: child.envelope.assumptions,
            conflicts: child.envelope.conflicts,
            toolSummary: child.envelope.toolSummary,
            cost: child.envelope.cost,
            validationState: child.envelope.validationState,
            proposedActions: child.envelope.proposedActions,
          }
        : null;
      if (
        !child ||
        child.status !== 'succeeded' ||
        child.parent_run_id !== plan.run_id ||
        child.handoff_id !== work.id ||
        child.context_receipt_id !== effect.contextReceiptId ||
        child.agent_key !== step.agentKey ||
        child.agent_version !== step.agentVersion ||
        !isDeepStrictEqual(projectedResult, effect.result)
      ) {
        issues.push(`specialist_run_binding:${stepKey}`);
        continue;
      }

      const used = {
        tokens: Number(work.used_tokens),
        searches: Number(work.used_searches),
        apiCalls: Number(work.used_api_calls),
        credits: Number(work.used_credits),
        currencyMicros: Number(work.used_currency_micros),
        runtimeMs: Number(work.used_runtime_ms),
      };
      for (const [field, limit] of [
        ['tokens', step.budget.maxTokens],
        ['searches', step.budget.maxSearches],
        ['apiCalls', step.budget.maxApiCalls],
        ['credits', step.budget.maxCredits],
        ['currencyMicros', step.budget.maxCurrencyMicros],
        ['runtimeMs', step.budget.maxRuntimeMs],
      ] as const) {
        if (!Number.isSafeInteger(used[field]) || used[field] < 0 || used[field] > limit) {
          issues.push(`budget_projection:${stepKey}:${field}`);
        }
        const next = safeAdd(resourceUsage[field], used[field]);
        if (next === null) issues.push(`budget_overflow:${field}`);
        else resourceUsage[field] = next;
      }

      const resultTokens = safeAdd(result.cost.inputTokens, result.cost.outputTokens);
      if (
        resultTokens === null ||
        resultTokens > used.tokens ||
        result.cost.searches > used.searches ||
        result.cost.apiCalls > used.apiCalls ||
        result.cost.credits > used.credits ||
        result.cost.currencyMicros > used.currencyMicros
      ) {
        issues.push(`result_cost_unaccounted:${stepKey}`);
      }
      for (const action of result.proposedActions) {
        if (!step.commandKeys.includes(action.commandKey)) issues.push(`action_outside_plan:${stepKey}:${action.commandKey}`);
      }

      const nextInput = safeAdd(cost.inputTokens, result.cost.inputTokens);
      const nextOutput = safeAdd(cost.outputTokens, result.cost.outputTokens);
      const nextSearches = safeAdd(cost.searches, result.cost.searches);
      const nextApi = safeAdd(cost.apiCalls, result.cost.apiCalls);
      const nextCredits = safeAdd(cost.credits, result.cost.credits);
      const nextCurrency = safeAdd(cost.currencyMicros, result.cost.currencyMicros);
      if ([nextInput, nextOutput, nextSearches, nextApi, nextCredits, nextCurrency].some((value) => value === null)) {
        issues.push('aggregate_cost_overflow');
      } else {
        cost.inputTokens = Number(nextInput);
        cost.outputTokens = Number(nextOutput);
        cost.searches = Number(nextSearches);
        cost.apiCalls = Number(nextApi);
        cost.credits = Number(nextCredits);
        cost.currencyMicros = Number(nextCurrency);
      }

      aggregateConfidence = Math.min(aggregateConfidence, result.confidence);
      appendUnique(evidenceIds, result.evidenceIds, 512, 'aggregate_evidence_limit', issues);
      appendUnique(factIds, result.factIds, 512, 'aggregate_fact_limit', issues);
      appendUnique(sourceIds, result.sourceIds, 512, 'aggregate_source_limit', issues);
      appendUnique(assumptions, result.assumptions, 128, 'aggregate_assumption_limit', issues);
      appendUnique(conflicts, result.conflicts, 128, 'aggregate_conflict_limit', issues);
      toolSummary.push(...result.toolSummary);
      proposedActions.push(...result.proposedActions);
      if (toolSummary.length > 512) issues.push('aggregate_tool_summary_limit');
      if (proposedActions.length > 128) issues.push('aggregate_proposed_action_limit');
      aggregateSteps.push({
        stepKey: step.key,
        workUnitId: work.id,
        specialistRunId: effect.runId,
        agentKey: step.agentKey,
        agentVersion: step.agentVersion,
        attempt: work.attempt_count,
        confidence: result.confidence,
        result: result.result,
        evidenceIds: result.evidenceIds,
        factIds: result.factIds,
        sourceIds: result.sourceIds,
      });
    }

    if (aggregateSteps.length !== steps.length) issues.push('aggregate_step_count_mismatch');
    if (orchestrator.evidenceRequired && evidenceIds.length === 0) issues.push('orchestrator_evidence_required');
    if (
      aggregateConfidence < orchestrator.minimumConfidence ||
      aggregateConfidence < orchestrator.reviewBelowConfidence
    ) {
      issues.push('orchestrator_confidence_review');
    }

    const aggregate = {
      version: '1.0.0',
      dispatchId: input.dispatchId,
      planId: plan.id,
      planVersion: plan.plan_version,
      jobRunId: job.job_run_id,
      orchestratorRunId: plan.run_id,
      steps: aggregateSteps.sort((left, right) => left.stepKey.localeCompare(right.stepKey)),
      confidence: aggregateConfidence,
      evidenceIds,
      factIds,
      sourceIds,
      assumptions,
      conflicts,
      toolSummary,
      proposedActions,
      cost,
      resourceUsage,
      validators: orchestrator.deterministicValidators,
    };

    if (issues.length > 0) {
      const storedAggregation = {
        version: '1.0.0',
        dispatchId: input.dispatchId,
        planId: plan.id,
        planVersion: plan.plan_version,
        jobRunId: job.job_run_id,
        state: 'review_required',
        aggregate,
        evaluatorHandoff: null,
        issues: [...new Set(issues)].sort(),
        occurredAt: input.occurredAt.toISOString(),
      };
      orchestratorRun = await transitionRun(client, orchestratorRun, {
        toStatus: 'review_required',
        transitionId: deterministicId('agent-aggregate-transition', plan.run_id, input.dispatchId, 'review'),
        reasonCode: 'execution_aggregation_review_required',
        occurredAt: input.occurredAt,
        envelopePatch: {
          result: aggregate,
          confidence: aggregateConfidence,
          evidenceIds,
          factIds,
          sourceIds,
          assumptions,
          conflicts,
          toolSummary,
          cost,
          validationState: 'review',
          evaluatorState: 'not_required',
          proposedActions,
          executionAggregation: storedAggregation,
        },
        metadata: { dispatchId: input.dispatchId, planId: plan.id, issues: storedAggregation.issues },
      });
      return {
        workspaceId: input.workspaceId,
        dispatchId: input.dispatchId,
        planId: plan.id,
        planVersion: plan.plan_version,
        jobRunId: job.job_run_id,
        orchestratorRunId: plan.run_id,
        state: 'review_required',
        orchestratorStatus: orchestratorRun.status,
        aggregate,
        evaluatorHandoff: null,
        issues: storedAggregation.issues,
      };
    }

    if (orchestrator.independentEvaluatorKey) {
      const handoff = await createEvaluatorHandoff(
        client,
        input,
        plan,
        orchestrator,
        orchestrator.independentEvaluatorKey,
        aggregate,
      );
      const storedAggregation = {
        version: '1.0.0',
        dispatchId: input.dispatchId,
        planId: plan.id,
        planVersion: plan.plan_version,
        jobRunId: job.job_run_id,
        state: 'evaluation_pending',
        aggregate,
        evaluatorHandoff: handoff,
        issues: [],
        occurredAt: input.occurredAt.toISOString(),
      };
      orchestratorRun = await transitionRun(client, orchestratorRun, {
        toStatus: 'running',
        transitionId: deterministicId('agent-aggregate-transition', plan.run_id, input.dispatchId, 'evaluation-pending'),
        reasonCode: 'execution_aggregation_evaluator_handoff',
        occurredAt: input.occurredAt,
        envelopePatch: {
          result: aggregate,
          confidence: aggregateConfidence,
          evidenceIds,
          factIds,
          sourceIds,
          assumptions,
          conflicts,
          toolSummary,
          cost,
          validationState: 'passed',
          evaluatorState: 'pending',
          proposedActions,
          executionAggregation: storedAggregation,
        },
        metadata: {
          dispatchId: input.dispatchId,
          planId: plan.id,
          evaluatorRunId: handoff.evaluatorRunId,
          evaluatorKey: handoff.agentKey,
        },
      });
      return {
        workspaceId: input.workspaceId,
        dispatchId: input.dispatchId,
        planId: plan.id,
        planVersion: plan.plan_version,
        jobRunId: job.job_run_id,
        orchestratorRunId: plan.run_id,
        state: 'evaluation_pending',
        orchestratorStatus: orchestratorRun.status,
        aggregate,
        evaluatorHandoff: handoff,
        issues: [],
      };
    }

    const runningAt = input.occurredAt;
    const succeededAt = new Date(input.occurredAt.getTime() + 1);
    const storedAggregation = {
      version: '1.0.0',
      dispatchId: input.dispatchId,
      planId: plan.id,
      planVersion: plan.plan_version,
      jobRunId: job.job_run_id,
      state: 'succeeded',
      aggregate,
      evaluatorHandoff: null,
      issues: [],
      occurredAt: succeededAt.toISOString(),
    };
    orchestratorRun = await transitionRun(client, orchestratorRun, {
      toStatus: 'running',
      transitionId: deterministicId('agent-aggregate-transition', plan.run_id, input.dispatchId, 'start'),
      reasonCode: 'execution_aggregation_started',
      occurredAt: runningAt,
      envelopePatch: {
        result: aggregate,
        confidence: aggregateConfidence,
        evidenceIds,
        factIds,
        sourceIds,
        assumptions,
        conflicts,
        toolSummary,
        cost,
        validationState: 'passed',
        evaluatorState: 'not_required',
        proposedActions,
        executionAggregation: storedAggregation,
      },
      metadata: { dispatchId: input.dispatchId, planId: plan.id, jobRunId: job.job_run_id },
    });
    orchestratorRun = await transitionRun(client, orchestratorRun, {
      toStatus: 'succeeded',
      transitionId: deterministicId('agent-aggregate-transition', plan.run_id, input.dispatchId, 'success'),
      reasonCode: 'execution_aggregation_succeeded',
      occurredAt: succeededAt,
      envelopePatch: {},
      metadata: { dispatchId: input.dispatchId, planId: plan.id, jobRunId: job.job_run_id },
    });

    return {
      workspaceId: input.workspaceId,
      dispatchId: input.dispatchId,
      planId: plan.id,
      planVersion: plan.plan_version,
      jobRunId: job.job_run_id,
      orchestratorRunId: plan.run_id,
      state: 'succeeded',
      orchestratorStatus: orchestratorRun.status,
      aggregate,
      evaluatorHandoff: null,
      issues: [],
    };
  });
}

export async function getAgentExecutionAggregationState(
  pool: Pool,
  workspaceId: string,
  dispatchId: string,
): Promise<AgentExecutionAggregationResult | null> {
  assertIdentifier(workspaceId, 'workspaceId');
  assertIdentifier(dispatchId, 'dispatchId');
  const result = await pool.query<{
    job_run_id: string;
    plan_id: string;
    plan_version: number;
    orchestrator_run_id: string;
    status: PersistedAgentRunStatus;
    envelope: Record<string, unknown>;
  }>(
    `SELECT DISTINCT
       job.id AS job_run_id,
       plan.id AS plan_id,
       plan.plan_version,
       plan.run_id AS orchestrator_run_id,
       run.status,
       run.envelope
     FROM job_work_units AS work
     INNER JOIN job_runs AS job ON job.id = work.job_run_id
     INNER JOIN agent_execution_plans AS plan
       ON plan.workspace_id = work.workspace_id AND plan.id = work.payload->>'planId'
     INNER JOIN agent_runs AS run
       ON run.workspace_id = plan.workspace_id AND run.id = plan.run_id
     WHERE work.workspace_id = $1 AND work.payload->>'dispatchId' = $2`,
    [workspaceId, dispatchId],
  );
  const row = result.rows[0];
  if (result.rows.length !== 1 || !row) return null;
  return parseStoredAggregation(
    workspaceId,
    dispatchId,
    row.plan_id,
    row.plan_version,
    row.job_run_id,
    row.orchestrator_run_id,
    {
      id: row.orchestrator_run_id,
      agent_definition_id: '',
      agent_key: '',
      agent_version: '',
      status: row.status,
      envelope: row.envelope,
      started_at: null,
      completed_at: null,
      updated_at: new Date(0),
    },
  );
}
