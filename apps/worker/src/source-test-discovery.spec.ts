import { describe, expect, it, vi } from 'vitest';
import { buildTestDiscoveryUrl, executeInjectedTestDiscovery } from './source-test-discovery';

const query = { countryCode: 'TR', locality: 'Istanbul', niche: 'dentist', limit: 2 };
const endpoint = 'https://example.test/discover';
const canonicalUrl = buildTestDiscoveryUrl(endpoint, query);
const admission = {
  decision: 'allow' as const,
  transportRequestId: 'transport.discovery.1',
  canonicalUrl,
  maxResponseBytes: 4096,
  timeoutMs: 1000,
};

function response(candidates: unknown[]) {
  return {
    status: 200,
    finalUrl: canonicalUrl,
    contentType: 'application/json; charset=utf-8',
    body: new TextEncoder().encode(JSON.stringify({ candidates })),
    elapsedMs: 10,
  };
}

describe('executeInjectedTestDiscovery', () => {
  it('builds a deterministic geography+niche URL and normalizes injected candidates', async () => {
    const exchange = vi.fn(async () =>
      response([
        { externalRef: ' business.1 ', name: ' Example Dental ', website: 'https://EXAMPLE.com:443/' },
        { externalRef: 'business.2', name: 'Second Dental', website: null },
      ]),
    );
    const result = await executeInjectedTestDiscovery(
      { transportRequestId: admission.transportRequestId, endpoint, query, maxResponseBytes: 4096, timeoutMs: 1000 },
      admission,
      exchange,
    );

    expect(canonicalUrl).toBe('https://example.test/discover?country=TR&limit=2&locality=Istanbul&niche=dentist');
    expect(result).toEqual([
      { externalRef: 'business.1', name: 'Example Dental', website: 'https://example.com/' },
      { externalRef: 'business.2', name: 'Second Dental', website: null },
    ]);
    expect(exchange).toHaveBeenCalledOnce();
  });

  it('fails closed before transport for malformed query or endpoint inputs', async () => {
    const exchange = vi.fn(async () => response([]));
    await expect(
      executeInjectedTestDiscovery(
        {
          transportRequestId: admission.transportRequestId,
          endpoint,
          query: { ...query, countryCode: 'tr' },
          maxResponseBytes: 4096,
          timeoutMs: 1000,
        },
        admission,
        exchange,
      ),
    ).rejects.toMatchObject({ code: 'TEST_DISCOVERY_COUNTRY_INVALID' });
    expect(() => buildTestDiscoveryUrl('file:///tmp/discover', query)).toThrowError('TEST_DISCOVERY_ENDPOINT_INVALID');
    expect(() => buildTestDiscoveryUrl('https://user:secret@example.test/discover', query)).toThrowError(
      'TEST_DISCOVERY_ENDPOINT_INVALID',
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('rejects duplicate candidates after external-ref normalization', async () => {
    await expect(
      executeInjectedTestDiscovery(
        { transportRequestId: admission.transportRequestId, endpoint, query, maxResponseBytes: 4096, timeoutMs: 1000 },
        admission,
        async () => response([{ externalRef: 'business.1', name: 'A' }, { externalRef: ' business.1 ', name: 'B' }]),
      ),
    ).rejects.toMatchObject({ code: 'TEST_DISCOVERY_CANDIDATE_DUPLICATE' });
  });

  it('rejects unsafe or invalid websites', async () => {
    await expect(
      executeInjectedTestDiscovery(
        { transportRequestId: admission.transportRequestId, endpoint, query, maxResponseBytes: 4096, timeoutMs: 1000 },
        admission,
        async () => response([{ externalRef: 'business.1', name: 'A', website: 'not-a-url' }]),
      ),
    ).rejects.toMatchObject({ code: 'TEST_DISCOVERY_CANDIDATE_WEBSITE_INVALID' });

    await expect(
      executeInjectedTestDiscovery(
        { transportRequestId: admission.transportRequestId, endpoint, query, maxResponseBytes: 4096, timeoutMs: 1000 },
        admission,
        async () => response([{ externalRef: 'business.1', name: 'A', website: 'ftp://example.com/file' }]),
      ),
    ).rejects.toMatchObject({ code: 'TEST_DISCOVERY_CANDIDATE_WEBSITE_INVALID' });

    await expect(
      executeInjectedTestDiscovery(
        { transportRequestId: admission.transportRequestId, endpoint, query, maxResponseBytes: 4096, timeoutMs: 1000 },
        admission,
        async () => response([{ externalRef: 'business.1', name: 'A', website: 'https://user:secret@example.com/' }]),
      ),
    ).rejects.toMatchObject({ code: 'TEST_DISCOVERY_CANDIDATE_WEBSITE_INVALID' });
  });

  it('rejects provider payloads that exceed the requested result limit', async () => {
    await expect(
      executeInjectedTestDiscovery(
        { transportRequestId: admission.transportRequestId, endpoint, query: { ...query, limit: 1 }, maxResponseBytes: 4096, timeoutMs: 1000 },
        { ...admission, canonicalUrl: buildTestDiscoveryUrl(endpoint, { ...query, limit: 1 }) },
        async () => ({
          ...response([{ externalRef: 'business.1', name: 'A' }, { externalRef: 'business.2', name: 'B' }]),
          finalUrl: buildTestDiscoveryUrl(endpoint, { ...query, limit: 1 }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'TEST_DISCOVERY_RESULT_LIMIT_EXCEEDED' });
  });
});
