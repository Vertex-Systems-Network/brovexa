import { z } from 'zod';
import { SourceBudgetSchema } from './source';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
const NormalizedTermSchema = z.string().trim().min(1).max(160);

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toLocaleLowerCase('en-US');
    if (seen.has(normalized)) duplicates.add(normalized);
    seen.add(normalized);
  }
  return [...duplicates];
}

export const SourceDiscoveryGeographySchema = z
  .object({
    countryCodes: z.array(CountryCodeSchema).max(249),
    administrativeAreas: z.array(IdentifierSchema).max(512),
    localities: z.array(NormalizedTermSchema).max(1024),
    exclusions: z.array(NormalizedTermSchema).max(1024),
  })
  .strict()
  .superRefine((geography, ctx) => {
    if (
      geography.countryCodes.length === 0 &&
      geography.administrativeAreas.length === 0 &&
      geography.localities.length === 0
    ) {
      ctx.addIssue({ code: 'custom', message: 'Discovery geography requires at least one positive geography selector.' });
    }
    for (const [field, values] of Object.entries(geography)) {
      if (duplicateValues(values).length > 0) {
        ctx.addIssue({ code: 'custom', path: [field], message: `${field} must not contain duplicate values.` });
      }
    }
  });

export const SourceDiscoveryNicheSchema = z
  .object({
    categoryRefs: z.array(IdentifierSchema).max(512),
    keywords: z.array(NormalizedTermSchema).max(256),
    negativeKeywords: z.array(NormalizedTermSchema).max(256),
  })
  .strict()
  .superRefine((niche, ctx) => {
    if (niche.categoryRefs.length === 0 && niche.keywords.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Discovery niche requires at least one category reference or keyword.' });
    }
    for (const [field, values] of Object.entries(niche)) {
      if (duplicateValues(values).length > 0) {
        ctx.addIssue({ code: 'custom', path: [field], message: `${field} must not contain duplicate values.` });
      }
    }
    const positive = new Set(niche.keywords.map((value) => value.trim().toLocaleLowerCase('en-US')));
    if (niche.negativeKeywords.some((value) => positive.has(value.trim().toLocaleLowerCase('en-US')))) {
      ctx.addIssue({
        code: 'custom',
        path: ['negativeKeywords'],
        message: 'A discovery keyword cannot also be a negative keyword.',
      });
    }
  });

export const SourceDiscoveryPlanSchema = z
  .object({
    version: z.literal('1.0.0'),
    planId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    researchJobId: IdentifierSchema,
    objective: NormalizedTermSchema.max(512),
    geography: SourceDiscoveryGeographySchema,
    niche: SourceDiscoveryNicheSchema,
    sourceKeys: z.array(z.string().regex(/^source\.[a-z0-9_.-]+$/)).min(1).max(64),
    requestedFields: z.array(IdentifierSchema).min(1).max(512),
    budget: SourceBudgetSchema,
    coverageTarget: z
      .object({
        minimumCandidates: z.number().int().nonnegative().max(1_000_000),
        maximumCandidates: z.number().int().positive().max(1_000_000),
      })
      .strict(),
    requestedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (duplicateValues(plan.sourceKeys).length > 0) {
      ctx.addIssue({ code: 'custom', path: ['sourceKeys'], message: 'sourceKeys must not contain duplicate values.' });
    }
    if (duplicateValues(plan.requestedFields).length > 0) {
      ctx.addIssue({ code: 'custom', path: ['requestedFields'], message: 'requestedFields must not contain duplicate values.' });
    }
    if (plan.coverageTarget.minimumCandidates > plan.coverageTarget.maximumCandidates) {
      ctx.addIssue({
        code: 'custom',
        path: ['coverageTarget'],
        message: 'minimumCandidates must not exceed maximumCandidates.',
      });
    }
    if (plan.budget.maxRequests === 0 || plan.budget.maxPages === 0 || plan.budget.maxRuntimeMs === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['budget'],
        message: 'Executable discovery plans require non-zero request, page and runtime budgets.',
      });
    }
  });

export type SourceDiscoveryGeography = z.infer<typeof SourceDiscoveryGeographySchema>;
export type SourceDiscoveryNiche = z.infer<typeof SourceDiscoveryNicheSchema>;
export type SourceDiscoveryPlan = z.infer<typeof SourceDiscoveryPlanSchema>;

export function parseSourceDiscoveryPlan(rawPlan: unknown): SourceDiscoveryPlan {
  return SourceDiscoveryPlanSchema.parse(rawPlan);
}
