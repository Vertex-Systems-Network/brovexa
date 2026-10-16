import { createHash } from 'node:crypto';
import type {
  WebsiteInspectionRequest,
  WebsiteInspectionResult,
  WebsiteCapabilityObservation,
} from '@brovexa/contracts';

/**
 * M04-WEB-003 local development: bounded, TEST-ONLY orchestration.
 * No HTTP, DNS, redirects, credentials, outbound requests or HTML persistence.
 * A fixture exchange is injected by a test harness, NEVER a production fetch.
 * Production acquisition needs independent M02 transport/SSRF admission.
 */
export class WebsiteInspectionRuntimeError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'WebsiteInspectionRuntimeError';
  }
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const capabilityIds = new Set([
  'booking', 'commerce', 'contact_form', 'business_contact',
  'mobile_viewport', 'structured_data', 'social_link', 'https',
]);

export interface WebsiteAuthorizedFixture {
  decision: 'allow' | 'blocked';
  transportKind: 'test' | 'network';
  workspaceId: string;
  /** Receipt authorization is for this exact inspection, not just the workspace. */
  inspectionId: string;
  canonicalBusinessId: string;
  verifiedDomain: string;
  verificationId: string;
  /** Source-of-truth verification evidence IDs, fetched independently of the request. */
  domainEvidenceIds: readonly string[];
  sourceKey: string;
  sourceAdmissionDecisionRef: string;
  sourcePolicyId: string;
  sourcePolicyVersion: string;
  transportPolicyId: string;
  transportPolicyVersion: string;
  canonicalUrl: string;
  /** An evidence receipt provided by the trusted, scoped test fixture admission. */
  receiptId: string;
  /** Independently-approved test fixture manifest, bound to receiptId. */
  fixtureBodySha256: string;
  fixtureStatus: number;
  fixtureContentType: 'text/html';
  fixtureByteLength: number;
  maxResponseBytes: number;
  timeoutMs: number;
  expiresAt: string;
}

export interface WebsiteFixtureExchangeInput {
  transportKind: 'test';
  transportRequestId: string;
  url: string;
  maxResponseBytes: number;
  timeoutMs: number;
  acceptedContentTypes: readonly ['text/html'];
}

export interface WebsiteFixtureExchange {
  status: number;
  finalUrl: string;
  contentType: string;
  body: Uint8Array;
  elapsedMs: number;
}

type CapabilityFinding = Omit<WebsiteCapabilityObservation, 'transportReceiptIds'>;

export interface WebsiteExtraction {
  /** Untrusted extractor coverage is advisory only; single-root runtime always emits partial. */
  coverage: 'partial' | 'bounded';
  findings: readonly CapabilityFinding[];
  reasonCodes: readonly string[];
}

export interface WebsiteInspectionDependencies {
  contracts: {
    parseRequest(value: unknown): WebsiteInspectionRequest;
    parseResult(value: unknown): WebsiteInspectionResult;
  };
  /** Must independently check the stored verification and source policy, not trust request assertions. */
  authorize(request: WebsiteInspectionRequest): Promise<WebsiteAuthorizedFixture>;
  /** Test fixture only: inject deterministic response; do not bind to fetch/HTTP. */
  exchange(input: WebsiteFixtureExchangeInput): Promise<WebsiteFixtureExchange>;
  /** Inspect transient bytes; return bounded evidence references, NEVER page text. */
  extract(input: {
    readonly request: WebsiteInspectionRequest;
    readonly body: Uint8Array;
    readonly receiptId: string;
  }): Promise<WebsiteExtraction>;
  /** Storage adapter may map to WEB-002 after that interface is merged and validated. */
  persist?(result: WebsiteInspectionResult): Promise<void>;
  now?: () => Date;
}

function fail(code: string): never {
  throw new WebsiteInspectionRuntimeError(code);
}

/**
 * WEB-010: the authorization adapter is an asynchronous trust boundary. Read
 * only own data properties ONCE; accessor-backed receipts and provenance arrays
 * could otherwise change between validation and the transport/digest handoff.
 */
