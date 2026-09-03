import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SourceTransportResponseReceiptSchema } from './source-transport-result';

const identity = {
  sourceRequestId: 'source-request-result-1',
  sourceTaskId: 'source-task-result-1',
  connectorKey: 'connector.company_sites',
  connectorVersion: '1.0.0',
  transportPolicyId: 'transport-policy.company-sites',
  transportPolicyVersion: '1.0.0',
};

function admission(transportRequestId: string, url: string, evaluatedAt: string) {
  return {
    decision: 'allow' as const,
    reasonCodes: [],
    warnings: [],
    transportPolicyId: identity.transportPolicyId,
    transportPolicyVersion: identity.transportPolicyVersion,
    connectorKey: identity.connectorKey,
    connectorVersion: identity.connectorVersion,
    sourceRequestId: identity.sourceRequestId,
    transportRequestId,
    canonicalUrl: url,
    hostname: new URL(url).hostname,
    port: 443,
    maxResponseBytes: 1024,
    timeoutMs: 500,
    evaluatedAt,
  };
}

function oneHopReceipt() {
  const url = 'https://example.com/resource';
  return {
    version: '1.0.0' as const,
    receiptId: 'transport-receipt-1',
    ...identity,
    hopChain: {
      version: '1.0.0' as const,
      ...identity,
      revalidateEachHop: true as const,
      hops: [
        {
          hopIndex: 0,
          transportRequestId: 'transport-request-1',
          url,
          requestedAt: '2026-09-03T00:00:00.000Z',
          resolution: {
            transportRequestId: 'transport-request-1',
            url,
            hostname: 'example.com',
            resolvedAt: '2026-09-03T00:00:01.000Z',
            addresses: [{ address: '93.184.216.34', family: 4 as const, classification: 'public' as const }],
          },
          previousRedirect: null,
        },
      ],
    },
    hopAdmissions: [admission('transport-request-1', url, '2026-09-03T00:00:02.000Z')],
    final: {
      transportRequestId: 'transport-request-1',
      url,
      status: 200,
      contentType: 'application/json',
      responseBytes: 128,
      elapsedMs: 25,
      receivedAt: '2026-09-03T00:00:02.100Z',
      bodyDigest: { algorithm: 'sha256' as const, value: 'a'.repeat(64) },
    },
    bodyIncluded: false as const,
  };
}

function twoHopReceipt() {
  const firstUrl = 'https://example.com/start';
  const secondUrl = 'https://example.com/final';
  const receipt = oneHopReceipt();

  return {
    ...receipt,
    receiptId: 'transport-receipt-2',
    hopChain: {
      ...receipt.hopChain,
      hops: [
        {
          hopIndex: 0,
          transportRequestId: 'transport-request-redirect-1',
          url: firstUrl,
          requestedAt: '2026-09-03T00:00:00.000Z',
          resolution: {
            transportRequestId: 'transport-request-redirect-1',
            url: firstUrl,
            hostname: 'example.com',
            resolvedAt: '2026-09-03T00:00:01.000Z',
            addresses: [{ address: '93.184.216.34', family: 4 as const, classification: 'public' as const }],
          },
          previousRedirect: null,
        },
        {
          hopIndex: 1,
          transportRequestId: 'transport-request-redirect-2',
          url: secondUrl,
          requestedAt: '2026-09-03T00:00:03.000Z',
          resolution: {
            transportRequestId: 'transport-request-redirect-2',
            url: secondUrl,
            hostname: 'example.com',
            resolvedAt: '2026-09-03T00:00:04.000Z',
            addresses: [{ address: '93.184.216.35', family: 4 as const, classification: 'public' as const }],
          },
          previousRedirect: {
            fromTransportRequestId: 'transport-request-redirect-1',
            fromUrl: firstUrl,
            status: 302,
            location: '/final',
            observedAt: '2026-09-03T00:00:02.000Z',
          },
        },
      ],
    },
    hopAdmissions: [
      admission('transport-request-redirect-1', firstUrl, '2026-09-03T00:00:01.500Z'),
      admission('transport-request-redirect-2', secondUrl, '2026-09-03T00:00:04.500Z'),
    ],
    final: {
      ...receipt.final,
      transportRequestId: 'transport-request-redirect-2',
      url: secondUrl,
      receivedAt: '2026-09-03T00:00:04.600Z',
    },
  };
}

function expectInvalid(value: unknown): void {
  expect(SourceTransportResponseReceiptSchema.safeParse(value).success).toBe(false);
}

describe('SourceTransportResponseReceiptSchema', () => {
  it('accepts a body-free receipt bound to one admitted terminal hop', () => {
    const parsed = SourceTransportResponseReceiptSchema.parse(oneHopReceipt());
    expect(parsed.bodyIncluded).toBe(false);
    expect(parsed.final.bodyDigest.algorithm).toBe('sha256');
  });

  it('rejects raw response payload/header material through strict receipt shapes', () => {
    const base = oneHopReceipt();
    expectInvalid({ ...base, rawBody: 'secret-response-body' });
    expectInvalid({ ...base, final: { ...base.final, rawHeaders: { authorization: 'secret' } } });
  });

  it('rejects blocked admissions and missing per-hop admission evidence', () => {
    const base = oneHopReceipt();
    const firstAdmission = base.hopAdmissions[0]!;
    expectInvalid({
      ...base,
      hopAdmissions: [
        {
          ...firstAdmission,
          decision: 'blocked' as const,
          reasonCodes: ['transport_host_not_allowed'],
        },
      ],
    });
    expectInvalid({ ...base, hopAdmissions: [] });
  });

  it('rejects hop admission request, URL and transport identity drift', () => {
    const base = oneHopReceipt();
    const firstAdmission = base.hopAdmissions[0]!;
    expectInvalid({
      ...base,
      hopAdmissions: [{ ...firstAdmission, transportRequestId: 'transport-request-other' }],
    });
    expectInvalid({
      ...base,
      hopAdmissions: [{ ...firstAdmission, canonicalUrl: 'https://example.com/other' }],
    });
    expectInvalid({ ...base, connectorVersion: '9.9.9' });
  });

  it('rejects final response identity changes and admitted budget widening', () => {
    const base = oneHopReceipt();
    expectInvalid({ ...base, final: { ...base.final, transportRequestId: 'transport-request-other' } });
    expectInvalid({ ...base, final: { ...base.final, url: 'https://example.com/other' } });
    expectInvalid({ ...base, final: { ...base.final, responseBytes: 1025 } });
    expectInvalid({ ...base, final: { ...base.final, elapsedMs: 501 } });
  });

  it('rejects response timestamps before terminal admission and redirect terminal statuses', () => {
    const base = oneHopReceipt();
    expectInvalid({ ...base, final: { ...base.final, receivedAt: '2026-09-03T00:00:01.900Z' } });
    expectInvalid({ ...base, final: { ...base.final, status: 302 } });
  });

  it('requires an allow admission for every valid redirect hop', () => {
    const base = twoHopReceipt();
    expect(SourceTransportResponseReceiptSchema.safeParse(base).success).toBe(true);
    expectInvalid({ ...base, hopAdmissions: base.hopAdmissions.slice(0, 1) });

    const secondAdmission = base.hopAdmissions[1]!;
    expectInvalid({
      ...base,
      hopAdmissions: [
        base.hopAdmissions[0]!,
        { ...secondAdmission, evaluatedAt: '2026-09-03T00:00:03.500Z' },
      ],
    });
  });
});
