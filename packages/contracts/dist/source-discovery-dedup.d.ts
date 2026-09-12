import { z } from 'zod';
export declare const sourceDiscoveryDedupKeyKindValues: readonly ['source_external_ref', 'website_origin', 'normalized_name_location', 'provider_fingerprint'];
export declare const SourceDiscoveryDedupKeyKindSchema: z.ZodEnum<{
    normalized_name_location: "normalized_name_location";
    provider_fingerprint: "provider_fingerprint";
    source_external_ref: "source_external_ref";
    website_origin: "website_origin";
}>;
export type SourceDiscoveryDedupKeyKind = z.infer<typeof SourceDiscoveryDedupKeyKindSchema>;
export declare const SourceDiscoveryDedupEvidenceSchema: z.ZodObject<{
    candidateId: z.ZodString;
    keyKind: z.ZodEnum<{
        normalized_name_location: "normalized_name_location";
        provider_fingerprint: "provider_fingerprint";
        source_external_ref: "source_external_ref";
        website_origin: "website_origin";
    }>;
    keyValue: z.ZodString;
    keyScope: z.ZodNullable<z.ZodString>;
    sourceReferenceIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type SourceDiscoveryDedupEvidence = z.infer<typeof SourceDiscoveryDedupEvidenceSchema>;
export declare const SourceDiscoveryDedupMatchedKeySchema: z.ZodObject<{
    keyKind: z.ZodEnum<{
        normalized_name_location: "normalized_name_location";
        provider_fingerprint: "provider_fingerprint";
        source_external_ref: "source_external_ref";
        website_origin: "website_origin";
    }>;
    keyValue: z.ZodString;
    keyScope: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export type SourceDiscoveryDedupMatchedKey = z.infer<typeof SourceDiscoveryDedupMatchedKeySchema>;
export declare const SourceDiscoveryDedupGroupSchema: z.ZodObject<{
    groupId: z.ZodString;
    candidateIds: z.ZodArray<z.ZodString>;
    decision: z.ZodEnum<{
        duplicate: "duplicate";
        possible_duplicate: "possible_duplicate";
    }>;
    matchedKeys: z.ZodArray<z.ZodObject<{
        keyKind: z.ZodEnum<{
            normalized_name_location: "normalized_name_location";
            provider_fingerprint: "provider_fingerprint";
            source_external_ref: "source_external_ref";
            website_origin: "website_origin";
        }>;
        keyValue: z.ZodString;
        keyScope: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>>;
    reasonCodes: z.ZodArray<z.ZodString>;
    canonicalizationState: z.ZodLiteral<"unverified_candidates_only">;
}, z.core.$strict>;
export type SourceDiscoveryDedupGroup = z.infer<typeof SourceDiscoveryDedupGroupSchema>;
export declare const SourceDiscoveryDedupBatchSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    batchId: z.ZodString;
    workspaceId: z.ZodString;
    researchJobId: z.ZodString;
    candidates: z.ZodArray<z.ZodObject<{
        candidateId: z.ZodString;
        objectType: z.ZodEnum<{
            business: "business";
            contact_channel: "contact_channel";
            custom: "custom";
            domain: "domain";
            employment: "employment";
            job: "job";
            location: "location";
            news_event: "news_event";
            person: "person";
            procurement: "procurement";
            signal_candidate: "signal_candidate";
            website: "website";
        }>;
        candidateState: z.ZodLiteral<"unverified">;
        fields: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        fieldNames: z.ZodArray<z.ZodString>;
        dataClassifications: z.ZodArray<z.ZodEnum<{
            AUTH_SECRET: "AUTH_SECRET";
            COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
            CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
            INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
            PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
            PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
            SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
        }>>;
        storageClass: z.ZodEnum<{
            EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
            NORMALIZED_FACT: "NORMALIZED_FACT";
            REFERENCE_ONLY: "REFERENCE_ONLY";
            SOURCE_CONTENT: "SOURCE_CONTENT";
            TRANSIENT: "TRANSIENT";
        }>;
        sourceReferenceIds: z.ZodArray<z.ZodString>;
        observedAt: z.ZodString;
    }, z.core.$strip>>;
    evidence: z.ZodArray<z.ZodObject<{
        candidateId: z.ZodString;
        keyKind: z.ZodEnum<{
            normalized_name_location: "normalized_name_location";
            provider_fingerprint: "provider_fingerprint";
            source_external_ref: "source_external_ref";
            website_origin: "website_origin";
        }>;
        keyValue: z.ZodString;
        keyScope: z.ZodNullable<z.ZodString>;
        sourceReferenceIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    groups: z.ZodArray<z.ZodObject<{
        groupId: z.ZodString;
        candidateIds: z.ZodArray<z.ZodString>;
        decision: z.ZodEnum<{
            duplicate: "duplicate";
            possible_duplicate: "possible_duplicate";
        }>;
        matchedKeys: z.ZodArray<z.ZodObject<{
            keyKind: z.ZodEnum<{
                normalized_name_location: "normalized_name_location";
                provider_fingerprint: "provider_fingerprint";
                source_external_ref: "source_external_ref";
                website_origin: "website_origin";
            }>;
            keyValue: z.ZodString;
            keyScope: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        reasonCodes: z.ZodArray<z.ZodString>;
        canonicalizationState: z.ZodLiteral<"unverified_candidates_only">;
    }, z.core.$strict>>;
    evaluatedAt: z.ZodString;
}, z.core.$strict>;
export type SourceDiscoveryDedupBatch = z.infer<typeof SourceDiscoveryDedupBatchSchema>;
export declare function parseSourceDiscoveryDedupBatch(rawBatch: unknown): SourceDiscoveryDedupBatch;
