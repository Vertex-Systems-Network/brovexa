import {
  RESEARCH_ACQUISITION_SHARD_WORK_TYPE,
  getAcquisitionShard,
  getResearchJobControl,
  type PersistedAcquisitionShard,
  type PersistedResearchJobControl,
  type createPgPool,
} from '@brovexa/db';
import { CancelledWorkError, PermanentWorkError, RetryableWorkError } from './errors';
import type { WorkHandler, WorkHandlerContext } from './runtime';

export const ACQUISITION_SHARD_ORCHESTRATED_EFFECT = 'research.acquire.shard.orchestrated';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const sourceKeyPattern = /^source\.[a-z0-9_.-]+$/;

interface AcquisitionShardPayload {
  researchJobId: string;
  shardId: string;
  shardKey: string;
  ordinal: number;
  sourceKeys: string[];
  budget: Record<string, unknown>;
}

export interface AcquisitionShardRuntimePersistence {
  getShard(workspaceId: string, shardId: string): Promise<PersistedAcquisitionShard | null>;
  getControl(workspaceId: string, researchJobId: string): Promise<PersistedResearchJobControl | null>;
}

export interface AcquisitionShardExecutionContext {
  workspaceId: string;
  researchJobId: string;
  shardId: string;
  shardKey: string;
  ordinal: number;
  sourceKeys: readonly string[];
  budget: PersistedAcquisitionShard['budget'];
  workUnitId: string;
  jobRunId: string;
  correlationId: string;
  attempt: number;
  /**
   * Must be called immediately before creating or dispatching each child unit.
   * It fails closed when the research job is paused, cancelled, killed, or the
   * canonical work unit has received a cancellation request.
   */
  assertMayDispatch(): Promise<void>;
  isCancellationRequested(): Promise<boolean>;
}

export interface AcquisitionShardExecutorOutcome {
  effectData?: Record<string, unknown>;
}

export interface AcquisitionShardExecutorRegistration {
  /**
   * M02A remains provider-neutral. Real provider/network activation is a
   * separate gate and cannot be enabled by this orchestration slice.
   */
  networkAccess: 'none';
  execute(context: AcquisitionShardExecutionContext): Promise<AcquisitionShardExecutorOutcome>;
}

export interface AcquisitionShardHandlerOptions {
  persistence: AcquisitionShardRuntimePersistence;
  executor: AcquisitionShardExecutorRegistration;
}

