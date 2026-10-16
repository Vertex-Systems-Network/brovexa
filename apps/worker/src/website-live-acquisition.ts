import { createHash } from 'node:crypto';
import { resolve4 } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { awaitM04LiveStage } from './website-live-async-boundary';

/**
 * M04 live WEBSITE READ: isolated opt-in HTTPS root acquisition.
 * The frozen WEB-001/002 1.0.0 schemas are TEST ONLY. Do not cast this
 * response into a fixture result or insert it into website_inspection_runs.
 * A future explicitly versioned live evidence contract/storage is required.
 * No live target is contacted by constructing this module.
 */
export class M04LiveAcquisitionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'M04LiveAcquisitionError';
  }
}

export interface M04LiveScope {
  readonly workspaceId: string;
  readonly inspectionId: string;
  readonly canonicalBusinessId: string;
  readonly domainVerificationId: string;
  readonly verifiedDomain: string;
  readonly sourceKey: string;
  readonly sourceAdmissionDecisionRef: string;
  readonly sourcePolicyId: string;
  readonly sourcePolicyVersion: string;
  readonly transportPolicyId: string;
  readonly transportPolicyVersion: string;
}

export interface M04LivePermit extends M04LiveScope {
  readonly decision: 'allow' | 'blocked';
  readonly permission: 'live_root_read';
  readonly networkApproved: true;
  readonly credentialsApproved: false;
  readonly outreachApproved: false;
  readonly rawBodyRetentionApproved: false;
  readonly maxResponseBytes: number;
  readonly timeoutMs: number;
  readonly expiresAt: string;
}

export interface M04LiveReadRequest extends M04LiveScope {
  readonly version: '2.0.0';
  readonly executionMode: 'live';
  readonly networkRequested: true;
  readonly credentialedFetchRequested: false;
  readonly rawPayloadRequested: false;
  readonly outreachRequested: false;
  readonly targetUrl: string;
  readonly maxResponseBytes: number;
  readonly timeoutMs: number;
}

