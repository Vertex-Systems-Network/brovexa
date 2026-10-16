import type { WebsiteInspectionResult } from '@brovexa/contracts';

/**
 * M04-WEB-003 -> WEB-002 integration seam. No DB import until #174 is integrated.
 * Explicitly projects WEB-001 request fields including safety budgets onto
 * WEB-002 storage. The migration records budgets for traceable provenance.
 * Caller MUST parse the result with WebsiteInspectionResultSchema first.
 */
export class WebsiteInspectionBridgeError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'WebsiteInspectionBridgeError';
  }
}

const workspaceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WebsiteInspectionPersistencePayload {
  version: '1.0.0';
  request: WebsiteInspectionResult['request'];
  status: WebsiteInspectionResult['status'];
  coverage: WebsiteInspectionResult['coverage'];
  transportReceiptIds: readonly string[];
  reasonCodes: readonly string[];
  observations: readonly WebsiteInspectionResult['observations'][number][];
  completedAt: string;
  bodyIncluded: false;
  retentionTtlSeconds: number;
  deletionRequired: true;
}

export interface WebsiteInspectionStoragePolicy {
  workspaceId: string;
  retentionTtlSeconds: number;
  /** This seam only supports explicit-delete enabled evidence. */
  deletionRequired: true;
}

/**
 * WEB-018: The tenant policy lookup is an asynchronous authorization boundary.
 * A reused ORM row, Proxy or getter must not change workspace scope or TTL
 * between validation and record construction. Access own data only, once;
 * never execute policy accessors and never copy auxiliary policy fields.
 */
function snapshotStoragePolicy(value: unknown): WebsiteInspectionStoragePolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_WORKSPACE_INVALID');
  }
  const own = (field: keyof WebsiteInspectionStoragePolicy, code: string): unknown => {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, field); }
    catch { throw new WebsiteInspectionBridgeError(code); }
    if (!descriptor || !('value' in descriptor)) throw new WebsiteInspectionBridgeError(code);
    return descriptor.value;
  };
  const tenant = own('workspaceId', 'M04_PERSISTENCE_WORKSPACE_INVALID');
  const ttl = own('retentionTtlSeconds', 'M04_PERSISTENCE_RETENTION_INVALID');
  const deletion = own('deletionRequired', 'M04_PERSISTENCE_RETENTION_INVALID');
  if (typeof tenant !== 'string' || !workspaceId.test(tenant)) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_WORKSPACE_INVALID');
  }
  if (deletion !== true || typeof ttl !== 'number' || !Number.isSafeInteger(ttl) ||
      ttl < 1 || ttl > 31_536_000) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_RETENTION_INVALID');
  }
  return Object.freeze({ workspaceId: tenant, retentionTtlSeconds: ttl,
    deletionRequired: true as const });
}

/** WEB-018: DB acknowledgements are untrusted until pinned to own data. */
function snapshotAcknowledgement(value: unknown): { inspectionId: string; replayed: boolean } {
  const invalid = (): never => { throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_ACK_MISMATCH'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const own = (field: 'inspectionId' | 'replayed'): unknown => {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, field); }
    catch { return invalid(); }
    if (!descriptor || !('value' in descriptor)) invalid();
    return descriptor.value;
  };
  const inspectionId = own('inspectionId');
  const replayed = own('replayed');
  if (typeof inspectionId !== 'string' || typeof replayed !== 'boolean') invalid();
  return Object.freeze({ inspectionId, replayed });
}