function snapshotAdmission(raw: WebsiteAuthorizedFixture): WebsiteAuthorizedFixture {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('M04_FIXTURE_ADMISSION_INVALID');
  }
  const read = (key: keyof WebsiteAuthorizedFixture): unknown => {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(raw, key); }
    catch { fail('M04_FIXTURE_ADMISSION_INVALID'); }
    if (!descriptor || !('value' in descriptor)) fail('M04_FIXTURE_ADMISSION_INVALID');
    return descriptor.value;
  };
  const evidence = read('domainEvidenceIds');
  if (!Array.isArray(evidence) || evidence.length === 0 || evidence.length > 32) {
    fail('M04_FIXTURE_ADMISSION_INVALID');
  }
  const domainEvidenceIds: unknown[] = [];
  for (let index = 0; index < evidence.length; index++) {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(evidence, String(index)); }
    catch { fail('M04_FIXTURE_ADMISSION_INVALID'); }
    if (!descriptor || !('value' in descriptor)) fail('M04_FIXTURE_ADMISSION_INVALID');
    domainEvidenceIds.push(descriptor.value);
  }
  const keys = [
    'decision', 'transportKind', 'workspaceId', 'inspectionId',
    'canonicalBusinessId', 'verifiedDomain', 'verificationId', 'sourceKey',
    'sourceAdmissionDecisionRef', 'sourcePolicyId', 'sourcePolicyVersion',
    'transportPolicyId', 'transportPolicyVersion', 'canonicalUrl', 'receiptId',
    'fixtureBodySha256', 'fixtureStatus', 'fixtureContentType', 'fixtureByteLength',
    'maxResponseBytes', 'timeoutMs', 'expiresAt',
  ] as const;
  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) snapshot[key] = read(key);
  snapshot.domainEvidenceIds = Object.freeze(domainEvidenceIds);
  return Object.freeze(snapshot) as unknown as WebsiteAuthorizedFixture;
}

function checkIdenticalApproval(request: WebsiteInspectionRequest, admission: WebsiteAuthorizedFixture, nowMs: number): void {
  const valid = admission?.decision === 'allow' && admission.transportKind === 'test' &&
    admission.workspaceId === request.workspaceId &&
    admission.inspectionId === request.inspectionId &&
    admission.canonicalBusinessId === request.canonicalBusinessId &&
    admission.verifiedDomain === request.verifiedDomain &&
    admission.verificationId === request.domainVerification.verificationId &&
    Array.isArray(admission.domainEvidenceIds) &&
    admission.domainEvidenceIds.length === request.domainVerification.evidenceIds.length &&
    new Set(admission.domainEvidenceIds).size === admission.domainEvidenceIds.length &&
    admission.domainEvidenceIds.every((value: string) => request.domainVerification.evidenceIds.includes(value)) &&
    admission.sourceKey === request.sourceKey &&
    admission.sourceAdmissionDecisionRef === request.sourceAdmissionDecisionRef &&
    admission.sourcePolicyId === request.sourcePolicySnapshot.policyId &&
    admission.sourcePolicyVersion === request.sourcePolicySnapshot.policyVersion &&
    admission.transportPolicyId === request.transportPolicyId &&
    admission.transportPolicyVersion === request.transportPolicyVersion &&
    admission.canonicalUrl === request.targetUrl &&
    typeof admission.receiptId === 'string' && identifier.test(admission.receiptId) &&
    typeof admission.fixtureBodySha256 === 'string' && /^[0-9a-f]{64}$/.test(admission.fixtureBodySha256) &&
    Number.isSafeInteger(admission.fixtureStatus) &&
    (admission.fixtureStatus >= 200 && admission.fixtureStatus <= 599 &&
     !(admission.fixtureStatus >= 300 && admission.fixtureStatus < 400)) &&
    admission.fixtureContentType === 'text/html' &&
    Number.isSafeInteger(admission.fixtureByteLength) && admission.fixtureByteLength >= 0 &&
    admission.fixtureByteLength <= request.limits.maxResponseBytes &&
    Number.isSafeInteger(admission.maxResponseBytes) && admission.maxResponseBytes >= request.limits.maxResponseBytes &&
    admission.maxResponseBytes <= 1_000_000 &&
    Number.isSafeInteger(admission.timeoutMs) && admission.timeoutMs >= request.limits.timeoutMs &&
    admission.timeoutMs <= 30_000 &&
    typeof admission.expiresAt === 'string' && Number.isFinite(Date.parse(admission.expiresAt)) &&
    Date.parse(admission.expiresAt) >= nowMs &&
    Date.parse(admission.expiresAt) <= nowMs + 86_400_000;
  if (!valid) fail('M04_FIXTURE_ADMISSION_INVALID');
}