export interface M04LiveTransportRequest {
  readonly url: string;
  readonly ipv4: string;
  readonly maxResponseBytes: number;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface M04LiveTransportResponse {
  readonly status: number;
  readonly contentType: string;
  readonly contentEncoding: string;
  readonly body: Uint8Array;
}

/** Independent M02 per-hop admission; MUST come from the real source-transport
 * policy evaluation, not caller-provided URL parameters or request flags. */
export interface M04LiveM02HopAdmission {
  readonly decision: 'allow' | 'blocked';
  readonly workspaceId: string;
  readonly inspectionId: string;
  readonly transportKind: 'network';
  readonly canonicalUrl: string;
  readonly resolvedIpv4: string;
  readonly maxResponseBytes: number;
  readonly timeoutMs: number;
  readonly transportPolicyId: string;
  readonly transportPolicyVersion: string;
  readonly sourceKey: string;
  readonly sourcePolicyId: string;
  readonly sourcePolicyVersion: string;
  readonly expiresAt: string;
}
export interface M04LiveM02HopInput {
  readonly workspaceId: string;
  readonly inspectionId: string;
  readonly canonicalUrl: string;
  readonly resolvedIpv4: string;
  readonly maxResponseBytes: number;
  readonly timeoutMs: number;
  readonly transportPolicyId: string;
  readonly transportPolicyVersion: string;
  readonly sourceKey: string;
  readonly sourcePolicyId: string;
  readonly sourcePolicyVersion: string;
}

export interface M04LiveAcquisitionDependencies {
  /** Explicit opt-in is required at the composition boundary. */
  readonly enabled: true;
  /** Independently authenticated, workspace+inspection scoped approval store. */
  readonly loadPermit: (scope: Readonly<{ workspaceId: string; inspectionId: string }>) => Promise<M04LivePermit | null>;
  /** No default: the M02 per-hop transport policy must independently allow this pinned hop. */
  readonly admitM02Hop: (input: Readonly<M04LiveM02HopInput>) => Promise<M04LiveM02HopAdmission>;
  /** Replaceable for offline tests. Production default uses native DNS A records. */
  readonly resolveAddresses?: (host: string) => Promise<readonly string[]>;
  /** Replaceable for offline tests. Production default pins TLS to a public IPv4 address. */
  readonly transport?: (input: M04LiveTransportRequest) => Promise<M04LiveTransportResponse>;
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
}

export interface M04LiveReadReceipt {
  readonly version: '2.0.0';
  readonly executionMode: 'live';
  readonly networkRequested: true;
  readonly rawBodyRetained: false;
  readonly workspaceId: string;
  readonly inspectionId: string;
  readonly canonicalUrl: string;
  readonly remoteIpv4: string;
  readonly status: number;
  readonly contentType: 'text/html';
  readonly bodyLength: number;
  readonly bodySha256: string;
  readonly receiptId: string;
  readonly receivedAt: string;
}

/** Transient body is never stored by this module. Caller must dispose it. */
export interface M04LiveReadOutput {
  readonly receipt: M04LiveReadReceipt;
  readonly body: Uint8Array;
}

const id = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const version = /^\d+\.\d+\.\d+$/;
const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const scopeFields = [
  'workspaceId', 'inspectionId', 'canonicalBusinessId', 'domainVerificationId',
  'verifiedDomain', 'sourceKey', 'sourceAdmissionDecisionRef',
  'sourcePolicyId', 'sourcePolicyVersion', 'transportPolicyId', 'transportPolicyVersion',
] as const;

function fail(code: string): never { throw new M04LiveAcquisitionError(code); }
function ownValue(object: unknown, key: string): unknown {
  if (!object || typeof object !== 'object' || Array.isArray(object)) fail('M04_LIVE_OBJECT_INVALID');
  let descriptor: PropertyDescriptor | undefined;
  try { descriptor = Object.getOwnPropertyDescriptor(object, key); }
  catch { fail('M04_LIVE_OBJECT_INVALID'); }
  if (!descriptor || !('value' in descriptor)) fail('M04_LIVE_OBJECT_INVALID');
  return descriptor.value;
}
function canonicalScope(request: M04LiveReadRequest): M04LiveScope {
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const key of scopeFields) {
    const field = ownValue(request, key);
    if (typeof field !== 'string') fail('M04_LIVE_SCOPE_INVALID');
    result[key] = field;
  }
  return result as unknown as M04LiveScope;
}
function validateScope(scope: M04LiveScope): void {
  for (const field of scopeFields) {
    const value = scope[field];
    if (typeof value !== 'string' || !id.test(value)) fail('M04_LIVE_SCOPE_INVALID');
  }
  if (!domain.test(scope.verifiedDomain) || scope.verifiedDomain.length > 253 ||
      /\.(?:local|internal|invalid|test|localhost)$/.test(scope.verifiedDomain) ||
      isIP(scope.verifiedDomain) !== 0 || !/^source\.[a-z0-9_.-]+$/.test(scope.sourceKey) ||
      !version.test(scope.sourcePolicyVersion) || !version.test(scope.transportPolicyVersion)) {
    fail('M04_LIVE_SCOPE_INVALID');
  }
}
function budget(bytes: unknown, timeout: unknown): void {
  if (!Number.isSafeInteger(bytes) || typeof bytes !== 'number' || bytes < 1 || bytes > 1_000_000 ||
      !Number.isSafeInteger(timeout) || typeof timeout !== 'number' || timeout < 100 || timeout > 30_000) {
    fail('M04_LIVE_BUDGET_INVALID');
  }
}

/** Reject private, metadata, CGNAT, link-local, loopback, docs and other special-use IPv4. */
export function isPublicM04Ipv4(address: string): boolean {
  if (isIP(address) !== 4 || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) return false;
  const octets = address.split('.').map(Number);
  const [a,b,c,d] = octets;
  if ([a,b,c,d].some(n => n === undefined || n > 255)) return false;
  if (a === undefined || b === undefined || c === undefined) return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2) ||
      (b === 88 && c === 99))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

/**
 * Real HTTPS transport. Dial IP is pinned after preflight DNS; SNI and certificate
 * verification still use the exact verified hostname. No proxy, cookies,
 * redirects, credential headers, cleartext HTTP, or transparent decompression.
 */
