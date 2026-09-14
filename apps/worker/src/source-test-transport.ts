import { URL } from 'node:url';

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

const contentTypePattern = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/;

function normalizedContentType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function validContentType(value: unknown): value is string {
  return typeof value === 'string' && contentTypePattern.test(normalizedContentType(value));
}

function canonicalUrl(value: unknown, code: string): string {
  if (typeof value !== 'string') throw new TestSourceTransportError(code);
  try {
    return new URL(value).href;
  } catch {
    throw new TestSourceTransportError(code);
  }
}

function ensureByteBudget(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TestSourceTransportError(code);
}

function ensureTimeoutBudget(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 100 || value > 120_000) throw new TestSourceTransportError(code);
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

  const requestUrl = canonicalUrl(request.url, 'TEST_TRANSPORT_INVALID_REQUEST_URL');
  const admissionUrl = canonicalUrl(admission.canonicalUrl, 'TEST_TRANSPORT_INVALID_ADMISSION_URL');
  if (admissionUrl !== requestUrl) throw new TestSourceTransportError('TEST_TRANSPORT_ADMISSION_URL_MISMATCH');

  ensureByteBudget(request.maxResponseBytes, 'TEST_TRANSPORT_INVALID_BYTE_BUDGET');
  ensureTimeoutBudget(request.timeoutMs, 'TEST_TRANSPORT_INVALID_TIMEOUT_BUDGET');
  ensureByteBudget(admission.maxResponseBytes, 'TEST_TRANSPORT_INVALID_ADMISSION_BYTE_BUDGET');
  ensureTimeoutBudget(admission.timeoutMs, 'TEST_TRANSPORT_INVALID_ADMISSION_TIMEOUT_BUDGET');
  if (request.maxResponseBytes > admission.maxResponseBytes) {
    throw new TestSourceTransportError('TEST_TRANSPORT_BYTE_BUDGET_WIDENED');
  }
  if (request.timeoutMs > admission.timeoutMs) throw new TestSourceTransportError('TEST_TRANSPORT_TIMEOUT_BUDGET_WIDENED');
  if (request.acceptedContentTypes.length === 0 || request.acceptedContentTypes.some((value) => !validContentType(value))) {
    throw new TestSourceTransportError('TEST_TRANSPORT_CONTENT_TYPES_INVALID');
  }

  const result = await exchange({
    transportRequestId: request.transportRequestId,
    url: requestUrl,
    maxResponseBytes: request.maxResponseBytes,
    timeoutMs: request.timeoutMs,
  });

  if (!Number.isInteger(result.status) || result.status < 100 || result.status > 599) {
    throw new TestSourceTransportError('TEST_TRANSPORT_INVALID_STATUS');
  }
  if (result.status >= 300 && result.status < 400) {
    throw new TestSourceTransportError('TEST_TRANSPORT_REDIRECT_REQUIRES_REVALIDATION');
  }
  const finalUrl = canonicalUrl(result.finalUrl, 'TEST_TRANSPORT_INVALID_FINAL_URL');
  if (finalUrl !== requestUrl) throw new TestSourceTransportError('TEST_TRANSPORT_FINAL_URL_CHANGED');
  if (!Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || result.elapsedMs > request.timeoutMs) {
    throw new TestSourceTransportError('TEST_TRANSPORT_TIMEOUT_EXCEEDED');
  }
  if (!(result.body instanceof Uint8Array)) throw new TestSourceTransportError('TEST_TRANSPORT_INVALID_BODY');
  if (result.body.byteLength > request.maxResponseBytes) {
    throw new TestSourceTransportError('TEST_TRANSPORT_RESPONSE_TOO_LARGE');
  }
  if (!validContentType(result.contentType)) throw new TestSourceTransportError('TEST_TRANSPORT_INVALID_CONTENT_TYPE');

  const contentType = normalizedContentType(result.contentType);
  const accepted = new Set(request.acceptedContentTypes.map(normalizedContentType));
  if (!accepted.has(contentType)) throw new TestSourceTransportError('TEST_TRANSPORT_CONTENT_TYPE_NOT_ALLOWED');

  return result;
}
