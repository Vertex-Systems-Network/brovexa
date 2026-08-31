import type { Pool, PoolClient } from 'pg';
import { AgentPersistenceConflictError } from './agent-persistence';
import { withPgTransaction } from './client';

export const AGENT_EXECUTION_JOB_TYPE = 'agent.execution.plan';
export const AGENT_EXECUTION_QUEUE_NAME = 'brovexa-work-v1';
const dependencyBlockedAtSql = `'infinity'::timestamptz`;
const budgetEffectPrefix = 'agent.execution.budget.';

export interface AgentExecutionDispatchInput {
  dispatchId: string;
  workspaceId: string;
  planId: string;
  handlerRegistryVersion: string;
  supportedAgentKeys: readonly string[];
  createdAt: Date;
}

export interface AgentExecutionBudgetUsage {
  tokens: number;
  searches: number;
  apiCalls: number;
  credits: number;
  currencyMicros: number;
  runtimeMs: number;
}

export interface RecordAgentExecutionBudgetUsageInput {
  eventId: string;
  workspaceId: string;
  dispatchId: string;
  stepKey: string;
  usage: AgentExecutionBudgetUsage;
  metadata?: Record<string, unknown> | undefined;
  occurredAt: Date;
}

export interface WriteAgentExecutionCheckpointInput {
  workspaceId: string;
  dispatchId: string;
  stepKey: string;
  checkpointKey: string;
  data: Record<string, unknown>;
}

export interface AgentExecutionDispatchWorkState {
  stepKey: string;
  workUnitId: string;
  status: 'blocked' | 'runnable' | 'running' | 'retry_wait' | 'succeeded' | 'cancelled' | 'dead_letter' | 'review';
  attemptCount: number;
  maxAttempts: number;
  reserved: AgentExecutionBudgetUsage & { concurrency: number };
  consumed: AgentExecutionBudgetUsage;
}

export interface AgentExecutionDispatchState {
  dispatchId: string;
  planId: string;
  orchestratorRunId: string;
  jobRunId: string;
  jobRunStatus: string;
  maxParallelism: number;
  workUnits: AgentExecutionDispatchWorkState[];
}

export interface AgentExecutionDispatchResult extends AgentExecutionDispatchState {
  created: boolean;
  newlyRunnableWorkUnitIds: string[];
}

export type AgentExecutionDispatchErrorCode =
  | 'AGENT_DISPATCH_INPUT_INVALID'
  | 'AGENT_DISPATCH_PLAN_NOT_FOUND'
  | 'AGENT_DISPATCH_PLAN_INVALID'
  | 'AGENT_DISPATCH_AUTHORIZATION_REQUIRED'
  | 'AGENT_DISPATCH_HANDLER_UNAVAILABLE'
  | 'AGENT_DISPATCH_DEFINITION_NOT_APPROVED'
  | 'AGENT_DISPATCH_ORCHESTRATOR_RUN_STATE'
  | 'AGENT_DISPATCH_ID_CONFLICT'
  | 'AGENT_DISPATCH_PROJECTION_CONFLICT'
  | 'AGENT_DISPATCH_NOT_FOUND'
  | 'AGENT_DISPATCH_CHECKPOINT_STATE'
  | 'AGENT_DISPATCH_BUDGET_EXCEEDED';

export class AgentExecutionDispatchError extends Error {
  readonly code: AgentExecutionDispatchErrorCode;

  constructor(code: AgentExecutionDispatchErrorCode, message: string) {
    super(message);
    this.name = 'AgentExecutionDispatchError';
    this.code = code;
  }
}

interface AgentBudget {
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
  budget: AgentBudget;
}

interface PlanRow {
  id: string;
  workspace_id: string;
  user_id: string;
  run_id: string;
  context_receipt_id: string;
  plan_version: number;
  max_parallelism: number;
  step_count: number;
  envelope: Record<string, unknown>;
  created_at: Date;
}

interface ParsedPlan {
  id: string;
  workspaceId: string;
  userId: string;
  runId: string;
  contextReceiptId: string;
  planVersion: number;
  maxParallelism: number;
  steps: PlanStep[];
  createdAt: Date;
}

interface DefinitionRow {
  id: string;
  agent_key: string;
  version: string;
  status: string;
  requires_human_approval: boolean;
  specification: Record<string, unknown>;
}

interface ExistingJobRow {
  id: string;
  status: string;
}

const terminalJobStatuses = new Set(['succeeded', 'failed', 'cancelled', 'review']);
const budgetFields = ['tokens', 'searches', 'apiCalls', 'credits', 'currencyMicros', 'runtimeMs'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => !isNonEmptyString(entry))) return null;
  const values = value.map((entry) => entry.trim());
  return new Set(values).size === values.length ? values : null;
}

