import type { Pool, PoolClient } from 'pg';
import { AgentPersistenceConflictError } from './agent-persistence';
import { withPgTransaction } from './client';

export interface AgentExecutionBudgetInput {
  maxTokens: number;
  maxSearches: number;
  maxApiCalls: number;
  maxCredits: number;
  maxCurrencyMicros: number;
  maxRuntimeMs: number;
  maxConcurrency: number;
}

export interface AgentExecutionStepInput {
  key: string;
  agentKey: string;
  agentVersion: string;
  dependencies: readonly string[];
  toolKeys: readonly string[];
  commandKeys: readonly string[];
  policyRefs: readonly string[];
  canonicalRefs: readonly string[];
  memoryRefs: readonly string[];
  budget: AgentExecutionBudgetInput;
}

export interface PersistAgentExecutionPlanInput {
  id: string;
  workspaceId: string;
  userId: string;
  runId: string;
  contextReceiptId: string;
  orchestratorKey: string;
  orchestratorVersion: string;
  planVersion: number;
  maxParallelism: number;
  steps: readonly AgentExecutionStepInput[];
  parentRunId?: string | undefined;
  handoffId?: string | undefined;
  createdAt: Date;
}

export interface PersistedAgentExecutionPlanResult {
  planId: string;
  runId: string;
  created: boolean;
  runEnvelope: Record<string, unknown>;
  planEnvelope: Record<string, unknown>;
}

export type AgentExecutionPlanErrorCode =
  | 'AGENT_EXECUTION_INPUT_INVALID'
  | 'AGENT_EXECUTION_AUTHORIZATION_REQUIRED'
  | 'AGENT_EXECUTION_CONTEXT_NOT_FOUND'
  | 'AGENT_EXECUTION_CONTEXT_MISMATCH'
  | 'AGENT_EXECUTION_DEFINITION_NOT_APPROVED'
  | 'AGENT_EXECUTION_DEFINITION_INVALID'
  | 'AGENT_EXECUTION_SCOPE_BROADENED'
  | 'AGENT_EXECUTION_TOOL_NOT_ALLOWED'
  | 'AGENT_EXECUTION_COMMAND_NOT_ALLOWED'
  | 'AGENT_EXECUTION_MEMORY_SCOPE_NOT_ALLOWED'
  | 'AGENT_EXECUTION_BUDGET_EXCEEDED'
  | 'AGENT_EXECUTION_REVIEW_REQUIRED';

export class AgentExecutionPlanError extends Error {
  readonly code: AgentExecutionPlanErrorCode;

  constructor(code: AgentExecutionPlanErrorCode, message: string) {
    super(message);
    this.name = 'AgentExecutionPlanError';
    this.code = code;
  }
}

interface AgentDefinitionRow {
  id: string;
  agent_key: string;
  version: string;
  status: string;
  autonomy_tier: string;
  requires_human_approval: boolean;
  specification: Record<string, unknown>;
}

interface ContextReceiptRow {
  user_id: string | null;
  run_scope_id: string | null;
  agent_definition_id: string;
  agent_key: string;
  agent_version: string;
  receipt: Record<string, unknown>;
  created_at: Date;
}

interface ExistingPlanRow {
  run_id: string;
  envelope: Record<string, unknown>;
}

interface ParsedDefinition {
  id: string;
  key: string;
  version: string;
  autonomyTier: string;
  requiresHumanApproval: boolean;
  allowedTools: readonly string[];
  allowedCommands: readonly string[];
  memoryReadScopes: readonly string[];
  promptVersion: string;
  skillVersions: Record<string, string>;
  budget: AgentExecutionBudgetInput;
}

interface ContextMemoryRef {
  memoryId: string;
  namespace: string;
  status: string;
}

interface ParsedContextReceipt {
  policyRefs: ReadonlySet<string>;
  canonicalRefs: ReadonlySet<string>;
  memoryRefs: ReadonlyMap<string, ContextMemoryRef>;
}