/**
 * Pin one defensive response snapshot before validating digest or handing its
 * transient body to any asynchronously invoked extractor. A hostile injected
 * fixture must not swap the body/status between approval checks and analysis.
 */
function snapshotExchange(raw: WebsiteFixtureExchange, maxResponseBytes: number): WebsiteFixtureExchange {
  if (!raw) fail('M04_FIXTURE_RESPONSE_INVALID');
  try {
    const body = raw.body;
    if (!(body instanceof Uint8Array) || body.byteLength > maxResponseBytes) {
      fail('M04_FIXTURE_BYTE_BUDGET');
    }
    return {
      status: raw.status,
      finalUrl: raw.finalUrl,
      contentType: raw.contentType,
      elapsedMs: raw.elapsedMs,
      body: Uint8Array.from(body),
    };
  } catch (error) {
    if (error instanceof WebsiteInspectionRuntimeError) throw error;
    fail('M04_FIXTURE_RESPONSE_INVALID');
  }
}

function checkExchange(response: WebsiteFixtureExchange, request: WebsiteInspectionRequest): void {
  if (!response || !Number.isSafeInteger(response.status) ||
      response.status < 100 || response.status > 599) fail('M04_FIXTURE_RESPONSE_INVALID');
  if (response.finalUrl !== request.targetUrl) fail('M04_FIXTURE_REDIRECT_FORBIDDEN');
  if (typeof response.contentType !== 'string' ||
      !/^text\/html(?:\s*;|$)/i.test(response.contentType)) fail('M04_FIXTURE_CONTENT_TYPE_INVALID');
  if (!Number.isFinite(response.elapsedMs) || response.elapsedMs < 0 ||
      response.elapsedMs > request.limits.timeoutMs) fail('M04_FIXTURE_TIMEOUT');
  if (!(response.body instanceof Uint8Array) ||
      response.body.byteLength > request.limits.maxResponseBytes) fail('M04_FIXTURE_BYTE_BUDGET');
  if (response.status >= 300 && response.status < 400) fail('M04_FIXTURE_REDIRECT_FORBIDDEN');
}

function verifyAttestedFixture(response: WebsiteFixtureExchange, manifest: Readonly<{
  bodySha256: string; status: number; contentType: 'text/html'; byteLength: number;
}>): void {
  // Runtime must not trust a response merely because a scoped receipt ID exists.
  // Assert both the manifest metadata and exact bytes from the authorized fixture.
  const digest = createHash('sha256').update(response.body).digest('hex');
  if (response.status !== manifest.status ||
      response.contentType.split(';', 1)[0]?.trim().toLowerCase() !== manifest.contentType ||
      response.body.byteLength !== manifest.byteLength || digest !== manifest.bodySha256) {
    fail('M04_FIXTURE_ATTESTATION_MISMATCH');
  }
}

function validClock(clock: Date): number {
  if (!(clock instanceof Date) || !Number.isFinite(clock.getTime())) fail('M04_CLOCK_INVALID');
  return clock.getTime();
}

/**
 * WEB-009: Do not validate an injected extractor's mutable getters and then
 * serialize them by reading the properties again. Snapshot only own data
 * properties once, with bounded arrays and no toJSON/iterable invocation.
 * This also prevents auxiliary raw HTML/secret properties being propagated.
 */
function ownData(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') fail('M04_EXTRACTION_INVALID');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) fail('M04_EXTRACTION_INVALID');
  return descriptor.value;
}

function ownList(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail('M04_EXTRACTION_INVALID');
  const output: unknown[] = [];
  for (let i = 0; i < value.length; i++) output.push(ownData(value, String(i)));
  return output;
}

function snapshotExtraction(raw: unknown): WebsiteExtraction {
  const coverage = ownData(raw, 'coverage');
  const reasons = ownList(ownData(raw, 'reasonCodes'), 16);
  const candidates = ownList(ownData(raw, 'findings'), 8);
  const findings = candidates.map((candidate) => ({
    capability: ownData(candidate, 'capability'),
    observation: ownData(candidate, 'observation'),
    reason: ownData(candidate, 'reason'),
    confidence: ownData(candidate, 'confidence'),
    evidenceReferenceIds: ownList(ownData(candidate, 'evidenceReferenceIds'), 32),
  }));
  // Types are trusted only AFTER validateExtraction(), never from this cast.
  return { coverage, reasonCodes: reasons, findings } as WebsiteExtraction;
}