function readBudget(value: unknown): AgentBudget | null {
  if (!isRecord(value)) return null;
  const budget: AgentBudget = {
    maxTokens: Number(value.maxTokens),
    maxSearches: Number(value.maxSearches),
    maxApiCalls: Number(value.maxApiCalls),
    maxCredits: Number(value.maxCredits),
    maxCurrencyMicros: Number(value.maxCurrencyMicros),
    maxRuntimeMs: Number(value.maxRuntimeMs),
    maxConcurrency: Number(value.maxConcurrency),
  };
  for (const field of [
    'maxTokens',
    'maxSearches',
    'maxApiCalls',
    'maxCredits',
    'maxCurrencyMicros',
    'maxRuntimeMs',
  ] as const) {
    if (!Number.isSafeInteger(budget[field]) || budget[field] < 0) return null;
  }
  if (!Number.isInteger(budget.maxConcurrency) || budget.maxConcurrency !== 1) return null;
  return budget;
}

function assertIdentifier(value: string, field: string, maxLength = 128): void {
  if (!isNonEmptyString(value) || value.length > maxLength) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_INPUT_INVALID',
      `${field} must be a non-empty identifier no longer than ${maxLength} characters.`,
    );
  }
}

function assertAgentKey(value: string, field: string): void {
  if (!/^agent\.[a-z0-9_.-]+$/.test(value)) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_INPUT_INVALID',
      `${field} must be a canonical agent key.`,
    );
  }
}

function normalizeSupportedAgentKeys(values: readonly string[]): string[] {
  if (values.length < 1 || values.length > 128) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_INPUT_INVALID',
      'supportedAgentKeys must contain 1 through 128 entries.',
    );
  }
  const normalized = values.map((value) => value.trim());
  for (const value of normalized) assertAgentKey(value, 'supportedAgentKeys');
  if (new Set(normalized).size !== normalized.length) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_INPUT_INVALID',
      'supportedAgentKeys must not contain duplicates.',
    );
  }
  return normalized;
}

function parsePlan(row: PlanRow): ParsedPlan {
  const envelope = row.envelope;
  const steps = Array.isArray(envelope.steps) ? envelope.steps : null;
  if (
    envelope.id !== row.id ||
    envelope.workspaceId !== row.workspace_id ||
    envelope.userId !== row.user_id ||
    envelope.runId !== row.run_id ||
    envelope.contextReceiptId !== row.context_receipt_id ||
    envelope.planVersion !== row.plan_version ||
    envelope.maxParallelism !== row.max_parallelism ||
    !steps ||
    steps.length !== row.step_count
  ) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_PLAN_INVALID',
      `Execution plan ${row.id} does not match its canonical persistence projection.`,
    );
  }

  const parsedSteps: PlanStep[] = [];
  const stepKeys = new Set<string>();
  for (const candidate of steps) {
    if (!isRecord(candidate)) {
      throw new AgentExecutionDispatchError('AGENT_DISPATCH_PLAN_INVALID', 'Execution plan contains a malformed step.');
    }
    const key = isNonEmptyString(candidate.key) ? candidate.key.trim() : null;
    const agentKey = isNonEmptyString(candidate.agentKey) ? candidate.agentKey.trim() : null;
    const agentVersion = isNonEmptyString(candidate.agentVersion) ? candidate.agentVersion.trim() : null;
    const dependencies = readStringArray(candidate.dependencies);
    const toolKeys = readStringArray(candidate.toolKeys);
    const commandKeys = readStringArray(candidate.commandKeys);
    const policyRefs = readStringArray(candidate.policyRefs);
    const canonicalRefs = readStringArray(candidate.canonicalRefs);
    const memoryRefs = readStringArray(candidate.memoryRefs);
    const budget = readBudget(candidate.budget);
    if (
      !key ||
      !/^[a-z][a-z0-9_.-]{0,127}$/.test(key) ||
      !agentKey ||
      !/^agent\.[a-z0-9_.-]+$/.test(agentKey) ||
      !agentVersion ||
      !dependencies ||
      !toolKeys ||
      !commandKeys ||
      !policyRefs ||
      !canonicalRefs ||
      !memoryRefs ||
      !budget ||
      stepKeys.has(key)
    ) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_PLAN_INVALID',
        `Execution plan ${row.id} contains an invalid step projection.`,
      );
    }
    stepKeys.add(key);
    parsedSteps.push({
      key,
      agentKey,
      agentVersion,
      dependencies,
      toolKeys,
      commandKeys,
      policyRefs,
      canonicalRefs,
      memoryRefs,
      budget,
    });
  }

  for (const step of parsedSteps) {
    for (const dependency of step.dependencies) {
      if (dependency === step.key || !stepKeys.has(dependency)) {
        throw new AgentExecutionDispatchError(
          'AGENT_DISPATCH_PLAN_INVALID',
          `Execution plan ${row.id} contains an invalid dependency edge.`,
        );
      }
    }
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    runId: row.run_id,
    contextReceiptId: row.context_receipt_id,
    planVersion: row.plan_version,
    maxParallelism: row.max_parallelism,
    steps: parsedSteps,
    createdAt: row.created_at,
  };
}

