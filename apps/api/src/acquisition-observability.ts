import {
  getAcquisitionProgress,
  getAcquisitionShard,
  getResearchJob,
  getResearchJobControl,
  type AcquisitionProgressCheckpoint,
  type PersistedAcquisitionShard,
  type PersistedResearchJob,
  type PersistedResearchJobControl,
  type ResearchAcquisitionBudget,
  type createPgPool,
} from '@brovexa/db';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const maxObservedShards = 512;

export type AcquisitionObservabilityErrorCode =
  | 'ACQUISITION_OBSERVABILITY_INPUT_INVALID'
  | 'ACQUISITION_OBSERVABILITY_JOB_NOT_FOUND'
  | 'ACQUISITION_OBSERVABILITY_CONTROL_NOT_FOUND'
  | 'ACQUISITION_OBSERVABILITY_CONTROL_IDENTITY_MISMATCH'
  | 'ACQUISITION_OBSERVABILITY_SHARD_NOT_FOUND'
  | 'ACQUISITION_OBSERVABILITY_SHARD_IDENTITY_MISMATCH'
  | 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT'
  | 'ACQUISITION_OBSERVABILITY_PROGRESS_CORRUPT'
  | 'ACQUISITION_OBSERVABILITY_OVERFLOW';

export class AcquisitionObservabilityError extends Error {
  constructor(
    readonly code: AcquisitionObservabilityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AcquisitionObservabilityError';
  }
}

export interface AcquisitionObservabilityPersistence {
  getJob(workspaceId: string, researchJobId: string): Promise<PersistedResearchJob | null>;
  getControl(workspaceId: string, researchJobId: string): Promise<PersistedResearchJobControl | null>;
  getShard(workspaceId: string, shardId: string): Promise<PersistedAcquisitionShard | null>;
  getProgress(workspaceId: string, shardId: string): Promise<AcquisitionProgressCheckpoint | null>;
}

export interface ReadAcquisitionObservationInput {
  workspaceId: string;
  researchJobId: string;
  shardIds: readonly string[];
}

export interface AcquisitionExactProgress {
  shardsObserved: number;
  shardsCheckpointed: number;
  shardsTerminal: number;
  completedUnits: number;
  failedUnits: number;
  returnedRecords: number;
  requests: number;
  pages: number;
  bytes: number;
  currencyMicros: number;
  runtimeMs: number;
}

export interface AcquisitionBudgetUsage {
  limits: {
    businesses: number;
    requests: number;
    pages: number;
    bytes: number;
    currencyMicros: number;
    runtimeMs: number;
    maxConcurrency: number;
  };
  used: {
    businesses: number;
    requests: number;
    pages: number;
    bytes: number;
    currencyMicros: number;
    runtimeMs: number;
  };
  remaining: {
    businesses: number;
    requests: number;
    pages: number;
    bytes: number;
    currencyMicros: number;
    runtimeMs: number;
  };
  exhausted: {
    businesses: boolean;
    requests: boolean;
    pages: boolean;
    bytes: boolean;
    currencyMicros: boolean;
    runtimeMs: boolean;
  };
}

export type AcquisitionUtilizationBucket = '0' | 'lt25' | '25_49' | '50_74' | '75_99' | '100';

export interface RedactedAcquisitionTelemetry {
  controlState: PersistedResearchJobControl['state'];
  shardCountBucket: '0' | '1' | '2_4' | '5_9' | '10_plus';
  checkpointCoverage: 'none' | 'partial' | 'all';
  terminalCoverage: 'none' | 'partial' | 'all';
  hasFailures: boolean;
  utilization: {
    businesses: AcquisitionUtilizationBucket;
    requests: AcquisitionUtilizationBucket;
    pages: AcquisitionUtilizationBucket;
    bytes: AcquisitionUtilizationBucket;
    currencyMicros: AcquisitionUtilizationBucket;
    runtimeMs: AcquisitionUtilizationBucket;
  };
}

export interface AcquisitionObservation {
  controlState: PersistedResearchJobControl['state'];
  progress: AcquisitionExactProgress;
  budget: AcquisitionBudgetUsage;
  telemetry: RedactedAcquisitionTelemetry;
}

interface UsageVector {
  businesses: number;
  requests: number;
  pages: number;
  bytes: number;
  currencyMicros: number;
  runtimeMs: number;
}