export function fetchPinnedLiveWebsite(input: M04LiveTransportRequest): Promise<M04LiveTransportResponse> {
  if (!isPublicM04Ipv4(input.ipv4) || !input.url.startsWith('https://')) {
    return Promise.reject(new M04LiveAcquisitionError('M04_LIVE_DIAL_INVALID'));
  }
  const parsed = new URL(input.url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
      parsed.pathname !== '/' || parsed.search || parsed.hash || input.url !== parsed.href) {
    return Promise.reject(new M04LiveAcquisitionError('M04_LIVE_DIAL_INVALID'));
  }
  budget(input.maxResponseBytes, input.timeoutMs);
  return new Promise((resolve, reject) => {
    let done = false;
    const errorOnce = (code: string): void => {
      if (done) return;
      done = true;
      req.destroy();
      reject(new M04LiveAcquisitionError(code));
    };
    const req = httpsRequest(parsed, {
      method: 'GET', agent: false, family: 4, rejectUnauthorized: true,
      servername: parsed.hostname, timeout: input.timeoutMs, maxHeaderSize: 16_384,
      headers: { Accept: 'text/html', 'Accept-Encoding': 'identity',
        'User-Agent': 'Brovexa-M04-Authorized-Site-Inspection/1.0' },
      lookup: (_host, _options, callback) => callback(null, input.ipv4, 4),
      signal: input.signal,
    }, response => {
      const status = response.statusCode ?? 0;
      const rawContentType = response.headers['content-type'];
      const rawEncoding = response.headers['content-encoding'];
      const contentType = Array.isArray(rawContentType) ? '' : (rawContentType ?? '');
      const contentEncoding = Array.isArray(rawEncoding) ? '' : (rawEncoding ?? 'identity');
      if (status !== 200 || !/^text\/html(?:\s*;|$)/i.test(contentType) ||
          contentEncoding.toLowerCase() !== 'identity') {
        errorOnce('M04_LIVE_RESPONSE_REJECTED');
        return;
      }
      const chunks: Uint8Array[] = [];
      let count = 0;
      response.on('data', (chunk: Buffer) => {
        if (done) return;
        if (!(chunk instanceof Uint8Array) || count + chunk.byteLength > input.maxResponseBytes) {
          errorOnce('M04_LIVE_RESPONSE_TOO_LARGE');
          return;
        }
        count += chunk.byteLength;
        chunks.push(Uint8Array.from(chunk));
      });
      response.on('end', () => {
        if (done) return;
        done = true;
        const body = new Uint8Array(count);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        resolve({ status, contentType, contentEncoding, body });
      });
      response.on('error', () => errorOnce('M04_LIVE_TRANSPORT_FAILED'));
    });
    req.on('timeout', () => errorOnce('M04_LIVE_TIMEOUT'));
    req.on('error', () => errorOnce(input.signal.aborted ? 'M04_LIVE_CANCELLED' : 'M04_LIVE_TRANSPORT_FAILED'));
    req.on('socket', socket => {
      socket.on('connect', () => {
        if (socket.remoteAddress !== input.ipv4) errorOnce('M04_LIVE_PIN_MISMATCH');
      });
    });
    req.end();
  });
}