async function assertCurrentWorkspaceRead(
  client: PoolClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
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
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_AUTHORIZATION_REQUIRED',
      'Current active workspace.read authorization is required to dispatch an execution plan.',
    );
  }
}

function resolveRetryLimit(row: DefinitionRow): { id: string; retryLimit: number } {
  const retryLimit = Number(row.specification.retryLimit);
  if (
    row.status !== 'approved' ||
    row.specification.status !== 'approved' ||
    row.specification.key !== row.agent_key ||
    row.specification.version !== row.version ||
    row.requires_human_approval ||
    row.specification.requiresHumanApproval !== false ||
    !Number.isInteger(retryLimit) ||
    retryLimit < 0 ||
    retryLimit > 20
  ) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_DEFINITION_NOT_APPROVED',
      `Specialist definition ${row.agent_key}@${row.version} is not dispatchable.`,
    );
  }
  return { id: row.id, retryLimit };
}

function createWorkPayload(
  input: AgentExecutionDispatchInput,
  plan: ParsedPlan,
  step: PlanStep,
): Record<string, unknown> {
  return {
    version: '1.0.0',
    dispatchId: input.dispatchId,
    handlerRegistryVersion: input.handlerRegistryVersion,
    planId: plan.id,
    planVersion: plan.planVersion,
    workspaceId: plan.workspaceId,
    orchestratorRunId: plan.runId,
    contextReceiptId: plan.contextReceiptId,
    maxParallelism: plan.maxParallelism,
    stepKey: step.key,
    agentKey: step.agentKey,
    agentVersion: step.agentVersion,
    dependencies: step.dependencies,
    toolKeys: step.toolKeys,
    commandKeys: step.commandKeys,
    policyRefs: step.policyRefs,
    canonicalRefs: step.canonicalRefs,
    memoryRefs: step.memoryRefs,
    budget: step.budget,
  };
}

function jobIdempotencyKey(plan: ParsedPlan): string {
  return `agent-plan:${plan.id}:v${plan.planVersion}`;
}

function workIdempotencyKey(plan: ParsedPlan, step: PlanStep): string {
  return `${plan.id}:v${plan.planVersion}:${step.key}`;
}

async function findDispatchJob(
  client: PoolClient,
  plan: ParsedPlan,
): Promise<ExistingJobRow | null> {
  const result = await client.query<ExistingJobRow>(
    `SELECT id, status
     FROM job_runs
     WHERE workspace_id = $1 AND job_type = $2 AND idempotency_key = $3`,
    [plan.workspaceId, AGENT_EXECUTION_JOB_TYPE, jobIdempotencyKey(plan)],
  );
  return result.rows[0] ?? null;
}

async function assertExistingProjection(
  client: PoolClient,
  input: AgentExecutionDispatchInput,
  plan: ParsedPlan,
  jobRunId: string,
): Promise<void> {
  const work = await client.query<{
    step_key: string;
    dispatch_id: string | null;
    registry_version: string | null;
    plan_id: string | null;
    plan_version: string | null;
  }>(
    `SELECT
       payload->>'stepKey' AS step_key,
       payload->>'dispatchId' AS dispatch_id,
       payload->>'handlerRegistryVersion' AS registry_version,
       payload->>'planId' AS plan_id,
       payload->>'planVersion' AS plan_version
     FROM job_work_units
     WHERE job_run_id = $1 AND workspace_id = $2
     ORDER BY payload->>'stepKey' ASC`,
    [jobRunId, plan.workspaceId],
  );
  if (work.rows.length !== plan.steps.length) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_PROJECTION_CONFLICT',
      `Existing JobRun for plan ${plan.id} has incomplete WorkUnit projection.`,
    );
  }
  const expectedKeys = plan.steps.map((step) => step.key).sort();
  const actualKeys = work.rows.map((row) => row.step_key).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_PROJECTION_CONFLICT',
      `Existing JobRun for plan ${plan.id} has a different step projection.`,
    );
  }
  for (const row of work.rows) {
    if (
      row.dispatch_id !== input.dispatchId ||
      row.registry_version !== input.handlerRegistryVersion ||
      row.plan_id !== plan.id ||
      Number(row.plan_version) !== plan.planVersion
    ) {
      throw new AgentPersistenceConflictError(
        'AGENT_EXECUTION_DISPATCH_CONFLICT',
        `Execution plan ${plan.id} is already dispatched with different dispatcher identity or registry version.`,
      );
    }
  }
}

async function assertDispatchIdUnused(
  client: PoolClient,
  workspaceId: string,
  dispatchId: string,
  planId: string,
): Promise<void> {
  const result = await client.query<{ plan_id: string | null }>(
    `SELECT payload->>'planId' AS plan_id
     FROM job_work_units
     WHERE workspace_id = $1 AND payload->>'dispatchId' = $2
     LIMIT 1`,
    [workspaceId, dispatchId],
  );
  const existingPlanId = result.rows[0]?.plan_id;
  if (existingPlanId && existingPlanId !== planId) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_ID_CONFLICT',
      `Dispatch ID ${dispatchId} is already bound to plan ${existingPlanId}.`,
    );
  }
}

