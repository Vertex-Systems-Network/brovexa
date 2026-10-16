import type { WebsiteCapabilityObservation } from '@brovexa/contracts';
import { extractWebsiteCapabilitiesFromFixture } from './website-fixture-extractor';
import {
  acquireAuthorizedM04LiveRoot,
  type M04LiveReadRequest,
  type M04LiveAcquisitionDependencies,
  type M04LiveReadReceipt,
} from './website-live-acquisition';

/**
 * M04 v2 live page assessment. This is NOT a WEB-001 v1 inspection result:
 * WEB-001/v1 and WEB-002/migration0018 forbid live network provenance.
 * Do not write this output to website_inspection_runs until a separate
 * authorized v2 storage contract and migration have been deployed.
 */
export interface M04LiveAssessment {
  readonly version: '2.0.0';
  readonly request: Readonly<M04LiveReadRequest>;
  readonly status: 'review_required';
  readonly coverage: 'partial';
  readonly transportReceiptIds: readonly string[];
  readonly observations: readonly WebsiteCapabilityObservation[];
  readonly reasonCodes: readonly string[];
  readonly receipt: Readonly<M04LiveReadReceipt>;
  readonly completedAt: string;
  readonly bodyIncluded: false;
}

export async function inspectAuthorizedM04LiveRoot(
  request: M04LiveReadRequest,
  dependencies: M04LiveAcquisitionDependencies,
): Promise<M04LiveAssessment> {
  // Snapshot the caller's exact own-data request BEFORE any async approval/DNS
  // work; do not serialize mutable caller fields after a network read.
  const requestFields = [
    'workspaceId','inspectionId','canonicalBusinessId','domainVerificationId',
    'verifiedDomain','sourceKey','sourceAdmissionDecisionRef','sourcePolicyId',
    'sourcePolicyVersion','transportPolicyId','transportPolicyVersion',
    'version','executionMode','networkRequested','credentialedFetchRequested',
    'rawPayloadRequested','outreachRequested','targetUrl','maxResponseBytes','timeoutMs',
  ] as const;
  const pinnedRequest = Object.freeze(Object.fromEntries(requestFields.map(field => [
    field, Object.getOwnPropertyDescriptor(request,field)?.value,
  ]))) as unknown as M04LiveReadRequest;
  const { receipt, body } = await acquireAuthorizedM04LiveRoot(pinnedRequest, dependencies);
  try {
    // Conservative deterministic HTML inspection shared with fixture mode;
    // single-root evidence never yields full-site absence or assessed status.
    const result = await extractWebsiteCapabilitiesFromFixture({
      request: {
        verifiedDomain: receipt.canonicalUrl.slice('https://'.length,-1),
        targetUrl: receipt.canonicalUrl,
        limits: { maxResponseBytes: pinnedRequest.maxResponseBytes },
      },
      receiptId: receipt.receiptId,
      body,
    });
    const observations: WebsiteCapabilityObservation[] = result.findings.map(item => ({
      capability: item.capability,
      observation: item.observation,
      reason: item.reason,
      confidence: item.confidence,
      evidenceReferenceIds: [...item.evidenceReferenceIds],
      transportReceiptIds: item.observation === 'unknown' ? [] : [receipt.receiptId],
    }));
    const completedAt = dependencies.now?.() ?? new Date();
    return {
      version: '2.0.0',
      request: pinnedRequest,
      status: 'review_required', coverage: 'partial',
      transportReceiptIds: [receipt.receiptId],
      observations, reasonCodes: [...result.reasonCodes],receipt,
      completedAt: completedAt.toISOString(),bodyIncluded:false,
    };
  } finally {
    // Externally sourced HTML is transient; minimize accidental retention.
    body.fill(0);
  }
}