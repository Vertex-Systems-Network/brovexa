import {
  AgentExecutionDispatchError,
  AgentSpecialistExecutionError,
  completeAgentSpecialistAttempt,
  createAgentSpecialistTransitionId,
  prepareAgentSpecialistAttempt,
  recordAgentExecutionBudgetUsage,
  transitionAgentRun,
  writeAgentExecutionCheckpoint,
  type AgentSpecialistExecutionResult,
  type AgentSpecialistWorkPayload,
  type createPgPool,
} from '@brovexa/db';
import { CancelledWorkError, PermanentWorkError, RetryableWorkError } from './errors';
import type { WorkHandler, WorkHandlerContext } from './runtime';

export interface DeterministicSpecialistResult {
  result: Record<string, unknown>;
  confidence: number;
  validationState: 'passed' | 'failed' | 'review';
  uncertainty?: string[] | undefined;
  evidenceIds?: string[] | undefined;
  factIds?: string[] | undefined;
  sourceIds?: string[] | undefined;
  assumptions?: string[] | undefined;
  conflicts?: string[] | undefined;
  toolSummary?: AgentSpecialistExecutionResult['toolSummary'] | undefined;
  cost?: Partial<AgentSpecialistExecutionResult['cost']> | undefined;
  proposedActions?: AgentSpecialistExecutionResult['proposedActions'] | undefined;
}

export interface DeterministicSpecialistHandlerContext {
  runId: string;
  contextReceiptId: string;
  workUnitId: string;
  jobRunId: string;
  workspaceId: string;
  correlationId: string;
  attempt: number;
  payload: AgentSpecialistWorkPayload;
  isCancellationRequested: () => Promise<boolean>;
  checkpoint(checkpointKey: string, data: Record<string, unknown>): Promise<string>;
  recordUsage(
    eventId: string,
    usage: {
      tokens: number;
      searches: number;
      apiCalls: number;
      credits: number;
      currencyMicros: number;
      runtimeMs: number;
    },
    metadata?: Record<string, unknown>,
  ): Promise<boolean>;
}

export type DeterministicSpecialistHandler = (
  context: DeterministicSpecialistHandlerContext,
) => Promise<DeterministicSpecialistResult>;

export interface DeterministicSpecialistRegistration {
  agentVersion: string;
  execute: DeterministicSpecialistHandler;
}

export interface DeterministicSpecialistRegistryOptions {
  pool: ReturnType<typeof createPgPool>;
  registryVersion: string;
  handlers: Readonly<Record<string, DeterministicSpecialistRegistration>>;
}

function assertRegistry(options: DeterministicSpecialistRegistryOptions): void {
  if (!options.registryVersion.trim() || options.registryVersion.length > 64) {
    throw new RangeError('Specialist handler registryVersion must be a non-empty version identifier.');
  }
  const entries = Object.entries(options.handlers);
  if (entries.length > 128) throw new RangeError('Specialist handler registry supports at most 128 handlers.');
  for (const [agentKey, registration] of entries) {
    if (!/^agent\.[a-z0-9_.-]+$/.test(agentKey) || agentKey === 'agent.control.orchestrator') {
      throw new RangeError(`Invalid deterministic specialist agent key: ${agentKey}.`);
    }
    if (!registration.agentVersion.trim() || registration.agentVersion.length > 64) {
      throw new RangeError(`Invalid deterministic specialist version for ${agentKey}.`);
    }
  }
}

function normalizedResult(result: DeterministicSpecialistResult): Record<string, unknown> {
  return {
    result: result.result,
    confidence: result.confidence,
    validationState: result.validationState,
    uncertainty: result.uncertainty ?? [],
    evidenceIds: result.evidenceIds ?? [],
    factIds: result.factIds ?? [],
    sourceIds: result.sourceIds ?? [],
    assumptions: result.assumptions ?? [],
    conflicts: result.conflicts ?? [],
    toolSummary: result.toolSummary ?? [],
    cost: {
      inputTokens: result.cost?.inputTokens ?? 0,
      outputTokens: result.cost?.outputTokens ?? 0,
      searches: result.cost?.searches ?? 0,
      apiCalls: result.cost?.apiCalls ?? 0,
      credits: result.cost?.credits ?? 0,
      currencyMicros: result.cost?.currencyMicros ?? 0,
    },
    proposedActions: result.proposedActions ?? [],
  };
}

function lifecycleTime(after: Date): Date {
  return new Date(Math.max(Date.now(), after.getTime() + 1));
}