async function unlockEligibleSteps(
  client: PoolClient,
  workspaceId: string,
  jobRunId: string,
  maxParallelism: number,
): Promise<string[]> {
  const active = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count
     FROM job_work_units
     WHERE workspace_id = $1
       AND job_run_id = $2
       AND (
         status IN ('runnable', 'running')
         OR (status = 'retry_wait' AND NOT (attempt_count = 0 AND next_attempt_at = ${dependencyBlockedAtSql}))
       )`,
    [workspaceId, jobRunId],
  );
  const capacity = Math.max(0, maxParallelism - (active.rows[0]?.count ?? 0));
  if (capacity === 0) return [];

  const eligible = await client.query<{ id: string }>(
    `SELECT candidate.id
     FROM job_work_units AS candidate
     WHERE candidate.workspace_id = $1
       AND candidate.job_run_id = $2
       AND candidate.status = 'retry_wait'
       AND candidate.attempt_count = 0
       AND candidate.next_attempt_at = ${dependencyBlockedAtSql}
       AND NOT EXISTS (
         SELECT 1
         FROM jsonb_array_elements_text(candidate.payload->'dependencies') AS dep(step_key)
         LEFT JOIN job_work_units AS dependency
           ON dependency.workspace_id = candidate.workspace_id
          AND dependency.job_run_id = candidate.job_run_id
          AND dependency.payload->>'stepKey' = dep.step_key
         WHERE dependency.id IS NULL OR dependency.status <> 'succeeded'
       )
     ORDER BY candidate.payload->>'stepKey' ASC
     LIMIT $3
     FOR UPDATE OF candidate`,
    [workspaceId, jobRunId, capacity],
  );
  const ids = eligible.rows.map((row) => row.id);
  if (ids.length === 0) return [];
  await client.query(
    `UPDATE job_work_units
     SET status = 'runnable', next_attempt_at = NULL, updated_at = now()
     WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
    [workspaceId, ids],
  );
  return ids;
}

async function settleBlockedAfterTerminalJob(
  client: PoolClient,
  workspaceId: string,
  jobRunId: string,
  jobStatus: string,
): Promise<void> {
  if (!['failed', 'cancelled', 'review'].includes(jobStatus)) return;
  await client.query(
    `UPDATE job_work_units
     SET status = 'cancelled',
         cancellation_requested_at = COALESCE(cancellation_requested_at, now()),
         completed_at = COALESCE(completed_at, now()),
         last_error_code = COALESCE(last_error_code, 'DEPENDENCY_TERMINAL'),
         last_error_class = COALESCE(last_error_class, 'cancelled'),
         updated_at = now()
     WHERE workspace_id = $1
       AND job_run_id = $2
       AND status = 'retry_wait'
       AND attempt_count = 0
       AND next_attempt_at = ${dependencyBlockedAtSql}`,
    [workspaceId, jobRunId],
  );
}