const additiveBudgetFields = [
  'maxTokens',
  'maxSearches',
  'maxApiCalls',
  'maxCredits',
  'maxCurrencyMicros',
  'maxRuntimeMs',
] as const;

type AdditiveBudgetField = (typeof additiveBudgetFields)[number];

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

function readStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([key, entry]) => !isNonEmptyString(key) || !isNonEmptyString(entry))) return null;
  return Object.fromEntries(entries.map(([key, entry]) => [key.trim(), (entry as string).trim()]));
}

function readBudget(value: unknown): AgentExecutionBudgetInput | null {
  if (!isRecord(value)) return null;
  const budget: AgentExecutionBudgetInput = {
    maxTokens: Number(value.maxTokens),
    maxSearches: Number(value.maxSearches),
    maxApiCalls: Number(value.maxApiCalls),
    maxCredits: Number(value.maxCredits),
    maxCurrencyMicros: Number(value.maxCurrencyMicros),
    maxRuntimeMs: Number(value.maxRuntimeMs),
    maxConcurrency: Number(value.maxConcurrency),
  };

  for (const field of additiveBudgetFields) {
    if (!Number.isSafeInteger(budget[field]) || budget[field] < 0) return null;
  }
  if (!Number.isInteger(budget.maxConcurrency) || budget.maxConcurrency < 1 || budget.maxConcurrency > 256) {
    return null;
  }
  return budget;
}

function assertIdentifier(value: string, field: string): void {
  if (!isNonEmptyString(value) || value.length > 128) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_INPUT_INVALID',
      `${field} must be a non-empty identifier no longer than 128 characters.`,
    );
  }
}

function assertUniqueIdentifiers(values: readonly string[], field: string, maxItems: number): void {
  if (values.length > maxItems || values.some((value) => !isNonEmptyString(value) || value.length > 512)) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_INPUT_INVALID',
      `${field} contains an invalid identifier or exceeds ${maxItems} items.`,
    );
  }
  if (new Set(values).size !== values.length) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_INPUT_INVALID',
      `${field} must not contain duplicate identifiers.`,
    );
  }
}

function assertInputBudget(budget: AgentExecutionBudgetInput, field: string): void {
  for (const budgetField of additiveBudgetFields) {
    const value = budget[budgetField];
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_INPUT_INVALID',
        `${field}.${budgetField} must be a non-negative safe integer.`,
      );
    }
  }
  if (!Number.isInteger(budget.maxConcurrency) || budget.maxConcurrency !== 1) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_INPUT_INVALID',
      `${field}.maxConcurrency must equal 1 in the current bounded execution foundation.`,
    );
  }
}

