import { isIP } from 'node:net';
import { URL } from 'node:url';
import { z } from 'zod';

/**
 * M04-WEB-001: contracts only. A valid request does NOT authorize DNS, HTTP,
 * redirects or provider execution. Each hop still requires M02 admission.
 */
const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const DateTimeSchema = z.string().datetime();
const DomainSchema = z.string().min(3).max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
  .refine((domain) => isIP(domain) === 0, 'A verified website domain cannot be an IP literal.')
  .refine((domain) => !/\.(?:localhost|local|internal|invalid|test)$/.test(domain),
    'A verified website domain cannot use a reserved internal-use suffix.');
const UrlSchema = z.string().min(1).max(2048).url();
const RefList = z.array(IdentifierSchema).max(32);
const CapabilitySchema = z.enum([
  'booking', 'commerce', 'contact_form', 'business_contact',
  'mobile_viewport', 'structured_data', 'social_link', 'https',
]);

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function websiteTargetMatchesVerifiedDomain(value: string, domain: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.username === '' && url.password === '' &&
      url.hostname === domain && isIP(url.hostname) === 0 &&
      url.port === '' &&
      url.pathname === '/' && url.search === '' && url.hash === '';
  } catch {
    return false;
  }
}

export const WebsiteInspectionRequestSchema = z.object({
  version: z.literal('1.0.0'),
  inspectionId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  canonicalBusinessId: IdentifierSchema,
  verifiedDomain: DomainSchema,
  domainVerification: z.object({
    verificationId: IdentifierSchema,
    decision: z.literal('verified'),
    evidenceIds: z.array(IdentifierSchema).min(1).max(32),
  }).strict(),
  targetUrl: UrlSchema,
  sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
  sourceAdmissionDecisionRef: IdentifierSchema,
  sourceAdmissionDecision: z.literal('allow'),
  sourcePolicySnapshot: z.object({
    policyId: IdentifierSchema,
    policyVersion: VersionSchema,
  }).strict(),
  transportPolicyId: IdentifierSchema,
  transportPolicyVersion: VersionSchema,
  limits: z.object({
    maxPages: z.number().int().min(1).max(5),
    maxResponseBytes: z.number().int().min(1).max(1_000_000),
    timeoutMs: z.number().int().min(100).max(30_000),
  }).strict(),
  executionMode: z.literal('test_only'),
  networkRequested: z.literal(false),
  credentialedFetchRequested: z.literal(false),
  rawPayloadRequested: z.literal(false),
  outreachRequested: z.literal(false),
  requestedAt: DateTimeSchema,
}).strict().superRefine((request, ctx) => {
  if (!unique(request.domainVerification.evidenceIds)) {
    ctx.addIssue({ code: 'custom', path: ['domainVerification', 'evidenceIds'],
      message: 'Domain verification evidence references must be unique.' });
  }
  if (!websiteTargetMatchesVerifiedDomain(request.targetUrl, request.verifiedDomain)) {
    ctx.addIssue({ code: 'custom', path: ['targetUrl'],
      message: 'Inspection target must be HTTPS root of the exact verified domain without credentials, ports, query or fragment.' });
  }
});

export type WebsiteInspectionRequest = z.infer<typeof WebsiteInspectionRequestSchema>;

export const WebsiteCapabilityObservationSchema = z.object({
  capability: CapabilitySchema,
  observation: z.enum(['observed_present', 'not_detected', 'unknown']),
  reason: z.enum(['detected', 'not_detected_with_bounded_coverage', 'insufficient_evidence']),
  confidence: z.number().min(0).max(1).nullable(),
  evidenceReferenceIds: RefList,
  transportReceiptIds: z.array(IdentifierSchema).max(5),
}).strict().superRefine((finding, ctx) => {
  if (!unique(finding.evidenceReferenceIds) || !unique(finding.transportReceiptIds)) {
    ctx.addIssue({ code: 'custom', message: 'Capability evidence and receipt references must be unique.' });
  }
  if (finding.observation === 'unknown') {
    if (finding.reason !== 'insufficient_evidence' || finding.confidence !== null ||
        finding.evidenceReferenceIds.length !== 0 || finding.transportReceiptIds.length !== 0) {
      ctx.addIssue({ code: 'custom', message: 'Unknown must not claim a measured confidence or evidence.' });
    }
  } else {
    const expectedReason = finding.observation === 'observed_present'
      ? 'detected' : 'not_detected_with_bounded_coverage';
    if (finding.reason !== expectedReason || finding.confidence === null ||
        finding.evidenceReferenceIds.length === 0 || finding.transportReceiptIds.length === 0) {
      ctx.addIssue({ code: 'custom',
        message: 'Observed or not-detected capability requires bounded receipt evidence and aligned reason/confidence.' });
    }
  }
});

