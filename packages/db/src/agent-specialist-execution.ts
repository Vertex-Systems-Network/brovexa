import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool } from 'pg';
import { AgentPersistenceConflictError, persistAgentRun, persistContextReceipt } from './agent-persistence';
import { withPgTransaction } from './client';

export interface AgentSpecialistBudget {
  maxTokens: number;
  maxSearches: number;
  maxApiCalls: number;
  maxCredits: number;
  maxCurrencyMicros: number;
  maxRuntimeMs: number;
  maxConcurrency: number;
}

export interface AgentSpecialistWorkPayload {
  version: '1.0.0';
  dispatchId: string;
  handlerRegistryVersion: string;
  planId: string;
  planVersion: number;
  workspaceId: string;
  orchestratorRunId: string;
  contextReceiptId: string;
  maxParallelism: number;
  stepKey: string;
  agentKey: string;
  agentVersion: string;
  dependencies: string[];
  toolKeys: string[];
  commandKeys: string[];
  policyRefs: string[];
  canonicalRefs: string[];
  memoryRefs: string[];
  budget: AgentSpecialistBudget;
}

export interface AgentSpecialistRuntimeDefinition {
  id: string;
  agentKey: string;
  version: string;
  promptVersion: string;
  skillVersions: Record<string, string>;
  outputSchemaId: string;
  allowedTools: readonly string[];
  allowedCommands: readonly string[];
  evidenceRequired: boolean;
  minimumConfidence: number;
  reviewBelowConfidence: number;
  budget: AgentSpecialistBudget;
}

export interface AgentSpecialistAttemptRun {
  runId: string;
  status: 'queued' | 'running';
  updatedAt: Date;
}

export interface PreparedAgentSpecialistAttempt {
  payload: AgentSpecialistWorkPayload;
  userId: string;
  definition: AgentSpecialistRuntimeDefinition;
  runId: string;
  contextReceiptId: string;
  runStatus: 'queued' | 'running';
  runUpdatedAt: Date;
  abandonedRuns: AgentSpecialistAttemptRun[];
  replayResult: AgentSpecialistExecutionResult | null;
}

export interface AgentSpecialistToolSummary {
  toolKey: string;
  status: 'succeeded' | 'failed' | 'blocked' | 'skipped';
  costMicros: number;
}

export interface AgentSpecialistCost {
  inputTokens: number;
  outputTokens: number;
  searches: number;
  apiCalls: number;
  credits: number;
  currencyMicros: number;
}

export interface AgentSpecialistProposedAction {
  commandKey: string;
  payload: Record<string, unknown>;
  evidenceRefs: string[];
}

export interface AgentSpecialistExecutionResult {
  result: Record<string, unknown>;
  confidence: number;
  uncertainty: string[];
  evidenceIds: string[];
  factIds: string[];
  sourceIds: string[];
  assumptions: string[];
  conflicts: string[];
  toolSummary: AgentSpecialistToolSummary[];
  cost: AgentSpecialistCost;
  validationState: 'passed';
  proposedActions: AgentSpecialistProposedAction[];
}

export type AgentSpecialistExecutionErrorCode =
  | 'AGENT_SPECIALIST_INPUT_INVALID'
  | 'AGENT_SPECIALIST_WORK_NOT_FOUND'
  | 'AGENT_SPECIALIST_WORK_STATE'
  | 'AGENT_SPECIALIST_WORK_IDENTITY_MISMATCH'
  | 'AGENT_SPECIALIST_PLAN_MISMATCH'
  | 'AGENT_SPECIALIST_AUTHORIZATION_REQUIRED'
  | 'AGENT_SPECIALIST_DEFINITION_NOT_APPROVED'
  | 'AGENT_SPECIALIST_DETERMINISTIC_ONLY'
  | 'AGENT_SPECIALIST_SCOPE_MISMATCH'
  | 'AGENT_SPECIALIST_CONTEXT_MISMATCH'
  | 'AGENT_SPECIALIST_EVALUATOR_REQUIRED'
  | 'AGENT_SPECIALIST_PRIOR_REVIEW_REQUIRED'
  | 'AGENT_SPECIALIST_RUN_STATE'
  | 'AGENT_SPECIALIST_RESULT_INVALID'
  | 'AGENT_SPECIALIST_REVIEW_REQUIRED';

export class AgentSpecialistExecutionError extends Error {
  readonly code: AgentSpecialistExecutionErrorCode;

  constructor(code: AgentSpecialistExecutionErrorCode, message: string) {
    super(message);
    this.name = 'AgentSpecialistExecutionError';
    this.code = code;
  }
}

interface CanonicalWorkRow {
  id: string;
  job_run_id: string;
  workspace_id: string;
  queue_name: string;
  work_type: string;
  work_version: number;
  idempotency_key: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
  max_attempts: number;
  started_at: Date | null;
  created_at: Date;
  job_type: string;
}

interface PlanRow {
  user_id: string;
  run_id: string;
  context_receipt_id: string;
  plan_version: number;
  max_parallelism: number;
  envelope: Record<string, unknown>;
}

