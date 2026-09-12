import { z } from 'zod';
export { SourceTransportAddressClassSchema, sourceTransportAddressClassValues } from './source-transport-address';
export type { SourceTransportAddressClass } from './source-transport-address';
export declare const sourceTransportNetworkModeValues: readonly ['disabled', 'test_only', 'provider_network'];
export declare const SourceTransportNetworkModeSchema: z.ZodEnum<{
    disabled: "disabled";
    provider_network: "provider_network";
    test_only: "test_only";
}>;
export type SourceTransportNetworkMode = z.infer<typeof SourceTransportNetworkModeSchema>;
export declare const sourceTransportMethodValues: readonly ['GET', 'HEAD', 'POST'];
export declare const SourceTransportMethodSchema: z.ZodEnum<{
    GET: "GET";
    HEAD: "HEAD";
    POST: "POST";
}>;
export type SourceTransportMethod = z.infer<typeof SourceTransportMethodSchema>;
export declare const SourceTransportPolicySchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    transportPolicyId: z.ZodString;
    transportPolicyVersion: z.ZodString;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    sourcePolicySnapshot: z.ZodObject<{
        policyId: z.ZodString;
        policyVersion: z.ZodString;
    }, z.core.$strip>;
    networkMode: z.ZodEnum<{
        disabled: "disabled";
        provider_network: "provider_network";
        test_only: "test_only";
    }>;
    allowedSchemes: z.ZodArray<z.ZodEnum<{
        http: "http";
        https: "https";
    }>>;
    allowCleartextHttp: z.ZodBoolean;
    allowedMethods: z.ZodArray<z.ZodEnum<{
        GET: "GET";
        HEAD: "HEAD";
        POST: "POST";
    }>>;
    allowedPorts: z.ZodArray<z.ZodNumber>;
    allowIpLiteralHosts: z.ZodBoolean;
    hostPolicy: z.ZodObject<{
        mode: z.ZodEnum<{
            allowlist: "allowlist";
            public_internet: "public_internet";
        }>;
        exactHosts: z.ZodArray<z.ZodString>;
        domainSuffixes: z.ZodArray<z.ZodString>;
        deniedHosts: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    redirects: z.ZodObject<{
        maxHops: z.ZodNumber;
        revalidateEachHop: z.ZodLiteral<true>;
    }, z.core.$strip>;
    dns: z.ZodObject<{
        requireFreshResolutionEachHop: z.ZodLiteral<true>;
        blockNonPublicAddressClasses: z.ZodLiteral<true>;
        maxResolutionAgeSeconds: z.ZodNumber;
    }, z.core.$strip>;
    limits: z.ZodObject<{
        maxResponseBytes: z.ZodNumber;
        maxTimeoutMs: z.ZodNumber;
    }, z.core.$strip>;
    allowedContentTypes: z.ZodArray<z.ZodString>;
    security: z.ZodObject<{
        ambientCredentialsProhibited: z.ZodLiteral<true>;
        urlCredentialsProhibited: z.ZodLiteral<true>;
        proxyAuthFromEnvironmentProhibited: z.ZodLiteral<true>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type SourceTransportPolicy = z.infer<typeof SourceTransportPolicySchema>;
export declare const SourceTransportRequestSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    transportRequestId: z.ZodString;
    sourceRequestId: z.ZodString;
    sourceTaskId: z.ZodString;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    url: z.ZodString;
    method: z.ZodEnum<{
        GET: "GET";
        HEAD: "HEAD";
        POST: "POST";
    }>;
    transportKind: z.ZodEnum<{
        network: "network";
        test: "test";
    }>;
    redirectHop: z.ZodNumber;
    maxResponseBytes: z.ZodNumber;
    timeoutMs: z.ZodNumber;
    acceptedContentTypes: z.ZodArray<z.ZodString>;
    requestedAt: z.ZodString;
}, z.core.$strip>;
export type SourceTransportRequest = z.infer<typeof SourceTransportRequestSchema>;
export declare const SourceTransportResolutionSchema: z.ZodObject<{
    transportRequestId: z.ZodString;
    url: z.ZodString;
    hostname: z.ZodString;
    resolvedAt: z.ZodString;
    addresses: z.ZodArray<z.ZodObject<{
        address: z.ZodString;
        family: z.ZodUnion<readonly [z.ZodLiteral<4>, z.ZodLiteral<6>]>;
        classification: z.ZodEnum<{
            documentation: "documentation";
            invalid: "invalid";
            link_local: "link_local";
            loopback: "loopback";
            metadata: "metadata";
            multicast: "multicast";
            private: "private";
            public: "public";
            reserved: "reserved";
            unspecified: "unspecified";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SourceTransportResolution = z.infer<typeof SourceTransportResolutionSchema>;
export declare const SourceTransportAdmissionInputSchema: z.ZodObject<{
    policy: z.ZodObject<{
        version: z.ZodLiteral<"1.0.0">;
        transportPolicyId: z.ZodString;
        transportPolicyVersion: z.ZodString;
        connectorKey: z.ZodString;
        connectorVersion: z.ZodString;
        sourcePolicySnapshot: z.ZodObject<{
            policyId: z.ZodString;
            policyVersion: z.ZodString;
        }, z.core.$strip>;
        networkMode: z.ZodEnum<{
            disabled: "disabled";
            provider_network: "provider_network";
            test_only: "test_only";
        }>;
        allowedSchemes: z.ZodArray<z.ZodEnum<{
            http: "http";
            https: "https";
        }>>;
        allowCleartextHttp: z.ZodBoolean;
        allowedMethods: z.ZodArray<z.ZodEnum<{
            GET: "GET";
            HEAD: "HEAD";
            POST: "POST";
        }>>;
        allowedPorts: z.ZodArray<z.ZodNumber>;
        allowIpLiteralHosts: z.ZodBoolean;
        hostPolicy: z.ZodObject<{
            mode: z.ZodEnum<{
                allowlist: "allowlist";
                public_internet: "public_internet";
            }>;
            exactHosts: z.ZodArray<z.ZodString>;
            domainSuffixes: z.ZodArray<z.ZodString>;
            deniedHosts: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        redirects: z.ZodObject<{
            maxHops: z.ZodNumber;
            revalidateEachHop: z.ZodLiteral<true>;
        }, z.core.$strip>;
        dns: z.ZodObject<{
            requireFreshResolutionEachHop: z.ZodLiteral<true>;
            blockNonPublicAddressClasses: z.ZodLiteral<true>;
            maxResolutionAgeSeconds: z.ZodNumber;
        }, z.core.$strip>;
        limits: z.ZodObject<{
            maxResponseBytes: z.ZodNumber;
            maxTimeoutMs: z.ZodNumber;
        }, z.core.$strip>;
        allowedContentTypes: z.ZodArray<z.ZodString>;
        security: z.ZodObject<{
            ambientCredentialsProhibited: z.ZodLiteral<true>;
            urlCredentialsProhibited: z.ZodLiteral<true>;
            proxyAuthFromEnvironmentProhibited: z.ZodLiteral<true>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    sourceRequest: z.ZodObject<{
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
    request: z.ZodObject<{
        version: z.ZodLiteral<"1.0.0">;
        transportRequestId: z.ZodString;
        sourceRequestId: z.ZodString;
        sourceTaskId: z.ZodString;
        connectorKey: z.ZodString;
        connectorVersion: z.ZodString;
        url: z.ZodString;
        method: z.ZodEnum<{
            GET: "GET";
            HEAD: "HEAD";
            POST: "POST";
        }>;
        transportKind: z.ZodEnum<{
            network: "network";
            test: "test";
        }>;
        redirectHop: z.ZodNumber;
        maxResponseBytes: z.ZodNumber;
        timeoutMs: z.ZodNumber;
        acceptedContentTypes: z.ZodArray<z.ZodString>;
        requestedAt: z.ZodString;
    }, z.core.$strip>;
    resolution: z.ZodObject<{
        transportRequestId: z.ZodString;
        url: z.ZodString;
        hostname: z.ZodString;
        resolvedAt: z.ZodString;
        addresses: z.ZodArray<z.ZodObject<{
            address: z.ZodString;
            family: z.ZodUnion<readonly [z.ZodLiteral<4>, z.ZodLiteral<6>]>;
            classification: z.ZodEnum<{
                documentation: "documentation";
                invalid: "invalid";
                link_local: "link_local";
                loopback: "loopback";
                metadata: "metadata";
                multicast: "multicast";
                private: "private";
                public: "public";
                reserved: "reserved";
                unspecified: "unspecified";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    evaluatedAt: z.ZodString;
}, z.core.$strip>;
export type SourceTransportAdmissionInput = z.infer<typeof SourceTransportAdmissionInputSchema>;
export declare const SourceTransportAdmissionDecisionSchema: z.ZodObject<{
    decision: z.ZodEnum<{
        allow: "allow";
        blocked: "blocked";
    }>;
    reasonCodes: z.ZodArray<z.ZodString>;
    warnings: z.ZodArray<z.ZodString>;
    transportPolicyId: z.ZodString;
    transportPolicyVersion: z.ZodString;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    sourceRequestId: z.ZodString;
    transportRequestId: z.ZodString;
    canonicalUrl: z.ZodString;
    hostname: z.ZodString;
    port: z.ZodNullable<z.ZodNumber>;
    maxResponseBytes: z.ZodNumber;
    timeoutMs: z.ZodNumber;
    evaluatedAt: z.ZodString;
}, z.core.$strip>;
export type SourceTransportAdmissionDecision = z.infer<typeof SourceTransportAdmissionDecisionSchema>;
export declare function evaluateSourceTransportAdmission(rawInput: SourceTransportAdmissionInput): SourceTransportAdmissionDecision;
