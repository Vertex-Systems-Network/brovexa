export interface SourceNetworkAdversarialCase {
    id: string;
    address: string;
    threat: 'metadata' | 'loopback' | 'private' | 'link_local' | 'multicast' | 'documentation' | 'reserved' | 'mapped_private';
    expectedDecision: 'block';
}
export declare const sourceNetworkAdversarialCases: readonly SourceNetworkAdversarialCase[];
export declare function adversarialSourceNetworkCaseIdsAreUnique(): boolean;