async function transitionAttempt(
  options: DeterministicSpecialistRegistryOptions,
  input: {
    runId: string;
    workspaceId: string;
    fromStatus: 'queued' | 'running';
    toStatus: 'running' | 'failed' | 'cancelled' | 'budget_stopped' | 'review_required';
    phase: string;
    reasonCode: string;
    updatedAt: Date;
    metadata: Record<string, unknown>;
  },
): Promise<Date> {
  const occurredAt = lifecycleTime(input.updatedAt);
  await transitionAgentRun(options.pool, {
    transitionId: createAgentSpecialistTransitionId(input.runId, input.phase),
    workspaceId: input.workspaceId,
    runId: input.runId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reasonCode: input.reasonCode,
    actorType: 'worker',
    metadata: input.metadata,
    occurredAt,
  });
  return occurredAt;
}

function executionEffect(
  runId: string,
  contextReceiptId: string,
  payload: AgentSpecialistWorkPayload,
  attempt: number,
  result: AgentSpecialistExecutionResult,
): { effectKey: string; effectData: Record<string, unknown> } {
  return {
    effectKey: 'agent.execution.specialist.result',
    effectData: {
      kind: 'agent_specialist_execution_result',
      runId,
      contextReceiptId,
      dispatchId: payload.dispatchId,
      planId: payload.planId,
      stepKey: payload.stepKey,
      agentKey: payload.agentKey,
      agentVersion: payload.agentVersion,
      attempt,
      result,
    },
  };
}

function asPermanent(error: AgentSpecialistExecutionError): PermanentWorkError {
  return new PermanentWorkError(error.code, error.message);
}

