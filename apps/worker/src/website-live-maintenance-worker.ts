import { createHash } from 'node:crypto';
import { purgeExpiredWebsiteLiveInspectionEvidenceForWork, type createPgPool } from '@brovexa/db';
import { CancelledWorkError, PermanentWorkError, RetryableWorkError } from './errors';
import { awaitM04LiveStage, M04LiveAsyncBoundaryError } from './website-live-async-boundary';
import type { WorkHandler, WorkHandlerContext } from './runtime';

/** Opt-in and tenant-scoped expiry maintenance; never auto-register or start a queue. */
export const M04_LIVE_RETENTION_WORK_TYPE = 'website_inspection_live_retention_v2';
export const M04_LIVE_RETENTION_WORK_VERSION = 2;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface M04LiveRetentionWorkerDependencies {
  readonly enabled: true;
  readonly pool: ReturnType<typeof createPgPool>;
  /** Independent maintenance-role authorization: never a queue payload boolean. */
  readonly authorizeWorkspaceMaintenance: (workspaceId: string) => Promise<boolean>;
  /** How many expired rows a work unit may purge (1..500). */
  readonly maxRows?: number;
  readonly stageTimeoutMs?: number;
}

function maintenancePayloadValid(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  try {
    const keys = Reflect.ownKeys(payload);
    const descriptor = Object.getOwnPropertyDescriptor(payload, 'kind');
    return keys.length === 1 && keys[0] === 'kind' &&
      descriptor !== undefined && 'value' in descriptor &&
      descriptor.value === 'website_live_retention_v2';
  } catch { return false; }
}

/** The canonical worker supplies the claimed workspace; no tenant ID is accepted from payload. */
export function createM04LiveRetentionWorkerHandlers(
  deps: M04LiveRetentionWorkerDependencies,
): Readonly<Record<typeof M04_LIVE_RETENTION_WORK_TYPE, WorkHandler>> {
  if (deps.enabled !== true || !deps.pool || typeof deps.pool.connect !== 'function' ||
      typeof deps.authorizeWorkspaceMaintenance !== 'function') {
    throw new RangeError('M04 retention needs an explicitly authorized maintenance role and DB pool.');
  }
  const maxRows = deps.maxRows ?? 100;
  const timeoutMs = deps.stageTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 500 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
    throw new RangeError('M04 retention limits must be bounded.');
  }
  const handler: WorkHandler = async (context: WorkHandlerContext) => {
    if (context.workType !== M04_LIVE_RETENTION_WORK_TYPE ||
        context.workVersion !== M04_LIVE_RETENTION_WORK_VERSION ||
        !uuid.test(context.workspaceId) ||
        typeof context.workUnitId !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(context.workUnitId) ||
        !maintenancePayloadValid(context.payload)) {
      throw new PermanentWorkError('M04_LIVE_RETENTION_WORK_INVALID');
    }
    const workspaceId = context.workspaceId;
    const checkCancellation = async (): Promise<void> => {
      const requested = await awaitM04LiveStage(context.isCancellationRequested, { timeoutMs });
      if (requested) throw new CancelledWorkError('M04_LIVE_RETENTION_CANCELLED');
    };
    try {
      await checkCancellation();
      const authorized = await awaitM04LiveStage(
        () => deps.authorizeWorkspaceMaintenance(workspaceId), { timeoutMs },
      );
      if (authorized !== true) throw new PermanentWorkError('M04_LIVE_RETENTION_UNAUTHORIZED');
      await checkCancellation();
      // Commit fence only: once PostgreSQL begins, wait for its actual acknowledgement.
      const acknowledgement = await purgeExpiredWebsiteLiveInspectionEvidenceForWork(
        deps.pool, workspaceId, context.workUnitId, maxRows,
      );
      // The deletion and durable receipt have already COMMITted. Return the
      // same work effect on retry; never try to compensate by deleting again.
      const deleted = acknowledgement.deleted;
      await checkCancellation();
      if (!Number.isSafeInteger(deleted) || deleted < 0 || deleted > maxRows) {
        throw new RetryableWorkError('M04_LIVE_RETENTION_ACK_INVALID');
      }
      const digest = createHash('sha256').update(JSON.stringify([
        workspaceId, context.workUnitId, M04_LIVE_RETENTION_WORK_VERSION,
      ])).digest('hex');
      return {
        effectKey: `m04.website_live_retention.${digest}`,
        effectData: { workspaceId, deleted, maxRows, version: '2.0.0' },
      };
    } catch (error) {
      if (error instanceof M04LiveAsyncBoundaryError) {
        throw new RetryableWorkError('M04_LIVE_RETENTION_DEPENDENCY_TIMEOUT');
      }
      const code = error instanceof Error
        ? Object.getOwnPropertyDescriptor(error, 'code')?.value : undefined;
      if(code==='M04_LIVE_DB_ID_CONFLICT')
        throw new PermanentWorkError('M04_LIVE_RETENTION_WORK_SCOPE_CONFLICT');
      if (typeof code === 'string' && new Set([
        '08000','08001','08003','08006','40001','40P01','53300','57P01',
      ]).has(code)) {
        throw new RetryableWorkError('M04_LIVE_RETENTION_TRANSIENT_DB');
      }
      throw error;
    }
  };
  return Object.freeze({ [M04_LIVE_RETENTION_WORK_TYPE]: handler });
}