async function readDispatchState(
  client: PoolClient,
  workspaceId: string,
  dispatchId: string,
): Promise<AgentExecutionDispatchState> {
  const jobs = await client.query<{
    job_run_id: string;
    job_status: string;
    plan_id: string;
    orchestrator_run_id: string;
    max_parallelism: string;
  }>(
    `SELECT DISTINCT
       work.job_run_id,
       job.status AS job_status,
       work.payload->>'planId' AS plan_id,
       work.payload->>'orchestratorRunId' AS orchestrator_run_id,
       work.payload->>'maxParallelism' AS max_parallelism
     FROM job_work_units AS work
     INNER JOIN job_runs AS job ON job.id = work.job_run_id
     WHERE work.workspace_id = $1 AND work.payload->>'dispatchId' = $2`,
    [workspaceId, dispatchId],
  );
  if (jobs.rows.length !== 1 || !jobs.rows[0]) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_NOT_FOUND',
      `Execution dispatch ${dispatchId} was not found or has an invalid JobRun projection.`,
    );
  }
  const job = jobs.rows[0];

  const work = await client.query<{
    step_key: string;
    id: string;
    status: AgentExecutionDispatchWorkState['status'];
    attempt_count: number;
    max_attempts: number;
    max_tokens: string;
    max_searches: string;
    max_api_calls: string;
    max_credits: string;
    max_currency_micros: string;
    max_runtime_ms: string;
    max_concurrency: string;
    used_tokens: string;
    used_searches: string;
    used_api_calls: string;
    used_credits: string;
    used_currency_micros: string;
    used_runtime_ms: string;
  }>(
    `SELECT
       work.payload->>'stepKey' AS step_key,
       work.id,
       CASE
         WHEN work.status = 'retry_wait'
          AND work.attempt_count = 0
          AND work.next_attempt_at = ${dependencyBlockedAtSql}
         THEN 'blocked'
         ELSE work.status
       END AS status,
       work.attempt_count,
       work.max_attempts,
       work.payload->'budget'->>'maxTokens' AS max_tokens,
       work.payload->'budget'->>'maxSearches' AS max_searches,
       work.payload->'budget'->>'maxApiCalls' AS max_api_calls,
       work.payload->'budget'->>'maxCredits' AS max_credits,
       work.payload->'budget'->>'maxCurrencyMicros' AS max_currency_micros,
       work.payload->'budget'->>'maxRuntimeMs' AS max_runtime_ms,
       work.payload->'budget'->>'maxConcurrency' AS max_concurrency,
       COALESCE(sum((effect.data->'usage'->>'tokens')::bigint) FILTER (WHERE effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_tokens,
       COALESCE(sum((effect.data->'usage'->>'searches')::bigint) FILTER (WHERE effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_searches,
       COALESCE(sum((effect.data->'usage'->>'apiCalls')::bigint) FILTER (WHERE effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_api_calls,
       COALESCE(sum((effect.data->'usage'->>'credits')::bigint) FILTER (WHERE effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_credits,
       COALESCE(sum((effect.data->'usage'->>'currencyMicros')::bigint) FILTER (WHERE effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_currency_micros,
       COALESCE(sum((effect.data->'usage'->>'runtimeMs')::bigint) FILTER (WHERE effect.data->>'kind' = 'agent_execution_budget_usage'), 0)::text AS used_runtime_ms
     FROM job_work_units AS work
     LEFT JOIN job_effects AS effect ON effect.work_unit_id = work.id
     WHERE work.workspace_id = $1
       AND work.job_run_id = $2
       AND work.payload->>'dispatchId' = $3
     GROUP BY work.id
     ORDER BY work.payload->>'stepKey' ASC`,
    [workspaceId, job.job_run_id, dispatchId],
  );

  return {
    dispatchId,
    planId: job.plan_id,
    orchestratorRunId: job.orchestrator_run_id,
    jobRunId: job.job_run_id,
    jobRunStatus: job.job_status,
    maxParallelism: Number(job.max_parallelism),
    workUnits: work.rows.map((row) => ({
      stepKey: row.step_key,
      workUnitId: row.id,
      status: row.status,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      reserved: {
        tokens: Number(row.max_tokens),
        searches: Number(row.max_searches),
        apiCalls: Number(row.max_api_calls),
        credits: Number(row.max_credits),
        currencyMicros: Number(row.max_currency_micros),
        runtimeMs: Number(row.max_runtime_ms),
        concurrency: Number(row.max_concurrency),
      },
      consumed: {
        tokens: Number(row.used_tokens),
        searches: Number(row.used_searches),
        apiCalls: Number(row.used_api_calls),
        credits: Number(row.used_credits),
        currencyMicros: Number(row.used_currency_micros),
        runtimeMs: Number(row.used_runtime_ms),
      },
    })),
  };
}

