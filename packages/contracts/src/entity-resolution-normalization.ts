import {
  BusinessIdentitySignalSchema,
  type BusinessIdentitySignal,
  type BusinessIdentitySignalKind,
} from './entity-resolution';

export const ENTITY_RESOLUTION_NORMALIZATION_VERSION = '1.0.0' as const;
export const MAX_ENTITY_RESOLUTION_CANDIDATE_KEYS = 256;

export type RawBusinessIdentitySignal = Pick<
  BusinessIdentitySignal,
  'signalId' | 'kind' | 'rawValue' | 'sourceScope' | 'sourceReferenceIds'
>;

export const deterministicCandidateKeyKindValues = [
  'domain_exact',
  'source_external_ref_exact',
  'name_address',
  'name_locality',
  'name_region',
  'name_country_code',
  'name_postal_code',
] as const;

export type DeterministicCandidateKeyKind = (typeof deterministicCandidateKeyKindValues)[number];
export type DeterministicCandidateKeyStrength = 'exact' | 'suggestive';

export interface DeterministicEntityCandidateKey {
  keyKind: DeterministicCandidateKeyKind;
  keyValue: string;
  keyScope: string | null;
  strength: DeterministicCandidateKeyStrength;
  reasonCode: string;
  signalIds: string[];
  sourceReferenceIds: string[];
}

export interface DeterministicCandidateGeneration {
  normalizationVersion: typeof ENTITY_RESOLUTION_NORMALIZATION_VERSION;
  normalizedSignals: BusinessIdentitySignal[];
  keys: DeterministicEntityCandidateKey[];
  conflictReasonCodes: string[];
  requiresReviewBeforeMatch: boolean;
}

const locationCandidateKinds = {
  address: ['name_address', 'identity_name_address'],
  locality: ['name_locality', 'identity_name_locality'],
  region: ['name_region', 'identity_name_region'],
  country_code: ['name_country_code', 'identity_name_country_code'],
  postal_code: ['name_postal_code', 'identity_name_postal_code'],
} as const;

function nonEmptyNormalized(value: string, label: string): string {
  const normalized = value.normalize('NFKC').trim();
  if (!normalized) throw new Error(`${label} must not normalize to an empty value.`);
  return normalized;
}

