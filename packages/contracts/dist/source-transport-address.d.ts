import { z } from 'zod';
export declare const sourceTransportAddressClassValues: readonly ['public', 'private', 'loopback', 'link_local', 'metadata', 'multicast', 'unspecified', 'documentation', 'reserved', 'invalid'];
export declare const SourceTransportAddressClassSchema: z.ZodEnum<{
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
export type SourceTransportAddressClass = z.infer<typeof SourceTransportAddressClassSchema>;