interface DefinitionRow {
  id: string;
  agent_key: string;
  version: string;
  status: string;
  requires_human_approval: boolean;
  specification: Record<string, unknown>;
}

interface ParentContextRow {
  receipt: Record<string, unknown>;
  created_at: Date;
}

interface ResolvedAdmission {
  work: CanonicalWorkRow;
  payload: AgentSpecialistWorkPayload;
  userId: string;
  definition: AgentSpecialistRuntimeDefinition;
  parentContext: ParentContextRow;
}

const canonicalQueueName = 'brovexa-work-v1';
const canonicalJobType = 'agent.execution.plan';
const safeArrayMaximum = 512;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readIdentifier(value: unknown, field: string, maxLength = 128): string {
  if (!isNonEmptyString(value) || value.length > maxLength) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_INPUT_INVALID',
      `${field} must be a non-empty identifier no longer than ${maxLength} characters.`,
    );
  }
  return value.trim();
}

function readStringArray(value: unknown, field: string, maxItems = safeArrayMaximum): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => !isNonEmptyString(item))) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_INPUT_INVALID',
      `${field} must be a bounded array of non-empty strings.`,
    );
  }
  const normalized = value.map((item) => (item as string).trim());
  if (new Set(normalized).size !== normalized.length) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_INPUT_INVALID',
      `${field} must not contain duplicate identifiers.`,
    );
  }
  return normalized;
}

function readStringRecord(value: unknown, field: string): Record<string, string> {
  if (!isRecord(value)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_DEFINITION_NOT_APPROVED', `${field} is invalid.`);
  }
  const entries = Object.entries(value);
  if (entries.some(([key, item]) => !isNonEmptyString(key) || !isNonEmptyString(item))) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_DEFINITION_NOT_APPROVED', `${field} is invalid.`);
  }
  return Object.fromEntries(entries.map(([key, item]) => [key.trim(), (item as string).trim()]));
}

function readSafeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', `${field} must be a non-negative safe integer.`);
  }
  return value;
}

function readBudget(value: unknown, field: string): AgentSpecialistBudget {
  if (!isRecord(value)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', `${field} must be a budget object.`);
  }
  const budget = {
    maxTokens: readSafeInteger(value.maxTokens, `${field}.maxTokens`),
    maxSearches: readSafeInteger(value.maxSearches, `${field}.maxSearches`),
    maxApiCalls: readSafeInteger(value.maxApiCalls, `${field}.maxApiCalls`),
    maxCredits: readSafeInteger(value.maxCredits, `${field}.maxCredits`),
    maxCurrencyMicros: readSafeInteger(value.maxCurrencyMicros, `${field}.maxCurrencyMicros`),
    maxRuntimeMs: readSafeInteger(value.maxRuntimeMs, `${field}.maxRuntimeMs`),
    maxConcurrency: readSafeInteger(value.maxConcurrency, `${field}.maxConcurrency`),
  };
  if (budget.maxConcurrency < 1 || budget.maxConcurrency > 256) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', `${field}.maxConcurrency is invalid.`);
  }
  return budget;
}

function parseWorkPayload(value: unknown): AgentSpecialistWorkPayload {
  if (!isRecord(value)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', 'Specialist WorkUnit payload must be an object.');
  }
  if (value.version !== '1.0.0') {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', 'Unsupported specialist payload version.');
  }
  const agentKey = readIdentifier(value.agentKey, 'payload.agentKey');
  if (!/^agent\.[a-z0-9_.-]+$/.test(agentKey) || agentKey === 'agent.control.orchestrator') {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', 'payload.agentKey must target a specialist agent.');
  }
  const stepKey = readIdentifier(value.stepKey, 'payload.stepKey');
  if (!/^[a-z][a-z0-9_.-]{0,127}$/.test(stepKey)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', 'payload.stepKey is not canonical.');
  }
  const planVersion = readSafeInteger(value.planVersion, 'payload.planVersion');
  const maxParallelism = readSafeInteger(value.maxParallelism, 'payload.maxParallelism');
  if (planVersion < 1 || maxParallelism < 1 || maxParallelism > 256) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', 'Specialist plan version/parallelism is invalid.');
  }
  const budget = readBudget(value.budget, 'payload.budget');
  if (budget.maxConcurrency !== 1) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_INPUT_INVALID',
      'Specialist WorkUnit must reserve exactly one concurrency slot.',
    );
  }
  return {
    version: '1.0.0',
    dispatchId: readIdentifier(value.dispatchId, 'payload.dispatchId'),
    handlerRegistryVersion: readIdentifier(value.handlerRegistryVersion, 'payload.handlerRegistryVersion', 64),
    planId: readIdentifier(value.planId, 'payload.planId'),
    planVersion,
    workspaceId: readIdentifier(value.workspaceId, 'payload.workspaceId'),
    orchestratorRunId: readIdentifier(value.orchestratorRunId, 'payload.orchestratorRunId'),
    contextReceiptId: readIdentifier(value.contextReceiptId, 'payload.contextReceiptId'),
    maxParallelism,
    stepKey,
    agentKey,
    agentVersion: readIdentifier(value.agentVersion, 'payload.agentVersion', 64),
    dependencies: readStringArray(value.dependencies, 'payload.dependencies', 64),
    toolKeys: readStringArray(value.toolKeys, 'payload.toolKeys', 128),
    commandKeys: readStringArray(value.commandKeys, 'payload.commandKeys', 128),
    policyRefs: readStringArray(value.policyRefs, 'payload.policyRefs', 128),
    canonicalRefs: readStringArray(value.canonicalRefs, 'payload.canonicalRefs', 512),
    memoryRefs: readStringArray(value.memoryRefs, 'payload.memoryRefs', 512),
    budget,
  };
}

