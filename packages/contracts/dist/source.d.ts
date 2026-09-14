import { z } from 'zod';
export declare const sourceClassValues: readonly ['maps_local_api', 'official_registry_open_data', 'industry_directory', 'company_first_party', 'careers_jobs', 'procurement_tender', 'news_search_index', 'review_reputation', 'social_community', 'technical_technology', 'funding_company_intelligence', 'customer_first_party', 'licensed_b2b', 'customer_import', 'browser_manual_capture', 'partner_mcp'];
export declare const SourceClassSchema: z.ZodEnum<{
    browser_manual_capture: "browser_manual_capture";
    careers_jobs: "careers_jobs";
    company_first_party: "company_first_party";
    customer_first_party: "customer_first_party";
    customer_import: "customer_import";
    funding_company_intelligence: "funding_company_intelligence";
    industry_directory: "industry_directory";
    licensed_b2b: "licensed_b2b";
    maps_local_api: "maps_local_api";
    news_search_index: "news_search_index";
    official_registry_open_data: "official_registry_open_data";
    partner_mcp: "partner_mcp";
    procurement_tender: "procurement_tender";
    review_reputation: "review_reputation";
    social_community: "social_community";
    technical_technology: "technical_technology";
}>;
export type SourceClass = z.infer<typeof SourceClassSchema>;
export declare const sourceOperationValues: readonly ['discover', 'search', 'list', 'lookup', 'fetch', 'detail', 'import', 'sync'];
export declare const SourceOperationSchema: z.ZodEnum<{
    detail: "detail";
    discover: "discover";
    fetch: "fetch";
    import: "import";
    list: "list";
    lookup: "lookup";
    search: "search";
    sync: "sync";
}>;
export type SourceOperation = z.infer<typeof SourceOperationSchema>;
export declare const connectorPolicyStateValues: readonly ['APPROVED', 'APPROVED_WITH_LIMITS', 'TRANSIENT_ONLY', 'REVIEW_REQUIRED', 'BLOCKED', 'EXPIRED'];
export declare const ConnectorPolicyStateSchema: z.ZodEnum<{
    APPROVED: "APPROVED";
    APPROVED_WITH_LIMITS: "APPROVED_WITH_LIMITS";
    BLOCKED: "BLOCKED";
    EXPIRED: "EXPIRED";
    REVIEW_REQUIRED: "REVIEW_REQUIRED";
    TRANSIENT_ONLY: "TRANSIENT_ONLY";
}>;
export type ConnectorPolicyState = z.infer<typeof ConnectorPolicyStateSchema>;
export declare const sourceStorageClassValues: readonly ['TRANSIENT', 'REFERENCE_ONLY', 'NORMALIZED_FACT', 'EVIDENCE_MINIMAL', 'SOURCE_CONTENT'];
export declare const SourceStorageClassSchema: z.ZodEnum<{
    EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
    NORMALIZED_FACT: "NORMALIZED_FACT";
    REFERENCE_ONLY: "REFERENCE_ONLY";
    SOURCE_CONTENT: "SOURCE_CONTENT";
    TRANSIENT: "TRANSIENT";
}>;
export type SourceStorageClass = z.infer<typeof SourceStorageClassSchema>;
export declare const sourceDataClassificationValues: readonly ['PUBLIC_BUSINESS', 'INTERNAL_WORKSPACE', 'PERSONAL_BUSINESS_CONTACT', 'CUSTOMER_FIRST_PARTY', 'COMMERCIAL_CONFIDENTIAL', 'SECURITY_SENSITIVE', 'AUTH_SECRET'];
export declare const SourceDataClassificationSchema: z.ZodEnum<{
    AUTH_SECRET: "AUTH_SECRET";
    COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
    CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
    INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
    PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
    PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
    SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
}>;
export type SourceDataClassification = z.infer<typeof SourceDataClassificationSchema>;
export declare const sourceAccessMethodValues: readonly ['official_api', 'licensed_api', 'public_web', 'first_party_web', 'open_data_dump', 'customer_authorized', 'user_import', 'manual_capture', 'webhook', 'partner_protocol'];
export declare const SourceAccessMethodSchema: z.ZodEnum<{
    customer_authorized: "customer_authorized";
    first_party_web: "first_party_web";
    licensed_api: "licensed_api";
    manual_capture: "manual_capture";
    official_api: "official_api";
    open_data_dump: "open_data_dump";
    partner_protocol: "partner_protocol";
    public_web: "public_web";
    user_import: "user_import";
    webhook: "webhook";
}>;
export type SourceAccessMethod = z.infer<typeof SourceAccessMethodSchema>;
export declare const connectorCredentialModeValues: readonly ['none', 'api_key_ref', 'oauth_ref', 'service_account_ref', 'user_authorized_ref'];
export declare const ConnectorCredentialModeSchema: z.ZodEnum<{
    api_key_ref: "api_key_ref";
    none: "none";
    oauth_ref: "oauth_ref";
    service_account_ref: "service_account_ref";
    user_authorized_ref: "user_authorized_ref";
}>;
export type ConnectorCredentialMode = z.infer<typeof ConnectorCredentialModeSchema>;
export declare const SourceBudgetSchema: z.ZodObject<{
    maxRequests: z.ZodNumber;
    maxPages: z.ZodNumber;
    maxBytes: z.ZodNumber;
    maxCurrencyMicros: z.ZodNumber;
    maxRuntimeMs: z.ZodNumber;
    maxConcurrency: z.ZodNumber;
}, z.core.$strip>;
export type SourceBudget = z.infer<typeof SourceBudgetSchema>;
export declare const SourceCapabilitySchema: z.ZodObject<{
    sourceKey: z.ZodString;
    version: z.ZodString;
    sourceClass: z.ZodEnum<{
        browser_manual_capture: "browser_manual_capture";
        careers_jobs: "careers_jobs";
        company_first_party: "company_first_party";
        customer_first_party: "customer_first_party";
        customer_import: "customer_import";
        funding_company_intelligence: "funding_company_intelligence";
        industry_directory: "industry_directory";
        licensed_b2b: "licensed_b2b";
        maps_local_api: "maps_local_api";
        news_search_index: "news_search_index";
        official_registry_open_data: "official_registry_open_data";
        partner_mcp: "partner_mcp";
        procurement_tender: "procurement_tender";
        review_reputation: "review_reputation";
        social_community: "social_community";
        technical_technology: "technical_technology";
    }>;
    accessMethods: z.ZodArray<z.ZodEnum<{
        customer_authorized: "customer_authorized";
        first_party_web: "first_party_web";
        licensed_api: "licensed_api";
        manual_capture: "manual_capture";
        official_api: "official_api";
        open_data_dump: "open_data_dump";
        partner_protocol: "partner_protocol";
        public_web: "public_web";
        user_import: "user_import";
        webhook: "webhook";
    }>>;
    operations: z.ZodArray<z.ZodEnum<{
        detail: "detail";
        discover: "discover";
        fetch: "fetch";
        import: "import";
        list: "list";
        lookup: "lookup";
        search: "search";
        sync: "sync";
    }>>;
    supportedFields: z.ZodArray<z.ZodString>;
    dataClassifications: z.ZodArray<z.ZodEnum<{
        AUTH_SECRET: "AUTH_SECRET";
        COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
        CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
        INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
        PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
        PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
        SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
    }>>;
    geography: z.ZodObject<{
        mode: z.ZodEnum<{
            country_allowlist: "country_allowlist";
            global: "global";
            provider_defined: "provider_defined";
        }>;
        countryCodes: z.ZodArray<z.ZodString>;
        supportsRadius: z.ZodBoolean;
        supportsPolygon: z.ZodBoolean;
        supportsAdministrativeAreas: z.ZodBoolean;
    }, z.core.$strip>;
    pagination: z.ZodObject<{
        mode: z.ZodEnum<{
            cursor: "cursor";
            none: "none";
            offset: "offset";
            page: "page";
            stream: "stream";
            token: "token";
        }>;
        maxPageSize: z.ZodOptional<z.ZodNumber>;
        maxCursorLength: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    hardLimits: z.ZodObject<{
        maxRequests: z.ZodNumber;
        maxPages: z.ZodNumber;
        maxBytes: z.ZodNumber;
        maxCurrencyMicros: z.ZodNumber;
        maxRuntimeMs: z.ZodNumber;
        maxConcurrency: z.ZodNumber;
    }, z.core.$strip>;
    supportsAttribution: z.ZodBoolean;
    supportsDeletion: z.ZodBoolean;
    supportsRefresh: z.ZodBoolean;
    supportsRawPayloadReference: z.ZodBoolean;
}, z.core.$strip>;
export type SourceCapability = z.infer<typeof SourceCapabilitySchema>;
export declare const ConnectorPolicySchema: z.ZodObject<{
    policyId: z.ZodString;
    version: z.ZodString;
    sourceKey: z.ZodString;
    connectorKey: z.ZodString;
    state: z.ZodEnum<{
        APPROVED: "APPROVED";
        APPROVED_WITH_LIMITS: "APPROVED_WITH_LIMITS";
        BLOCKED: "BLOCKED";
        EXPIRED: "EXPIRED";
        REVIEW_REQUIRED: "REVIEW_REQUIRED";
        TRANSIENT_ONLY: "TRANSIENT_ONLY";
    }>;
    accessMethod: z.ZodEnum<{
        customer_authorized: "customer_authorized";
        first_party_web: "first_party_web";
        licensed_api: "licensed_api";
        manual_capture: "manual_capture";
        official_api: "official_api";
        open_data_dump: "open_data_dump";
        partner_protocol: "partner_protocol";
        public_web: "public_web";
        user_import: "user_import";
        webhook: "webhook";
    }>;
    policyLicenseRef: z.ZodString;
    policyLicenseVersion: z.ZodString;
    allowedPurposes: z.ZodArray<z.ZodString>;
    prohibitedPurposes: z.ZodArray<z.ZodString>;
    allowedFields: z.ZodArray<z.ZodString>;
    allowedDataClassifications: z.ZodArray<z.ZodEnum<{
        AUTH_SECRET: "AUTH_SECRET";
        COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
        CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
        INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
        PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
        PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
        SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
    }>>;
    storage: z.ZodObject<{
        allowedClasses: z.ZodArray<z.ZodEnum<{
            EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
            NORMALIZED_FACT: "NORMALIZED_FACT";
            REFERENCE_ONLY: "REFERENCE_ONLY";
            SOURCE_CONTENT: "SOURCE_CONTENT";
            TRANSIENT: "TRANSIENT";
        }>>;
        defaultClass: z.ZodEnum<{
            EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
            NORMALIZED_FACT: "NORMALIZED_FACT";
            REFERENCE_ONLY: "REFERENCE_ONLY";
            SOURCE_CONTENT: "SOURCE_CONTENT";
            TRANSIENT: "TRANSIENT";
        }>;
        rawPayloadStorageAllowed: z.ZodBoolean;
        cacheTtlSeconds: z.ZodNullable<z.ZodNumber>;
        retentionTtlSeconds: z.ZodNullable<z.ZodNumber>;
        deletionRequired: z.ZodBoolean;
        refreshAfterSeconds: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>;
    canonicalizationRule: z.ZodEnum<{
        customer_authoritative_with_conflict_rules: "customer_authoritative_with_conflict_rules";
        independent_verification_required: "independent_verification_required";
        normalized_candidate: "normalized_candidate";
        reference_only: "reference_only";
    }>;
    attribution: z.ZodObject<{
        required: z.ZodBoolean;
        policyRef: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    export: z.ZodObject<{
        mode: z.ZodEnum<{
            none: "none";
            policy_filtered: "policy_filtered";
            redistributable: "redistributable";
            reference_only: "reference_only";
        }>;
        allowedFields: z.ZodArray<z.ZodString>;
        attributionRequired: z.ZodBoolean;
    }, z.core.$strip>;
    personalData: z.ZodObject<{
        allowed: z.ZodBoolean;
        allowedFields: z.ZodArray<z.ZodString>;
        requiresPurposeReview: z.ZodBoolean;
        exportAllowed: z.ZodBoolean;
    }, z.core.$strip>;
    geography: z.ZodObject<{
        mode: z.ZodEnum<{
            country_allowlist: "country_allowlist";
            global: "global";
            provider_defined: "provider_defined";
        }>;
        allowedCountryCodes: z.ZodArray<z.ZodString>;
        blockedCountryCodes: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    robots: z.ZodObject<{
        mode: z.ZodEnum<{
            not_applicable: "not_applicable";
            provider_terms: "provider_terms";
            respect: "respect";
        }>;
        barrierBypassProhibited: z.ZodLiteral<true>;
    }, z.core.$strip>;
    quotas: z.ZodObject<{
        maxRequests: z.ZodNumber;
        maxPages: z.ZodNumber;
        maxBytes: z.ZodNumber;
        maxCurrencyMicros: z.ZodNumber;
        maxRuntimeMs: z.ZodNumber;
        maxConcurrency: z.ZodNumber;
    }, z.core.$strip>;
    cost: z.ZodObject<{
        currency: z.ZodString;
        estimatedRequestMicros: z.ZodNumber;
    }, z.core.$strip>;
    credentials: z.ZodObject<{
        allowedModes: z.ZodArray<z.ZodEnum<{
            api_key_ref: "api_key_ref";
            none: "none";
            oauth_ref: "oauth_ref";
            service_account_ref: "service_account_ref";
            user_authorized_ref: "user_authorized_ref";
        }>>;
        secretLoggingProhibited: z.ZodLiteral<true>;
        promptExposureProhibited: z.ZodLiteral<true>;
    }, z.core.$strip>;
    fallback: z.ZodObject<{
        allowed: z.ZodBoolean;
        connectorKeys: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    owner: z.ZodString;
    reviewedAt: z.ZodString;
    nextReviewAt: z.ZodString;
}, z.core.$strip>;
export type ConnectorPolicy = z.infer<typeof ConnectorPolicySchema>;
export declare const ConnectorDefinitionSchema: z.ZodObject<{
    connectorKey: z.ZodString;
    version: z.ZodString;
    sourceKey: z.ZodString;
    capabilityVersion: z.ZodString;
    policyId: z.ZodString;
    policyVersion: z.ZodString;
    accessMethod: z.ZodEnum<{
        customer_authorized: "customer_authorized";
        first_party_web: "first_party_web";
        licensed_api: "licensed_api";
        manual_capture: "manual_capture";
        official_api: "official_api";
        open_data_dump: "open_data_dump";
        partner_protocol: "partner_protocol";
        public_web: "public_web";
        user_import: "user_import";
        webhook: "webhook";
    }>;
    credentialMode: z.ZodEnum<{
        api_key_ref: "api_key_ref";
        none: "none";
        oauth_ref: "oauth_ref";
        service_account_ref: "service_account_ref";
        user_authorized_ref: "user_authorized_ref";
    }>;
    status: z.ZodEnum<{
        approved: "approved";
        disabled: "disabled";
        draft: "draft";
    }>;
    activation: z.ZodEnum<{
        disabled: "disabled";
        dry_run: "dry_run";
        enabled: "enabled";
    }>;
    implementationVersion: z.ZodString;
    owner: z.ZodString;
    changeReason: z.ZodString;
}, z.core.$strip>;
export type ConnectorDefinition = z.infer<typeof ConnectorDefinitionSchema>;
export declare const SourceRequestEnvelopeSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    requestId: z.ZodString;
    workspaceId: z.ZodString;
    researchJobId: z.ZodOptional<z.ZodString>;
    researchRunId: z.ZodOptional<z.ZodString>;
    workUnitId: z.ZodOptional<z.ZodString>;
    sourceTaskId: z.ZodString;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    sourceKey: z.ZodString;
    operation: z.ZodEnum<{
        detail: "detail";
        discover: "discover";
        fetch: "fetch";
        import: "import";
        list: "list";
        lookup: "lookup";
        search: "search";
        sync: "sync";
    }>;
    executionIntent: z.ZodEnum<{
        execute: "execute";
        preflight: "preflight";
    }>;
    purpose: z.ZodString;
    intendedUse: z.ZodString;
    requestedFields: z.ZodArray<z.ZodString>;
    requestedDataClassifications: z.ZodArray<z.ZodEnum<{
        AUTH_SECRET: "AUTH_SECRET";
        COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
        CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
        INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
        PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
        PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
        SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
    }>>;
    geography: z.ZodObject<{
        countryCodes: z.ZodArray<z.ZodString>;
        areaRefs: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    storageClass: z.ZodEnum<{
        EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
        NORMALIZED_FACT: "NORMALIZED_FACT";
        REFERENCE_ONLY: "REFERENCE_ONLY";
        SOURCE_CONTENT: "SOURCE_CONTENT";
        TRANSIENT: "TRANSIENT";
    }>;
    exportRequested: z.ZodBoolean;
    rawPayloadRequested: z.ZodBoolean;
    robotsDecision: z.ZodEnum<{
        allowed: "allowed";
        disallowed: "disallowed";
        not_applicable: "not_applicable";
        unknown: "unknown";
    }>;
    targetUrl: z.ZodOptional<z.ZodString>;
    query: z.ZodObject<{
        text: z.ZodOptional<z.ZodString>;
        categories: z.ZodArray<z.ZodString>;
        externalRefs: z.ZodArray<z.ZodString>;
        filters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>;
    pagination: z.ZodObject<{
        cursor: z.ZodOptional<z.ZodString>;
        page: z.ZodOptional<z.ZodNumber>;
        pageSize: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    budget: z.ZodObject<{
        maxRequests: z.ZodNumber;
        maxPages: z.ZodNumber;
        maxBytes: z.ZodNumber;
        maxCurrencyMicros: z.ZodNumber;
        maxRuntimeMs: z.ZodNumber;
        maxConcurrency: z.ZodNumber;
    }, z.core.$strip>;
    policySnapshot: z.ZodObject<{
        policyId: z.ZodString;
        policyVersion: z.ZodString;
    }, z.core.$strip>;
    requestedAt: z.ZodString;
}, z.core.$strip>;
export type SourceRequestEnvelope = z.infer<typeof SourceRequestEnvelopeSchema>;
export declare const ConnectorHealthSnapshotSchema: z.ZodObject<{
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    status: z.ZodEnum<{
        circuit_open: "circuit_open";
        degraded: "degraded";
        disabled: "disabled";
        rate_limited: "rate_limited";
        ready: "ready";
        unknown: "unknown";
    }>;
    observedAt: z.ZodString;
    quotaRemaining: z.ZodNullable<z.ZodNumber>;
    rollingErrorRate: z.ZodNumber;
    p95LatencyMs: z.ZodNullable<z.ZodNumber>;
    reasonCodes: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ConnectorHealthSnapshot = z.infer<typeof ConnectorHealthSnapshotSchema>;
export declare const ConnectorAdmissionInputSchema: z.ZodObject<{
    capability: z.ZodObject<{
        sourceKey: z.ZodString;
        version: z.ZodString;
        sourceClass: z.ZodEnum<{
            browser_manual_capture: "browser_manual_capture";
            careers_jobs: "careers_jobs";
            company_first_party: "company_first_party";
            customer_first_party: "customer_first_party";
            customer_import: "customer_import";
            funding_company_intelligence: "funding_company_intelligence";
            industry_directory: "industry_directory";
            licensed_b2b: "licensed_b2b";
            maps_local_api: "maps_local_api";
            news_search_index: "news_search_index";
            official_registry_open_data: "official_registry_open_data";
            partner_mcp: "partner_mcp";
            procurement_tender: "procurement_tender";
            review_reputation: "review_reputation";
            social_community: "social_community";
            technical_technology: "technical_technology";
        }>;
        accessMethods: z.ZodArray<z.ZodEnum<{
            customer_authorized: "customer_authorized";
            first_party_web: "first_party_web";
            licensed_api: "licensed_api";
            manual_capture: "manual_capture";
            official_api: "official_api";
            open_data_dump: "open_data_dump";
            partner_protocol: "partner_protocol";
            public_web: "public_web";
            user_import: "user_import";
            webhook: "webhook";
        }>>;
        operations: z.ZodArray<z.ZodEnum<{
            detail: "detail";
            discover: "discover";
            fetch: "fetch";
            import: "import";
            list: "list";
            lookup: "lookup";
            search: "search";
            sync: "sync";
        }>>;
        supportedFields: z.ZodArray<z.ZodString>;
        dataClassifications: z.ZodArray<z.ZodEnum<{
            AUTH_SECRET: "AUTH_SECRET";
            COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
            CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
            INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
            PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
            PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
            SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
        }>>;
        geography: z.ZodObject<{
            mode: z.ZodEnum<{
                country_allowlist: "country_allowlist";
                global: "global";
                provider_defined: "provider_defined";
            }>;
            countryCodes: z.ZodArray<z.ZodString>;
            supportsRadius: z.ZodBoolean;
            supportsPolygon: z.ZodBoolean;
            supportsAdministrativeAreas: z.ZodBoolean;
        }, z.core.$strip>;
        pagination: z.ZodObject<{
            mode: z.ZodEnum<{
                cursor: "cursor";
                none: "none";
                offset: "offset";
                page: "page";
                stream: "stream";
                token: "token";
            }>;
            maxPageSize: z.ZodOptional<z.ZodNumber>;
            maxCursorLength: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        hardLimits: z.ZodObject<{
            maxRequests: z.ZodNumber;
            maxPages: z.ZodNumber;
            maxBytes: z.ZodNumber;
            maxCurrencyMicros: z.ZodNumber;
            maxRuntimeMs: z.ZodNumber;
            maxConcurrency: z.ZodNumber;
        }, z.core.$strip>;
        supportsAttribution: z.ZodBoolean;
        supportsDeletion: z.ZodBoolean;
        supportsRefresh: z.ZodBoolean;
        supportsRawPayloadReference: z.ZodBoolean;
    }, z.core.$strip>;
    policy: z.ZodObject<{
        policyId: z.ZodString;
        version: z.ZodString;
        sourceKey: z.ZodString;
        connectorKey: z.ZodString;
        state: z.ZodEnum<{
            APPROVED: "APPROVED";
            APPROVED_WITH_LIMITS: "APPROVED_WITH_LIMITS";
            BLOCKED: "BLOCKED";
            EXPIRED: "EXPIRED";
            REVIEW_REQUIRED: "REVIEW_REQUIRED";
            TRANSIENT_ONLY: "TRANSIENT_ONLY";
        }>;
        accessMethod: z.ZodEnum<{
            customer_authorized: "customer_authorized";
            first_party_web: "first_party_web";
            licensed_api: "licensed_api";
            manual_capture: "manual_capture";
            official_api: "official_api";
            open_data_dump: "open_data_dump";
            partner_protocol: "partner_protocol";
            public_web: "public_web";
            user_import: "user_import";
            webhook: "webhook";
        }>;
        policyLicenseRef: z.ZodString;
        policyLicenseVersion: z.ZodString;
        allowedPurposes: z.ZodArray<z.ZodString>;
        prohibitedPurposes: z.ZodArray<z.ZodString>;
        allowedFields: z.ZodArray<z.ZodString>;
        allowedDataClassifications: z.ZodArray<z.ZodEnum<{
            AUTH_SECRET: "AUTH_SECRET";
            COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
            CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
            INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
            PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
            PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
            SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
        }>>;
        storage: z.ZodObject<{
            allowedClasses: z.ZodArray<z.ZodEnum<{
                EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
                NORMALIZED_FACT: "NORMALIZED_FACT";
                REFERENCE_ONLY: "REFERENCE_ONLY";
                SOURCE_CONTENT: "SOURCE_CONTENT";
                TRANSIENT: "TRANSIENT";
            }>>;
            defaultClass: z.ZodEnum<{
                EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
                NORMALIZED_FACT: "NORMALIZED_FACT";
                REFERENCE_ONLY: "REFERENCE_ONLY";
                SOURCE_CONTENT: "SOURCE_CONTENT";
                TRANSIENT: "TRANSIENT";
            }>;
            rawPayloadStorageAllowed: z.ZodBoolean;
            cacheTtlSeconds: z.ZodNullable<z.ZodNumber>;
            retentionTtlSeconds: z.ZodNullable<z.ZodNumber>;
            deletionRequired: z.ZodBoolean;
            refreshAfterSeconds: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>;
        canonicalizationRule: z.ZodEnum<{
            customer_authoritative_with_conflict_rules: "customer_authoritative_with_conflict_rules";
            independent_verification_required: "independent_verification_required";
            normalized_candidate: "normalized_candidate";
            reference_only: "reference_only";
        }>;
        attribution: z.ZodObject<{
            required: z.ZodBoolean;
            policyRef: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        export: z.ZodObject<{
            mode: z.ZodEnum<{
                none: "none";
                policy_filtered: "policy_filtered";
                redistributable: "redistributable";
                reference_only: "reference_only";
            }>;
            allowedFields: z.ZodArray<z.ZodString>;
            attributionRequired: z.ZodBoolean;
        }, z.core.$strip>;
        personalData: z.ZodObject<{
            allowed: z.ZodBoolean;
            allowedFields: z.ZodArray<z.ZodString>;
            requiresPurposeReview: z.ZodBoolean;
            exportAllowed: z.ZodBoolean;
        }, z.core.$strip>;
        geography: z.ZodObject<{
            mode: z.ZodEnum<{
                country_allowlist: "country_allowlist";
                global: "global";
                provider_defined: "provider_defined";
            }>;
            allowedCountryCodes: z.ZodArray<z.ZodString>;
            blockedCountryCodes: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        robots: z.ZodObject<{
            mode: z.ZodEnum<{
                not_applicable: "not_applicable";
                provider_terms: "provider_terms";
                respect: "respect";
            }>;
            barrierBypassProhibited: z.ZodLiteral<true>;
        }, z.core.$strip>;
        quotas: z.ZodObject<{
            maxRequests: z.ZodNumber;
            maxPages: z.ZodNumber;
            maxBytes: z.ZodNumber;
            maxCurrencyMicros: z.ZodNumber;
            maxRuntimeMs: z.ZodNumber;
            maxConcurrency: z.ZodNumber;
        }, z.core.$strip>;
        cost: z.ZodObject<{
            currency: z.ZodString;
            estimatedRequestMicros: z.ZodNumber;
        }, z.core.$strip>;
        credentials: z.ZodObject<{
            allowedModes: z.ZodArray<z.ZodEnum<{
                api_key_ref: "api_key_ref";
                none: "none";
                oauth_ref: "oauth_ref";
                service_account_ref: "service_account_ref";
                user_authorized_ref: "user_authorized_ref";
            }>>;
            secretLoggingProhibited: z.ZodLiteral<true>;
            promptExposureProhibited: z.ZodLiteral<true>;
        }, z.core.$strip>;
        fallback: z.ZodObject<{
            allowed: z.ZodBoolean;
            connectorKeys: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        owner: z.ZodString;
        reviewedAt: z.ZodString;
        nextReviewAt: z.ZodString;
    }, z.core.$strip>;
    connector: z.ZodObject<{
        connectorKey: z.ZodString;
        version: z.ZodString;
        sourceKey: z.ZodString;
        capabilityVersion: z.ZodString;
        policyId: z.ZodString;
        policyVersion: z.ZodString;
        accessMethod: z.ZodEnum<{
            customer_authorized: "customer_authorized";
            first_party_web: "first_party_web";
            licensed_api: "licensed_api";
            manual_capture: "manual_capture";
            official_api: "official_api";
            open_data_dump: "open_data_dump";
            partner_protocol: "partner_protocol";
            public_web: "public_web";
            user_import: "user_import";
            webhook: "webhook";
        }>;
        credentialMode: z.ZodEnum<{
            api_key_ref: "api_key_ref";
            none: "none";
            oauth_ref: "oauth_ref";
            service_account_ref: "service_account_ref";
            user_authorized_ref: "user_authorized_ref";
        }>;
        status: z.ZodEnum<{
            approved: "approved";
            disabled: "disabled";
            draft: "draft";
        }>;
        activation: z.ZodEnum<{
            disabled: "disabled";
            dry_run: "dry_run";
            enabled: "enabled";
        }>;
        implementationVersion: z.ZodString;
        owner: z.ZodString;
        changeReason: z.ZodString;
    }, z.core.$strip>;
    request: z.ZodObject<{
        version: z.ZodLiteral<"1.0.0">;
        requestId: z.ZodString;
        workspaceId: z.ZodString;
        researchJobId: z.ZodOptional<z.ZodString>;
        researchRunId: z.ZodOptional<z.ZodString>;
        workUnitId: z.ZodOptional<z.ZodString>;
        sourceTaskId: z.ZodString;
        connectorKey: z.ZodString;
        connectorVersion: z.ZodString;
        sourceKey: z.ZodString;
        operation: z.ZodEnum<{
            detail: "detail";
            discover: "discover";
            fetch: "fetch";
            import: "import";
            list: "list";
            lookup: "lookup";
            search: "search";
            sync: "sync";
        }>;
        executionIntent: z.ZodEnum<{
            execute: "execute";
            preflight: "preflight";
        }>;
        purpose: z.ZodString;
        intendedUse: z.ZodString;
        requestedFields: z.ZodArray<z.ZodString>;
        requestedDataClassifications: z.ZodArray<z.ZodEnum<{
            AUTH_SECRET: "AUTH_SECRET";
            COMMERCIAL_CONFIDENTIAL: "COMMERCIAL_CONFIDENTIAL";
            CUSTOMER_FIRST_PARTY: "CUSTOMER_FIRST_PARTY";
            INTERNAL_WORKSPACE: "INTERNAL_WORKSPACE";
            PERSONAL_BUSINESS_CONTACT: "PERSONAL_BUSINESS_CONTACT";
            PUBLIC_BUSINESS: "PUBLIC_BUSINESS";
            SECURITY_SENSITIVE: "SECURITY_SENSITIVE";
        }>>;
        geography: z.ZodObject<{
            countryCodes: z.ZodArray<z.ZodString>;
            areaRefs: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        storageClass: z.ZodEnum<{
            EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
            NORMALIZED_FACT: "NORMALIZED_FACT";
            REFERENCE_ONLY: "REFERENCE_ONLY";
            SOURCE_CONTENT: "SOURCE_CONTENT";
            TRANSIENT: "TRANSIENT";
        }>;
        exportRequested: z.ZodBoolean;
        rawPayloadRequested: z.ZodBoolean;
        robotsDecision: z.ZodEnum<{
            allowed: "allowed";
            disallowed: "disallowed";
            not_applicable: "not_applicable";
            unknown: "unknown";
        }>;
        targetUrl: z.ZodOptional<z.ZodString>;
        query: z.ZodObject<{
            text: z.ZodOptional<z.ZodString>;
            categories: z.ZodArray<z.ZodString>;
            externalRefs: z.ZodArray<z.ZodString>;
            filters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>;
        pagination: z.ZodObject<{
            cursor: z.ZodOptional<z.ZodString>;
            page: z.ZodOptional<z.ZodNumber>;
            pageSize: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        budget: z.ZodObject<{
            maxRequests: z.ZodNumber;
            maxPages: z.ZodNumber;
            maxBytes: z.ZodNumber;
            maxCurrencyMicros: z.ZodNumber;
            maxRuntimeMs: z.ZodNumber;
            maxConcurrency: z.ZodNumber;
        }, z.core.$strip>;
        policySnapshot: z.ZodObject<{
            policyId: z.ZodString;
            policyVersion: z.ZodString;
        }, z.core.$strip>;
        requestedAt: z.ZodString;
    }, z.core.$strip>;
    health: z.ZodObject<{
        connectorKey: z.ZodString;
        connectorVersion: z.ZodString;
        status: z.ZodEnum<{
            circuit_open: "circuit_open";
            degraded: "degraded";
            disabled: "disabled";
            rate_limited: "rate_limited";
            ready: "ready";
            unknown: "unknown";
        }>;
        observedAt: z.ZodString;
        quotaRemaining: z.ZodNullable<z.ZodNumber>;
        rollingErrorRate: z.ZodNumber;
        p95LatencyMs: z.ZodNullable<z.ZodNumber>;
        reasonCodes: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    evaluatedAt: z.ZodString;
    maxHealthAgeSeconds: z.ZodNumber;
}, z.core.$strip>;
export type ConnectorAdmissionInput = z.infer<typeof ConnectorAdmissionInputSchema>;
export declare const ConnectorAdmissionDecisionSchema: z.ZodObject<{
    decision: z.ZodEnum<{
        allow: "allow";
        blocked: "blocked";
        review_required: "review_required";
    }>;
    reasonCodes: z.ZodArray<z.ZodString>;
    warnings: z.ZodArray<z.ZodString>;
    policySnapshot: z.ZodObject<{
        policyId: z.ZodString;
        policyVersion: z.ZodString;
    }, z.core.$strip>;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    sourceKey: z.ZodString;
    operation: z.ZodEnum<{
        detail: "detail";
        discover: "discover";
        fetch: "fetch";
        import: "import";
        list: "list";
        lookup: "lookup";
        search: "search";
        sync: "sync";
    }>;
    storageClass: z.ZodEnum<{
        EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
        NORMALIZED_FACT: "NORMALIZED_FACT";
        REFERENCE_ONLY: "REFERENCE_ONLY";
        SOURCE_CONTENT: "SOURCE_CONTENT";
        TRANSIENT: "TRANSIENT";
    }>;
    allowedStorageClasses: z.ZodArray<z.ZodEnum<{
        EVIDENCE_MINIMAL: "EVIDENCE_MINIMAL";
        NORMALIZED_FACT: "NORMALIZED_FACT";
        REFERENCE_ONLY: "REFERENCE_ONLY";
        SOURCE_CONTENT: "SOURCE_CONTENT";
        TRANSIENT: "TRANSIENT";
    }>>;
    exportAllowed: z.ZodBoolean;
    rawPayloadAllowed: z.ZodBoolean;
    effectiveBudget: z.ZodObject<{
        maxRequests: z.ZodNumber;
        maxPages: z.ZodNumber;
        maxBytes: z.ZodNumber;
        maxCurrencyMicros: z.ZodNumber;
        maxRuntimeMs: z.ZodNumber;
        maxConcurrency: z.ZodNumber;
    }, z.core.$strip>;
    evaluatedAt: z.ZodString;
}, z.core.$strip>;
export type ConnectorAdmissionDecision = z.infer<typeof ConnectorAdmissionDecisionSchema>;
export declare function evaluateConnectorAdmission(rawInput: ConnectorAdmissionInput): ConnectorAdmissionDecision;
export declare const SourceReferenceSchema: z.ZodObject<{
    referenceId: z.ZodString;
    sourceKey: z.ZodString;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    externalId: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    observedAt: z.ZodOptional<z.ZodString>;
    fetchedAt: z.ZodString;
    contentHash: z.ZodOptional<z.ZodString>;
    attribution: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SourceReference = z.infer<typeof SourceReferenceSchema>;
export declare const SourceCandidateSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type SourceCandidate = z.infer<typeof SourceCandidateSchema>;
export declare const SourceResultEnvelopeSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    requestId: z.ZodString;
    workspaceId: z.ZodString;
    sourceTaskId: z.ZodString;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    sourceKey: z.ZodString;
    policySnapshot: z.ZodObject<{
        policyId: z.ZodString;
        policyVersion: z.ZodString;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        blocked: "blocked";
        complete: "complete";
        empty: "empty";
        failed: "failed";
        partial: "partial";
    }>;
    sourceReferences: z.ZodArray<z.ZodObject<{
        referenceId: z.ZodString;
        sourceKey: z.ZodString;
        connectorKey: z.ZodString;
        connectorVersion: z.ZodString;
        externalId: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        observedAt: z.ZodOptional<z.ZodString>;
        fetchedAt: z.ZodString;
        contentHash: z.ZodOptional<z.ZodString>;
        attribution: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
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
    rawPayloadRefs: z.ZodArray<z.ZodString>;
    nextCursor: z.ZodOptional<z.ZodString>;
    usage: z.ZodObject<{
        requests: z.ZodNumber;
        pages: z.ZodNumber;
        bytes: z.ZodNumber;
        currencyMicros: z.ZodNumber;
        runtimeMs: z.ZodNumber;
    }, z.core.$strip>;
    coverage: z.ZodObject<{
        state: z.ZodEnum<{
            complete: "complete";
            partial: "partial";
            unknown: "unknown";
        }>;
        returnedRecords: z.ZodNumber;
        estimatedTotalRecords: z.ZodNullable<z.ZodNumber>;
        notes: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    errors: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        classification: z.ZodEnum<{
            partial: "partial";
            permanent: "permanent";
            policy: "policy";
            quota: "quota";
            retryable: "retryable";
        }>;
        message: z.ZodString;
    }, z.core.$strip>>;
    completedAt: z.ZodString;
}, z.core.$strip>;
export type SourceResultEnvelope = z.infer<typeof SourceResultEnvelopeSchema>;
export declare const SourceResultValidationSchema: z.ZodObject<{
    valid: z.ZodBoolean;
    issues: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type SourceResultValidation = z.infer<typeof SourceResultValidationSchema>;
export declare function validateSourceResultAgainstAdmission(input: {
    result: SourceResultEnvelope;
    request: SourceRequestEnvelope;
    capability: SourceCapability;
    policy: ConnectorPolicy;
    admission: ConnectorAdmissionDecision;
}): SourceResultValidation;
