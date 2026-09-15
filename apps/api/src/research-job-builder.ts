import {
  ResearchJobSpecSchema,
  evaluateResearchJobPreflight,
  type ResearchJobPreflightDecision,
  type ResearchJobSpec,
} from '@brovexa/contracts';
import {
  createResearchJob,
  persistResearchJobPreflight,
  type CreateResearchJobInput,
  type CreateResearchJobResult,
  type PersistResearchJobPreflightInput,
  type PersistResearchJobPreflightResult,
  type ResearchAcquisitionBudget,
  type createPgPool,
} from '@brovexa/db';

export type ResearchJobBuilderErrorCode =
  | 'RESEARCH_JOB_BUILDER_INPUT_INVALID'
  | 'RESEARCH_JOB_BUILDER_CONTRACT_PREFLIGHT_DENIED'
  | 'RESEARCH_JOB_BUILDER_PERSISTED_PREFLIGHT_DENIED'
  | 'RESEARCH_JOB_BUILDER_PREFLIGHT_IDENTITY_MISMATCH'
  | 'RESEARCH_JOB_BUILDER_PREFLIGHT_BUDGET_EXCEEDED'
  | 'RESEARCH_JOB_BUILDER_RESULT_IDENTITY_MISMATCH';

export class ResearchJobBuilderError extends Error {
  constructor(
    readonly code: ResearchJobBuilderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ResearchJobBuilderError';
  }
}

export interface BuildResearchJobInput {
  job: unknown;
  preflightId: string;
  preflightIdempotencyKey: string;
  admissionSnapshotIds: readonly string[];
  researchJobIdempotencyKey: string;
  availableSourceKeys: readonly string[];
  blockedSourceKeys: readonly string[];
  reviewRequiredSourceKeys: readonly string[];
  createdAt: Date;
}

export interface ResearchJobBuilderPersistence {
  persistPreflight(input: PersistResearchJobPreflightInput): Promise<PersistResearchJobPreflightResult>;
  createJob(input: CreateResearchJobInput): Promise<CreateResearchJobResult>;
}

export interface BuildResearchJobResult {
  job: ResearchJobSpec;
  contractPreflight: ResearchJobPreflightDecision;
  persistedPreflight: PersistResearchJobPreflightResult;
  persistedJob: CreateResearchJobResult;
}

type DatabasePool = ReturnType<typeof createPgPool>;

type SourceBudget = ResearchJobSpec['budget'];
type PersistedPreflightBudget = PersistResearchJobPreflightResult['envelope']['aggregateBudget'];

function builderError(code: ResearchJobBuilderErrorCode, message: string): ResearchJobBuilderError {
  return new ResearchJobBuilderError(code, message);
}

function parseJob(rawJob: unknown): ResearchJobSpec {
  const parsed = ResearchJobSpecSchema.safeParse(rawJob);
  if (!parsed.success) {
    throw builderError(
      'RESEARCH_JOB_BUILDER_INPUT_INVALID',
      `Research job specification is invalid: ${parsed.error.issues[0]?.message ?? 'unknown validation failure'}`,
    );
  }
  return parsed.data;
}

function preflightBudgetWithin(parent: SourceBudget, child: PersistedPreflightBudget): boolean {
  return child.maxRequests <= parent.maxRequests
    && child.maxPages <= parent.maxPages
    && child.maxBytes <= parent.maxBytes
    && child.maxCurrencyMicros <= parent.maxCurrencyMicros
    && child.maxRuntimeMs <= parent.maxRuntimeMs
    && child.maxConcurrency <= parent.maxConcurrency;
}

