import { describe, expect, it, vi } from 'vitest';
import {
  WebsiteInspectionRequestSchema,
  WebsiteInspectionResultSchema,
  type WebsiteInspectionRequest,
} from '@brovexa/contracts';
import type { WorkHandlerContext } from './runtime';
import { createWebsiteInspectionWorkHandler, M04_WEBSITE_INSPECTION_WORK_TYPE } from './website-inspection-worker';

const WORKSPACE = '550e8400-e29b-41d4-a716-446655440000';
function request(): WebsiteInspectionRequest {
  return WebsiteInspectionRequestSchema.parse({
    version: '1.0.0', inspectionId: 'inspection.m04.fixture.1', workspaceId: WORKSPACE,
    canonicalBusinessId: 'business.001', verifiedDomain: 'example.com',
    domainVerification: { verificationId: 'verify.001', decision: 'verified', evidenceIds: ['evidence.domain.1'] },
    targetUrl: 'https://example.com/', sourceKey: 'source.approved_web',
    sourceAdmissionDecisionRef: 'admission.001', sourceAdmissionDecision: 'allow',
    sourcePolicySnapshot: { policyId: 'policy.001', policyVersion: '1.0.0' },
    transportPolicyId: 'transport.001', transportPolicyVersion: '1.0.0',
    limits: { maxPages: 1, maxResponseBytes: 4096, timeoutMs: 5000 },
    executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
    rawPayloadRequested: false, outreachRequested: false, requestedAt: '2026-10-16T00:00:00.000Z',
  });
}
function context(overrides: Partial<WorkHandlerContext> = {}): WorkHandlerContext {
  return {
    workType: M04_WEBSITE_INSPECTION_WORK_TYPE, workVersion: 1, workspaceId: WORKSPACE,
    jobRunId: 'job.001', workUnitId: 'work.001', correlationId: 'trace.001', attempt: 1,
    payload: { kind: 'website_inspection_fixture', inspectionId: request().inspectionId },
    isCancellationRequested: async () => false,
    ...overrides,
  };
}
function options() {
  const loadRequest = vi.fn(async () => request());
  const runInspection = vi.fn(async (r: WebsiteInspectionRequest, _options: { cancellationSignal?: AbortSignal }) => WebsiteInspectionResultSchema.parse({
    version: '1.0.0', request: r, status: 'review_required', coverage: 'partial',
    transportReceiptIds: ['receipt.001'], observations: [],
    reasonCodes: ['website.single_page_only'],
    completedAt: '2026-10-16T00:01:00.000Z', bodyIncluded: false,
  }));
  return { loadRequest, runInspection, parseRequest: WebsiteInspectionRequestSchema.parse,
    parseResult: WebsiteInspectionResultSchema.parse };
}

describe('M04 WEB-023 fixture-only canonical work handler (staged native suite)', () => {
  it('emits deterministic bounded effects without raw fixture body', async () => {
    const config = options();
    const handler = createWebsiteInspectionWorkHandler(config);
    const first = await handler(context());
    const second = await handler(context({ attempt: 2 }));
    expect(first.effectKey).toBe(second.effectKey);
    expect(first.effectData).toMatchObject({ inspectionId: request().inspectionId, bodyIncluded: false, receiptCount: 1 });
    expect(first.effectData).not.toHaveProperty('rawHtml');
    expect(config.loadRequest).toHaveBeenCalledWith({ workspaceId: WORKSPACE, inspectionId: request().inspectionId });
  });
  it('rejects unexpected payload and forbids request-supplied approval', async () => {
    const config = options();
    const handler = createWebsiteInspectionWorkHandler(config);
    await expect(handler(context({ payload: { kind: 'website_inspection_fixture', inspectionId: request().inspectionId, networkRequested: true } })))
      .rejects.toMatchObject({ code: 'M04_WORK_PAYLOAD_INVALID' });
    expect(config.loadRequest).not.toHaveBeenCalled();
  });
  it('does not run a cross-workspace request even if it is schema-valid', async () => {
    const config = options();
    config.loadRequest.mockImplementation(async () => ({ ...request(), workspaceId: '550e8400-e29b-41d4-a716-446655440001' }));
    const handler = createWebsiteInspectionWorkHandler(config);
    await expect(handler(context())).rejects.toMatchObject({ code: 'M04_WORK_REQUEST_SCOPE_MISMATCH' });
    expect(config.runInspection).not.toHaveBeenCalled();
  });
  it('rejects pre-cancelled units before performing source lookup', async () => {
    const config = options();
    const handler = createWebsiteInspectionWorkHandler(config);
    await expect(handler(context({ isCancellationRequested: async () => true })))
      .rejects.toMatchObject({ code: 'M04_WORK_CANCELLED' });
    expect(config.loadRequest).not.toHaveBeenCalled();
  });
  it('fails retryably if the cancellation DB read is unavailable', async () => {
    const config = options();
    const handler = createWebsiteInspectionWorkHandler(config);
    await expect(handler(context({ isCancellationRequested: async () => { throw new Error('DB unavailable'); } })))
      .rejects.toMatchObject({ code: 'M04_CANCELLATION_CHECK_FAILED' });
    expect(config.runInspection).not.toHaveBeenCalled();
  });
  it('propagates cancellation signal independently for each work invocation', async () => {
    const config = options();
    const handler = createWebsiteInspectionWorkHandler(config);
    await handler(context());
    await handler(context({ workUnitId: 'work.002' }));
    const signal1 = config.runInspection.mock.calls[0]?.[1]?.cancellationSignal;
    const signal2 = config.runInspection.mock.calls[1]?.[1]?.cancellationSignal;
    expect(signal1).toBeInstanceOf(AbortSignal);
    expect(signal2).toBeInstanceOf(AbortSignal);
    expect(signal1).not.toBe(signal2);
  });
});