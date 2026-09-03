import { describe, expect, it, vi } from 'vitest';
import { executeInjectedTestTransport } from './source-test-transport';

const request = {
  transportRequestId: 'transport.req.1',
  transportKind: 'test' as const,
  url: 'https://example.com/resource',
  maxResponseBytes: 1024,
  timeoutMs: 500,
  acceptedContentTypes: ['application/json'],
};

const admission = {
  decision: 'allow' as const,
  transportRequestId: request.transportRequestId,
  canonicalUrl: request.url,
  maxResponseBytes: 1024,
  timeoutMs: 500,
};

const successfulResult = {
  status: 200,
  finalUrl: request.url,
  contentType: 'application/json; charset=utf-8',
  body: new Uint8Array([1, 2, 3]),
  elapsedMs: 25,
};

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('executeInjectedTestTransport', () => {
  it('executes only the injected exchange for an admitted test request', async () => {
    const exchange = vi.fn(async () => successfulResult);
    const result = await executeInjectedTestTransport(request, admission, exchange);

    expect(result).toEqual(successfulResult);
    expect(exchange).toHaveBeenCalledOnce();
    expect(exchange).toHaveBeenCalledWith({
      transportRequestId: request.transportRequestId,
      url: request.url,
      maxResponseBytes: request.maxResponseBytes,
      timeoutMs: request.timeoutMs,
    });
  });

  it('canonicalizes valid request/admission URLs before the injected exchange', async () => {
    const exchange = vi.fn(async () => successfulResult);
    await executeInjectedTestTransport(
      { ...request, url: 'https://EXAMPLE.com:443/resource' },
      { ...admission, canonicalUrl: 'https://example.com/resource' },
      exchange,
    );
    expect(exchange).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/resource' }));
  });

  it('never permits a network-kind request to reach the injected exchange', async () => {
    const exchange = vi.fn(async () => successfulResult);
    await expectCode(
      executeInjectedTestTransport({ ...request, transportKind: 'network' }, admission, exchange),
      'TEST_TRANSPORT_NETWORK_FORBIDDEN',
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('fails closed for blocked or mismatched admissions', async () => {
    const exchange = vi.fn(async () => successfulResult);
    await expectCode(
      executeInjectedTestTransport(request, { ...admission, decision: 'blocked' }, exchange),
      'TEST_TRANSPORT_ADMISSION_BLOCKED',
    );
    await expectCode(
      executeInjectedTestTransport(request, { ...admission, transportRequestId: 'other' }, exchange),
      'TEST_TRANSPORT_ADMISSION_ID_MISMATCH',
    );
    await expectCode(
      executeInjectedTestTransport(request, { ...admission, canonicalUrl: 'https://example.com/other' }, exchange),
      'TEST_TRANSPORT_ADMISSION_URL_MISMATCH',
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('rejects malformed request/admission URLs before exchange', async () => {
    const exchange = vi.fn(async () => successfulResult);
    await expectCode(
      executeInjectedTestTransport({ ...request, url: 'not-a-url' }, admission, exchange),
      'TEST_TRANSPORT_INVALID_REQUEST_URL',
    );
    await expectCode(
      executeInjectedTestTransport(request, { ...admission, canonicalUrl: 'not-a-url' }, exchange),
      'TEST_TRANSPORT_INVALID_ADMISSION_URL',
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('does not allow request budgets to widen the admitted limits', async () => {
    const exchange = vi.fn(async () => successfulResult);
    await expectCode(
      executeInjectedTestTransport({ ...request, maxResponseBytes: 2048 }, admission, exchange),
      'TEST_TRANSPORT_BYTE_BUDGET_WIDENED',
    );
    await expectCode(
      executeInjectedTestTransport({ ...request, timeoutMs: 501 }, admission, exchange),
      'TEST_TRANSPORT_TIMEOUT_BUDGET_WIDENED',
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('fails closed for malformed request or admission budget shapes', async () => {
    const exchange = vi.fn(async () => successfulResult);
    await expectCode(
      executeInjectedTestTransport({ ...request, timeoutMs: 99 }, admission, exchange),
      'TEST_TRANSPORT_INVALID_TIMEOUT_BUDGET',
    );
    await expectCode(
      executeInjectedTestTransport(request, { ...admission, maxResponseBytes: 0 }, exchange),
      'TEST_TRANSPORT_INVALID_ADMISSION_BYTE_BUDGET',
    );
    await expectCode(
      executeInjectedTestTransport(request, { ...admission, timeoutMs: 120_001 }, exchange),
      'TEST_TRANSPORT_INVALID_ADMISSION_TIMEOUT_BUDGET',
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('rejects invalid accepted content-type declarations before exchange', async () => {
    const exchange = vi.fn(async () => successfulResult);
    await expectCode(
      executeInjectedTestTransport({ ...request, acceptedContentTypes: [''] }, admission, exchange),
      'TEST_TRANSPORT_CONTENT_TYPES_INVALID',
    );
    await expectCode(
      executeInjectedTestTransport({ ...request, acceptedContentTypes: ['applicationjson'] }, admission, exchange),
      'TEST_TRANSPORT_CONTENT_TYPES_INVALID',
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('requires redirect revalidation instead of following injected redirects', async () => {
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, status: 302 })),
      'TEST_TRANSPORT_REDIRECT_REQUIRES_REVALIDATION',
    );
  });

  it('enforces deterministic elapsed-time, byte and content-type budgets', async () => {
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, elapsedMs: 501 })),
      'TEST_TRANSPORT_TIMEOUT_EXCEEDED',
    );
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, body: new Uint8Array(1025) })),
      'TEST_TRANSPORT_RESPONSE_TOO_LARGE',
    );
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, contentType: 'text/html' })),
      'TEST_TRANSPORT_CONTENT_TYPE_NOT_ALLOWED',
    );
  });

  it('fails closed for malformed injected result shapes', async () => {
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, finalUrl: undefined as unknown as string })),
      'TEST_TRANSPORT_INVALID_FINAL_URL',
    );
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, finalUrl: 'not-a-url' })),
      'TEST_TRANSPORT_INVALID_FINAL_URL',
    );
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, body: undefined as unknown as Uint8Array })),
      'TEST_TRANSPORT_INVALID_BODY',
    );
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, contentType: undefined as unknown as string })),
      'TEST_TRANSPORT_INVALID_CONTENT_TYPE',
    );
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, contentType: 'not-a-mime' })),
      'TEST_TRANSPORT_INVALID_CONTENT_TYPE',
    );
  });

  it('rejects a silent final-URL change', async () => {
    await expectCode(
      executeInjectedTestTransport(request, admission, async () => ({ ...successfulResult, finalUrl: 'https://evil.example/' })),
      'TEST_TRANSPORT_FINAL_URL_CHANGED',
    );
  });
});