function toPersistenceBudget(job: ResearchJobSpec): ResearchAcquisitionBudget {
  return {
    maxBusinesses: job.output.maximumBusinesses,
    maxRequests: job.budget.maxRequests,
    maxPages: job.budget.maxPages,
    maxBytes: job.budget.maxBytes,
    maxCurrencyMicros: job.budget.maxCurrencyMicros,
    maxRuntimeMs: job.budget.maxRuntimeMs,
    maxConcurrency: job.budget.maxConcurrency,
  };
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertPersistedPreflight(
  input: BuildResearchJobInput,
  job: ResearchJobSpec,
  persisted: PersistResearchJobPreflightResult,
): void {
  const envelope = persisted.envelope;
  if (
    persisted.id !== input.preflightId
    || envelope.id !== input.preflightId
    || envelope.workspaceId !== job.workspaceId
    || envelope.researchJobId !== job.researchJobId
    || envelope.idempotencyKey !== input.preflightIdempotencyKey
    || !arraysEqual(envelope.admissionSnapshotIds, input.admissionSnapshotIds)
  ) {
    throw builderError(
      'RESEARCH_JOB_BUILDER_PREFLIGHT_IDENTITY_MISMATCH',
      'Persisted preflight identity does not match the requested research job build.',
    );
  }

  if (envelope.decision !== 'allow') {
    throw builderError(
      'RESEARCH_JOB_BUILDER_PERSISTED_PREFLIGHT_DENIED',
      `Persisted research-job preflight is ${envelope.decision}; job materialization remains fail-closed.`,
    );
  }

  if (!preflightBudgetWithin(job.budget, envelope.aggregateBudget)) {
    throw builderError(
      'RESEARCH_JOB_BUILDER_PREFLIGHT_BUDGET_EXCEEDED',
      'Persisted preflight aggregate budget exceeds the enclosing research-job budget.',
    );
  }
}

function assertPersistedJob(
  input: BuildResearchJobInput,
  job: ResearchJobSpec,
  persisted: CreateResearchJobResult,
): void {
  const record = persisted.researchJob;
  if (
    record.id !== job.researchJobId
    || record.workspaceId !== job.workspaceId
    || record.preflightId !== input.preflightId
    || !arraysEqual(record.approvedSourceKeys, job.approvedSourceKeys)
  ) {
    throw builderError(
      'RESEARCH_JOB_BUILDER_RESULT_IDENTITY_MISMATCH',
      'Persisted research-job identity does not match the validated builder input.',
    );
  }
}

export function createResearchJobBuilderPersistence(pool: DatabasePool): ResearchJobBuilderPersistence {
  return {
    persistPreflight: (input) => persistResearchJobPreflight(pool, input),
    createJob: (input) => createResearchJob(pool, input),
  };
}

export async function buildResearchJob(
  input: BuildResearchJobInput,
  persistence: ResearchJobBuilderPersistence,
): Promise<BuildResearchJobResult> {
  const job = parseJob(input.job);
  const contractPreflight = evaluateResearchJobPreflight({
    job,
    availableSourceKeys: [...input.availableSourceKeys],
    blockedSourceKeys: [...input.blockedSourceKeys],
    reviewRequiredSourceKeys: [...input.reviewRequiredSourceKeys],
  });

  if (contractPreflight.decision !== 'allow') {
    throw builderError(
      'RESEARCH_JOB_BUILDER_CONTRACT_PREFLIGHT_DENIED',
      `Research-job contract preflight is ${contractPreflight.decision}; persistence remains fail-closed.`,
    );
  }

  const persistedPreflight = await persistence.persistPreflight({
    id: input.preflightId,
    workspaceId: job.workspaceId,
    researchJobId: job.researchJobId,
    idempotencyKey: input.preflightIdempotencyKey,
    admissionSnapshotIds: [...input.admissionSnapshotIds],
    createdAt: input.createdAt,
  });
  assertPersistedPreflight(input, job, persistedPreflight);

  const persistedJob = await persistence.createJob({
    id: job.researchJobId,
    workspaceId: job.workspaceId,
    preflightId: input.preflightId,
    idempotencyKey: input.researchJobIdempotencyKey,
    spec: job as Record<string, unknown>,
    approvedSourceKeys: job.approvedSourceKeys,
    budget: toPersistenceBudget(job),
  });
  assertPersistedJob(input, job, persistedJob);

  return {
    job,
    contractPreflight,
    persistedPreflight,
    persistedJob,
  };
}
