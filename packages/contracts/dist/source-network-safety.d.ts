import type { SourceTransportAddressClass } from './source-transport-address';
export type SourceNetworkSafetyDecisionCode = 'ALL_ADDRESSES_PUBLIC' | 'NO_RESOLVED_ADDRESSES' | 'NON_PUBLIC_ADDRESS_PRESENT';
export interface SourceNetworkSafetyDecision {
    decision: 'allow' | 'block';
    code: SourceNetworkSafetyDecisionCode;
    observedClasses: readonly SourceTransportAddressClass[];
}
export declare function decideSourceNetworkSafety(addressClasses: readonly SourceTransportAddressClass[]): SourceNetworkSafetyDecision;
/**
 * Classify an IP address into its network safety class.
 * Supports both IPv4 and IPv6 addresses.
 */
export declare function classifySourceAddress(address: string, family: 4 | 6): {
    classification: SourceTransportAddressClass;
};