function assertPlanShape(input: PersistAgentExecutionPlanInput): void {
  for (const [field, value] of [
    ['id', input.id],
    ['workspaceId', input.workspaceId],
    ['userId', input.userId],
    ['runId', input.runId],
    ['contextReceiptId', input.contextReceiptId],
    ['orchestratorKey', input.orchestratorKey],
    ['orchestratorVersion', input.orchestratorVersion],
  ] as const) {
    assertIdentifier(value, field);
  }
  if (input.parentRunId !== undefined) assertIdentifier(input.parentRunId, 'parentRunId');
  if (input.handoffId !== undefined) assertIdentifier(input.handoffId, 'handoffId');
  if (input.orchestratorKey !== 'agent.control.orchestrator') {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_INPUT_INVALID',
      'Execution plans must use agent.control.orchestrator.',
    );
  }
  if (!Number.isInteger(input.planVersion) || input.planVersion < 1 || input.planVersion > 1_000_000) {
    throw new AgentExecutionPlanError('AGENT_EXECUTION_INPUT_INVALID', 'planVersion is outside the supported range.');
  }
  if (input.steps.length < 1 || input.steps.length > 64) {
    throw new AgentExecutionPlanError('AGENT_EXECUTION_INPUT_INVALID', 'Execution plans require 1 through 64 steps.');
  }
  if (
    !Number.isInteger(input.maxParallelism) ||
    input.maxParallelism < 1 ||
    input.maxParallelism > 256 ||
    input.maxParallelism > input.steps.length
  ) {
    throw new AgentExecutionPlanError('AGENT_EXECUTION_INPUT_INVALID', 'maxParallelism is invalid for this plan.');
  }
  if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
    throw new AgentExecutionPlanError('AGENT_EXECUTION_INPUT_INVALID', 'createdAt must be a valid Date.');
  }

  const stepKeys = new Set<string>();
  for (const step of input.steps) {
    assertIdentifier(step.key, 'step.key');
    assertIdentifier(step.agentKey, `${step.key}.agentKey`);
    assertIdentifier(step.agentVersion, `${step.key}.agentVersion`);
    if (!/^agent\.[a-z0-9_.-]+$/.test(step.agentKey) || step.agentKey === 'agent.control.orchestrator') {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_INPUT_INVALID',
        `Step ${step.key} must target a non-orchestrator canonical agent key.`,
      );
    }
    if (stepKeys.has(step.key)) {
      throw new AgentExecutionPlanError('AGENT_EXECUTION_INPUT_INVALID', `Duplicate execution step key: ${step.key}.`);
    }
    stepKeys.add(step.key);
    assertUniqueIdentifiers(step.dependencies, `${step.key}.dependencies`, 64);
    assertUniqueIdentifiers(step.toolKeys, `${step.key}.toolKeys`, 128);
    assertUniqueIdentifiers(step.commandKeys, `${step.key}.commandKeys`, 128);
    assertUniqueIdentifiers(step.policyRefs, `${step.key}.policyRefs`, 128);
    assertUniqueIdentifiers(step.canonicalRefs, `${step.key}.canonicalRefs`, 512);
    assertUniqueIdentifiers(step.memoryRefs, `${step.key}.memoryRefs`, 512);
    if (step.policyRefs.length < 1) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_INPUT_INVALID',
        `Step ${step.key} requires at least one policy reference.`,
      );
    }
    assertInputBudget(step.budget, `${step.key}.budget`);
  }

  for (const step of input.steps) {
    for (const dependency of step.dependencies) {
      if (dependency === step.key || !stepKeys.has(dependency)) {
        throw new AgentExecutionPlanError(
          'AGENT_EXECUTION_INPUT_INVALID',
          `Step ${step.key} has an invalid dependency: ${dependency}.`,
        );
      }
    }
  }

  const byKey = new Map(input.steps.map((step) => [step.key, step]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (key: string): boolean => {
    if (visiting.has(key)) return false;
    if (visited.has(key)) return true;
    const step = byKey.get(key);
    if (!step) return true;
    visiting.add(key);
    for (const dependency of step.dependencies) {
      if (!visit(dependency)) return false;
    }
    visiting.delete(key);
    visited.add(key);
    return true;
  };

  for (const step of input.steps) {
    if (!visit(step.key)) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_INPUT_INVALID',
        'Execution plan dependencies must form an acyclic DAG.',
      );
    }
  }
}

function parseDefinition(row: AgentDefinitionRow): ParsedDefinition {
  const specification = row.specification;
  const allowedTools = readStringArray(specification.allowedTools);
  const allowedCommands = readStringArray(specification.allowedCommands);
  const memory = isRecord(specification.memory) ? specification.memory : null;
  const memoryReadScopes = memory ? readStringArray(memory.read) : null;
  const promptVersion = isNonEmptyString(specification.promptVersion)
    ? specification.promptVersion.trim()
    : null;
  const skillVersions = readStringRecord(specification.skillVersions);
  const budget = readBudget(specification.budget);

  if (
    row.status !== 'approved' ||
    specification.status !== 'approved' ||
    specification.key !== row.agent_key ||
    specification.version !== row.version
  ) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_DEFINITION_NOT_APPROVED',
      `Agent definition ${row.agent_key}@${row.version} is not an approved immutable execution target.`,
    );
  }

  if (
    specification.autonomyTier !== row.autonomy_tier ||
    specification.requiresHumanApproval !== row.requires_human_approval ||
    !allowedTools ||
    !allowedCommands ||
    !memoryReadScopes ||
    !promptVersion ||
    !skillVersions ||
    !budget
  ) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_DEFINITION_INVALID',
      `Agent definition ${row.agent_key}@${row.version} has an invalid or inconsistent execution specification.`,
    );
  }

  return {
    id: row.id,
    key: row.agent_key,
    version: row.version,
    autonomyTier: row.autonomy_tier,
    requiresHumanApproval: row.requires_human_approval,
    allowedTools,
    allowedCommands,
    memoryReadScopes,
    promptVersion,
    skillVersions,
    budget,
  };
}