function parseDefinition(row: DefinitionRow, payload: AgentSpecialistWorkPayload): AgentSpecialistRuntimeDefinition {
  if (row.status !== 'approved' || row.requires_human_approval) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_DEFINITION_NOT_APPROVED',
      `Specialist definition ${payload.agentKey}@${payload.agentVersion} is not execution-approved.`,
    );
  }
  const specification = row.specification;
  if (
    specification.key !== row.agent_key ||
    specification.version !== row.version ||
    specification.status !== row.status ||
    specification.requiresHumanApproval !== row.requires_human_approval
  ) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_DEFINITION_NOT_APPROVED',
      `Specialist definition ${payload.agentKey}@${payload.agentVersion} is internally inconsistent.`,
    );
  }
  const modelPolicy = specification.modelPolicy;
  if (
    !isRecord(modelPolicy) ||
    modelPolicy.routingMode !== 'deterministic_only' ||
    !Array.isArray(modelPolicy.allowedProviderIds) ||
    modelPolicy.allowedProviderIds.length !== 0 ||
    !Array.isArray(modelPolicy.allowedModelIds) ||
    modelPolicy.allowedModelIds.length !== 0 ||
    !Array.isArray(modelPolicy.fallbackModelIds) ||
    modelPolicy.fallbackModelIds.length !== 0
  ) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_DETERMINISTIC_ONLY',
      `Specialist ${payload.agentKey}@${payload.agentVersion} is not deterministic-only.`,
    );
  }
  if (isNonEmptyString(specification.independentEvaluatorKey)) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_EVALUATOR_REQUIRED',
      `Specialist ${payload.agentKey}@${payload.agentVersion} requires independent evaluation not implemented in this slice.`,
    );
  }
  const allowedTools = readStringArray(specification.allowedTools, 'definition.allowedTools', 128);
  const allowedCommands = readStringArray(specification.allowedCommands, 'definition.allowedCommands', 128);
  for (const toolKey of payload.toolKeys) {
    if (!allowedTools.includes(toolKey)) {
      throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_SCOPE_MISMATCH', `Tool ${toolKey} is outside the specialist definition.`);
    }
  }
  for (const commandKey of payload.commandKeys) {
    if (!allowedCommands.includes(commandKey)) {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_SCOPE_MISMATCH',
        `Command ${commandKey} is outside the specialist definition.`,
      );
    }
  }
  const definitionBudget = readBudget(specification.budget, 'definition.budget');
  for (const field of [
    'maxTokens',
    'maxSearches',
    'maxApiCalls',
    'maxCredits',
    'maxCurrencyMicros',
    'maxRuntimeMs',
    'maxConcurrency',
  ] as const) {
    if (payload.budget[field] > definitionBudget[field]) {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_SCOPE_MISMATCH',
        `Specialist WorkUnit exceeds definition budget ${field}.`,
      );
    }
  }
  const minimumConfidence = Number(specification.minimumConfidence);
  const reviewBelowConfidence = Number(specification.reviewBelowConfidence);
  if (
    !Number.isFinite(minimumConfidence) ||
    minimumConfidence < 0 ||
    minimumConfidence > 1 ||
    !Number.isFinite(reviewBelowConfidence) ||
    reviewBelowConfidence < 0 ||
    reviewBelowConfidence > 1
  ) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_DEFINITION_NOT_APPROVED',
      'Specialist confidence thresholds are invalid.',
    );
  }
  return {
    id: row.id,
    agentKey: row.agent_key,
    version: row.version,
    promptVersion: readIdentifier(specification.promptVersion, 'definition.promptVersion', 64),
    skillVersions: readStringRecord(specification.skillVersions, 'definition.skillVersions'),
    outputSchemaId: readIdentifier(specification.outputSchemaId, 'definition.outputSchemaId'),
    allowedTools,
    allowedCommands,
    evidenceRequired: specification.evidenceRequired === true,
    minimumConfidence,
    reviewBelowConfidence,
    budget: definitionBudget,
  };
}

function assertCurrentWorkspaceReadResult(allowed: boolean): void {
  if (!allowed) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_AUTHORIZATION_REQUIRED',
      'Current active workspace.read authorization is required for specialist execution.',
    );
  }
}

function hashIdentity(...parts: Array<string | number>): string {
  return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 48);
}