/** Strict scope + independently retrieved approval before ANY DNS or network. */
export async function acquireAuthorizedM04LiveRoot(
  raw: M04LiveReadRequest,
  deps: M04LiveAcquisitionDependencies,
): Promise<M04LiveReadOutput> {
  if (deps?.enabled !== true || typeof deps.loadPermit !== 'function' ||
      typeof deps.admitM02Hop !== 'function') fail('M04_LIVE_DISABLED');
  if (deps.signal?.aborted) fail('M04_LIVE_CANCELLED');
  const scope = canonicalScope(raw);
  validateScope(scope);
  if (ownValue(raw, 'version') !== '2.0.0' || ownValue(raw, 'executionMode') !== 'live' ||
      ownValue(raw, 'networkRequested') !== true ||
      ownValue(raw, 'credentialedFetchRequested') !== false ||
      ownValue(raw, 'rawPayloadRequested') !== false || ownValue(raw, 'outreachRequested') !== false) {
    fail('M04_LIVE_INTENT_INVALID');
  }
  const url = ownValue(raw, 'targetUrl');
  if (url !== `https://${scope.verifiedDomain}/`) fail('M04_LIVE_TARGET_INVALID');
  const requestBytes = ownValue(raw, 'maxResponseBytes');
  const requestTimeout = ownValue(raw, 'timeoutMs');
  budget(requestBytes, requestTimeout);
  const bytes = requestBytes as number;
  const timeoutMs = requestTimeout as number;
  const identity = Object.freeze({workspaceId:scope.workspaceId,inspectionId:scope.inspectionId});
  const originalPermit = await awaitM04LiveStage(
    () => deps.loadPermit(identity), { timeoutMs, signal: deps.signal },
  );
  if (deps.signal?.aborted) fail('M04_LIVE_CANCELLED');
  const permit: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const field of scopeFields) permit[field] = ownValue(originalPermit, field);
  for (const field of [
    'decision', 'permission', 'networkApproved', 'credentialsApproved',
    'outreachApproved', 'rawBodyRetentionApproved', 'maxResponseBytes', 'timeoutMs', 'expiresAt',
  ] as const) permit[field] = ownValue(originalPermit, field);
  const valid = scopeFields.every(key => permit[key] === scope[key]) &&
    permit.decision === 'allow' && permit.permission === 'live_root_read' &&
    permit.networkApproved === true && permit.credentialsApproved === false &&
    permit.outreachApproved === false && permit.rawBodyRetentionApproved === false &&
    typeof permit.maxResponseBytes === 'number' && bytes <= permit.maxResponseBytes &&
    typeof permit.timeoutMs === 'number' && timeoutMs <= permit.timeoutMs;
  const now = deps.now?.() ?? new Date();
  const expiration = typeof permit.expiresAt === 'string' ? Date.parse(permit.expiresAt) : NaN;
  if (!valid || !Number.isFinite(now.getTime()) || !Number.isFinite(expiration) ||
      expiration <= now.getTime() || expiration > now.getTime() + 86_400_000) {
    fail('M04_LIVE_PERMIT_INVALID');
  }
  const resolve = deps.resolveAddresses ?? resolve4;
  const resolved = await awaitM04LiveStage(
    () => resolve(scope.verifiedDomain), { timeoutMs, signal: deps.signal },
  );
  if (deps.signal?.aborted) fail('M04_LIVE_CANCELLED');
  // Reject a mixed public/private DNS answer, not merely the chosen first IP.
  if (!Array.isArray(resolved) || resolved.length < 1 || resolved.length > 32 ||
      resolved.some(address => typeof address !== 'string' || !isPublicM04Ipv4(address))) {
    fail('M04_LIVE_DNS_NONPUBLIC');
  }
  // A resolver callback is untrusted; require own data elements and pin one immutable A record.
  const addresses: string[] = [];
  for (let i = 0; i < resolved.length; i += 1) {
    const item = Object.getOwnPropertyDescriptor(resolved, String(i));
    if (!item || !('value' in item) || typeof item.value !== 'string' ||
        !isPublicM04Ipv4(item.value)) fail('M04_LIVE_DNS_NONPUBLIC');
    addresses.push(item.value);
  }
  const chosen = addresses[0]!;
  if (deps.signal?.aborted) fail('M04_LIVE_CANCELLED');
  const hop = Object.freeze({
    workspaceId:scope.workspaceId, inspectionId:scope.inspectionId,
    canonicalUrl:url as string, resolvedIpv4:chosen,
    maxResponseBytes:bytes,timeoutMs,
    transportPolicyId:scope.transportPolicyId,
    transportPolicyVersion:scope.transportPolicyVersion,
    sourceKey:scope.sourceKey,sourcePolicyId:scope.sourcePolicyId,
    sourcePolicyVersion:scope.sourcePolicyVersion,
  });
  const rawAdmission = await awaitM04LiveStage(
    () => deps.admitM02Hop(hop), { timeoutMs, signal: deps.signal },
  );
  if (deps.signal?.aborted) fail('M04_LIVE_CANCELLED');
  const admitted: Record<string,unknown> = Object.create(null) as Record<string,unknown>;
  for (const key of [
    'decision','workspaceId','inspectionId','transportKind','canonicalUrl','resolvedIpv4',
    'maxResponseBytes','timeoutMs','transportPolicyId','transportPolicyVersion',
    'sourceKey','sourcePolicyId','sourcePolicyVersion','expiresAt',
  ]) admitted[key] = ownValue(rawAdmission,key);
  const hopTime = deps.now?.() ?? new Date();
  const hopExpiry = typeof admitted.expiresAt==='string' ? Date.parse(admitted.expiresAt) : NaN;
  if (admitted.decision !== 'allow' || admitted.transportKind !== 'network' ||
      admitted.workspaceId !== hop.workspaceId || admitted.inspectionId !== hop.inspectionId ||
      admitted.canonicalUrl !== hop.canonicalUrl || admitted.resolvedIpv4 !== hop.resolvedIpv4 ||
      admitted.maxResponseBytes !== bytes || admitted.timeoutMs !== timeoutMs ||
      admitted.transportPolicyId !== hop.transportPolicyId ||
      admitted.transportPolicyVersion !== hop.transportPolicyVersion ||
      admitted.sourceKey !== hop.sourceKey || admitted.sourcePolicyId !== hop.sourcePolicyId ||
      admitted.sourcePolicyVersion !== hop.sourcePolicyVersion ||
      !Number.isFinite(hopExpiry) || hopExpiry <= hopTime.getTime() ||
      hopExpiry > hopTime.getTime() + 300_000) {
    fail('M04_LIVE_M02_HOP_BLOCKED');
  }
  const dialNow = deps.now?.() ?? new Date();
  if (deps.signal?.aborted) fail('M04_LIVE_CANCELLED');
  if (!Number.isFinite(dialNow.getTime()) || dialNow.getTime() >= expiration ||
      dialNow.getTime() >= hopExpiry) {
    fail('M04_LIVE_PERMIT_EXPIRED');
  }
  const controller = new AbortController();
  const onCancel = (): void => controller.abort();
  deps.signal?.addEventListener('abort', onCancel, {once:true});
  if (deps.signal?.aborted) controller.abort();
  const deadline = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (controller.signal.aborted) fail('M04_LIVE_CANCELLED');
    // Race even injected transports that ignore AbortSignal; no late result may advance.
    const transport = deps.transport ?? fetchPinnedLiveWebsite;
    const response = await new Promise<M04LiveTransportResponse>((resolveResult,rejectResult) => {
      let finished = false;
      const cancelled = ():void => {
        if (finished) return;
        finished = true;
        rejectResult(new M04LiveAcquisitionError(deps.signal?.aborted ? 'M04_LIVE_CANCELLED' : 'M04_LIVE_TIMEOUT'));
      };
      controller.signal.addEventListener('abort', cancelled, {once:true});
      if (controller.signal.aborted) { cancelled(); return; }
      Promise.resolve().then(() => transport({url:url as string,ipv4:chosen,maxResponseBytes:bytes,timeoutMs,signal:controller.signal}))
        .then(value => { if (!finished) {finished=true;controller.signal.removeEventListener('abort',cancelled);resolveResult(value);} },
          err => {if (!finished) {finished=true;controller.signal.removeEventListener('abort',cancelled);rejectResult(err);} });
    });
    if (controller.signal.aborted) fail(deps.signal?.aborted?'M04_LIVE_CANCELLED':'M04_LIVE_TIMEOUT');
    const status = ownValue(response, 'status');
    const contentType = ownValue(response, 'contentType');
    const contentEncoding = ownValue(response, 'contentEncoding');
    const untrustedBody = ownValue(response, 'body');
    if (status !== 200 || typeof contentType !== 'string' ||
        !/^text\/html(?:\s*;|$)/i.test(contentType) ||
        typeof contentEncoding !== 'string' || contentEncoding.toLowerCase() !== 'identity' ||
        !(untrustedBody instanceof Uint8Array) || untrustedBody.byteLength > bytes) {
      fail('M04_LIVE_RESPONSE_INVALID');
    }
    // Avoid user-defined Uint8Array subclass @@iterator callbacks after validation.
    const body = new Uint8Array(untrustedBody.byteLength);
    try { body.set(untrustedBody); }
    catch { fail('M04_LIVE_RESPONSE_INVALID'); }
    const completedAt = deps.now?.() ?? new Date();
    if (controller.signal.aborted || deps.signal?.aborted) fail('M04_LIVE_CANCELLED');
    if (!Number.isFinite(completedAt.getTime()) || completedAt.getTime() >= expiration) {
      fail('M04_LIVE_PERMIT_EXPIRED');
    }
    const bodySha256 = createHash('sha256').update(body).digest('hex');
    const receiptId = 'live.' + createHash('sha256').update(JSON.stringify([
      scope.workspaceId,scope.inspectionId,url,chosen,bodySha256,completedAt.toISOString(),
    ])).digest('hex').slice(0,40);
    return {
      body,
      receipt: Object.freeze({
        version:'2.0.0',executionMode:'live',networkRequested:true,rawBodyRetained:false,
        workspaceId:scope.workspaceId,inspectionId:scope.inspectionId,
        canonicalUrl:url as string,remoteIpv4:chosen,status:200,
        contentType:'text/html',bodyLength:body.byteLength,bodySha256,receiptId,
        receivedAt:completedAt.toISOString(),
      }),
    };
  } finally {
    clearTimeout(deadline);
    deps.signal?.removeEventListener('abort',onCancel);
  }
}