import type { WebsiteInspectionResult } from '@brovexa/contracts';

/**
 * M04-WEB-003 -> WEB-002 integration seam. No DB import until #174 is integrated.
 * Explicitly projects WEB-001's request onto WEB-002's persisted columns, omitting
 * the runtime limits (which the persistence interface does not store).
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
  request: Omit<WebsiteInspectionResult['request'], 'limits'>;
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

export function toWebsiteInspectionPersistencePayload(
  result: WebsiteInspectionResult,
  policy: WebsiteInspectionStoragePolicy,
): WebsiteInspectionPersistencePayload {
  if (!result || !result.request || !policy ||
      !workspaceId.test(policy.workspaceId) ||
      result.request.workspaceId !== policy.workspaceId) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_WORKSPACE_INVALID');
  }
  if (policy.deletionRequired !== true ||
      !Number.isSafeInteger(policy.retentionTtlSeconds) ||
      policy.retentionTtlSeconds < 1 || policy.retentionTtlSeconds > 31_536_000) {
    throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_RETENTION_INVALID');
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
    retentionTtlSeconds: policy.retentionTtlSeconds,
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

/**
 * Integration adapter: strict schema -> trusted workspace storage policy ->
 * allow-listed DB record -> ack binding. No SQL/network performed in this file.
 * An ack mismatch is an incident; it cannot undo a previously committed DB write.
 */
export function createWebsiteInspectionPersistenceHandoff(
  dependencies: WebsiteInspectionPersistenceHandoffDependencies,
): (value: unknown) => Promise<{ inspectionId: string; replayed: boolean }> {
  return async (raw: unknown) => {
    // Snapshot before crossing the asynchronous tenant-policy trust boundary.
    const result = structuredClone(dependencies.parseResult(raw));
    if (!result?.request || !workspaceId.test(result.request.workspaceId)) {
      throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_WORKSPACE_INVALID');
    }
    const policy = await dependencies.policyForWorkspace(result.request.workspaceId);
    const payload = toWebsiteInspectionPersistencePayload(result, policy);
    const acknowledgement = await dependencies.persist(payload);
    if (!acknowledgement || acknowledgement.inspectionId !== payload.request.inspectionId ||
        typeof acknowledgement.replayed !== 'boolean') {
      throw new WebsiteInspectionBridgeError('M04_PERSISTENCE_ACK_MISMATCH');
    }
    return acknowledgement;
  };
}