function parseContextReceipt(
  row: ContextReceiptRow,
  input: PersistAgentExecutionPlanInput,
): ParsedContextReceipt {
  const receipt = row.receipt;
  const policyRefs = readStringArray(receipt.policyRefs);
  const canonicalRefs = readStringArray(receipt.canonicalRefs);
  const rawMemoryRefs = Array.isArray(receipt.memoryRefs) ? receipt.memoryRefs : null;

  if (
    row.user_id !== input.userId ||
    row.agent_key !== input.orchestratorKey ||
    row.agent_version !== input.orchestratorVersion ||
    receipt.id !== input.contextReceiptId ||
    receipt.workspaceId !== input.workspaceId ||
    receipt.userId !== input.userId ||
    receipt.agentKey !== input.orchestratorKey ||
    receipt.agentVersion !== input.orchestratorVersion ||
    (row.run_scope_id !== null && row.run_scope_id !== input.runId) ||
    (receipt.runId !== undefined && receipt.runId !== input.runId) ||
    !policyRefs ||
    policyRefs.length === 0 ||
    !canonicalRefs ||
    !rawMemoryRefs
  ) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_CONTEXT_MISMATCH',
      `Context receipt ${input.contextReceiptId} does not match the requested orchestrator execution scope.`,
    );
  }

  const memoryRefs = new Map<string, ContextMemoryRef>();
  for (const candidate of rawMemoryRefs) {
    if (!isRecord(candidate) || !isNonEmptyString(candidate.memoryId) || !isNonEmptyString(candidate.namespace)) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_CONTEXT_MISMATCH',
        `Context receipt ${input.contextReceiptId} contains a malformed memory reference.`,
      );
    }
    const memoryId = candidate.memoryId.trim();
    if (memoryRefs.has(memoryId)) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_CONTEXT_MISMATCH',
        `Context receipt ${input.contextReceiptId} contains duplicate memory reference ${memoryId}.`,
      );
    }
    memoryRefs.set(memoryId, {
      memoryId,
      namespace: candidate.namespace.trim(),
      status: isNonEmptyString(candidate.status) ? candidate.status.trim() : '',
    });
  }

  return {
    policyRefs: new Set(policyRefs),
    canonicalRefs: new Set(canonicalRefs),
    memoryRefs,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function memoryScopeMatches(pattern: string, namespace: string): boolean {
  const expression = `^${pattern.split('*').map(escapeRegExp).join('.*')}$`;
  return new RegExp(expression).test(namespace);
}

function assertSubset(
  values: readonly string[],
  allowed: ReadonlySet<string>,
  code: AgentExecutionPlanErrorCode,
  messagePrefix: string,
): void {
  for (const value of values) {
    if (!allowed.has(value)) throw new AgentExecutionPlanError(code, `${messagePrefix}: ${value}.`);
  }
}

function assertBudgetWithin(
  requested: AgentExecutionBudgetInput,
  allowed: AgentExecutionBudgetInput,
  label: string,
): void {
  for (const field of additiveBudgetFields) {
    if (requested[field] > allowed[field]) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_BUDGET_EXCEEDED',
        `${label}.${field} exceeds the approved AgentDefinition budget.`,
      );
    }
  }
  if (requested.maxConcurrency > allowed.maxConcurrency) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_BUDGET_EXCEEDED',
      `${label}.maxConcurrency exceeds the approved AgentDefinition budget.`,
    );
  }
}