function error(code: AcquisitionObservabilityErrorCode, message: string): AcquisitionObservabilityError {
  return new AcquisitionObservabilityError(code, message);
}

function assertIdentifier(value: string, field: string): void {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    throw error('ACQUISITION_OBSERVABILITY_INPUT_INVALID', `${field} must use the canonical identifier format.`);
  }
}

function normalizeShardIds(values: readonly string[]): string[] {
  if (!Array.isArray(values) || values.length > maxObservedShards) {
    throw error(
      'ACQUISITION_OBSERVABILITY_INPUT_INVALID',
      `shardIds must contain at most ${maxObservedShards} entries.`,
    );
  }
  const normalized = values.map((value) => {
    assertIdentifier(value, 'shardIds');
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw error('ACQUISITION_OBSERVABILITY_INPUT_INVALID', 'shardIds must not contain duplicates.');
  }
  return normalized;
}

function assertSafeNonNegative(value: number, field: string, code: AcquisitionObservabilityErrorCode): void {
  if (!Number.isSafeInteger(value) || value < 0) throw error(code, `${field} must be a non-negative safe integer.`);
}

function validateBudget(budget: ResearchAcquisitionBudget, field: string): void {
  assertSafeNonNegative(budget.maxBusinesses, `${field}.maxBusinesses`, 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT');
  assertSafeNonNegative(budget.maxRequests, `${field}.maxRequests`, 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT');
  assertSafeNonNegative(budget.maxPages, `${field}.maxPages`, 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT');
  assertSafeNonNegative(budget.maxBytes, `${field}.maxBytes`, 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT');
  assertSafeNonNegative(budget.maxCurrencyMicros, `${field}.maxCurrencyMicros`, 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT');
  assertSafeNonNegative(budget.maxRuntimeMs, `${field}.maxRuntimeMs`, 'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT');
  if (!Number.isSafeInteger(budget.maxConcurrency) || budget.maxConcurrency < 1) {
    throw error('ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT', `${field}.maxConcurrency must be a positive safe integer.`);
  }
}

function validateProgress(progress: AcquisitionProgressCheckpoint, shardId: string): void {
  assertSafeNonNegative(progress.version, `${shardId}.version`, 'ACQUISITION_OBSERVABILITY_PROGRESS_CORRUPT');
  if (progress.version < 1 || !progress.observedAt || Number.isNaN(Date.parse(progress.observedAt))) {
    throw error('ACQUISITION_OBSERVABILITY_PROGRESS_CORRUPT', `Progress checkpoint for ${shardId} has invalid metadata.`);
  }
  const fields: readonly (keyof Pick<
    AcquisitionProgressCheckpoint,
    'completedUnits' | 'failedUnits' | 'returnedRecords' | 'requests' | 'pages' | 'bytes' | 'currencyMicros' | 'runtimeMs'
  >)[] = [
    'completedUnits',
    'failedUnits',
    'returnedRecords',
    'requests',
    'pages',
    'bytes',
    'currencyMicros',
    'runtimeMs',
  ];
  for (const field of fields) {
    assertSafeNonNegative(progress[field], `${shardId}.${field}`, 'ACQUISITION_OBSERVABILITY_PROGRESS_CORRUPT');
  }
}

function checkedAdd(left: number, right: number, field: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) {
    throw error('ACQUISITION_OBSERVABILITY_OVERFLOW', `${field} exceeds the safe integer range.`);
  }
  return value;
}

function emptyProgress(shardsObserved: number): AcquisitionExactProgress {
  return {
    shardsObserved,
    shardsCheckpointed: 0,
    shardsTerminal: 0,
    completedUnits: 0,
    failedUnits: 0,
    returnedRecords: 0,
    requests: 0,
    pages: 0,
    bytes: 0,
    currencyMicros: 0,
    runtimeMs: 0,
  };
}

function progressUsage(progress: AcquisitionProgressCheckpoint): UsageVector {
  return {
    businesses: progress.returnedRecords,
    requests: progress.requests,
    pages: progress.pages,
    bytes: progress.bytes,
    currencyMicros: progress.currencyMicros,
    runtimeMs: progress.runtimeMs,
  };
}

function budgetLimits(budget: ResearchAcquisitionBudget): UsageVector {
  return {
    businesses: budget.maxBusinesses,
    requests: budget.maxRequests,
    pages: budget.maxPages,
    bytes: budget.maxBytes,
    currencyMicros: budget.maxCurrencyMicros,
    runtimeMs: budget.maxRuntimeMs,
  };
}

function assertWithinBudget(usage: UsageVector, budget: ResearchAcquisitionBudget, scope: string): void {
  const limits = budgetLimits(budget);
  for (const field of Object.keys(usage) as (keyof UsageVector)[]) {
    if (usage[field] > limits[field]) {
      throw error(
        'ACQUISITION_OBSERVABILITY_BUDGET_CORRUPT',
        `${scope}.${field} exceeds its canonical persisted budget.`,
      );
    }
  }
}

function addCheckpoint(target: AcquisitionExactProgress, checkpoint: AcquisitionProgressCheckpoint): void {
  target.shardsCheckpointed = checkedAdd(target.shardsCheckpointed, 1, 'shardsCheckpointed');
  if (checkpoint.terminal) target.shardsTerminal = checkedAdd(target.shardsTerminal, 1, 'shardsTerminal');
  target.completedUnits = checkedAdd(target.completedUnits, checkpoint.completedUnits, 'completedUnits');
  target.failedUnits = checkedAdd(target.failedUnits, checkpoint.failedUnits, 'failedUnits');
  target.returnedRecords = checkedAdd(target.returnedRecords, checkpoint.returnedRecords, 'returnedRecords');
  target.requests = checkedAdd(target.requests, checkpoint.requests, 'requests');
  target.pages = checkedAdd(target.pages, checkpoint.pages, 'pages');
  target.bytes = checkedAdd(target.bytes, checkpoint.bytes, 'bytes');
  target.currencyMicros = checkedAdd(target.currencyMicros, checkpoint.currencyMicros, 'currencyMicros');
  target.runtimeMs = checkedAdd(target.runtimeMs, checkpoint.runtimeMs, 'runtimeMs');
}

function usageFromProgress(progress: AcquisitionExactProgress): UsageVector {
  return {
    businesses: progress.returnedRecords,
    requests: progress.requests,
    pages: progress.pages,
    bytes: progress.bytes,
    currencyMicros: progress.currencyMicros,
    runtimeMs: progress.runtimeMs,
  };
}

function buildBudgetUsage(budget: ResearchAcquisitionBudget, usage: UsageVector): AcquisitionBudgetUsage {
  assertWithinBudget(usage, budget, 'researchJob');
  const limits = budgetLimits(budget);
  return {
    limits: {
      ...limits,
      maxConcurrency: budget.maxConcurrency,
    },
    used: { ...usage },
    remaining: {
      businesses: limits.businesses - usage.businesses,
      requests: limits.requests - usage.requests,
      pages: limits.pages - usage.pages,
      bytes: limits.bytes - usage.bytes,
      currencyMicros: limits.currencyMicros - usage.currencyMicros,
      runtimeMs: limits.runtimeMs - usage.runtimeMs,
    },
    exhausted: {
      businesses: usage.businesses === limits.businesses,
      requests: usage.requests === limits.requests,
      pages: usage.pages === limits.pages,
      bytes: usage.bytes === limits.bytes,
      currencyMicros: usage.currencyMicros === limits.currencyMicros,
      runtimeMs: usage.runtimeMs === limits.runtimeMs,
    },
  };
}

function countBucket(count: number): RedactedAcquisitionTelemetry['shardCountBucket'] {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 4) return '2_4';
  if (count <= 9) return '5_9';
  return '10_plus';
}

function coverageBucket(count: number, total: number): RedactedAcquisitionTelemetry['checkpointCoverage'] {
  if (total === 0 || count === 0) return 'none';
  return count >= total ? 'all' : 'partial';
}

function utilizationBucket(used: number, limit: number): AcquisitionUtilizationBucket {
  if (used === 0) return '0';
  if (limit === 0) return '100';
  const basisPoints = Math.floor((used * 10_000) / limit);
  if (basisPoints < 2_500) return 'lt25';
  if (basisPoints < 5_000) return '25_49';
  if (basisPoints < 7_500) return '50_74';
  if (basisPoints < 10_000) return '75_99';
  return '100';
}

function buildTelemetry(
  control: PersistedResearchJobControl,
  progress: AcquisitionExactProgress,
  budget: AcquisitionBudgetUsage,
): RedactedAcquisitionTelemetry {
  return {
    controlState: control.state,
    shardCountBucket: countBucket(progress.shardsObserved),
    checkpointCoverage: coverageBucket(progress.shardsCheckpointed, progress.shardsObserved),
    terminalCoverage: coverageBucket(progress.shardsTerminal, progress.shardsObserved),
    hasFailures: progress.failedUnits > 0,
    utilization: {
      businesses: utilizationBucket(budget.used.businesses, budget.limits.businesses),
      requests: utilizationBucket(budget.used.requests, budget.limits.requests),
      pages: utilizationBucket(budget.used.pages, budget.limits.pages),
      bytes: utilizationBucket(budget.used.bytes, budget.limits.bytes),
      currencyMicros: utilizationBucket(budget.used.currencyMicros, budget.limits.currencyMicros),
      runtimeMs: utilizationBucket(budget.used.runtimeMs, budget.limits.runtimeMs),
    },
  };
}

function assertControlIdentity(
  job: PersistedResearchJob,
  control: PersistedResearchJobControl,
): void {
  if (control.workspaceId !== job.workspaceId || control.researchJobId !== job.id) {
    throw error(
      'ACQUISITION_OBSERVABILITY_CONTROL_IDENTITY_MISMATCH',
      'Research-job control identity does not match the persisted research job.',
    );
  }
}

function assertShardIdentity(job: PersistedResearchJob, shard: PersistedAcquisitionShard): void {
  if (
    shard.workspaceId !== job.workspaceId ||
    shard.researchJobId !== job.id ||
    shard.jobRunId !== job.jobRunId
  ) {
    throw error(
      'ACQUISITION_OBSERVABILITY_SHARD_IDENTITY_MISMATCH',
      'Acquisition shard identity does not match the persisted research job.',
    );
  }
}

export function createAcquisitionObservabilityPersistence(
  pool: ReturnType<typeof createPgPool>,
): AcquisitionObservabilityPersistence {
  return {
    getJob: (workspaceId, researchJobId) => getResearchJob(pool, workspaceId, researchJobId),
    getControl: (workspaceId, researchJobId) => getResearchJobControl(pool, workspaceId, researchJobId),
    getShard: (workspaceId, shardId) => getAcquisitionShard(pool, workspaceId, shardId),
    getProgress: (workspaceId, shardId) => getAcquisitionProgress(pool, workspaceId, shardId),
  };
}

export async function readAcquisitionObservation(
  input: ReadAcquisitionObservationInput,
  persistence: AcquisitionObservabilityPersistence,
): Promise<AcquisitionObservation> {
  assertIdentifier(input.workspaceId, 'workspaceId');
  assertIdentifier(input.researchJobId, 'researchJobId');
  const shardIds = normalizeShardIds(input.shardIds);

  const job = await persistence.getJob(input.workspaceId, input.researchJobId);
  if (!job) throw error('ACQUISITION_OBSERVABILITY_JOB_NOT_FOUND', 'Research job was not found.');
  if (job.workspaceId !== input.workspaceId || job.id !== input.researchJobId) {
    throw error('ACQUISITION_OBSERVABILITY_JOB_NOT_FOUND', 'Research job lookup returned an unexpected identity.');
  }
  validateBudget(job.budget, 'researchJob.budget');

  const control = await persistence.getControl(input.workspaceId, input.researchJobId);
  if (!control) throw error('ACQUISITION_OBSERVABILITY_CONTROL_NOT_FOUND', 'Research-job control was not found.');
  assertControlIdentity(job, control);

  const progress = emptyProgress(shardIds.length);
  for (const shardId of shardIds) {
    const shard = await persistence.getShard(input.workspaceId, shardId);
    if (!shard) throw error('ACQUISITION_OBSERVABILITY_SHARD_NOT_FOUND', 'An acquisition shard was not found.');
    assertShardIdentity(job, shard);
    validateBudget(shard.budget, 'acquisitionShard.budget');

    const checkpoint = await persistence.getProgress(input.workspaceId, shardId);
    if (!checkpoint) continue;
    validateProgress(checkpoint, shardId);
    assertWithinBudget(progressUsage(checkpoint), shard.budget, 'acquisitionShard');
    addCheckpoint(progress, checkpoint);
  }

  const budget = buildBudgetUsage(job.budget, usageFromProgress(progress));
  return {
    controlState: control.state,
    progress,
    budget,
    telemetry: buildTelemetry(control, progress, budget),
  };
}