export async function dispatchAgentExecutionPlan(
  pool: Pool,
  input: AgentExecutionDispatchInput,
): Promise<AgentExecutionDispatchResult> {
  assertIdentifier(input.dispatchId, 'dispatchId');
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.planId, 'planId');
  assertIdentifier(input.handlerRegistryVersion, 'handlerRegistryVersion', 64);
  if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
    throw new AgentExecutionDispatchError('AGENT_DISPATCH_INPUT_INVALID', 'createdAt must be a valid Date.');
  }
  const supportedAgentKeys = new Set(normalizeSupportedAgentKeys(input.supportedAgentKeys));

  return withPgTransaction(pool, async (client) => {
    const planResult = await client.query<PlanRow>(
      `SELECT
         id, workspace_id, user_id, run_id, context_receipt_id,
         plan_version, max_parallelism, step_count, envelope, created_at
       FROM agent_execution_plans
       WHERE id = $1 AND workspace_id = $2
       FOR SHARE`,
      [input.planId, input.workspaceId],
    );
    const planRow = planResult.rows[0];
    if (!planRow) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_PLAN_NOT_FOUND',
        `Execution plan ${input.planId} was not found in workspace ${input.workspaceId}.`,
      );
    }
    const plan = parsePlan(planRow);
    if (input.createdAt < plan.createdAt) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_PLAN_INVALID',
        'Dispatch creation time cannot precede its execution plan.',
      );
    }
    await assertCurrentWorkspaceRead(client, plan.workspaceId, plan.userId);
    await assertDispatchIdUnused(client, plan.workspaceId, input.dispatchId, plan.id);

    const existingJob = await findDispatchJob(client, plan);
    if (existingJob) {
      await assertExistingProjection(client, input, plan, existingJob.id);
      const state = await readDispatchState(client, plan.workspaceId, input.dispatchId);
      return { ...state, created: false, newlyRunnableWorkUnitIds: [] };
    }

    const orchestratorRun = await client.query<{ status: string }>(
      `SELECT status FROM agent_runs WHERE id = $1 AND workspace_id = $2 FOR SHARE`,
      [plan.runId, plan.workspaceId],
    );
    if (orchestratorRun.rows[0]?.status !== 'queued') {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_ORCHESTRATOR_RUN_STATE',
        `Orchestrator AgentRun ${plan.runId} must be queued before first dispatch.`,
      );
    }

    const definitions = new Map<string, { id: string; retryLimit: number }>();
    for (const step of plan.steps) {
      if (!supportedAgentKeys.has(step.agentKey)) {
        throw new AgentExecutionDispatchError(
          'AGENT_DISPATCH_HANDLER_UNAVAILABLE',
          `No explicitly registered handler is available for ${step.agentKey}.`,
        );
      }
      const definitionResult = await client.query<DefinitionRow>(
        `SELECT id, agent_key, version, status, requires_human_approval, specification
         FROM agent_definitions
         WHERE agent_key = $1 AND version = $2
         FOR SHARE`,
        [step.agentKey, step.agentVersion],
      );
      const definitionRow = definitionResult.rows[0];
      if (!definitionRow) {
        throw new AgentExecutionDispatchError(
          'AGENT_DISPATCH_DEFINITION_NOT_APPROVED',
          `Specialist definition ${step.agentKey}@${step.agentVersion} is unavailable.`,
        );
      }
      definitions.set(step.key, resolveRetryLimit(definitionRow));
    }

    const job = await client.query<{ id: string; correlation_id: string }>(
      `INSERT INTO job_runs (
         workspace_id, job_type, job_version, idempotency_key, status, created_at, updated_at
       ) VALUES ($1, $2, 1, $3, 'pending', $4, $4)
       ON CONFLICT (workspace_id, job_type, idempotency_key) DO NOTHING
       RETURNING id, correlation_id`,
      [plan.workspaceId, AGENT_EXECUTION_JOB_TYPE, jobIdempotencyKey(plan), input.createdAt],
    );
    const jobRow = job.rows[0];
    if (!jobRow) {
      const concurrent = await findDispatchJob(client, plan);
      if (!concurrent) {
        throw new AgentExecutionDispatchError(
          'AGENT_DISPATCH_PROJECTION_CONFLICT',
          `Concurrent JobRun for plan ${plan.id} could not be resolved.`,
        );
      }
      await assertExistingProjection(client, input, plan, concurrent.id);
      const state = await readDispatchState(client, plan.workspaceId, input.dispatchId);
      return { ...state, created: false, newlyRunnableWorkUnitIds: [] };
    }

    for (const step of plan.steps) {
      const definition = definitions.get(step.key);
      if (!definition) throw new Error(`Definition resolution missing for step ${step.key}.`);
      const payload = createWorkPayload(input, plan, step);
      await client.query(
        `INSERT INTO job_work_units (
           job_run_id, workspace_id, queue_name, work_type, work_version,
           idempotency_key, correlation_id, payload, status, max_attempts,
           next_attempt_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7::jsonb, 'retry_wait', $8, ${dependencyBlockedAtSql}, $9, $9)`,
        [
          jobRow.id,
          plan.workspaceId,
          AGENT_EXECUTION_QUEUE_NAME,
          step.agentKey,
          workIdempotencyKey(plan, step),
          jobRow.correlation_id,
          JSON.stringify(payload),
          definition.retryLimit + 1,
          input.createdAt,
        ],
      );
    }

    const newlyRunnableWorkUnitIds = await unlockEligibleSteps(
      client,
      plan.workspaceId,
      jobRow.id,
      plan.maxParallelism,
    );
    const state = await readDispatchState(client, plan.workspaceId, input.dispatchId);
    return { ...state, created: true, newlyRunnableWorkUnitIds };
  });
}

export async function reconcileAgentExecutionDispatch(
  pool: Pool,
  workspaceId: string,
  dispatchId: string,
): Promise<AgentExecutionDispatchResult> {
  assertIdentifier(workspaceId, 'workspaceId');
  assertIdentifier(dispatchId, 'dispatchId');
  return withPgTransaction(pool, async (client) => {
    const stateBefore = await readDispatchState(client, workspaceId, dispatchId);
    if (terminalJobStatuses.has(stateBefore.jobRunStatus)) {
      await settleBlockedAfterTerminalJob(client, workspaceId, stateBefore.jobRunId, stateBefore.jobRunStatus);
      const state = await readDispatchState(client, workspaceId, dispatchId);
      return { ...state, created: false, newlyRunnableWorkUnitIds: [] };
    }
    const newlyRunnableWorkUnitIds = await unlockEligibleSteps(
      client,
      workspaceId,
      stateBefore.jobRunId,
      stateBefore.maxParallelism,
    );
    const state = await readDispatchState(client, workspaceId, dispatchId);
    return { ...state, created: false, newlyRunnableWorkUnitIds };
  });
}