export function createAgentSpecialistRunId(workUnitId: string, attempt: number): string {
  return `agent-specialist-${hashIdentity(workUnitId, attempt)}`;
}

export function createAgentSpecialistContextReceiptId(workUnitId: string, attempt: number): string {
  return `ctx-specialist-${hashIdentity(workUnitId, attempt)}`;
}

export function createAgentSpecialistTransitionId(runId: string, phase: string): string {
  return `agent-specialist-${phase}-${hashIdentity(runId, phase)}`;
}

async function resolveAdmission(
  pool: Pool,
  input: {
    workspaceId: string;
    jobRunId: string;
    workUnitId: string;
    correlationId: string;
    attempt: number;
    workType: string;
    workVersion: number;
    payload: Record<string, unknown>;
  },
): Promise<ResolvedAdmission> {
  for (const [field, value] of [
    ['workspaceId', input.workspaceId],
    ['jobRunId', input.jobRunId],
    ['workUnitId', input.workUnitId],
    ['correlationId', input.correlationId],
    ['workType', input.workType],
  ] as const) {
    readIdentifier(value, field);
  }
  if (!Number.isInteger(input.attempt) || input.attempt < 1 || !Number.isInteger(input.workVersion) || input.workVersion < 1) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', 'Work attempt/version is invalid.');
  }

  const payload = parseWorkPayload(input.payload);
  const workResult = await pool.query<CanonicalWorkRow>(
    `SELECT
       work.id,
       work.job_run_id,
       work.workspace_id,
       work.queue_name,
       work.work_type,
       work.work_version,
       work.idempotency_key,
       work.correlation_id,
       work.payload,
       work.status,
       work.attempt_count,
       work.max_attempts,
       work.started_at,
       work.created_at,
       job.job_type
     FROM job_work_units AS work
     INNER JOIN job_runs AS job ON job.id = work.job_run_id AND job.workspace_id = work.workspace_id
     WHERE work.id = $1 AND work.workspace_id = $2`,
    [input.workUnitId, input.workspaceId],
  );
  const work = workResult.rows[0];
  if (!work) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_WORK_NOT_FOUND', `WorkUnit ${input.workUnitId} was not found.`);
  }
  if (
    work.status !== 'running' ||
    work.attempt_count !== input.attempt ||
    work.job_run_id !== input.jobRunId ||
    work.correlation_id !== input.correlationId
  ) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_WORK_STATE',
      `WorkUnit ${input.workUnitId} is not the claimed running attempt ${input.attempt}.`,
    );
  }
  if (
    work.job_type !== canonicalJobType ||
    work.queue_name !== canonicalQueueName ||
    work.work_type !== input.workType ||
    work.work_type !== payload.agentKey ||
    work.work_version !== input.workVersion ||
    work.work_version !== 1 ||
    payload.workspaceId !== work.workspace_id ||
    !isDeepStrictEqual(work.payload, input.payload)
  ) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_WORK_IDENTITY_MISMATCH',
      `WorkUnit ${input.workUnitId} does not match its claimed canonical specialist identity.`,
    );
  }

  const planResult = await pool.query<PlanRow>(
    `SELECT user_id, run_id, context_receipt_id, plan_version, max_parallelism, envelope
     FROM agent_execution_plans
     WHERE id = $1 AND workspace_id = $2`,
    [payload.planId, input.workspaceId],
  );
  const plan = planResult.rows[0];
  if (!plan || !isRecord(plan.envelope) || !Array.isArray(plan.envelope.steps)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_PLAN_MISMATCH', `Plan ${payload.planId} is unavailable or invalid.`);
  }
  const step = plan.envelope.steps.find(
    (candidate): candidate is Record<string, unknown> => isRecord(candidate) && candidate.key === payload.stepKey,
  );
  if (!step) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_PLAN_MISMATCH', `Plan step ${payload.stepKey} is unavailable.`);
  }
  const expectedStep = {
    key: payload.stepKey,
    agentKey: payload.agentKey,
    agentVersion: payload.agentVersion,
    dependencies: payload.dependencies,
    toolKeys: payload.toolKeys,
    commandKeys: payload.commandKeys,
    policyRefs: payload.policyRefs,
    canonicalRefs: payload.canonicalRefs,
    memoryRefs: payload.memoryRefs,
    budget: payload.budget,
  };
  if (
    plan.run_id !== payload.orchestratorRunId ||
    plan.context_receipt_id !== payload.contextReceiptId ||
    plan.plan_version !== payload.planVersion ||
    plan.max_parallelism !== payload.maxParallelism ||
    plan.envelope.id !== payload.planId ||
    plan.envelope.workspaceId !== payload.workspaceId ||
    plan.envelope.userId !== plan.user_id ||
    !isDeepStrictEqual(step, expectedStep)
  ) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_PLAN_MISMATCH',
      `WorkUnit ${input.workUnitId} no longer matches immutable plan ${payload.planId}.`,
    );
  }

  const authorization = await pool.query<{ allowed: boolean }>(
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
    [input.workspaceId, plan.user_id],
  );
  assertCurrentWorkspaceReadResult(authorization.rows[0]?.allowed ?? false);

  const definitionResult = await pool.query<DefinitionRow>(
    `SELECT id, agent_key, version, status, requires_human_approval, specification
     FROM agent_definitions
     WHERE agent_key = $1 AND version = $2`,
    [payload.agentKey, payload.agentVersion],
  );
  const definitionRow = definitionResult.rows[0];
  if (!definitionRow) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_DEFINITION_NOT_APPROVED',
      `Specialist definition ${payload.agentKey}@${payload.agentVersion} is unavailable.`,
    );
  }
  const definition = parseDefinition(definitionRow, payload);

  const contextResult = await pool.query<ParentContextRow>(
    `SELECT receipt, created_at
     FROM agent_context_receipts
     WHERE id = $1 AND workspace_id = $2`,
    [payload.contextReceiptId, input.workspaceId],
  );
  const parentContext = contextResult.rows[0];
  if (!parentContext || !isRecord(parentContext.receipt)) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_CONTEXT_MISMATCH',
      `Parent ContextReceipt ${payload.contextReceiptId} is unavailable.`,
    );
  }

  return { work, payload, userId: plan.user_id, definition, parentContext };
}

