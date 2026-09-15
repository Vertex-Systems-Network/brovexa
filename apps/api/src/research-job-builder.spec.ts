import { describe, expect, it, vi } from 'vitest';
import { ResearchJobSpecSchema, type ResearchJobSpec } from '@brovexa/contracts';
import type {
  CreateResearchJobInput,
  CreateResearchJobResult,
  PersistResearchJobPreflightInput,
  PersistResearchJobPreflightResult,
} from '@brovexa/db';
import {
  ResearchJobBuilderError,
  buildResearchJob,
  type BuildResearchJobInput,
  type ResearchJobBuilderPersistence,
} from './research-job-builder';

function jobFixture(): ResearchJobSpec {
  return ResearchJobSpecSchema.parse({
    version: '1.0.0',
    researchJobId: 'research-job-003',
    workspaceId: 'workspace-003',
    objective: 'Discover qualified businesses without widening source authority.',
    discoveryPlan: {
      version: '1.0.0',
      planId: 'discovery-plan-003',
      workspaceId: 'workspace-003',
      researchJobId: 'research-job-003',
      objective: 'Find businesses from approved source evidence.',
      geography: {
        countryCodes: ['AE'],
        administrativeAreas: [],
        localities: ['Dubai'],
        exclusions: [],
      },
      niche: {
        categoryRefs: ['agency.marketing'],
        keywords: ['marketing agency'],
        negativeKeywords: [],
      },
      sourceKeys: ['source.registry.primary'],
      requestedFields: ['name', 'domain'],
      budget: {
        maxRequests: 20,
        maxPages: 10,
        maxBytes: 500_000,
        maxCurrencyMicros: 500_000,
        maxRuntimeMs: 30_000,
        maxConcurrency: 2,
      },
      coverageTarget: {
        minimumCandidates: 5,
        maximumCandidates: 50,
      },
      requestedAt: '2026-09-15T10:00:00.000Z',
    },
    businessFilters: {
      organizationTypes: ['agency'],
      excludedOrganizationTypes: [],
      employeeCount: { minimum: 2, maximum: 500 },
    },
    digitalFilters: {
      websitePresence: 'required',
      requiredCapabilities: [],
      excludedCapabilities: [],
    },
    contactTargets: {
      roles: ['Founder'],
      functions: ['executive'],
      seniorities: ['owner'],
      minimumPerBusiness: 1,
    },
    signalTargets: {
      signalKeys: ['signal.website_gap'],
      requireEvidence: true,
    },
    approvedSourceKeys: ['source.registry.primary'],
    depth: 'standard',
    quality: {
      minimumEvidenceItems: 2,
      minimumSourceDiversity: 1,
      maximumEvidenceAgeDays: 90,
    },
    output: {
      maximumBusinesses: 50,
      includeEvidence: true,
      includeContacts: true,
      includeSignals: true,
    },
    schedule: {
      mode: 'manual',
      runAt: null,
      recurrence: null,
      timezone: 'UTC',
    },
    budget: {
      maxRequests: 40,
      maxPages: 20,
      maxBytes: 1_000_000,
      maxCurrencyMicros: 1_000_000,
      maxRuntimeMs: 60_000,
      maxConcurrency: 4,
    },
    requestedAt: '2026-09-15T10:00:00.000Z',
  });
}

function buildInput(job: ResearchJobSpec = jobFixture()): BuildResearchJobInput {
  return {
    job,
    preflightId: 'preflight-003',
    preflightIdempotencyKey: 'preflight-idempotency-003',
    admissionSnapshotIds: ['admission-003'],
    researchJobIdempotencyKey: 'research-job-idempotency-003',
    availableSourceKeys: ['source.registry.primary'],
    blockedSourceKeys: [],
    reviewRequiredSourceKeys: [],
    createdAt: new Date('2026-09-15T10:01:00.000Z'),
  };
}

function preflightResult(
  input: PersistResearchJobPreflightInput,
  options: {
    decision?: PersistResearchJobPreflightResult['envelope']['decision'];
    workspaceId?: string;
    maxRequests?: number;
  } = {},
): PersistResearchJobPreflightResult {
  return {
    id: input.id,
    created: true,
    envelope: {
      id: input.id,
      workspaceId: options.workspaceId ?? input.workspaceId,
      researchJobId: input.researchJobId,
      idempotencyKey: input.idempotencyKey,
      decision: options.decision ?? 'allow',
      admissionSnapshotIds: [...input.admissionSnapshotIds],
      aggregateBudget: {
        maxRequests: options.maxRequests ?? 20,
        maxPages: 10,
        maxBytes: 500_000,
        maxCurrencyMicros: 500_000,
        maxRuntimeMs: 30_000,
        maxConcurrency: 2,
      },
      createdAt: input.createdAt.toISOString(),
    },
  };
}