function addBudgetValue(current: number, value: number, field: AdditiveBudgetField): number {
  const next = current + value;
  if (!Number.isSafeInteger(next)) {
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_BUDGET_EXCEEDED',
      `Aggregate ${field} exceeds safe integer accounting limits.`,
    );
  }
  return next;
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
    throw new AgentExecutionPlanError(
      'AGENT_EXECUTION_AUTHORIZATION_REQUIRED',
      'Current active workspace.read authorization is required to persist an execution plan.',
    );
  }
}

function createPlanEnvelope(input: PersistAgentExecutionPlanInput): Record<string, unknown> {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    runId: input.runId,
    contextReceiptId: input.contextReceiptId,
    orchestratorKey: input.orchestratorKey,
    orchestratorVersion: input.orchestratorVersion,
    planVersion: input.planVersion,
    maxParallelism: input.maxParallelism,
    steps: input.steps.map((step) => ({
      key: step.key,
      agentKey: step.agentKey,
      agentVersion: step.agentVersion,
      dependencies: [...step.dependencies],
      toolKeys: [...step.toolKeys],
      commandKeys: [...step.commandKeys],
      policyRefs: [...step.policyRefs],
      canonicalRefs: [...step.canonicalRefs],
      memoryRefs: [...step.memoryRefs],
      budget: { ...step.budget },
    })),
    createdAt: input.createdAt.toISOString(),
  };
}

function createQueuedRunEnvelope(
  input: PersistAgentExecutionPlanInput,
  definition: ParsedDefinition,
): Record<string, unknown> {
  return {
    id: input.runId,
    workspaceId: input.workspaceId,
    agentKey: input.orchestratorKey,
    agentVersion: input.orchestratorVersion,
    ...(input.parentRunId ? { parentRunId: input.parentRunId } : {}),
    ...(input.handoffId ? { handoffId: input.handoffId } : {}),
    executionMode: 'deterministic',
    promptVersion: definition.promptVersion,
    skillVersions: definition.skillVersions,
    contextReceiptId: input.contextReceiptId,
    status: 'queued',
    uncertainty: [],
    evidenceIds: [],
    factIds: [],
    sourceIds: [],
    assumptions: [],
    conflicts: [],
    toolSummary: [],
    cost: {
      inputTokens: 0,
      outputTokens: 0,
      searches: 0,
      apiCalls: 0,
      credits: 0,
      currencyMicros: 0,
    },
    validationState: 'pending',
    evaluatorState: 'not_required',
    proposedActions: [],
  };
}