function selectChildMemoryRefs(
  parentReceipt: Record<string, unknown>,
  payload: AgentSpecialistWorkPayload,
): Array<Record<string, unknown>> {
  const parentPolicies = readStringArray(parentReceipt.policyRefs, 'parentContext.policyRefs', 128);
  const parentCanonical = readStringArray(parentReceipt.canonicalRefs, 'parentContext.canonicalRefs', 512);
  if (payload.policyRefs.some((ref) => !parentPolicies.includes(ref))) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_CONTEXT_MISMATCH', 'Specialist policy scope exceeds parent context.');
  }
  if (payload.canonicalRefs.some((ref) => !parentCanonical.includes(ref))) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_CONTEXT_MISMATCH', 'Specialist canonical scope exceeds parent context.');
  }
  if (!Array.isArray(parentReceipt.memoryRefs)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_CONTEXT_MISMATCH', 'Parent context memory references are invalid.');
  }
  const byId = new Map<string, Record<string, unknown>>();
  for (const value of parentReceipt.memoryRefs) {
    if (isRecord(value) && isNonEmptyString(value.memoryId)) byId.set(value.memoryId, value);
  }
  const selected: Array<Record<string, unknown>> = [];
  for (const memoryId of payload.memoryRefs) {
    const memory = byId.get(memoryId);
    if (!memory || memory.status !== 'active') {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_CONTEXT_MISMATCH',
        `Specialist memory ${memoryId} is outside the active parent ContextReceipt.`,
      );
    }
    selected.push({ ...memory });
  }
  return selected;
}

