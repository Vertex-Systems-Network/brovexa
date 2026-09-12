import { z } from 'zod';
export declare function sourceResolutionAddressKey(address: string, family: 4 | 6): string;
export declare const SourceResolvedAddressEvidenceSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type SourceResolvedAddressEvidence = z.infer<typeof SourceResolvedAddressEvidenceSchema>;
export declare const SourceTransportResolutionEvidenceSchema: z.ZodObject<{
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
export type SourceTransportResolutionEvidence = z.infer<typeof SourceTransportResolutionEvidenceSchema>;
