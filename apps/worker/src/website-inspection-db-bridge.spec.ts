import { describe, expect, it } from 'vitest';
import type { WebsiteInspectionResult } from '@brovexa/contracts';
import {
  WebsiteInspectionBridgeError,
  createWebsiteInspectionPersistenceHandoff,
  toWebsiteInspectionPersistencePayload,
  type WebsiteInspectionStoragePolicy,
} from './website-inspection-db-bridge';

const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
const policy = (): WebsiteInspectionStoragePolicy => ({
  workspaceId, retentionTtlSeconds: 86400, deletionRequired: true,
});

function sample(): WebsiteInspectionResult {
  return {
    version: '1.0.0', status: 'review_required', coverage: 'partial',
    transportReceiptIds: ['receipt.1'], reasonCodes: ['website.single_page_only'],
    observations: [{ capability: 'social_link', observation: 'unknown',
      reason: 'insufficient_evidence', confidence: null,
      evidenceReferenceIds: [], transportReceiptIds: [] }],
    completedAt: '2026-10-16T01:00:00.000Z', bodyIncluded: false,
    request: {
      version: '1.0.0', inspectionId: 'inspection.1', workspaceId,
      canonicalBusinessId: 'business.1', verifiedDomain: 'example.com',
      domainVerification: { verificationId: 'verify.1', decision: 'verified', evidenceIds: ['domain.1'] },
      targetUrl: 'https://example.com/', sourceKey: 'source.approved',
      sourceAdmissionDecisionRef: 'admission.1', sourceAdmissionDecision: 'allow',
      sourcePolicySnapshot: { policyId: 'source.policy', policyVersion: '1.0.0' },
      transportPolicyId: 'transport.policy', transportPolicyVersion: '1.0.0',
      limits: { maxPages: 1, maxResponseBytes: 1024, timeoutMs: 1000 },
      executionMode: 'test_only', networkRequested: false, credentialedFetchRequested: false,
      rawPayloadRequested: false, outreachRequested: false,
      requestedAt: '2026-10-16T00:00:00.000Z',
    },
  };
}

describe('M04 WEB-018 tenant policy & storage acknowledgement boundary (candidate)', () => {
  it('fails closed on accessor workspaceId without executing getter', () => {
    const mutable = policy();
    let invoked = 0;
    Object.defineProperty(mutable, 'workspaceId', { get: () => { invoked++; return workspaceId; } });
    expect(() => toWebsiteInspectionPersistencePayload(sample(), mutable))
      .toThrowError(WebsiteInspectionBridgeError);
    expect(invoked).toBe(0);
  });

  it('fails closed on accessor retention TTL without executing getter', () => {
    const mutable = policy();
    let invoked = 0;
    Object.defineProperty(mutable, 'retentionTtlSeconds', { get: () => { invoked++; return 86400; } });
    expect(() => toWebsiteInspectionPersistencePayload(sample(), mutable))
      .toThrowError(WebsiteInspectionBridgeError);
    expect(invoked).toBe(0);
  });

  it('pins workspace and TTL across asynchronous DB adapter side effects', async () => {
    const mutable = policy();
    let recorded: ReturnType<typeof toWebsiteInspectionPersistencePayload> | undefined;
    const handoff = createWebsiteInspectionPersistenceHandoff({
      parseResult: raw => raw as WebsiteInspectionResult,
      policyForWorkspace: async () => mutable,
      persist: async payload => {
        recorded = payload;
        mutable.retentionTtlSeconds = 0;
        mutable.workspaceId = '550e8400-e29b-41d4-a716-446655440001';
        return { inspectionId: 'inspection.1', replayed: false };
      },
    });
    await handoff(sample());
    expect(recorded?.retentionTtlSeconds).toBe(86400);
    expect(recorded?.request.workspaceId).toBe(workspaceId);
  });

  it('rejects getter-backed DB ACK and does not execute its getter', async () => {
    let invoked = 0;
    const handoff = createWebsiteInspectionPersistenceHandoff({
      parseResult: raw => raw as WebsiteInspectionResult,
      policyForWorkspace: async () => policy(),
      persist: async () => {
        const ack = { inspectionId: 'inspection.1', replayed: false };
        Object.defineProperty(ack, 'replayed', { get: () => { invoked++; return false; } });
        return ack;
      },
    });
    await expect(handoff(sample())).rejects.toMatchObject({ code: 'M04_PERSISTENCE_ACK_MISMATCH' });
    expect(invoked).toBe(0);
  });
});

// WEB-024: native Vitest candidates; do not run until M04 completion gate.
describe('M04 WEB-024 cancellable tenant policy/DB write boundary (staged)', () => {
  it('does not call policy lookup or DB when cancellation precedes handoff', async () => {
    const controller = new AbortController();
    controller.abort();
    let lookups = 0;
    let writes = 0;
    const handoff = createWebsiteInspectionPersistenceHandoff({
      parseResult: raw => raw as WebsiteInspectionResult,
      policyForWorkspace: async () => { lookups++; return policy(); },
      persist: async () => { writes++; return { inspectionId: 'inspection.1', replayed: false }; },
    });
    await expect(handoff(sample(), { cancellationSignal: controller.signal }))
      .rejects.toMatchObject({ code: 'M04_PERSISTENCE_CANCELLED' });
    expect(lookups).toBe(0);
    expect(writes).toBe(0);
  });

  it('does not persist if the worker cancels during the tenant-policy read', async () => {
    const controller = new AbortController();
    let allowPolicy: ((value: WebsiteInspectionStoragePolicy) => void) | undefined;
    let startLookup: (() => void) | undefined;
    const started = new Promise<void>(resolve => { startLookup = resolve; });
    let writes = 0;
    const handoff = createWebsiteInspectionPersistenceHandoff({
      parseResult: raw => raw as WebsiteInspectionResult,
      policyForWorkspace: () => {
        startLookup?.();
        return new Promise<WebsiteInspectionStoragePolicy>(done => { allowPolicy = done; });
      },
      persist: async () => { writes++; return { inspectionId: 'inspection.1', replayed: false }; },
    });
    const pending = handoff(sample(), { cancellationSignal: controller.signal });
    await started;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'M04_PERSISTENCE_CANCELLED' });
    allowPolicy?.(policy()); // Late policy result must not trigger any DB write.
    await Promise.resolve();
    expect(writes).toBe(0);
  });

  it('does not claim cancellation rolls back a commit already in flight', async () => {
    const controller = new AbortController();
    let dbWrites = 0;
    const handoff = createWebsiteInspectionPersistenceHandoff({
      parseResult: raw => raw as WebsiteInspectionResult,
      policyForWorkspace: async () => policy(),
      persist: async () => {
        dbWrites++;
        controller.abort(); // A commit may already have happened.
        return { inspectionId: 'inspection.1', replayed: false };
      },
    });
    await expect(handoff(sample(), { cancellationSignal: controller.signal }))
      .resolves.toEqual({ inspectionId: 'inspection.1', replayed: false });
    expect(dbWrites).toBe(1);
  });
});