export async function cancelAgentExecutionDispatch(
  pool: Pool,
  workspaceId: string,
  dispatchId: string,
): Promise<AgentExecutionDispatchState> {
  assertIdentifier(workspaceId, 'workspaceId');
  assertIdentifier(dispatchId, 'dispatchId');
  return withPgTransaction(pool, async (client) => {
    const state = await readDispatchState(client, workspaceId, dispatchId);
    await client.query(
      `UPDATE job_work_units
       SET cancellation_requested_at = COALESCE(cancellation_requested_at, now()),
           status = CASE WHEN status IN ('runnable', 'retry_wait') THEN 'cancelled' ELSE status END,
           completed_at = CASE WHEN status IN ('runnable', 'retry_wait') THEN COALESCE(completed_at, now()) ELSE completed_at END,
           next_attempt_at = CASE WHEN status IN ('runnable', 'retry_wait') THEN NULL ELSE next_attempt_at END,
           updated_at = now()
       WHERE workspace_id = $1
         AND job_run_id = $2
         AND status NOT IN ('succeeded', 'cancelled', 'dead_letter', 'review')`,
      [workspaceId, state.jobRunId],
    );
    await client.query(
      `UPDATE job_runs
       SET status = 'cancelled', completed_at = COALESCE(completed_at, now()), updated_at = now()
       WHERE id = $1 AND workspace_id = $2 AND status NOT IN ('succeeded', 'failed', 'review')`,
      [state.jobRunId, workspaceId],
    );
    return readDispatchState(client, workspaceId, dispatchId);
  });
}

export async function writeAgentExecutionCheckpoint(
  pool: Pool,
  input: WriteAgentExecutionCheckpointInput,
): Promise<string> {
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.dispatchId, 'dispatchId');
  assertIdentifier(input.stepKey, 'stepKey');
  if (!/^[a-z][a-z0-9_.-]{0,127}$/.test(input.checkpointKey)) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_INPUT_INVALID',
      'checkpointKey must use the canonical lowercase identifier format.',
    );
  }
  if (!isRecord(input.data)) {
    throw new AgentExecutionDispatchError('AGENT_DISPATCH_INPUT_INVALID', 'Checkpoint data must be a JSON object.');
  }

  return withPgTransaction(pool, async (client) => {
    const work = await client.query<{ id: string; status: string; is_blocked: boolean }>(
      `SELECT
         id,
         status,
         status = 'retry_wait' AND attempt_count = 0 AND next_attempt_at = ${dependencyBlockedAtSql} AS is_blocked
       FROM job_work_units
       WHERE workspace_id = $1
         AND payload->>'dispatchId' = $2
         AND payload->>'stepKey' = $3
       FOR SHARE`,
      [input.workspaceId, input.dispatchId, input.stepKey],
    );
    const row = work.rows[0];
    if (!row) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_NOT_FOUND',
        `Step ${input.stepKey} was not found in dispatch ${input.dispatchId}.`,
      );
    }
    if (row.is_blocked || (row.status !== 'running' && row.status !== 'retry_wait')) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_CHECKPOINT_STATE',
        `Step ${input.stepKey} must be running or retry_wait before writing a checkpoint.`,
      );
    }
    const checkpoint = await client.query<{ id: string }>(
      `INSERT INTO job_checkpoints (work_unit_id, checkpoint_key, data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (work_unit_id, checkpoint_key)
       DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING id`,
      [row.id, input.checkpointKey, JSON.stringify(input.data)],
    );
    const id = checkpoint.rows[0]?.id;
    if (!id) throw new Error('Agent execution checkpoint could not be persisted.');
    return id;
  });
}

function assertUsage(usage: AgentExecutionBudgetUsage): void {
  let nonzero = false;
  for (const field of budgetFields) {
    const value = usage[field];
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_INPUT_INVALID',
        `usage.${field} must be a non-negative safe integer.`,
      );
    }
    if (value > 0) nonzero = true;
  }
  if (!nonzero) {
    throw new AgentExecutionDispatchError(
      'AGENT_DISPATCH_INPUT_INVALID',
      'Budget usage must account for at least one non-zero resource.',
    );
  }
}

