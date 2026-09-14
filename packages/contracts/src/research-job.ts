import { z } from 'zod';
import { SourceBudgetSchema } from './source';
import { SourceDiscoveryPlanSchema } from './source-discovery-plan';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const SourceKeySchema = z.string().regex(/^source\.[a-z0-9_.-]+$/);
const TermSchema = z.string().trim().min(1).max(160);
const SafeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function unique(values: readonly string[]): boolean {
  return new Set(values.map(normalized)).size === values.length;
}

function isSubset(values: readonly string[], allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return values.every((value) => allowedSet.has(value));
}

function budgetWithin(child: z.infer<typeof SourceBudgetSchema>, parent: z.infer<typeof SourceBudgetSchema>): boolean {
  return child.maxRequests <= parent.maxRequests
    && child.maxPages <= parent.maxPages
    && child.maxBytes <= parent.maxBytes
    && child.maxCurrencyMicros <= parent.maxCurrencyMicros
    && child.maxRuntimeMs <= parent.maxRuntimeMs
    && child.maxConcurrency <= parent.maxConcurrency;
}

export const ResearchJobBusinessFiltersSchema = z
  .object({
    organizationTypes: z.array(IdentifierSchema).max(64),
    excludedOrganizationTypes: z.array(IdentifierSchema).max(64),
    employeeCount: z
      .object({
        minimum: SafeIntegerSchema.max(10_000_000).nullable(),
        maximum: SafeIntegerSchema.max(10_000_000).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((filters, ctx) => {
    if (!unique(filters.organizationTypes)) {
      ctx.addIssue({ code: 'custom', path: ['organizationTypes'], message: 'organizationTypes must be unique.' });
    }
    if (!unique(filters.excludedOrganizationTypes)) {
      ctx.addIssue({ code: 'custom', path: ['excludedOrganizationTypes'], message: 'excludedOrganizationTypes must be unique.' });
    }
    const included = new Set(filters.organizationTypes.map(normalized));
    if (filters.excludedOrganizationTypes.some((value) => included.has(normalized(value)))) {
      ctx.addIssue({
        code: 'custom',
        path: ['excludedOrganizationTypes'],
        message: 'An organization type cannot be both included and excluded.',
      });
    }
    const { minimum, maximum } = filters.employeeCount;
    if (minimum !== null && maximum !== null && minimum > maximum) {
      ctx.addIssue({ code: 'custom', path: ['employeeCount'], message: 'minimum employee count must not exceed maximum.' });
    }
  });

export const ResearchJobDigitalFiltersSchema = z
  .object({
    websitePresence: z.enum(['any', 'required', 'missing']),
    requiredCapabilities: z.array(IdentifierSchema).max(128),
    excludedCapabilities: z.array(IdentifierSchema).max(128),
  })
  .strict()
  .superRefine((filters, ctx) => {
    if (!unique(filters.requiredCapabilities) || !unique(filters.excludedCapabilities)) {
      ctx.addIssue({ code: 'custom', message: 'Digital capability filters must be unique.' });
    }
    const required = new Set(filters.requiredCapabilities.map(normalized));
    if (filters.excludedCapabilities.some((value) => required.has(normalized(value)))) {
      ctx.addIssue({
        code: 'custom',
        path: ['excludedCapabilities'],
        message: 'A digital capability cannot be both required and excluded.',
      });
    }
  });

export const ResearchJobContactTargetsSchema = z
  .object({
    roles: z.array(TermSchema).max(128),
    functions: z.array(IdentifierSchema).max(64),
    seniorities: z.array(IdentifierSchema).max(32),
    minimumPerBusiness: z.number().int().min(0).max(50),
  })
  .strict()
  .superRefine((targets, ctx) => {
    for (const [field, values] of Object.entries({ roles: targets.roles, functions: targets.functions, seniorities: targets.seniorities })) {
      if (!unique(values)) ctx.addIssue({ code: 'custom', path: [field], message: `${field} must be unique.` });
    }
  });

export const ResearchJobSignalTargetsSchema = z
  .object({
    signalKeys: z.array(z.string().regex(/^signal\.[a-z0-9_.-]+$/)).max(128),
    requireEvidence: z.boolean(),
  })
  .strict()
  .superRefine((targets, ctx) => {
    if (!unique(targets.signalKeys)) {
      ctx.addIssue({ code: 'custom', path: ['signalKeys'], message: 'signalKeys must be unique.' });
    }
  });

export const ResearchJobQualitySchema = z.object({
  minimumEvidenceItems: z.number().int().min(1).max(100),
  minimumSourceDiversity: z.number().int().min(1).max(32),
  maximumEvidenceAgeDays: z.number().int().min(1).max(3650),
}).strict();

export const ResearchJobOutputSchema = z.object({
  maximumBusinesses: z.number().int().min(1).max(1_000_000),
  includeEvidence: z.boolean(),
  includeContacts: z.boolean(),
  includeSignals: z.boolean(),
}).strict();

export const ResearchJobScheduleSchema = z
  .object({
    mode: z.enum(['manual', 'once', 'recurring']),
    runAt: z.string().datetime().nullable(),
    recurrence: z.string().trim().min(1).max(256).nullable(),
    timezone: z.string().trim().min(1).max(128),
  })
  .strict()
  .superRefine((schedule, ctx) => {
    if (schedule.mode === 'manual' && (schedule.runAt !== null || schedule.recurrence !== null)) {
      ctx.addIssue({ code: 'custom', message: 'Manual schedules cannot include runAt or recurrence.' });
    }
    if (schedule.mode === 'once' && (schedule.runAt === null || schedule.recurrence !== null)) {
      ctx.addIssue({ code: 'custom', message: 'One-time schedules require runAt and cannot include recurrence.' });
    }
    if (schedule.mode === 'recurring' && (schedule.recurrence === null || schedule.runAt !== null)) {
      ctx.addIssue({ code: 'custom', message: 'Recurring schedules require recurrence and cannot include runAt.' });
    }
  });

export const ResearchJobSpecSchema = z
  .object({
    version: z.literal('1.0.0'),
    researchJobId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    objective: z.string().trim().min(1).max(512),
    discoveryPlan: SourceDiscoveryPlanSchema,
    businessFilters: ResearchJobBusinessFiltersSchema,
    digitalFilters: ResearchJobDigitalFiltersSchema,
    contactTargets: ResearchJobContactTargetsSchema,
    signalTargets: ResearchJobSignalTargetsSchema,
    approvedSourceKeys: z.array(SourceKeySchema).min(1).max(64),
    depth: z.enum(['surface', 'standard', 'deep']),
    quality: ResearchJobQualitySchema,
    output: ResearchJobOutputSchema,
    schedule: ResearchJobScheduleSchema,
    budget: SourceBudgetSchema,
    requestedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((job, ctx) => {
    if (!unique(job.approvedSourceKeys)) {
      ctx.addIssue({ code: 'custom', path: ['approvedSourceKeys'], message: 'approvedSourceKeys must be unique.' });
    }
    if (job.discoveryPlan.researchJobId !== job.researchJobId || job.discoveryPlan.workspaceId !== job.workspaceId) {
      ctx.addIssue({
        code: 'custom',
        path: ['discoveryPlan'],
        message: 'Discovery plan researchJobId and workspaceId must match the enclosing research job.',
      });
    }
    if (!isSubset(job.discoveryPlan.sourceKeys, job.approvedSourceKeys)) {
      ctx.addIssue({
        code: 'custom',
        path: ['discoveryPlan', 'sourceKeys'],
        message: 'Discovery plan sourceKeys must be a subset of approvedSourceKeys.',
      });
    }
    if (!budgetWithin(job.discoveryPlan.budget, job.budget)) {
      ctx.addIssue({
        code: 'custom',
        path: ['discoveryPlan', 'budget'],
        message: 'Discovery plan budget must remain within the enclosing research job budget.',
      });
    }
    if (job.output.includeContacts === false && job.contactTargets.minimumPerBusiness > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactTargets', 'minimumPerBusiness'],
        message: 'Contact targets cannot require contacts when contact output is disabled.',
      });
    }
    if (job.output.includeSignals === false && job.signalTargets.signalKeys.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['signalTargets'],
        message: 'Signal targets cannot be requested when signal output is disabled.',
      });
    }
  });

export const ResearchJobPreflightInputSchema = z.object({
  job: ResearchJobSpecSchema,
  availableSourceKeys: z.array(SourceKeySchema).max(256),
  blockedSourceKeys: z.array(SourceKeySchema).max(256),
  reviewRequiredSourceKeys: z.array(SourceKeySchema).max(256),
}).strict();

export const ResearchJobPreflightDecisionSchema = z.object({
  decision: z.enum(['allow', 'review_required', 'blocked']),
  reasonCodes: z.array(IdentifierSchema).max(128),
  executableSourceKeys: z.array(SourceKeySchema).max(64),
}).strict();

export type ResearchJobSpec = z.infer<typeof ResearchJobSpecSchema>;
export type ResearchJobPreflightInput = z.infer<typeof ResearchJobPreflightInputSchema>;
export type ResearchJobPreflightDecision = z.infer<typeof ResearchJobPreflightDecisionSchema>;

export function evaluateResearchJobPreflight(rawInput: ResearchJobPreflightInput): ResearchJobPreflightDecision {
  const input = ResearchJobPreflightInputSchema.parse(rawInput);
  const approved = input.job.approvedSourceKeys;
  const available = new Set(input.availableSourceKeys);
  const blocked = new Set(input.blockedSourceKeys);
  const review = new Set(input.reviewRequiredSourceKeys);
  const reasons = new Set<string>();

  const unavailable = approved.filter((sourceKey) => !available.has(sourceKey));
  const explicitlyBlocked = approved.filter((sourceKey) => blocked.has(sourceKey));
  const needsReview = approved.filter((sourceKey) => review.has(sourceKey));
  const executableSourceKeys = input.job.discoveryPlan.sourceKeys.filter(
    (sourceKey) => available.has(sourceKey) && !blocked.has(sourceKey) && !review.has(sourceKey),
  );

  if (unavailable.length > 0) reasons.add('research_source_unavailable');
  if (explicitlyBlocked.length > 0) reasons.add('research_source_blocked');
  if (needsReview.length > 0) reasons.add('research_source_review_required');
  if (executableSourceKeys.length === 0) reasons.add('research_no_executable_source');

  const decision = explicitlyBlocked.length > 0 || unavailable.length > 0 || executableSourceKeys.length === 0
    ? 'blocked'
    : needsReview.length > 0
      ? 'review_required'
      : 'allow';

  return ResearchJobPreflightDecisionSchema.parse({
    decision,
    reasonCodes: [...reasons].sort(),
    executableSourceKeys: [...executableSourceKeys].sort(),
  });
}