function createQueuedRunEnvelope(
  runId: string,
  contextReceiptId: string,
  workUnitId: string,
  payload: AgentSpecialistWorkPayload,
  definition: AgentSpecialistRuntimeDefinition,
): Record<string, unknown> {
  return {
    id: runId,
    workspaceId: payload.workspaceId,
    agentKey: payload.agentKey,
    agentVersion: payload.agentVersion,
    parentRunId: payload.orchestratorRunId,
    handoffId: workUnitId,
    executionMode: 'deterministic',
    promptVersion: definition.promptVersion,
    skillVersions: definition.skillVersions,
    contextReceiptId,
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

function isResultEnvelope(value: unknown): value is AgentSpecialistExecutionResult {
  if (!isRecord(value) || !isRecord(value.result)) return false;
  return (
    typeof value.confidence === 'number' &&
    Array.isArray(value.uncertainty) &&
    Array.isArray(value.evidenceIds) &&
    Array.isArray(value.factIds) &&
    Array.isArray(value.sourceIds) &&
    Array.isArray(value.assumptions) &&
    Array.isArray(value.conflicts) &&
    Array.isArray(value.toolSummary) &&
    isRecord(value.cost) &&
    value.validationState === 'passed' &&
    Array.isArray(value.proposedActions)
  );
}

export async function prepareAgentSpecialistAttempt(
  pool: Pool,
  input: {
    workspaceId: string;
    jobRunId: string;
    workUnitId: string;
    correlationId: string;
    attempt: number;
    workType: string;
    workVersion: number;
    payload: Record<string, unknown>;
  },
): Promise<PreparedAgentSpecialistAttempt> {
  const admission = await resolveAdmission(pool, input);
  const { work, payload, definition, parentContext, userId } = admission;

  const previous = await pool.query<{
    id: string;
    status: string;
    updated_at: Date;
    envelope: Record<string, unknown>;
  }>(
    `SELECT id, status, updated_at, envelope
     FROM agent_runs
     WHERE workspace_id = $1
       AND handoff_id = $2
       AND parent_run_id = $3
       AND agent_key = $4
       AND agent_version = $5
     ORDER BY created_at ASC, id ASC`,
    [payload.workspaceId, work.id, payload.orchestratorRunId, payload.agentKey, payload.agentVersion],
  );

  for (const row of previous.rows) {
    if (row.status === 'succeeded') {
      const projected = {
        result: row.envelope.result,
        confidence: row.envelope.confidence,
        uncertainty: row.envelope.uncertainty,
        evidenceIds: row.envelope.evidenceIds,
        factIds: row.envelope.factIds,
        sourceIds: row.envelope.sourceIds,
        assumptions: row.envelope.assumptions,
        conflicts: row.envelope.conflicts,
        toolSummary: row.envelope.toolSummary,
        cost: row.envelope.cost,
        validationState: row.envelope.validationState,
        proposedActions: row.envelope.proposedActions,
      };
      if (!isResultEnvelope(projected)) {
        throw new AgentSpecialistExecutionError(
          'AGENT_SPECIALIST_RUN_STATE',
          `Succeeded specialist AgentRun ${row.id} has an invalid result projection.`,
        );
      }
      return {
        payload,
        userId,
        definition,
        runId: row.id,
        contextReceiptId: readIdentifier(row.envelope.contextReceiptId, 'run.contextReceiptId'),
        runStatus: 'running',
        runUpdatedAt: row.updated_at,
        abandonedRuns: [],
        replayResult: projected,
      };
    }
    if (['review_required', 'blocked', 'budget_stopped'].includes(row.status)) {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_PRIOR_REVIEW_REQUIRED',
        `Prior specialist AgentRun ${row.id} requires review before another attempt.`,
      );
    }
  }

  const runId = createAgentSpecialistRunId(work.id, input.attempt);
  const contextReceiptId = createAgentSpecialistContextReceiptId(work.id, input.attempt);
  const selectedMemoryRefs = selectChildMemoryRefs(parentContext.receipt, payload);
  const createdAt = work.created_at < parentContext.created_at ? parentContext.created_at : work.created_at;
  const childReceipt = {
    id: contextReceiptId,
    taskId: `specialist-task-${hashIdentity(work.id, input.attempt)}`,
    workspaceId: payload.workspaceId,
    userId,
    runId: payload.orchestratorRunId,
    agentKey: payload.agentKey,
    agentVersion: payload.agentVersion,
    policyRefs: payload.policyRefs,
    canonicalRefs: payload.canonicalRefs,
    memoryRefs: selectedMemoryRefs,
    tokenBudget: payload.budget.maxTokens,
    maxCurrencyMicros: payload.budget.maxCurrencyMicros,
    createdAt: createdAt.toISOString(),
  };

  await persistContextReceipt(pool, {
    id: contextReceiptId,
    workspaceId: payload.workspaceId,
    userId,
    runScopeId: payload.orchestratorRunId,
    agentDefinitionId: definition.id,
    agentKey: payload.agentKey,
    agentVersion: payload.agentVersion,
    receipt: childReceipt,
    tokenBudget: payload.budget.maxTokens,
    maxCurrencyMicros: payload.budget.maxCurrencyMicros,
    createdAt,
  });

  const queuedEnvelope = createQueuedRunEnvelope(runId, contextReceiptId, work.id, payload, definition);
  const existingCurrent = previous.rows.find((row) => row.id === runId);
  if (!existingCurrent) {
    await persistAgentRun(pool, {
      id: runId,
      workspaceId: payload.workspaceId,
      agentDefinitionId: definition.id,
      agentKey: payload.agentKey,
      agentVersion: payload.agentVersion,
      contextReceiptId,
      parentRunId: payload.orchestratorRunId,
      handoffId: work.id,
      executionMode: 'deterministic',
      status: 'queued',
      envelope: queuedEnvelope,
    });
  }

  const current = await pool.query<{ status: string; updated_at: Date }>(
    `SELECT status, updated_at
     FROM agent_runs
     WHERE id = $1 AND workspace_id = $2`,
    [runId, payload.workspaceId],
  );
  const currentRow = current.rows[0];
  if (!currentRow || (currentRow.status !== 'queued' && currentRow.status !== 'running')) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_RUN_STATE',
      `Specialist AgentRun ${runId} is not resumable for attempt ${input.attempt}.`,
    );
  }

  const abandonedRuns = previous.rows
    .filter((row) => row.id !== runId && (row.status === 'queued' || row.status === 'running'))
    .map((row) => ({ runId: row.id, status: row.status as 'queued' | 'running', updatedAt: row.updated_at }));

  return {
    payload,
    userId,
    definition,
    runId,
    contextReceiptId,
    runStatus: currentRow.status,
    runUpdatedAt: currentRow.updated_at,
    abandonedRuns,
    replayResult: null,
  };
}

function assertResultStringList(value: unknown, field: string, maxItems: number): string[] {
  return readStringArray(value ?? [], field, maxItems);
}