function validateExtraction(extraction: WebsiteExtraction): void {
  if (!extraction || (extraction.coverage !== 'partial' && extraction.coverage !== 'bounded') ||
      !Array.isArray(extraction.findings) || extraction.findings.length > 8 ||
      !Array.isArray(extraction.reasonCodes) || extraction.reasonCodes.length > 16) {
    fail('M04_EXTRACTION_INVALID');
  }
  const seen = new Set<string>();
  for (const finding of extraction.findings) {
    if (!finding || !capabilityIds.has(finding.capability) || seen.has(finding.capability) ||
        !Array.isArray(finding.evidenceReferenceIds) || finding.evidenceReferenceIds.length > 32 ||
        finding.evidenceReferenceIds.some((id: string) => typeof id !== 'string' || !identifier.test(id)) ||
        new Set(finding.evidenceReferenceIds).size !== finding.evidenceReferenceIds.length ||
        (finding.observation !== 'unknown' && finding.observation !== 'observed_present' && finding.observation !== 'not_detected')) {
      fail('M04_EXTRACTION_INVALID');
    }
    seen.add(finding.capability);
    if (finding.observation === 'unknown') {
      if (finding.reason !== 'insufficient_evidence' || finding.confidence !== null ||
          finding.evidenceReferenceIds.length !== 0) fail('M04_EXTRACTION_UNKNOWN_CLAIM');
    } else if (finding.reason !== (finding.observation === 'observed_present'
        ? 'detected' : 'not_detected_with_bounded_coverage') ||
        finding.evidenceReferenceIds.length === 0 ||
        typeof finding.confidence !== 'number' || !Number.isFinite(finding.confidence) ||
        finding.confidence < 0 || finding.confidence > 1) {
      fail('M04_EXTRACTION_UNSUPPORTED_CLAIM');
    }
    if (finding.observation === 'not_detected') {
      // Even 'bounded' input is only a single homepage test fixture; it cannot
      // establish website-wide absence. Reject before persistence.
      fail(extraction.coverage !== 'bounded'
        ? 'M04_EXTRACTION_NEGATIVE_WITHOUT_COVERAGE'
        : 'M04_FIXTURE_NEGATIVE_UNSUPPORTED');
    }
  }
  if (extraction.reasonCodes.some((v) => typeof v !== 'string' || !identifier.test(v)) ||
      new Set(extraction.reasonCodes).size !== extraction.reasonCodes.length) {
    fail('M04_EXTRACTION_REASON_INVALID');
  }
}

