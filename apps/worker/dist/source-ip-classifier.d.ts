export type SourceIpAddressClass = 'public' | 'private' | 'loopback' | 'link_local' | 'metadata' | 'multicast' | 'unspecified' | 'documentation' | 'reserved' | 'invalid';
export interface SourceIpClassification {
    address: string;
    family: 0 | 4 | 6;
    classification: SourceIpAddressClass;
}
export declare function classifySourceIpAddress(rawAddress: string): SourceIpClassification;
export declare function isPublicSourceIpAddress(address: string): boolean;