export type WebsiteCapabilityObservation = z.infer<typeof WebsiteCapabilityObservationSchema>;

export const WebsiteInspectionResultSchema = z.object({
  version: z.literal('1.0.0'),
  request: WebsiteInspectionRequestSchema,
  status: z.enum(['assessed', 'review_required', 'unavailable']),
  coverage: z.enum(['none', 'partial', 'bounded']),
  transportReceiptIds: z.array(IdentifierSchema).max(5),
  observations: z.array(WebsiteCapabilityObservationSchema).max(8),
  reasonCodes: z.array(IdentifierSchema).max(16),
  completedAt: DateTimeSchema,
  bodyIncluded: z.literal(false),
}).strict().superRefine((result, ctx) => {
  if (!unique(result.transportReceiptIds) || !unique(result.reasonCodes) ||
      !unique(result.observations.map((item) => item.capability))) {
    ctx.addIssue({ code: 'custom',
      message: 'Transport receipts, reason codes and capability kinds must be unique.' });
  }
  if (Date.parse(result.completedAt) < Date.parse(result.request.requestedAt)) {
    ctx.addIssue({ code: 'custom', path: ['completedAt'],
      message: 'Website inspection result cannot predate its request.' });
  }
  const receiptSet = new Set(result.transportReceiptIds);
  for (const [index, observation] of result.observations.entries()) {
    if (observation.transportReceiptIds.some((id) => !receiptSet.has(id))) {
      ctx.addIssue({ code: 'custom', path: ['observations', index, 'transportReceiptIds'],
        message: 'Observation receipts must belong to the inspection result.' });
    }
    if (observation.observation === 'not_detected' && result.coverage !== 'bounded') {
      ctx.addIssue({ code: 'custom', path: ['observations', index, 'observation'],
        message: 'Not detected requires bounded coverage; it is never proof of absolute absence.' });
    }
  }
  if (result.coverage === 'none' &&
      (result.transportReceiptIds.length !== 0 ||
       result.observations.some((item) => item.observation !== 'unknown'))) {
    ctx.addIssue({ code: 'custom', path: ['coverage'],
      message: 'No coverage cannot claim transport receipts or observed capabilities.' });
  }
  if (result.coverage !== 'none' && result.transportReceiptIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['transportReceiptIds'],
      message: 'Partial or bounded coverage requires transport receipts.' });
  }
  if (result.status === 'assessed' &&
      (result.coverage !== 'bounded' || result.reasonCodes.length !== 0 ||
       result.observations.length === 0 ||
       result.observations.some((item) => item.observation === 'unknown'))) {
    ctx.addIssue({ code: 'custom', path: ['status'],
      message: 'Assessed requires bounded coverage and fully evidenced non-unknown observations.' });
  }
  if (result.status === 'unavailable' &&
      (result.coverage !== 'none' || result.reasonCodes.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['status'],
      message: 'Unavailable must retain no coverage and a documented failure reason.' });
  }
  if (result.status === 'review_required' &&
      result.reasonCodes.length === 0 &&
      result.coverage === 'bounded' &&
      result.observations.length !== 0 &&
      result.observations.every((item) => item.observation !== 'unknown')) {
    ctx.addIssue({ code: 'custom', path: ['status'],
      message: 'Review required needs a limitation, unknown observation or reason code.' });
  }
});

export type WebsiteInspectionResult = z.infer<typeof WebsiteInspectionResultSchema>;
