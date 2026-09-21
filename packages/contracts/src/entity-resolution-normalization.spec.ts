import { describe, expect, it } from 'vitest';
import {
  MAX_ENTITY_RESOLUTION_CANDIDATE_KEYS,
  generateDeterministicEntityCandidateKeys,
  normalizeBusinessIdentitySignal,
  normalizeBusinessIdentityValue,
  type RawBusinessIdentitySignal,
} from './entity-resolution-normalization';

function signal(
  signalId: string,
  kind: RawBusinessIdentitySignal['kind'],
  rawValue: string,
  sourceReferenceIds: string[],
  sourceScope: string | null = null,
): RawBusinessIdentitySignal {
  return { signalId, kind, rawValue, sourceScope, sourceReferenceIds };
}

describe('entity-resolution deterministic normalization', () => {
  it('normalizes names, domains, country codes, postal codes, and source refs deterministically', () => {
    expect(normalizeBusinessIdentityValue('business_name', '  ACME & Co., LLC  ')).toBe(
      'acme and co llc',
    );
    expect(normalizeBusinessIdentityValue('domain', 'HTTPS://Exämple.COM.:443/')).toBe(
      'xn--exmple-cua.com',
    );
    expect(normalizeBusinessIdentityValue('country_code', ' pk ')).toBe('PK');
    expect(normalizeBusinessIdentityValue('postal_code', ' SW1A-1AA ')).toBe('SW1A1AA');
    expect(normalizeBusinessIdentityValue('source_external_ref', '  Provider:AbC-123  ')).toBe(
      'Provider:AbC-123',
    );
  });

  it('fails closed for credentialed, path-bearing, or non-HTTP domain forms', () => {
    expect(() => normalizeBusinessIdentityValue('domain', 'https://user:pass@example.com/')).toThrow(
      /credentials/,
    );
    expect(() => normalizeBusinessIdentityValue('domain', 'example.com/path')).toThrow(/hostname only/);
    expect(() => normalizeBusinessIdentityValue('domain', 'ftp://example.com')).toThrow(/HTTP\(S\)/);
  });

  it('emits contract-valid normalized signals with a pinned normalization version', () => {
    expect(
      normalizeBusinessIdentitySignal(signal('signal.domain', 'domain', 'Example.COM', ['ref.1'])),
    ).toEqual({
      signalId: 'signal.domain',
      kind: 'domain',
      rawValue: 'Example.COM',
      normalizedValue: 'example.com',
      normalizationVersion: '1.0.0',
      sourceScope: null,
      sourceReferenceIds: ['ref.1'],
    });
  });
});

describe('deterministic entity candidate generation', () => {
  const baseSignals: RawBusinessIdentitySignal[] = [
    signal('signal.name', 'business_name', 'Acme & Co', ['ref.name']),
    signal('signal.domain', 'domain', 'https://ACME.example/', ['ref.domain']),
    signal('signal.locality', 'locality', ' Lahore ', ['ref.locality']),
    signal('signal.country', 'country_code', 'pk', ['ref.country']),
    signal(
      'signal.external',
      'source_external_ref',
      'Provider-123',
      ['ref.external'],
      'source.registry',
    ),
  ];

  it('generates exact identity keys and only suggestive name/location keys with provenance', () => {
    const result = generateDeterministicEntityCandidateKeys(baseSignals);

    expect(result.requiresReviewBeforeMatch).toBe(false);
    expect(result.conflictReasonCodes).toEqual([]);
    expect(result.keys).toEqual(
      expect.arrayContaining([
        {
          keyKind: 'domain_exact',
          keyValue: 'acme.example',
          keyScope: null,
          strength: 'exact',
          reasonCode: 'identity_exact_domain',
          signalIds: ['signal.domain'],
          sourceReferenceIds: ['ref.domain'],
        },
        {
          keyKind: 'source_external_ref_exact',
          keyValue: 'Provider-123',
          keyScope: 'source.registry',
          strength: 'exact',
          reasonCode: 'identity_exact_source_external_ref',
          signalIds: ['signal.external'],
          sourceReferenceIds: ['ref.external'],
        },
        {
          keyKind: 'name_locality',
          keyValue: 'acme and co\u0000lahore',
          keyScope: null,
          strength: 'suggestive',
          reasonCode: 'identity_name_locality',
          signalIds: ['signal.locality', 'signal.name'],
          sourceReferenceIds: ['ref.locality', 'ref.name'],
        },
      ]),
    );
  });

  it('is stable across input ordering and merges duplicate-key provenance deterministically', () => {
    const duplicateDomain = signal('signal.domain.2', 'domain', 'acme.example.', ['ref.domain.2']);
    const forward = generateDeterministicEntityCandidateKeys([...baseSignals, duplicateDomain]);
    const reversed = generateDeterministicEntityCandidateKeys([
      duplicateDomain,
      ...[...baseSignals].reverse(),
    ]);

    expect(reversed).toEqual(forward);
    expect(forward.keys.find((key) => key.keyKind === 'domain_exact')).toMatchObject({
      signalIds: ['signal.domain', 'signal.domain.2'],
      sourceReferenceIds: ['ref.domain', 'ref.domain.2'],
    });
  });

  it('fails closed to review when deterministic exact identity signals conflict', () => {
    const result = generateDeterministicEntityCandidateKeys([
      ...baseSignals,
      signal('signal.domain.other', 'domain', 'other.example', ['ref.other']),
      signal(
        'signal.external.other',
        'source_external_ref',
        'Provider-999',
        ['ref.external.other'],
        'source.registry',
      ),
    ]);

    expect(result.requiresReviewBeforeMatch).toBe(true);
    expect(result.conflictReasonCodes).toEqual([
      'identity_conflicting_domains',
      'identity_conflicting_source_external_refs',
    ]);
  });

  it('fails closed when bounded name or location signals contradict an otherwise exact key', () => {
    const result = generateDeterministicEntityCandidateKeys([
      ...baseSignals,
      signal('signal.name.other', 'business_name', 'Different Trading Name', ['ref.name.other']),
      signal('signal.locality.other', 'locality', 'Karachi', ['ref.locality.other']),
    ]);

    expect(result.requiresReviewBeforeMatch).toBe(true);
    expect(result.conflictReasonCodes).toEqual([
      'identity_conflicting_business_names',
      'identity_conflicting_localities',
    ]);
  });

  it('never treats name/location-only evidence as sufficient for automatic matching', () => {
    const result = generateDeterministicEntityCandidateKeys([
      signal('signal.name', 'business_name', 'Acme', ['ref.1']),
      signal('signal.locality', 'locality', 'Multan', ['ref.2']),
    ]);

    expect(result.keys).toHaveLength(1);
    expect(result.keys[0]?.strength).toBe('suggestive');
    expect(result.requiresReviewBeforeMatch).toBe(true);
  });

  it('bounds candidate-key fanout instead of allowing unbounded name/location combinations', () => {
    const manySignals: RawBusinessIdentitySignal[] = [];
    for (let index = 0; index < 17; index += 1) {
      manySignals.push(signal(`signal.name.${index}`, 'business_name', `Business ${index}`, ['ref.name']));
    }
    for (let index = 0; index < 16; index += 1) {
      manySignals.push(signal(`signal.locality.${index}`, 'locality', `City ${index}`, ['ref.location']));
    }

    expect(() => generateDeterministicEntityCandidateKeys(manySignals)).toThrow(
      new RegExp(String(MAX_ENTITY_RESOLUTION_CANDIDATE_KEYS)),
    );
  });
});
