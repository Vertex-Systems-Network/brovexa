export interface SourceAdapterResolutionBindingInput {
  transportRequestId: string;
  canonicalUrl: string;
  hostname: string;
  resolvedAt: string;
  resolvedAddressKeys: readonly string[];
}

export interface SourceAdapterResolutionBinding extends SourceAdapterResolutionBindingInput {
  version: 1;
}

function normalizedToken(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new Error(`SOURCE_ADAPTER_RESOLUTION_INVALID_${field.toUpperCase()}`);
  }
  return normalized;
}

export function bindSourceAdapterResolution(
  input: SourceAdapterResolutionBindingInput,
): SourceAdapterResolutionBinding {
  const keys = input.resolvedAddressKeys.map((value) => normalizedToken(value, 'address_key', 96));
  if (keys.length === 0 || keys.length > 32) {
    throw new Error('SOURCE_ADAPTER_RESOLUTION_INVALID_ADDRESS_COUNT');
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error('SOURCE_ADAPTER_RESOLUTION_DUPLICATE_ADDRESS');
  }

  const resolvedAt = normalizedToken(input.resolvedAt, 'resolved_at', 64);
  if (!Number.isFinite(Date.parse(resolvedAt))) {
    throw new Error('SOURCE_ADAPTER_RESOLUTION_INVALID_RESOLVED_AT');
  }

  return {
    version: 1,
    transportRequestId: normalizedToken(input.transportRequestId, 'transport_request_id', 128),
    canonicalUrl: normalizedToken(input.canonicalUrl, 'canonical_url', 2048),
    hostname: normalizedToken(input.hostname.toLowerCase(), 'hostname', 253),
    resolvedAt,
    resolvedAddressKeys: keys,
  };
}
