"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceDiscoveryPlanSchema = exports.SourceDiscoveryNicheSchema = exports.SourceDiscoveryGeographySchema = void 0;
exports.parseSourceDiscoveryPlan = parseSourceDiscoveryPlan;
const zod_1 = require("zod");
const source_1 = require("./source");
const IdentifierSchema = zod_1.z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const CountryCodeSchema = zod_1.z.string().regex(/^[A-Z]{2}$/);
const NormalizedTermSchema = zod_1.z.string().trim().min(1).max(160);
function duplicateValues(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        const normalized = value.trim().toLocaleLowerCase('en-US');
        if (seen.has(normalized))
            duplicates.add(normalized);
        seen.add(normalized);
    }
    return [...duplicates];
}
exports.SourceDiscoveryGeographySchema = zod_1.z
    .object({
    countryCodes: zod_1.z.array(CountryCodeSchema).max(249),
    administrativeAreas: zod_1.z.array(IdentifierSchema).max(512),
    localities: zod_1.z.array(NormalizedTermSchema).max(1024),
    exclusions: zod_1.z.array(NormalizedTermSchema).max(1024),
})
    .strict()
    .superRefine((geography, ctx) => {
    if (geography.countryCodes.length === 0 &&
        geography.administrativeAreas.length === 0 &&
        geography.localities.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Discovery geography requires at least one positive geography selector.' });
    }
    for (const [field, values] of Object.entries(geography)) {
        if (duplicateValues(values).length > 0) {
            ctx.addIssue({ code: 'custom', path: [field], message: `${field} must not contain duplicate values.` });
        }
    }
});
exports.SourceDiscoveryNicheSchema = zod_1.z
    .object({
    categoryRefs: zod_1.z.array(IdentifierSchema).max(512),
    keywords: zod_1.z.array(NormalizedTermSchema).max(256),
    negativeKeywords: zod_1.z.array(NormalizedTermSchema).max(256),
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
exports.SourceDiscoveryPlanSchema = zod_1.z
    .object({
    version: zod_1.z.literal('1.0.0'),
    planId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    researchJobId: IdentifierSchema,
    objective: NormalizedTermSchema.max(512),
    geography: exports.SourceDiscoveryGeographySchema,
    niche: exports.SourceDiscoveryNicheSchema,
    sourceKeys: zod_1.z.array(zod_1.z.string().regex(/^source\.[a-z0-9_.-]+$/)).min(1).max(64),
    requestedFields: zod_1.z.array(IdentifierSchema).min(1).max(512),
    budget: source_1.SourceBudgetSchema,
    coverageTarget: zod_1.z
        .object({
        minimumCandidates: zod_1.z.number().int().nonnegative().max(1_000_000),
        maximumCandidates: zod_1.z.number().int().positive().max(1_000_000),
    })
        .strict(),
    requestedAt: zod_1.z.string().datetime(),
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
function parseSourceDiscoveryPlan(rawPlan) {
    return exports.SourceDiscoveryPlanSchema.parse(rawPlan);
}
//# sourceMappingURL=source-discovery-plan.js.map