export async function recordAgentExecutionBudgetUsage(
  pool: Pool,
  input: RecordAgentExecutionBudgetUsageInput,
): Promise<boolean> {
  assertIdentifier(input.eventId, 'eventId');
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.dispatchId, 'dispatchId');
  assertIdentifier(input.stepKey, 'stepKey');
  assertUsage(input.usage);
  if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) {
    throw new AgentExecutionDispatchError('AGENT_DISPATCH_INPUT_INVALID', 'occurredAt must be a valid Date.');
  }
  const metadata = input.metadata ?? {};
  if (!isRecord(metadata)) {
    throw new AgentExecutionDispatchError('AGENT_DISPATCH_INPUT_INVALID', 'Budget metadata must be a JSON object.');
  }

  return withPgTransaction(pool, async (client) => {
    const work = await client.query<{
      id: string;
      status: string;
      is_blocked: boolean;
      budget: Record<string, unknown>;
    }>(
      `SELECT
         id,
         status,
         status = 'retry_wait' AND attempt_count = 0 AND next_attempt_at = ${dependencyBlockedAtSql} AS is_blocked,
         payload->'budget' AS budget
       FROM job_work_units
       WHERE workspace_id = $1
         AND payload->>'dispatchId' = $2
         AND payload->>'stepKey' = $3
       FOR UPDATE`,
      [input.workspaceId, input.dispatchId, input.stepKey],
    );
    const row = work.rows[0];
    if (!row) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_NOT_FOUND',
        `Step ${input.stepKey} was not found in dispatch ${input.dispatchId}.`,
      );
    }
    if (row.is_blocked || !['running', 'retry_wait', 'succeeded'].includes(row.status)) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_CHECKPOINT_STATE',
        `Step ${input.stepKey} cannot account usage while status is ${row.status}.`,
      );
    }
    const reserved = readBudget(row.budget);
    if (!reserved) {
      throw new AgentExecutionDispatchError(
        'AGENT_DISPATCH_PROJECTION_CONFLICT',
        `Step ${input.stepKey} has an invalid reserved budget projection.`,
      );
    }

    const effectKey = `${budgetEffectPrefix}${input.eventId}`;
    const data = {
      kind: 'agent_execution_budget_usage',
      dispatchId: input.dispatchId,
      stepKey: input.stepKey,
      usage: input.usage,
      metadata,
      occurredAt: input.occurredAt.toISOString(),
    };
    const existing = await client.query<{ same_event: boolean }>(
      `SELECT data = $3::jsonb AS same_event
       FROM job_effects
       WHERE work_unit_id = $1 AND effect_key = $2`,
      [row.id, effectKey, JSON.stringify(data)],
    );
    if (existing.rows[0]) {
      if (!existing.rows[0].same_event) {
        throw new AgentPersistenceConflictError(
          'AGENT_EXECUTION_BUDGET_EVENT_ID_CONFLICT',
          `Budget event ${input.eventId} already exists with different content or scope.`,
        );
      }
      return false;
    }

    const consumed = await client.query<{
      tokens: string;
      searches: string;
      api_calls: string;
      credits: string;
      currency_micros: string;
      runtime_ms: string;
    }>(
      `SELECT
         COALESCE(sum((data->'usage'->>'tokens')::bigint), 0)::text AS tokens,
         COALESCE(sum((data->'usage'->>'searches')::bigint), 0)::text AS searches,
         COALESCE(sum((data->'usage'->>'apiCalls')::bigint), 0)::text AS api_calls,
         COALESCE(sum((data->'usage'->>'credits')::bigint), 0)::text AS credits,
         COALESCE(sum((data->'usage'->>'currencyMicros')::bigint), 0)::text AS currency_micros,
         COALESCE(sum((data->'usage'->>'runtimeMs')::bigint), 0)::text AS runtime_ms
       FROM job_effects
       WHERE work_unit_id = $1 AND data->>'kind' = 'agent_execution_budget_usage'`,
      [row.id],
    );
    const totals = consumed.rows[0];
    if (!totals) throw new Error('Budget usage aggregation returned no row.');
    const next = {
      tokens: Number(totals.tokens) + input.usage.tokens,
      searches: Number(totals.searches) + input.usage.searches,
      apiCalls: Number(totals.api_calls) + input.usage.apiCalls,
      credits: Number(totals.credits) + input.usage.credits,
      currencyMicros: Number(totals.currency_micros) + input.usage.currencyMicros,
      runtimeMs: Number(totals.runtime_ms) + input.usage.runtimeMs,
    };
    const limits = {
      tokens: reserved.maxTokens,
      searches: reserved.maxSearches,
      apiCalls: reserved.maxApiCalls,
      credits: reserved.maxCredits,
      currencyMicros: reserved.maxCurrencyMicros,
      runtimeMs: reserved.maxRuntimeMs,
    };
    for (const field of budgetFields) {
      if (!Number.isSafeInteger(next[field]) || next[field] > limits[field]) {
        throw new AgentExecutionDispatchError(
          'AGENT_DISPATCH_BUDGET_EXCEEDED',
          `Step ${input.stepKey} exceeds reserved ${field} budget.`,
        );
      }
    }

    await client.query(
      `INSERT INTO job_effects (work_unit_id, effect_key, data)
       VALUES ($1, $2, $3::jsonb)`,
      [row.id, effectKey, JSON.stringify(data)],
    );
    return true;
  });
}

export async function getAgentExecutionDispatchState(
  pool: Pool,
  workspaceId: string,
  dispatchId: string,
): Promise<AgentExecutionDispatchState | null> {
  assertIdentifier(workspaceId, 'workspaceId');
  assertIdentifier(dispatchId, 'dispatchId');
  const exists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM job_work_units
       WHERE workspace_id = $1 AND payload->>'dispatchId' = $2
     ) AS exists`,
    [workspaceId, dispatchId],
  );
  if (!exists.rows[0]?.exists) return null;
  return withPgTransaction(pool, (client) => readDispatchState(client, workspaceId, dispatchId));
}