function researchJobResult(input: CreateResearchJobInput): CreateResearchJobResult {
  return {
    created: true,
    researchJob: {
      id: input.id,
      workspaceId: input.workspaceId,
      preflightId: input.preflightId,
      jobRunId: 'job-run-003',
      correlationId: 'correlation-003',
      spec: input.spec,
      approvedSourceKeys: [...input.approvedSourceKeys],
      budget: input.budget,
      createdAt: new Date('2026-09-15T10:01:01.000Z'),
    },
  };
}

function persistenceFixture(): ResearchJobBuilderPersistence {
  return {
    persistPreflight: vi.fn(async (input: PersistResearchJobPreflightInput) => preflightResult(input)),
    createJob: vi.fn(async (input: CreateResearchJobInput) => researchJobResult(input)),
  };
}

async function expectBuilderError(
  promise: Promise<unknown>,
  code: ResearchJobBuilderError['code'],
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected ResearchJobBuilderError.');
  } catch (error) {
    expect(error).toBeInstanceOf(ResearchJobBuilderError);
    expect((error as ResearchJobBuilderError).code).toBe(code);
  }
}

describe('buildResearchJob', () => {
  it('materializes an allowed research job through persisted preflight and bounded parent budget', async () => {
    const job = jobFixture();
    const persistence = persistenceFixture();

    const result = await buildResearchJob(buildInput(job), persistence);

    expect(result.contractPreflight.decision).toBe('allow');
    expect(result.persistedJob.created).toBe(true);
    expect(persistence.persistPreflight).toHaveBeenCalledTimes(1);
    expect(persistence.createJob).toHaveBeenCalledWith(expect.objectContaining({
      id: job.researchJobId,
      workspaceId: job.workspaceId,
      approvedSourceKeys: ['source.registry.primary'],
      budget: {
        maxBusinesses: 50,
        maxRequests: 40,
        maxPages: 20,
        maxBytes: 1_000_000,
        maxCurrencyMicros: 1_000_000,
        maxRuntimeMs: 60_000,
        maxConcurrency: 4,
      },
    }));
  });

  it('fails before persistence when the frozen contract preflight requires review', async () => {
    const persistence = persistenceFixture();
    const input = {
      ...buildInput(),
      reviewRequiredSourceKeys: ['source.registry.primary'],
    };

    await expectBuilderError(
      buildResearchJob(input, persistence),
      'RESEARCH_JOB_BUILDER_CONTRACT_PREFLIGHT_DENIED',
    );
    expect(persistence.persistPreflight).not.toHaveBeenCalled();
    expect(persistence.createJob).not.toHaveBeenCalled();
  });

  it('preserves a persisted blocked decision as evidence but refuses parent job creation', async () => {
    const persistence = persistenceFixture();
    persistence.persistPreflight = vi.fn(async (input: PersistResearchJobPreflightInput) => (
      preflightResult(input, { decision: 'blocked' })
    ));

    await expectBuilderError(
      buildResearchJob(buildInput(), persistence),
      'RESEARCH_JOB_BUILDER_PERSISTED_PREFLIGHT_DENIED',
    );
    expect(persistence.persistPreflight).toHaveBeenCalledTimes(1);
    expect(persistence.createJob).not.toHaveBeenCalled();
  });

  it('rejects a persisted aggregate budget that exceeds the parent research-job budget', async () => {
    const persistence = persistenceFixture();
    persistence.persistPreflight = vi.fn(async (input: PersistResearchJobPreflightInput) => (
      preflightResult(input, { maxRequests: 41 })
    ));

    await expectBuilderError(
      buildResearchJob(buildInput(), persistence),
      'RESEARCH_JOB_BUILDER_PREFLIGHT_BUDGET_EXCEEDED',
    );
    expect(persistence.createJob).not.toHaveBeenCalled();
  });

  it('fails closed if persistence returns an identity outside the requested workspace/job boundary', async () => {
    const persistence = persistenceFixture();
    persistence.persistPreflight = vi.fn(async (input: PersistResearchJobPreflightInput) => (
      preflightResult(input, { workspaceId: 'workspace-other' })
    ));

    await expectBuilderError(
      buildResearchJob(buildInput(), persistence),
      'RESEARCH_JOB_BUILDER_PREFLIGHT_IDENTITY_MISMATCH',
    );
    expect(persistence.createJob).not.toHaveBeenCalled();
  });
});
