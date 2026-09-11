import { classifySourceIpAddress } from './source-ip-classifier';

export interface SourceNetworkResolutionPolicyResult {
  decision: 'allow' | 'block';
  reason: 'ALL_PUBLIC' | 'NO_ADDRESSES' | 'NON_PUBLIC_OR_INVALID_ADDRESS' | 'DUPLICATE_ADDRESS';
  classifications: readonly ReturnType<typeof classifySourceIpAddress>[];
}

export function evaluateSourceNetworkResolution(
  addresses: readonly string[],
): SourceNetworkResolutionPolicyResult {
  if (addresses.length === 0) {
    return { decision: 'block', reason: 'NO_ADDRESSES', classifications: [] };
  }

  const classifications = addresses.map((address) => classifySourceIpAddress(address));
  const canonicalKeys = classifications.map((entry) => `${entry.family}:${entry.address}`);
  if (new Set(canonicalKeys).size !== canonicalKeys.length) {
    return { decision: 'block', reason: 'DUPLICATE_ADDRESS', classifications };
  }

  if (classifications.some((entry) => entry.classification !== 'public')) {
    return { decision: 'block', reason: 'NON_PUBLIC_OR_INVALID_ADDRESS', classifications };
  }

  return { decision: 'allow', reason: 'ALL_PUBLIC', classifications };
}