/** Strictly one approved root fixture. Never claims full-site absence. */
export async function executeWebsiteInspectionFixture(
  rawRequest: unknown,
  dependencies: WebsiteInspectionDependencies,
): Promise<WebsiteInspectionResult> {
  const parsed = dependencies.contracts.parseRequest(rawRequest);
  // Snapshot the parsed request before ANY injected async callback can mutate its
  // URL, policy, budget or receipt bindings between checks (TOCTOU).
  const request: WebsiteInspectionRequest = {
    ...parsed,
    domainVerification: {
      ...parsed.domainVerification, evidenceIds: [...parsed.domainVerification.evidenceIds],
    },
    sourcePolicySnapshot: { ...parsed.sourcePolicySnapshot },
    limits: { ...parsed.limits },
  };
  Object.freeze(request.domainVerification.evidenceIds);
  Object.freeze(request.domainVerification);
  Object.freeze(request.sourcePolicySnapshot);
  Object.freeze(request.limits);
  Object.freeze(request);
  if (request.executionMode !== 'test_only' || request.networkRequested !== false ||
      request.credentialedFetchRequested !== false || request.rawPayloadRequested !== false ||
      request.outreachRequested !== false || request.sourceAdmissionDecision !== 'allow' ||
      request.targetUrl !== `https://${request.verifiedDomain}/`) {
    fail('M04_PRODUCTION_NETWORK_FORBIDDEN');
  }
  if (request.limits.maxPages !== 1) fail('M04_MULTIPAGE_UNSUPPORTED');
  const now = dependencies.now?.() ?? new Date();
  const nowMs = validClock(now);
  if (!Number.isFinite(Date.parse(request.requestedAt)) ||
      nowMs < Date.parse(request.requestedAt)) fail('M04_CLOCK_INVALID');

  const admission = snapshotAdmission(await dependencies.authorize(request));
  checkIdenticalApproval(request, admission, nowMs);
  const receiptId = admission.receiptId; // Pin provenance before injected execution.
  const authorizedExpiry = Date.parse(admission.expiresAt);
  const manifest = Object.freeze({
    bodySha256: admission.fixtureBodySha256,
    status: admission.fixtureStatus,
    contentType: admission.fixtureContentType,
    byteLength: admission.fixtureByteLength,
  });
  const rawResponse = await dependencies.exchange({
    transportKind: 'test', transportRequestId: request.inspectionId,
    url: request.targetUrl, maxResponseBytes: request.limits.maxResponseBytes,
    timeoutMs: request.limits.timeoutMs, acceptedContentTypes: ['text/html'],
  });
  const response = snapshotExchange(rawResponse, request.limits.maxResponseBytes);
  checkExchange(response, request);
  verifyAttestedFixture(response, manifest);
  const completedAtAfterChecks = (): string => {
    const clock = dependencies.now?.() ?? new Date();
    const currentMs = validClock(clock);
    // Do not accept expiring admissions if any awaited transport/extraction step
    // outlives authorization. Also fail closed on clock rollback.
    if (currentMs > authorizedExpiry) fail('M04_FIXTURE_ADMISSION_EXPIRED');
    if (currentMs < nowMs || currentMs < Date.parse(request.requestedAt)) {
      fail('M04_CLOCK_INVALID');
    }
    return clock.toISOString();
  };
  let result: WebsiteInspectionResult;
  if (response.status !== 200) {
    result = dependencies.contracts.parseResult({
      version: '1.0.0', request, status: 'unavailable', coverage: 'none',
      transportReceiptIds: [], observations: [], reasonCodes: ['website.http_unavailable'],
      completedAt: completedAtAfterChecks(), bodyIncluded: false,
    });
  } else {
    let untrustedExtraction: WebsiteExtraction;
    try {
      // A defensive copy prevents the extractor from mutating transport-owned evidence.
      untrustedExtraction = await dependencies.extract({
        request, body: Uint8Array.from(response.body), receiptId,
      });
    } catch {
      untrustedExtraction = { coverage: 'partial', findings: [], reasonCodes: ['website.analysis_failed'] };
    }
    // Snapshot untrusted findings BEFORE schema validation and persistence mapping.
    const extraction = snapshotExtraction(untrustedExtraction);
    validateExtraction(extraction);
    const observations = extraction.findings.map((finding): WebsiteCapabilityObservation => ({
      capability: finding.capability, observation: finding.observation,
      reason: finding.reason, confidence: finding.confidence,
      evidenceReferenceIds: [...finding.evidenceReferenceIds],
      // Receipts are always inserted by the authorized runner, never supplied by the extractor.
      transportReceiptIds: finding.observation === 'unknown' ? [] : [receiptId],
    }));
    // WEB-008: the only authorized acquisition is ONE root fixture. An
    // injected extractor must never upgrade its own coverage to 'bounded' or
    // produce 'assessed' evidence. Always retain explicit uncertainty.
    const reasons = [...extraction.reasonCodes];
    if (observations.length === 0 && reasons.length === 0) reasons.push('website.no_findings');
    if (!reasons.includes('website.single_page_only')) {
      // WEB-011: the mandatory uncertainty reason consumes a contract slot;
      // never rely on downstream Zod to discover overflow after analysis.
      if (reasons.length >= 16) fail('M04_EXTRACTION_REASON_INVALID');
      reasons.push('website.single_page_only');
    }
    result = dependencies.contracts.parseResult({
      version: '1.0.0', request,
      status: 'review_required',
      coverage: 'partial',
      transportReceiptIds: [receiptId], observations,
      reasonCodes: reasons, completedAt: completedAtAfterChecks(), bodyIncluded: false,
    });
  }
  await dependencies.persist?.(result);
  return result;
}