function normalizeCost(value: unknown): AgentSpecialistCost {
  if (!isRecord(value)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', 'Specialist result cost must be an object.');
  }
  return {
    inputTokens: readSafeInteger(value.inputTokens, 'result.cost.inputTokens'),
    outputTokens: readSafeInteger(value.outputTokens, 'result.cost.outputTokens'),
    searches: readSafeInteger(value.searches, 'result.cost.searches'),
    apiCalls: readSafeInteger(value.apiCalls, 'result.cost.apiCalls'),
    credits: readSafeInteger(value.credits, 'result.cost.credits'),
    currencyMicros: readSafeInteger(value.currencyMicros, 'result.cost.currencyMicros'),
  };
}

function normalizeResult(
  value: unknown,
  payload: AgentSpecialistWorkPayload,
  definition: AgentSpecialistRuntimeDefinition,
): AgentSpecialistExecutionResult {
  if (!isRecord(value) || !isRecord(value.result)) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', 'Specialist execution requires a structured result object.');
  }
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', 'Specialist result confidence must be between 0 and 1.');
  }
  if (value.validationState !== 'passed') {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_REVIEW_REQUIRED',
      'Specialist result cannot complete while deterministic validation has not passed.',
    );
  }
  if (confidence < definition.minimumConfidence || confidence < definition.reviewBelowConfidence) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_REVIEW_REQUIRED',
      `Specialist confidence ${confidence} is below the configured completion threshold.`,
    );
  }
  const evidenceIds = assertResultStringList(value.evidenceIds, 'result.evidenceIds', 512);
  if (definition.evidenceRequired && evidenceIds.length === 0) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_REVIEW_REQUIRED',
      'Specialist definition requires evidence before successful completion.',
    );
  }

  if (!Array.isArray(value.toolSummary) || value.toolSummary.length > 512) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', 'Specialist toolSummary is invalid.');
  }
  const toolSummary = value.toolSummary.map((entry, index): AgentSpecialistToolSummary => {
    if (!isRecord(entry)) {
      throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', `toolSummary[${index}] is invalid.`);
    }
    const toolKey = readIdentifier(entry.toolKey, `toolSummary[${index}].toolKey`);
    if (!payload.toolKeys.includes(toolKey)) {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_SCOPE_MISMATCH',
        `Specialist result claims unapproved tool ${toolKey}.`,
      );
    }
    if (!['succeeded', 'failed', 'blocked', 'skipped'].includes(String(entry.status))) {
      throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', `toolSummary[${index}].status is invalid.`);
    }
    return {
      toolKey,
      status: entry.status as AgentSpecialistToolSummary['status'],
      costMicros: readSafeInteger(entry.costMicros, `toolSummary[${index}].costMicros`),
    };
  });

  if (!Array.isArray(value.proposedActions) || value.proposedActions.length > 128) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', 'Specialist proposedActions is invalid.');
  }
  const proposedActions = value.proposedActions.map((entry, index): AgentSpecialistProposedAction => {
    if (!isRecord(entry) || !isRecord(entry.payload)) {
      throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RESULT_INVALID', `proposedActions[${index}] is invalid.`);
    }
    const commandKey = readIdentifier(entry.commandKey, `proposedActions[${index}].commandKey`);
    if (!payload.commandKeys.includes(commandKey)) {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_SCOPE_MISMATCH',
        `Specialist result proposes unapproved command ${commandKey}.`,
      );
    }
    return {
      commandKey,
      payload: entry.payload,
      evidenceRefs: assertResultStringList(entry.evidenceRefs, `proposedActions[${index}].evidenceRefs`, 128),
    };
  });

  const cost = normalizeCost(value.cost);
  const tokenTotal = cost.inputTokens + cost.outputTokens;
  if (
    !Number.isSafeInteger(tokenTotal) ||
    tokenTotal > payload.budget.maxTokens ||
    cost.searches > payload.budget.maxSearches ||
    cost.apiCalls > payload.budget.maxApiCalls ||
    cost.credits > payload.budget.maxCredits ||
    cost.currencyMicros > payload.budget.maxCurrencyMicros
  ) {
    throw new AgentSpecialistExecutionError(
      'AGENT_SPECIALIST_SCOPE_MISMATCH',
      'Specialist result cost exceeds its reserved WorkUnit budget.',
    );
  }

  return {
    result: value.result,
    confidence,
    uncertainty: assertResultStringList(value.uncertainty, 'result.uncertainty', 128),
    evidenceIds,
    factIds: assertResultStringList(value.factIds, 'result.factIds', 512),
    sourceIds: assertResultStringList(value.sourceIds, 'result.sourceIds', 512),
    assumptions: assertResultStringList(value.assumptions, 'result.assumptions', 128),
    conflicts: assertResultStringList(value.conflicts, 'result.conflicts', 128),
    toolSummary,
    cost,
    validationState: 'passed',
    proposedActions,
  };
}

