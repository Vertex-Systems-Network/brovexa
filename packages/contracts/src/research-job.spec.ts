import { describe, expect, it } from 'vitest';
import {
  ResearchJobSpecSchema,
  evaluateResearchJobPreflight,
  type ResearchJobSpec,
} from './research-job';

function jobFixture(): ResearchJobSpec {
  return ResearchJobSpecSchema.parse({
    version: '1.0.0',
    researchJobId: 'research-job-001',
    workspaceId: 'workspace-001',
    objective: 'Discover qualified agencies with weak digital capabilities.',
    discoveryPlan: {
      version: '1.0.0',
      planId: 'discovery-plan-001',
      workspaceId: 'workspace-001',
      researchJobId: 'research-job-001',
      objective: 'Find agencies for research.',
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
        maxRequests: 100,
        maxPages: 20,
        maxBytes: 2_000_000,
        maxCurrencyMicros: 2_000_000,
        maxRuntimeMs: 60_000,
        maxConcurrency: 4,
      },
      coverageTarget: {
        minimumCandidates: 10,
        maximumCandidates: 100,
      },
      requestedAt: '2026-09-15T00:00:00.000Z',
    },
    businessFilters: {
      organizationTypes: ['agency'],
      excludedOrganizationTypes: [],
      employeeCount: { minimum: 2, maximum: 500 },
    },
    digitalFilters: {
      websitePresence: 'required',
      requiredCapabilities: [],
      excludedCapabilities: ['commerce'],
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
    approvedSourceKeys: ['source.registry.primary', 'source.directory.optional'],
    depth: 'standard',
    quality: {
      minimumEvidenceItems: 2,
      minimumSourceDiversity: 1,
      maximumEvidenceAgeDays: 90,
    },
    output: {
      maximumBusinesses: 100,
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
      maxRequests: 200,
      maxPages: 40,
      maxBytes: 4_000_000,
      maxCurrencyMicros: 4_000_000,
      maxRuntimeMs: 120_000,
      maxConcurrency: 8,
    },
    requestedAt: '2026-09-15T00:00:00.000Z',
  });
}

describe('ResearchJobSpecSchema', () => {
  it('accepts a bounded provider-neutral research job composed over SourceDiscoveryPlan', () => {
    const job = jobFixture();
    expect(job.discoveryPlan.sourceKeys).toEqual(['source.registry.primary']);
    expect(job.approvedSourceKeys).toContain('source.registry.primary');
  });

  it('rejects discovery sources that are outside the approved source set', () => {
    const job = jobFixture();
    const result = ResearchJobSpecSchema.safeParse({
      ...job,
      approvedSourceKeys: ['source.directory.optional'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects discovery budgets that exceed the enclosing research job budget', () => {
    const job = jobFixture();
    const result = ResearchJobSpecSchema.safeParse({
      ...job,
      discoveryPlan: {
        ...job.discoveryPlan,
        budget: { ...job.discoveryPlan.budget, maxRequests: job.budget.maxRequests + 1 },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects contradictory output and target requirements', () => {
    const job = jobFixture();
    const result = ResearchJobSpecSchema.safeParse({
      ...job,
      output: { ...job.output, includeContacts: false },
    });
    expect(result.success).toBe(false);
  });
});

describe('evaluateResearchJobPreflight', () => {
  it('allows the job when every requested source is available and policy-clear', () => {
    const job = jobFixture();
    expect(evaluateResearchJobPreflight({
      job,
      availableSourceKeys: ['source.registry.primary'],
      blockedSourceKeys: [],
      reviewRequiredSourceKeys: [],
    })).toEqual({
      decision: 'allow',
      reasonCodes: [],
      executableSourceKeys: ['source.registry.primary'],
    });
  });

  it('requires review without converting the review state into an executable source', () => {
    const job = jobFixture();
    expect(evaluateResearchJobPreflight({
      job,
      availableSourceKeys: ['source.registry.primary'],
      blockedSourceKeys: [],
      reviewRequiredSourceKeys: ['source.registry.primary'],
    })).toEqual({
      decision: 'review_required',
      reasonCodes: ['research_source_review_required'],
      executableSourceKeys: [],
    });
  });

  it('fails closed for unavailable or explicitly blocked requested sources', () => {
    const job = jobFixture();
    const unavailable = evaluateResearchJobPreflight({
      job,
      availableSourceKeys: [],
      blockedSourceKeys: [],
      reviewRequiredSourceKeys: [],
    });
    expect(unavailable.decision).toBe('blocked');
    expect(unavailable.reasonCodes).toContain('research_source_unavailable');

    const blocked = evaluateResearchJobPreflight({
      job,
      availableSourceKeys: ['source.registry.primary'],
      blockedSourceKeys: ['source.registry.primary'],
      reviewRequiredSourceKeys: [],
    });
    expect(blocked.decision).toBe('blocked');
    expect(blocked.reasonCodes).toContain('research_source_blocked');
  });
});