function buildHandler(
  options: DeterministicSpecialistRegistryOptions,
  agentKey: string,
  registration: DeterministicSpecialistRegistration,
): WorkHandler {
  return async (workContext: WorkHandlerContext) => {
    let runId: string | null = null;
    let runStatus: 'queued' | 'running' | null = null;
    let runUpdatedAt: Date | null = null;
    let preparedPayload: AgentSpecialistWorkPayload | null = null;

    try {
      const prepared = await prepareAgentSpecialistAttempt(options.pool, {
        workspaceId: workContext.workspaceId,
        jobRunId: workContext.jobRunId,
        workUnitId: workContext.workUnitId,
        correlationId: workContext.correlationId,
        attempt: workContext.attempt,
        workType: workContext.workType,
        workVersion: workContext.workVersion,
        payload: workContext.payload,
      });
      preparedPayload = prepared.payload;

      if (prepared.payload.handlerRegistryVersion !== options.registryVersion) {
        throw new PermanentWorkError(
          'AGENT_SPECIALIST_REGISTRY_VERSION_MISMATCH',
          `WorkUnit requires handler registry ${prepared.payload.handlerRegistryVersion}, not ${options.registryVersion}.`,
        );
      }
      if (prepared.payload.agentKey !== agentKey || prepared.payload.agentVersion !== registration.agentVersion) {
        throw new PermanentWorkError(
          'AGENT_SPECIALIST_HANDLER_IDENTITY_MISMATCH',
          `Registered specialist handler does not match ${prepared.payload.agentKey}@${prepared.payload.agentVersion}.`,
        );
      }

      if (prepared.replayResult) {
        return executionEffect(
          prepared.runId,
          prepared.contextReceiptId,
          prepared.payload,
          workContext.attempt,
          prepared.replayResult,
        );
      }

      for (const abandoned of prepared.abandonedRuns) {
        await transitionAttempt(options, {
          runId: abandoned.runId,
          workspaceId: workContext.workspaceId,
          fromStatus: abandoned.status,
          toStatus: 'failed',
          phase: 'lease-recovery-failed',
          reasonCode: 'specialist_attempt_abandoned_after_lease',
          updatedAt: abandoned.updatedAt,
          metadata: {
            workUnitId: workContext.workUnitId,
            recoveredByAttempt: workContext.attempt,
          },
        });
      }

      runId = prepared.runId;
      runStatus = prepared.runStatus;
      runUpdatedAt = prepared.runUpdatedAt;

      if (await workContext.isCancellationRequested()) {
        runUpdatedAt = await transitionAttempt(options, {
          runId,
          workspaceId: workContext.workspaceId,
          fromStatus: runStatus,
          toStatus: 'cancelled',
          phase: 'cancelled-before-start',
          reasonCode: 'specialist_cancellation_requested',
          updatedAt: runUpdatedAt,
          metadata: { workUnitId: workContext.workUnitId, attempt: workContext.attempt },
        });
        runStatus = null;
        throw new CancelledWorkError();
      }

      if (runStatus === 'queued') {
        runUpdatedAt = await transitionAttempt(options, {
          runId,
          workspaceId: workContext.workspaceId,
          fromStatus: 'queued',
          toStatus: 'running',
          phase: 'start',
          reasonCode: 'specialist_execution_started',
          updatedAt: runUpdatedAt,
          metadata: { workUnitId: workContext.workUnitId, attempt: workContext.attempt },
        });
        runStatus = 'running';
      }

      const result = await registration.execute({
        runId,
        contextReceiptId: prepared.contextReceiptId,
        workUnitId: workContext.workUnitId,
        jobRunId: workContext.jobRunId,
        workspaceId: workContext.workspaceId,
        correlationId: workContext.correlationId,
        attempt: workContext.attempt,
        payload: prepared.payload,
        isCancellationRequested: workContext.isCancellationRequested,
        checkpoint: (checkpointKey, data) =>
          writeAgentExecutionCheckpoint(options.pool, {
            workspaceId: workContext.workspaceId,
            dispatchId: prepared.payload.dispatchId,
            stepKey: prepared.payload.stepKey,
            checkpointKey,
            data,
          }),
        recordUsage: (eventId, usage, metadata) =>
          recordAgentExecutionBudgetUsage(options.pool, {
            eventId,
            workspaceId: workContext.workspaceId,
            dispatchId: prepared.payload.dispatchId,
            stepKey: prepared.payload.stepKey,
            usage,
            ...(metadata ? { metadata } : {}),
            occurredAt: new Date(),
          }),
      });

      if (await workContext.isCancellationRequested()) {
        runUpdatedAt = await transitionAttempt(options, {
          runId,
          workspaceId: workContext.workspaceId,
          fromStatus: 'running',
          toStatus: 'cancelled',
          phase: 'cancelled-after-handler',
          reasonCode: 'specialist_cancellation_requested',
          updatedAt: runUpdatedAt,
          metadata: { workUnitId: workContext.workUnitId, attempt: workContext.attempt },
        });
        runStatus = null;
        throw new CancelledWorkError();
      }

      const completion = await completeAgentSpecialistAttempt(options.pool, {
        workspaceId: workContext.workspaceId,
        jobRunId: workContext.jobRunId,
        workUnitId: workContext.workUnitId,
        correlationId: workContext.correlationId,
        attempt: workContext.attempt,
        workType: workContext.workType,
        workVersion: workContext.workVersion,
        payload: workContext.payload,
        runId,
        result: normalizedResult(result),
        occurredAt: lifecycleTime(runUpdatedAt),
      });
      runStatus = null;
      return executionEffect(runId, prepared.contextReceiptId, prepared.payload, workContext.attempt, completion.result);
    } catch (error) {
      if (runId && runStatus && runUpdatedAt) {
        let target: 'failed' | 'cancelled' | 'budget_stopped' | 'review_required' = 'review_required';
        let reasonCode = 'specialist_execution_requires_review';
        if (error instanceof CancelledWorkError) {
          target = 'cancelled';
          reasonCode = 'specialist_execution_cancelled';
        } else if (error instanceof RetryableWorkError) {
          target = 'failed';
          reasonCode = 'specialist_retryable_failure';
        } else if (error instanceof AgentExecutionDispatchError && error.code === 'AGENT_DISPATCH_BUDGET_EXCEEDED') {
          target = 'budget_stopped';
          reasonCode = 'specialist_budget_stopped';
        }

        try {
          await transitionAttempt(options, {
            runId,
            workspaceId: workContext.workspaceId,
            fromStatus: runStatus,
            toStatus: target,
            phase: target,
            reasonCode,
            updatedAt: runUpdatedAt,
            metadata: {
              workUnitId: workContext.workUnitId,
              attempt: workContext.attempt,
              errorCode:
                error instanceof RetryableWorkError ||
                error instanceof PermanentWorkError ||
                error instanceof CancelledWorkError ||
                error instanceof AgentSpecialistExecutionError ||
                error instanceof AgentExecutionDispatchError
                  ? error.code
                  : 'UNCLASSIFIED_SPECIALIST_ERROR',
            },
          });
        } catch {
          // The canonical worker will still record the WorkUnit failure. The original error remains authoritative.
        }
      }

      if (error instanceof RetryableWorkError || error instanceof PermanentWorkError || error instanceof CancelledWorkError) {
        throw error;
      }
      if (error instanceof AgentSpecialistExecutionError) throw asPermanent(error);
      if (error instanceof AgentExecutionDispatchError) {
        throw new PermanentWorkError(error.code, error.message);
      }
      throw new PermanentWorkError('UNCLASSIFIED_SPECIALIST_ERROR');
    }
  };
}

export function createDeterministicSpecialistHandlers(
  options: DeterministicSpecialistRegistryOptions,
): Readonly<Record<string, WorkHandler>> {
  assertRegistry(options);
  return Object.fromEntries(
    Object.entries(options.handlers).map(([agentKey, registration]) => [
      agentKey,
      buildHandler(options, agentKey, registration),
    ]),
  );
}
