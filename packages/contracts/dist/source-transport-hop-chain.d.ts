import { z } from 'zod';
declare const SourceTransportRedirectEvidenceSchema: z.ZodObject<{
    fromTransportRequestId: z.ZodString;
    fromUrl: z.ZodString;
    status: z.ZodNumber;
    location: z.ZodString;
    observedAt: z.ZodString;
}, z.core.$strip>;
export type SourceTransportRedirectEvidence = z.infer<typeof SourceTransportRedirectEvidenceSchema>;
export declare const SourceTransportHopEvidenceSchema: z.ZodObject<{
    hopIndex: z.ZodNumber;
    transportRequestId: z.ZodString;
    url: z.ZodString;
    requestedAt: z.ZodString;
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
    previousRedirect: z.ZodNullable<z.ZodObject<{
        fromTransportRequestId: z.ZodString;
        fromUrl: z.ZodString;
        status: z.ZodNumber;
        location: z.ZodString;
        observedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SourceTransportHopEvidence = z.infer<typeof SourceTransportHopEvidenceSchema>;
export declare const SourceTransportHopChainSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0.0">;
    sourceRequestId: z.ZodString;
    sourceTaskId: z.ZodString;
    connectorKey: z.ZodString;
    connectorVersion: z.ZodString;
    transportPolicyId: z.ZodString;
    transportPolicyVersion: z.ZodString;
    revalidateEachHop: z.ZodLiteral<true>;
    hops: z.ZodArray<z.ZodObject<{
        hopIndex: z.ZodNumber;
        transportRequestId: z.ZodString;
        url: z.ZodString;
        requestedAt: z.ZodString;
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
        previousRedirect: z.ZodNullable<z.ZodObject<{
            fromTransportRequestId: z.ZodString;
            fromUrl: z.ZodString;
            status: z.ZodNumber;
            location: z.ZodString;
            observedAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SourceTransportHopChain = z.infer<typeof SourceTransportHopChainSchema>;
export interface SourceTransportRebindingObservation {
    hopIndex: number;
    hostname: string;
    previousAddresses: string[];
    currentAddresses: string[];
}
export declare function observeSourceTransportRebinding(rawChain: SourceTransportHopChain): SourceTransportRebindingObservation[];
export {};
