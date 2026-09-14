import { describe, expect, it } from 'vitest';
import { SourceDiscoveryPlanSchema } from './source-discovery-plan';

function plan() {
  return {
    version: '1.0.0' as const,
    planId: 'discovery-plan-1',
    workspaceId: 'workspace-1',
    researchJobId: 'research-job-1',
    objective: 'Find dentists in Istanbul with public business profiles',
    geography: {
      countryCodes: ['TR'],
      administrativeAreas: ['TR.34'],
      localities: ['Istanbul'],
      exclusions: [],
    },
    niche: {
      categoryRefs: ['niche.dentist'],
      keywords: ['dentist'],
      negativeKeywords: ['veterinary'],
    },
    sourceKeys: ['source.company_sites'],
    requestedFields: ['name', 'website'],
    budget: {
      maxRequests: 20,
      maxPages: 20,
      maxBytes: 1_000_000,
      maxCurrencyMicros: 100_000,
      maxRuntimeMs: 60_000,
      maxConcurrency: 2,
    },
    coverageTarget: { minimumCandidates: 10, maximumCandidates: 1000 },
    requestedAt: '2026-09-04T00:00:00.000Z',
  };
}

describe('SourceDiscoveryPlanSchema', () => {
  it('accepts a bounded geography+niche discovery plan', () => {
    expect(SourceDiscoveryPlanSchema.parse(plan())).toEqual(plan());
  });

  it('rejects a plan without a positive geography selector', () => {
    const value = plan();
    value.geography = { countryCodes: [], administrativeAreas: [], localities: [], exclusions: [] };
    expect(SourceDiscoveryPlanSchema.safeParse(value).success).toBe(false);
  });

  it('rejects a plan without a positive niche selector', () => {
    const value = plan();
    value.niche = { categoryRefs: [], keywords: [], negativeKeywords: [] };
    expect(SourceDiscoveryPlanSchema.safeParse(value).success).toBe(false);
  });

  it('rejects duplicate source keys and requested fields', () => {
    expect(SourceDiscoveryPlanSchema.safeParse({ ...plan(), sourceKeys: ['source.company_sites', 'source.company_sites'] }).success).toBe(false);
    expect(SourceDiscoveryPlanSchema.safeParse({ ...plan(), requestedFields: ['name', 'NAME'] }).success).toBe(false);
  });

  it('rejects contradictory positive and negative niche keywords', () => {
    const value = plan();
    value.niche = { ...value.niche, negativeKeywords: ['Dentist'] };
    expect(SourceDiscoveryPlanSchema.safeParse(value).success).toBe(false);
  });

  it('rejects inverted coverage targets and non-executable budgets', () => {
    expect(
      SourceDiscoveryPlanSchema.safeParse({ ...plan(), coverageTarget: { minimumCandidates: 101, maximumCandidates: 100 } })
        .success,
    ).toBe(false);
    expect(
      SourceDiscoveryPlanSchema.safeParse({ ...plan(), budget: { ...plan().budget, maxRequests: 0 } }).success,
    ).toBe(false);
  });
});