export async function completeAgentSpecialistAttempt(
  pool: Pool,
  input: {
    workspaceId: string;
    jobRunId: string;
    workUnitId: string;
    correlationId: string;
    attempt: number;
    workType: string;
    workVersion: number;
    payload: Record<string, unknown>;
    runId: string;
    result: unknown;
    occurredAt: Date;
  },
): Promise<{ created: boolean; result: AgentSpecialistExecutionResult }> {
  if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) {
    throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_INPUT_INVALID', 'Completion time must be valid.');
  }
  const admission = await resolveAdmission(pool, input);
  const normalized = normalizeResult(input.result, admission.payload, admission.definition);
  const transitionId = createAgentSpecialistTransitionId(input.runId, 'complete');

  return withPgTransaction(pool, async (client) => {
    const current = await client.query<{
      status: string;
      last_transition_id: string | null;
      envelope: Record<string, unknown>;
      started_at: Date | null;
      completed_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT status, last_transition_id, envelope, started_at, completed_at, updated_at
       FROM agent_runs
       WHERE workspace_id = $1 AND id = $2
       FOR UPDATE`,
      [input.workspaceId, input.runId],
    );
    const run = current.rows[0];
    if (!run) {
      throw new AgentSpecialistExecutionError('AGENT_SPECIALIST_RUN_STATE', `Specialist AgentRun ${input.runId} was not found.`);
    }

    const finalProjection = {
      ...run.envelope,
      status: 'succeeded',
      result: normalized.result,
      confidence: normalized.confidence,
      uncertainty: normalized.uncertainty,
      evidenceIds: normalized.evidenceIds,
      factIds: normalized.factIds,
      sourceIds: normalized.sourceIds,
      assumptions: normalized.assumptions,
      conflicts: normalized.conflicts,
      toolSummary: normalized.toolSummary,
      cost: normalized.cost,
      validationState: normalized.validationState,
      evaluatorState: 'not_required',
      proposedActions: normalized.proposedActions,
      ...(run.started_at ? { startedAt: run.started_at.toISOString() } : {}),
      completedAt: input.occurredAt.toISOString(),
    };

    if (run.status === 'succeeded') {
      const same =
        run.last_transition_id === transitionId &&
        isDeepStrictEqual(run.envelope.result, normalized.result) &&
        run.envelope.confidence === normalized.confidence &&
        isDeepStrictEqual(run.envelope.evidenceIds, normalized.evidenceIds) &&
        isDeepStrictEqual(run.envelope.toolSummary, normalized.toolSummary) &&
        isDeepStrictEqual(run.envelope.cost, normalized.cost) &&
        isDeepStrictEqual(run.envelope.proposedActions, normalized.proposedActions);
      if (!same) {
        throw new AgentPersistenceConflictError(
          'AGENT_SPECIALIST_RESULT_CONFLICT',
          `Specialist AgentRun ${input.runId} is already succeeded with a different result projection.`,
        );
      }
      return { created: false, result: normalized };
    }
    if (run.status !== 'running' || !run.started_at) {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_RUN_STATE',
        `Specialist AgentRun ${input.runId} must be running before completion.`,
      );
    }
    if (input.occurredAt < run.updated_at) {
      throw new AgentSpecialistExecutionError(
        'AGENT_SPECIALIST_RUN_STATE',
        `Specialist AgentRun ${input.runId} completion time regresses its lifecycle projection.`,
      );
    }

    await client.query(
      `INSERT INTO agent_run_transitions (
         id, workspace_id, run_id, from_status, to_status, reason_code,
         actor_type, actor_id, metadata, occurred_at
       ) VALUES ($1, $2, $3, 'running', 'succeeded', 'specialist_execution_completed',
                 'worker', NULL, $4::jsonb, $5)`,
      [
        transitionId,
        input.workspaceId,
        input.runId,
        JSON.stringify({ workUnitId: input.workUnitId, attempt: input.attempt }),
        input.occurredAt,
      ],
    );

    finalProjection.startedAt = run.started_at.toISOString();
    await client.query(
      `UPDATE agent_runs
       SET status = 'succeeded',
           last_transition_id = $3,
           envelope = $4::jsonb,
           completed_at = $5,
           updated_at = $5
       WHERE workspace_id = $1 AND id = $2`,
      [input.workspaceId, input.runId, transitionId, JSON.stringify(finalProjection), input.occurredAt],
    );

    return { created: true, result: normalized };
  });
}

export async function getAgentSpecialistRunsForWorkUnit(
  pool: Pool,
  workspaceId: string,
  workUnitId: string,
): Promise<Array<{ runId: string; status: string; parentRunId: string | null; contextReceiptId: string; envelope: Record<string, unknown> }>> {
  const result = await pool.query<{
    id: string;
    status: string;
    parent_run_id: string | null;
    context_receipt_id: string;
    envelope: Record<string, unknown>;
  }>(
    `SELECT id, status, parent_run_id, context_receipt_id, envelope
     FROM agent_runs
     WHERE workspace_id = $1 AND handoff_id = $2
     ORDER BY created_at ASC, id ASC`,
    [workspaceId, workUnitId],
  );
  return result.rows.map((row) => ({
    runId: row.id,
    status: row.status,
    parentRunId: row.parent_run_id,
    contextReceiptId: row.context_receipt_id,
    envelope: row.envelope,
  }));
}
