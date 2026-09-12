import type { SourceTransportAddressClass } from './source-transport-address';
export type SourceNetworkSafetyDecisionCode = 'ALL_ADDRESSES_PUBLIC' | 'NO_RESOLVED_ADDRESSES' | 'NON_PUBLIC_ADDRESS_PRESENT';
export interface SourceNetworkSafetyDecision {
    decision: 'allow' | 'block';
    code: SourceNetworkSafetyDecisionCode;
    observedClasses: readonly SourceTransportAddressClass[];
}
export declare function decideSourceNetworkSafety(addressClasses: readonly SourceTransportAddressClass[]): SourceNetworkSafetyDecision;