export async function persistAgentExecutionPlan(
  pool: Pool,
  input: PersistAgentExecutionPlanInput,
): Promise<PersistedAgentExecutionPlanResult> {
  assertPlanShape(input);
  const planEnvelope = createPlanEnvelope(input);

  return withPgTransaction(pool, async (client) => {
    await assertCurrentWorkspaceRead(client, input.workspaceId, input.userId);

    const existingPlan = await client.query<ExistingPlanRow>(
      `SELECT run_id, envelope
       FROM agent_execution_plans
       WHERE id = $1`,
      [input.id],
    );
    if (existingPlan.rows[0]) {
      const samePlan = JSON.stringify(existingPlan.rows[0].envelope) === JSON.stringify(planEnvelope);
      if (!samePlan || existingPlan.rows[0].run_id !== input.runId) {
        throw new AgentPersistenceConflictError(
          'AGENT_EXECUTION_PLAN_ID_CONFLICT',
          `Execution plan ${input.id} already exists with different content or scope.`,
        );
      }
      const run = await client.query<{ envelope: Record<string, unknown> }>(
        `SELECT envelope FROM agent_runs WHERE workspace_id = $1 AND id = $2`,
        [input.workspaceId, input.runId],
      );
      const runEnvelope = run.rows[0]?.envelope;
      if (!runEnvelope) {
        throw new AgentPersistenceConflictError(
          'AGENT_EXECUTION_PLAN_PROJECTION_MISMATCH',
          `Execution plan ${input.id} exists without its canonical AgentRun.`,
        );
      }
      return {
        planId: input.id,
        runId: input.runId,
        created: false,
        runEnvelope,
        planEnvelope,
      };
    }

    const runPlan = await client.query<{ id: string }>(
      `SELECT id FROM agent_execution_plans WHERE workspace_id = $1 AND run_id = $2`,
      [input.workspaceId, input.runId],
    );
    if (runPlan.rows[0]) {
      throw new AgentPersistenceConflictError(
        'AGENT_EXECUTION_RUN_ALREADY_PLANNED',
        `AgentRun ${input.runId} already belongs to execution plan ${runPlan.rows[0].id}.`,
      );
    }

    const existingRun = await client.query<{ id: string }>('SELECT id FROM agent_runs WHERE id = $1', [input.runId]);
    if (existingRun.rows[0]) {
      throw new AgentPersistenceConflictError(
        'AGENT_EXECUTION_RUN_ID_CONFLICT',
        `AgentRun ${input.runId} already exists without the requested execution plan.`,
      );
    }

    const contextResult = await client.query<ContextReceiptRow>(
      `SELECT
         user_id,
         run_scope_id,
         agent_definition_id,
         agent_key,
         agent_version,
         receipt,
         created_at
       FROM agent_context_receipts
       WHERE id = $1 AND workspace_id = $2
       FOR SHARE`,
      [input.contextReceiptId, input.workspaceId],
    );
    const contextRow = contextResult.rows[0];
    if (!contextRow) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_CONTEXT_NOT_FOUND',
        `Context receipt ${input.contextReceiptId} was not found in workspace ${input.workspaceId}.`,
      );
    }
    if (input.createdAt < contextRow.created_at) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_CONTEXT_MISMATCH',
        'Execution plan creation time cannot precede its ContextReceipt.',
      );
    }
    const context = parseContextReceipt(contextRow, input);

    const orchestratorResult = await client.query<AgentDefinitionRow>(
      `SELECT id, agent_key, version, status, autonomy_tier, requires_human_approval, specification
       FROM agent_definitions
       WHERE id = $1 AND agent_key = $2 AND version = $3
       FOR SHARE`,
      [contextRow.agent_definition_id, input.orchestratorKey, input.orchestratorVersion],
    );
    const orchestratorRow = orchestratorResult.rows[0];
    if (!orchestratorRow) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_DEFINITION_NOT_APPROVED',
        `Orchestrator definition ${input.orchestratorKey}@${input.orchestratorVersion} is unavailable.`,
      );
    }
    const orchestrator = parseDefinition(orchestratorRow);
    if (orchestrator.key !== 'agent.control.orchestrator') {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_DEFINITION_INVALID',
        'The resolved orchestrator definition is not agent.control.orchestrator.',
      );
    }
    if (input.maxParallelism > orchestrator.budget.maxConcurrency) {
      throw new AgentExecutionPlanError(
        'AGENT_EXECUTION_BUDGET_EXCEEDED',
        'Plan maxParallelism exceeds the orchestrator concurrency budget.',
      );
    }

    const aggregate: AgentExecutionBudgetInput = {
      maxTokens: 0,
      maxSearches: 0,
      maxApiCalls: 0,
      maxCredits: 0,
      maxCurrencyMicros: 0,
      maxRuntimeMs: 0,
      maxConcurrency: input.maxParallelism,
    };

    for (const step of input.steps) {
      const definitionResult = await client.query<AgentDefinitionRow>(
        `SELECT id, agent_key, version, status, autonomy_tier, requires_human_approval, specification
         FROM agent_definitions
         WHERE agent_key = $1 AND version = $2
         FOR SHARE`,
        [step.agentKey, step.agentVersion],
      );
      const definitionRow = definitionResult.rows[0];
      if (!definitionRow) {
        throw new AgentExecutionPlanError(
          'AGENT_EXECUTION_DEFINITION_NOT_APPROVED',
          `Specialist definition ${step.agentKey}@${step.agentVersion} is unavailable.`,
        );
      }
      const definition = parseDefinition(definitionRow);
      if (definition.requiresHumanApproval || definition.autonomyTier === 'T4') {
        throw new AgentExecutionPlanError(
          'AGENT_EXECUTION_REVIEW_REQUIRED',
          `Step ${step.key} requires a human approval artifact not implemented in this slice.`,
        );
      }

      assertSubset(
        step.toolKeys,
        new Set(definition.allowedTools),
        'AGENT_EXECUTION_TOOL_NOT_ALLOWED',
        `Step ${step.key} requests an unapproved tool`,
      );
      assertSubset(
        step.commandKeys,
        new Set(definition.allowedCommands),
        'AGENT_EXECUTION_COMMAND_NOT_ALLOWED',
        `Step ${step.key} requests an unapproved command`,
      );
      assertSubset(
        step.policyRefs,
        context.policyRefs,
        'AGENT_EXECUTION_SCOPE_BROADENED',
        `Step ${step.key} broadens policy scope`,
      );
      assertSubset(
        step.canonicalRefs,
        context.canonicalRefs,
        'AGENT_EXECUTION_SCOPE_BROADENED',
        `Step ${step.key} broadens canonical scope`,
      );

      for (const memoryId of step.memoryRefs) {
        const memoryRef = context.memoryRefs.get(memoryId);
        if (!memoryRef || memoryRef.status !== 'active') {
          throw new AgentExecutionPlanError(
            'AGENT_EXECUTION_SCOPE_BROADENED',
            `Step ${step.key} requests memory ${memoryId} outside the active ContextReceipt.`,
          );
        }
        if (!definition.memoryReadScopes.some((scope) => memoryScopeMatches(scope, memoryRef.namespace))) {
          throw new AgentExecutionPlanError(
            'AGENT_EXECUTION_MEMORY_SCOPE_NOT_ALLOWED',
            `Step ${step.key} cannot read memory ${memoryId} under its AgentDefinition scope.`,
          );
        }
      }

      assertBudgetWithin(step.budget, definition.budget, `Step ${step.key}`);
      for (const field of additiveBudgetFields) {
        aggregate[field] = addBudgetValue(aggregate[field], step.budget[field], field);
      }
    }

    assertBudgetWithin(aggregate, orchestrator.budget, 'Aggregate plan budget');

    const runEnvelope = createQueuedRunEnvelope(input, orchestrator);
    await client.query(
      `INSERT INTO agent_runs (
         id,
         workspace_id,
         agent_definition_id,
         agent_key,
         agent_version,
         context_receipt_id,
         parent_run_id,
         handoff_id,
         execution_mode,
         provider_id,
         model_id,
         status,
         envelope,
         started_at,
         completed_at,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'deterministic', NULL, NULL, 'queued', $9::jsonb, NULL, NULL, $10, $10)`,
      [
        input.runId,
        input.workspaceId,
        orchestrator.id,
        input.orchestratorKey,
        input.orchestratorVersion,
        input.contextReceiptId,
        input.parentRunId ?? null,
        input.handoffId ?? null,
        JSON.stringify(runEnvelope),
        input.createdAt,
      ],
    );

    await client.query(
      `INSERT INTO agent_execution_plans (
         id,
         workspace_id,
         user_id,
         run_id,
         context_receipt_id,
         orchestrator_definition_id,
         orchestrator_key,
         orchestrator_version,
         plan_version,
         max_parallelism,
         step_count,
         envelope,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)`,
      [
        input.id,
        input.workspaceId,
        input.userId,
        input.runId,
        input.contextReceiptId,
        orchestrator.id,
        input.orchestratorKey,
        input.orchestratorVersion,
        input.planVersion,
        input.maxParallelism,
        input.steps.length,
        JSON.stringify(planEnvelope),
        input.createdAt,
      ],
    );

    return {
      planId: input.id,
      runId: input.runId,
      created: true,
      runEnvelope,
      planEnvelope,
    };
  });
}

export async function getAgentExecutionPlanEnvelope(
  pool: Pool,
  workspaceId: string,
  planId: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query<{ envelope: Record<string, unknown> }>(
    `SELECT envelope
     FROM agent_execution_plans
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, planId],
  );
  return result.rows[0]?.envelope ?? null;
}