export function toWebsiteInspectionPersistencePayload(
  result: WebsiteInspectionResult,
  policy: WebsiteInspectionStoragePolicy,
): WebsiteInspectionPersistencePayload {
  const pinnedPolicy = snapshotStoragePolicy(policy);
  if (!result || !result.request ||
      result.request.workspaceId !== pinnedPolicy.workspaceId) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_WORKSPACE_INVALID');
  }
  if (result.version !== '1.0.0' || result.request.version !== '1.0.0' ||
      result.bodyIncluded !== false ||
      !Number.isFinite(Date.parse(result.completedAt)) ||
      !Number.isFinite(Date.parse(result.request.requestedAt)) ||
      Date.parse(result.completedAt) < Date.parse(result.request.requestedAt)) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_RESULT_INVALID');
  }
  // Explicit allow-list: structural TypeScript types do not strip unknown runtime
  // properties. Never spread untrusted request/observation objects into DB payloads.
  const request = result.request;
  return {
    version: '1.0.0',
    request: {
      version: request.version,
      inspectionId: request.inspectionId,
      workspaceId: request.workspaceId,
      canonicalBusinessId: request.canonicalBusinessId,
      verifiedDomain: request.verifiedDomain,
      domainVerification: {
        verificationId: request.domainVerification.verificationId,
        decision: request.domainVerification.decision,
        evidenceIds: [...request.domainVerification.evidenceIds],
      },
      targetUrl: request.targetUrl,
      sourceKey: request.sourceKey,
      sourceAdmissionDecisionRef: request.sourceAdmissionDecisionRef,
      sourceAdmissionDecision: request.sourceAdmissionDecision,
      sourcePolicySnapshot: {
        policyId: request.sourcePolicySnapshot.policyId,
        policyVersion: request.sourcePolicySnapshot.policyVersion,
      },
      transportPolicyId: request.transportPolicyId,
      transportPolicyVersion: request.transportPolicyVersion,
      limits: {
        maxPages: request.limits.maxPages,
        maxResponseBytes: request.limits.maxResponseBytes,
        timeoutMs: request.limits.timeoutMs,
      },
      executionMode: request.executionMode,
      networkRequested: request.networkRequested,
      credentialedFetchRequested: request.credentialedFetchRequested,
      rawPayloadRequested: request.rawPayloadRequested,
      outreachRequested: request.outreachRequested,
      requestedAt: request.requestedAt,
    },
    status: result.status,
    coverage: result.coverage,
    transportReceiptIds: [...result.transportReceiptIds],
    reasonCodes: [...result.reasonCodes],
    observations: result.observations.map(item => ({
      capability: item.capability,
      observation: item.observation,
      reason: item.reason,
      confidence: item.confidence,
      evidenceReferenceIds: [...item.evidenceReferenceIds],
      transportReceiptIds: [...item.transportReceiptIds],
    })),
    completedAt: result.completedAt,
    bodyIncluded: false,
    retentionTtlSeconds: pinnedPolicy.retentionTtlSeconds,
    deletionRequired: true,
  };
}

export interface WebsiteInspectionPersistenceHandoffDependencies {
  /** Always use the real WEB-001 strict contract parser when integrated. */
  parseResult(raw: unknown): WebsiteInspectionResult;
  /** Source of truth for tenant retention and deletion policy, not request data. */
  policyForWorkspace(workspaceId: string): Promise<WebsiteInspectionStoragePolicy>;
  /** Future WEB-002 native persistence function; MUST enforce database RBAC. */
  persist(payload: WebsiteInspectionPersistencePayload): Promise<{
    inspectionId: string;
    replayed: boolean;
  }>;
}

/** A per-work-unit cancellation fence for the policy-to-DB handoff. */
export interface WebsitePersistenceRunOptions {
  cancellationSignal?: AbortSignal;
}

function assertPersistenceNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_CANCELLED');
  }
}

/**
 * WEB-024: interrupt waiting for the tenant-policy read if the worker cancels.
 * The underlying lookup must still manage its own DB query cancellation.
 * NEVER use this Promise race around persist(): DB commits cannot be rolled
 * back simply because the caller stopped awaiting a Promise.
 */
function readPolicyWithCancellation(
  lookup: WebsiteInspectionPersistenceHandoffDependencies['policyForWorkspace'],
  workspace: string,
  signal?: AbortSignal,
): Promise<WebsiteInspectionStoragePolicy> {
  assertPersistenceNotCancelled(signal);
  if (!signal) return lookup(workspace);
  return new Promise<WebsiteInspectionStoragePolicy>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener('abort', cancel);
    const cancel = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new WebsiteInspectionBridgeError('M04_PERSISTENCE_CANCELLED'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    void Promise.resolve().then(() => {
      assertPersistenceNotCancelled(signal);
      return lookup(workspace);
    }).then(
      value => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      error => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

/**
 * Integration adapter: strict schema -> trusted workspace storage policy ->
 * allow-listed DB record -> ack binding. No SQL/network performed in this file.
 * An ack mismatch is an incident; it cannot undo a previously committed DB write.
 */
export function createWebsiteInspectionPersistenceHandoff(
  dependencies: WebsiteInspectionPersistenceHandoffDependencies,
): (value: unknown, options?: WebsitePersistenceRunOptions) => Promise<{ inspectionId: string; replayed: boolean }> {
  return async (raw: unknown, options?: WebsitePersistenceRunOptions) => {
    const signal = options?.cancellationSignal;
    assertPersistenceNotCancelled(signal);
    // Snapshot before crossing the asynchronous tenant-policy trust boundary.
    const result = structuredClone(dependencies.parseResult(raw));
    if (!result?.request || !workspaceId.test(result.request.workspaceId)) {
      throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_WORKSPACE_INVALID');
    }
    const policy = await readPolicyWithCancellation(
      dependencies.policyForWorkspace, result.request.workspaceId, signal,
    );
    assertPersistenceNotCancelled(signal);
    const payload = toWebsiteInspectionPersistencePayload(result, policy);
    // Last cancellation fence BEFORE the irreversible database callback.
    assertPersistenceNotCancelled(signal);
    // Do not race a database commit with an abort Promise. Always wait for ACK.
    const acknowledgement = snapshotAcknowledgement(await dependencies.persist(payload));
    if (acknowledgement.inspectionId !== payload.request.inspectionId) {
      throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_ACK_MISMATCH');
    }
    return acknowledgement;
  };
}