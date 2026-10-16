// Offline type-only shim mirroring WEB-001 public model; not included in integration patch.
declare module '@brovexa/contracts' {
  export const WebsiteInspectionRequestSchema: { parse(value: unknown): WebsiteInspectionRequest };
  export const WebsiteInspectionResultSchema: { parse(value: unknown): WebsiteInspectionResult; safeParse(value: unknown): { success: boolean } }; 
  export interface WebsiteInspectionRequest {
    version: '1.0.0'; inspectionId: string; workspaceId: string;
    canonicalBusinessId: string; verifiedDomain: string;
    domainVerification: { verificationId: string; decision: 'verified'; evidenceIds: string[] };
    targetUrl: string; sourceKey: string; sourceAdmissionDecisionRef: string;
    sourceAdmissionDecision: 'allow';
    sourcePolicySnapshot: { policyId: string; policyVersion: string };
    transportPolicyId: string; transportPolicyVersion: string;
    limits: { maxPages: number; maxResponseBytes: number; timeoutMs: number };
    executionMode: 'test_only'; networkRequested: false;
    credentialedFetchRequested: false; rawPayloadRequested: false; outreachRequested: false;
    requestedAt: string;
  }
  export interface WebsiteCapabilityObservation {
    capability: 'booking' | 'commerce' | 'contact_form' | 'business_contact' | 'mobile_viewport' | 'structured_data' | 'social_link' | 'https';
    observation: 'observed_present' | 'not_detected' | 'unknown';
    reason: 'detected' | 'not_detected_with_bounded_coverage' | 'insufficient_evidence';
    confidence: number | null; evidenceReferenceIds: string[]; transportReceiptIds: string[];
  }
  export interface WebsiteInspectionResult {
    version: '1.0.0'; request: WebsiteInspectionRequest; status: 'assessed' | 'review_required' | 'unavailable';
    coverage: 'none' | 'partial' | 'bounded'; transportReceiptIds: string[];
    observations: WebsiteCapabilityObservation[]; reasonCodes: string[];
    completedAt: string; bodyIncluded: false;
  }
}