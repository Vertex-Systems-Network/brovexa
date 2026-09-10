import type { SourceTransportAddressClass } from './source-transport-address';

export type SourceNetworkSafetyDecisionCode =
  | 'ALL_ADDRESSES_PUBLIC'
  | 'NO_RESOLVED_ADDRESSES'
  | 'NON_PUBLIC_ADDRESS_PRESENT';

export interface SourceNetworkSafetyDecision {
  decision: 'allow' | 'block';
  code: SourceNetworkSafetyDecisionCode;
  observedClasses: readonly SourceTransportAddressClass[];
}

export function decideSourceNetworkSafety(
  addressClasses: readonly SourceTransportAddressClass[],
): SourceNetworkSafetyDecision {
  const observedClasses = [...addressClasses];

  if (observedClasses.length === 0) {
    return {
      decision: 'block',
      code: 'NO_RESOLVED_ADDRESSES',
      observedClasses,
    };
  }

  if (observedClasses.some((classification) => classification !== 'public')) {
    return {
      decision: 'block',
      code: 'NON_PUBLIC_ADDRESS_PRESENT',
      observedClasses,
    };
  }

  return {
    decision: 'allow',
    code: 'ALL_ADDRESSES_PUBLIC',
    observedClasses,
  };
}
