import { z } from 'zod';
export declare const SourceDiscoveryGeographySchema: z.ZodObject<{
    countryCodes: z.ZodArray<z.ZodString>;
    administrativeAreas: z.ZodArray<z.ZodString>;
    localities: z.ZodArray<z.ZodString>;
    exclusions: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const SourceDiscoveryNicheSchema: z.ZodObject<{
    categoryRefs: z.ZodArray<z.ZodString>;
    keywords: z.ZodArray<z.ZodString>;
    negativeKeywords: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const SourceDiscoveryPlanSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    planId: z.ZodString;
    workspaceId: z.ZodString;
    researchJobId: z.ZodString;
    objective: z.ZodString;
    geography: z.ZodObject<{
        countryCodes: z.ZodArray<z.ZodString>;
        administrativeAreas: z.ZodArray<z.ZodString>;
        localities: z.ZodArray<z.ZodString>;
        exclusions: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    niche: z.ZodObject<{
        categoryRefs: z.ZodArray<z.ZodString>;
        keywords: z.ZodArray<z.ZodString>;
        negativeKeywords: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    sourceKeys: z.ZodArray<z.ZodString>;
    requestedFields: z.ZodArray<z.ZodString>;
    budget: z.ZodObject<{
        maxRequests: z.ZodNumber;
        maxPages: z.ZodNumber;
        maxBytes: z.ZodNumber;
        maxCurrencyMicros: z.ZodNumber;
        maxRuntimeMs: z.ZodNumber;
        maxConcurrency: z.ZodNumber;
    }, z.core.$strip>;
    coverageTarget: z.ZodObject<{
        minimumCandidates: z.ZodNumber;
        maximumCandidates: z.ZodNumber;
    }, z.core.$strict>;
    requestedAt: z.ZodString;
}, z.core.$strict>;
export type SourceDiscoveryGeography = z.infer<typeof SourceDiscoveryGeographySchema>;
export type SourceDiscoveryNiche = z.infer<typeof SourceDiscoveryNicheSchema>;
export type SourceDiscoveryPlan = z.infer<typeof SourceDiscoveryPlanSchema>;
export declare function parseSourceDiscoveryPlan(rawPlan: unknown): SourceDiscoveryPlan;
