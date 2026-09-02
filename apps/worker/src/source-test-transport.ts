export interface TestTransportRequest {
  transportRequestId: string;
  transportKind: 'test' | 'network';
  url: string;
  maxResponseBytes: number;
  timeoutMs: number;
  acceptedContentTypes: readonly string[];
}

export interface TestTransportAdmission {
  decision: 'allow' | 'blocked';
  transportRequestId: string;
  canonicalUrl: string;
  maxResponseBytes: number;
  timeoutMs: number;
}

export interface InjectedTestExchangeInput {
  transportRequestId: string;
  url: string;
  maxResponseBytes: number;
  timeoutMs: number;
}

export interface InjectedTestExchangeResult {
  status: number;
  finalUrl: string;
  contentType: string;
  body: Uint8Array;
  elapsedMs: number;
}

export type InjectedTestExchange = (input: InjectedTestExchangeInput) => Promise<InjectedTestExchangeResult>;

export class TestSourceTransportError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'TestSourceTransportError';
  }
}

function normalizedContentType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function ensurePositiveBudget(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TestSourceTransportError(code);
}

export async function executeInjectedTestTransport(
  request: TestTransportRequest,
  admission: TestTransportAdmission,
  exchange: InjectedTestExchange,
): Promise<InjectedTestExchangeResult> {
  if (request.transportKind !== 'test') throw new TestSourceTransportError('TEST_TRANSPORT_NETWORK_FORBIDDEN');
  if (admission.decision !== 'allow') throw new TestSourceTransportError('TEST_TRANSPORT_ADMISSION_BLOCKED');
  if (admission.transportRequestId !== request.transportRequestId) {
    throw new TestSourceTransportError('TEST_TRANSPORT_ADMISSION_ID_MISMATCH');
  }
  if (admission.canonicalUrl !== request.url) throw new TestSourceTransportError('TEST_TRANSPORT_ADMISSION_URL_MISMATCH');

  ensurePositiveBudget(request.maxResponseBytes, 'TEST_TRANSPORT_INVALID_BYTE_BUDGET');
  ensurePositiveBudget(request.timeoutMs, 'TEST_TRANSPORT_INVALID_TIMEOUT_BUDGET');
  if (request.maxResponseBytes > admission.maxResponseBytes) {
    throw new TestSourceTransportError('TEST_TRANSPORT_BYTE_BUDGET_WIDENED');
  }
  if (request.timeoutMs > admission.timeoutMs) throw new TestSourceTransportError('TEST_TRANSPORT_TIMEOUT_BUDGET_WIDENED');
  if (request.acceptedContentTypes.length === 0) {
    throw new TestSourceTransportError('TEST_TRANSPORT_CONTENT_TYPES_EMPTY');
  }

  const result = await exchange({
    transportRequestId: request.transportRequestId,
    url: request.url,
    maxResponseBytes: request.maxResponseBytes,
    timeoutMs: request.timeoutMs,
  });

  if (!Number.isInteger(result.status) || result.status < 100 || result.status > 599) {
    throw new TestSourceTransportError('TEST_TRANSPORT_INVALID_STATUS');
  }
  if (result.status >= 300 && result.status < 400) {
    throw new TestSourceTransportError('TEST_TRANSPORT_REDIRECT_REQUIRES_REVALIDATION');
  }
  if (result.finalUrl !== request.url) throw new TestSourceTransportError('TEST_TRANSPORT_FINAL_URL_CHANGED');
  if (!Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || result.elapsedMs > request.timeoutMs) {
    throw new TestSourceTransportError('TEST_TRANSPORT_TIMEOUT_EXCEEDED');
  }
  if (result.body.byteLength > request.maxResponseBytes) {
    throw new TestSourceTransportError('TEST_TRANSPORT_RESPONSE_TOO_LARGE');
  }

  const contentType = normalizedContentType(result.contentType);
  const accepted = new Set(request.acceptedContentTypes.map(normalizedContentType));
  if (!accepted.has(contentType)) throw new TestSourceTransportError('TEST_TRANSPORT_CONTENT_TYPE_NOT_ALLOWED');

  return result;
}