export interface AcquisitionShardRegistryOptions {
  pool: ReturnType<typeof createPgPool>;
  executor: AcquisitionShardExecutorRegistration;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function semanticallyEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function readPayload(context: WorkHandlerContext): AcquisitionShardPayload {
  const payload = context.payload;
  const sourceKeys = payload.sourceKeys;
  if (
    context.workType !== RESEARCH_ACQUISITION_SHARD_WORK_TYPE ||
    context.workVersion !== 1 ||
    typeof payload.researchJobId !== 'string' ||
    !identifierPattern.test(payload.researchJobId) ||
    typeof payload.shardId !== 'string' ||
    !identifierPattern.test(payload.shardId) ||
    typeof payload.shardKey !== 'string' ||
    !identifierPattern.test(payload.shardKey) ||
    !Number.isSafeInteger(payload.ordinal) ||
    Number(payload.ordinal) < 0 ||
    !Array.isArray(sourceKeys) ||
    sourceKeys.length === 0 ||
    sourceKeys.length > 512 ||
    sourceKeys.some((value) => typeof value !== 'string' || !sourceKeyPattern.test(value)) ||
    new Set(sourceKeys).size !== sourceKeys.length ||
    !isRecord(payload.budget)
  ) {
    throw new PermanentWorkError('ACQUISITION_SHARD_PAYLOAD_INVALID');
  }

  return {
    researchJobId: payload.researchJobId,
    shardId: payload.shardId,
    shardKey: payload.shardKey,
    ordinal: Number(payload.ordinal),
    sourceKeys: [...sourceKeys] as string[],
    budget: payload.budget,
  };
}

function assertShardBinding(
  context: WorkHandlerContext,
  payload: AcquisitionShardPayload,
  shard: PersistedAcquisitionShard,
): void {
  if (
    shard.workspaceId !== context.workspaceId ||
    shard.researchJobId !== payload.researchJobId ||
    shard.id !== payload.shardId ||
    shard.shardKey !== payload.shardKey ||
    shard.ordinal !== payload.ordinal ||
    shard.jobRunId !== context.jobRunId ||
    shard.workUnitId !== context.workUnitId ||
    shard.correlationId !== context.correlationId ||
    !semanticallyEqual(shard.sourceKeys, payload.sourceKeys) ||
    !semanticallyEqual(shard.budget, payload.budget)
  ) {
    throw new PermanentWorkError('ACQUISITION_SHARD_BINDING_MISMATCH');
  }
}

function assertControlIdentity(
  workspaceId: string,
  researchJobId: string,
  control: PersistedResearchJobControl | null,
): PersistedResearchJobControl {
  if (!control) throw new PermanentWorkError('ACQUISITION_CONTROL_NOT_FOUND');
  if (control.workspaceId !== workspaceId || control.researchJobId !== researchJobId) {
    throw new PermanentWorkError('ACQUISITION_CONTROL_IDENTITY_MISMATCH');
  }
  return control;
}

function assertDispatchableControl(control: PersistedResearchJobControl): void {
  if (control.state === 'active') return;
  if (control.state === 'paused') {
    throw new RetryableWorkError(
      'ACQUISITION_CONTROL_PAUSED',
      'Acquisition dispatch is paused; canonical recovery will retry after resume.',
    );
  }
  if (control.state === 'cancelled') {
    throw new CancelledWorkError('ACQUISITION_CONTROL_CANCELLED');
  }
  throw new CancelledWorkError('ACQUISITION_CONTROL_KILLED');
}

function assertExecutor(executor: AcquisitionShardExecutorRegistration): void {
  if (!executor || executor.networkAccess !== 'none' || typeof executor.execute !== 'function') {
    throw new RangeError('Acquisition shard executor must be an injected no-network registration.');
  }
}

export function createDatabaseAcquisitionShardPersistence(
  pool: ReturnType<typeof createPgPool>,
): AcquisitionShardRuntimePersistence {
  return {
    getShard: (workspaceId, shardId) => getAcquisitionShard(pool, workspaceId, shardId),
    getControl: (workspaceId, researchJobId) => getResearchJobControl(pool, workspaceId, researchJobId),
  };
}

export function createAcquisitionShardHandler(options: AcquisitionShardHandlerOptions): WorkHandler {
  assertExecutor(options.executor);

  return async (workContext) => {
    const payload = readPayload(workContext);
    const shard = await options.persistence.getShard(workContext.workspaceId, payload.shardId);
    if (!shard) throw new PermanentWorkError('ACQUISITION_SHARD_NOT_FOUND');
    assertShardBinding(workContext, payload, shard);

    const assertMayDispatch = async (): Promise<void> => {
      if (await workContext.isCancellationRequested()) throw new CancelledWorkError();
      const control = assertControlIdentity(
        workContext.workspaceId,
        payload.researchJobId,
        await options.persistence.getControl(workContext.workspaceId, payload.researchJobId),
      );
      assertDispatchableControl(control);
      if (await workContext.isCancellationRequested()) throw new CancelledWorkError();
    };

    await assertMayDispatch();

    const outcome = await options.executor.execute({
      workspaceId: workContext.workspaceId,
      researchJobId: payload.researchJobId,
      shardId: payload.shardId,
      shardKey: payload.shardKey,
      ordinal: payload.ordinal,
      sourceKeys: [...shard.sourceKeys],
      budget: shard.budget,
      workUnitId: workContext.workUnitId,
      jobRunId: workContext.jobRunId,
      correlationId: workContext.correlationId,
      attempt: workContext.attempt,
      assertMayDispatch,
      isCancellationRequested: workContext.isCancellationRequested,
    });

    if (await workContext.isCancellationRequested()) throw new CancelledWorkError();
    if (outcome.effectData !== undefined && !isRecord(outcome.effectData)) {
      throw new PermanentWorkError('ACQUISITION_SHARD_EFFECT_INVALID');
    }

    return {
      effectKey: ACQUISITION_SHARD_ORCHESTRATED_EFFECT,
      effectData: {
        ...(outcome.effectData ?? {}),
        kind: 'research_acquisition_shard_orchestrated',
        researchJobId: payload.researchJobId,
        shardId: payload.shardId,
        shardKey: payload.shardKey,
        ordinal: payload.ordinal,
      },
    };
  };
}

export function createAcquisitionShardHandlers(
  options: AcquisitionShardRegistryOptions,
): Readonly<Record<string, WorkHandler>> {
  assertExecutor(options.executor);
  return {
    [RESEARCH_ACQUISITION_SHARD_WORK_TYPE]: createAcquisitionShardHandler({
      persistence: createDatabaseAcquisitionShardPersistence(options.pool),
      executor: options.executor,
    }),
  };
}