function normalizeWords(rawValue: string): string {
  return nonEmptyNormalized(rawValue, 'Identity value')
    .replace(/&/g, ' and ')
    .toLocaleLowerCase('en-US')
    .replace(/[!"#$%'()*+,./:;<=>?@[\\\]^_`{|}~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDomain(rawValue: string): string {
  const value = nonEmptyNormalized(rawValue, 'Domain');
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Domain signal must be a valid hostname or credential-free HTTP(S) origin.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Domain signal supports only HTTP(S) hostname forms.');
  }
  if (url.username || url.password) {
    throw new Error('Domain signal must not contain credentials.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Domain signal must contain a hostname only, without path, query, or fragment.');
  }

  const hostname = url.hostname.toLocaleLowerCase('en-US').replace(/\.$/, '');
  if (!hostname || hostname.startsWith('.') || hostname.endsWith('.') || hostname.includes('..')) {
    throw new Error('Domain signal must normalize to a valid non-empty hostname.');
  }
  return hostname;
}

export function normalizeBusinessIdentityValue(
  kind: BusinessIdentitySignalKind,
  rawValue: string,
): string {
  switch (kind) {
    case 'business_name':
    case 'address':
    case 'locality':
    case 'region':
      return normalizeWords(rawValue);
    case 'domain':
      return normalizeDomain(rawValue);
    case 'country_code': {
      const countryCode = nonEmptyNormalized(rawValue, 'Country code')
        .toLocaleUpperCase('en-US')
        .replace(/[^A-Z]/g, '');
      if (!/^[A-Z]{2}$/.test(countryCode)) {
        throw new Error('country_code must normalize to exactly two ASCII letters.');
      }
      return countryCode;
    }
    case 'postal_code':
      return nonEmptyNormalized(rawValue, 'Postal code')
        .toLocaleUpperCase('en-US')
        .replace(/[\s-]+/g, '');
    case 'source_external_ref':
      return nonEmptyNormalized(rawValue, 'Source external reference');
  }
}

export function normalizeBusinessIdentitySignal(
  signal: RawBusinessIdentitySignal,
): BusinessIdentitySignal {
  return BusinessIdentitySignalSchema.parse({
    ...signal,
    sourceReferenceIds: [...signal.sourceReferenceIds],
    normalizedValue: normalizeBusinessIdentityValue(signal.kind, signal.rawValue),
    normalizationVersion: ENTITY_RESOLUTION_NORMALIZATION_VERSION,
  });
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function keyIdentity(key: Pick<DeterministicEntityCandidateKey, 'keyKind' | 'keyScope' | 'keyValue'>): string {
  return [key.keyKind, key.keyScope ?? '', key.keyValue].join('\u0000');
}

function compareKeys(left: DeterministicEntityCandidateKey, right: DeterministicEntityCandidateKey): number {
  const a = keyIdentity(left);
  const b = keyIdentity(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function distinctValues(signals: readonly BusinessIdentitySignal[]): string[] {
  return sortedUnique(signals.map((signal) => signal.normalizedValue));
}

export function generateDeterministicEntityCandidateKeys(
  signals: readonly RawBusinessIdentitySignal[],
): DeterministicCandidateGeneration {
  const normalizedSignals = signals
    .map(normalizeBusinessIdentitySignal)
    .sort((left, right) => (left.signalId < right.signalId ? -1 : left.signalId > right.signalId ? 1 : 0));

  const keyMap = new Map<string, DeterministicEntityCandidateKey>();

  const addKey = (key: DeterministicEntityCandidateKey): void => {
    const identity = keyIdentity(key);
    const existing = keyMap.get(identity);
    if (existing) {
      existing.signalIds = sortedUnique([...existing.signalIds, ...key.signalIds]);
      existing.sourceReferenceIds = sortedUnique([
        ...existing.sourceReferenceIds,
        ...key.sourceReferenceIds,
      ]);
      return;
    }

    if (keyMap.size >= MAX_ENTITY_RESOLUTION_CANDIDATE_KEYS) {
      throw new Error(
        `Entity-resolution candidate generation exceeds bounded limit of ${MAX_ENTITY_RESOLUTION_CANDIDATE_KEYS} keys.`,
      );
    }

    keyMap.set(identity, {
      ...key,
      signalIds: sortedUnique(key.signalIds),
      sourceReferenceIds: sortedUnique(key.sourceReferenceIds),
    });
  };

  const domains = normalizedSignals.filter((signal) => signal.kind === 'domain');
  for (const signal of domains) {
    addKey({
      keyKind: 'domain_exact',
      keyValue: signal.normalizedValue,
      keyScope: null,
      strength: 'exact',
      reasonCode: 'identity_exact_domain',
      signalIds: [signal.signalId],
      sourceReferenceIds: [...signal.sourceReferenceIds],
    });
  }

  const externalRefs = normalizedSignals.filter((signal) => signal.kind === 'source_external_ref');
  for (const signal of externalRefs) {
    addKey({
      keyKind: 'source_external_ref_exact',
      keyValue: signal.normalizedValue,
      keyScope: signal.sourceScope,
      strength: 'exact',
      reasonCode: 'identity_exact_source_external_ref',
      signalIds: [signal.signalId],
      sourceReferenceIds: [...signal.sourceReferenceIds],
    });
  }

  const names = normalizedSignals.filter((signal) => signal.kind === 'business_name');
  for (const name of names) {
    for (const location of normalizedSignals) {
      if (!(location.kind in locationCandidateKinds)) continue;
      const [keyKind, reasonCode] =
        locationCandidateKinds[location.kind as keyof typeof locationCandidateKinds];

      addKey({
        keyKind,
        keyValue: [name.normalizedValue, location.normalizedValue].join('\u0000'),
        keyScope: null,
        strength: 'suggestive',
        reasonCode,
        signalIds: [name.signalId, location.signalId],
        sourceReferenceIds: [...name.sourceReferenceIds, ...location.sourceReferenceIds],
      });
    }
  }

  const conflictReasonCodes = new Set<string>();
  if (distinctValues(domains).length > 1) {
    conflictReasonCodes.add('identity_conflicting_domains');
  }

  const refsByScope = new Map<string, BusinessIdentitySignal[]>();
  for (const signal of externalRefs) {
    const scope = signal.sourceScope;
    if (scope === null) continue;
    const scoped = refsByScope.get(scope) ?? [];
    scoped.push(signal);
    refsByScope.set(scope, scoped);
  }
  for (const scoped of refsByScope.values()) {
    if (distinctValues(scoped).length > 1) {
      conflictReasonCodes.add('identity_conflicting_source_external_refs');
    }
  }

  const conflictKinds: Array<[BusinessIdentitySignalKind, string]> = [
    ['business_name', 'identity_conflicting_business_names'],
    ['address', 'identity_conflicting_addresses'],
    ['locality', 'identity_conflicting_localities'],
    ['region', 'identity_conflicting_regions'],
    ['country_code', 'identity_conflicting_country_codes'],
    ['postal_code', 'identity_conflicting_postal_codes'],
  ];
  for (const [kind, reasonCode] of conflictKinds) {
    const scopedSignals = normalizedSignals.filter((signal) => signal.kind === kind);
    if (distinctValues(scopedSignals).length > 1) {
      conflictReasonCodes.add(reasonCode);
    }
  }

  const keys = [...keyMap.values()].sort(compareKeys);
  const exactKeyCount = keys.filter((key) => key.strength === 'exact').length;

  return {
    normalizationVersion: ENTITY_RESOLUTION_NORMALIZATION_VERSION,
    normalizedSignals,
    keys,
    conflictReasonCodes: [...conflictReasonCodes].sort(),
    requiresReviewBeforeMatch: conflictReasonCodes.size > 0 || exactKeyCount === 0,
  };
}
