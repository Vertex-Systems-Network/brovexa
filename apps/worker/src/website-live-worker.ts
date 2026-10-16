import { createHash } from 'node:crypto';
import { CancelledWorkError, PermanentWorkError, RetryableWorkError } from './errors';
import { awaitM04LiveStage, M04LiveAsyncBoundaryError } from './website-live-async-boundary';
import { M04LiveAcquisitionError } from './website-live-acquisition';
import type { WorkHandler } from './runtime';
import type { M04LiveReadRequest } from './website-live-acquisition';
import { inspectAndPersistM04LiveRoot, type M04LiveNativeIntegrationDeps } from './website-live-native-integration';

export const M04_LIVE_WORK_TYPE = 'website_inspection_live_v2';
export const M04_LIVE_WORK_VERSION = 2;
const id = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface M04LiveWorkerDeps extends Omit<M04LiveNativeIntegrationDeps,'signal'> {
  /** Independently tenant-scoped canonical request store, never the queue payload. */
  readonly loadRequest: (scope: Readonly<{workspaceId:string;inspectionId:string}>) => Promise<unknown>;
  readonly cancellationPollMs?: number;
  /** Bound each independent cancellation-store read; no unbounded initial polling. */
  readonly cancellationCheckTimeoutMs?: number;
  /** Bound the tenant-scoped request-store lookup even when polling says not cancelled. */
  readonly requestLoadTimeoutMs?: number;
}
function property(object:unknown,key:string):unknown {
  if(!object||typeof object!=='object'||Array.isArray(object))throw new PermanentWorkError('M04_LIVE_WORK_PAYLOAD_INVALID');
  const descriptor=Object.getOwnPropertyDescriptor(object,key);
  if(!descriptor||!('value' in descriptor))throw new PermanentWorkError('M04_LIVE_WORK_PAYLOAD_INVALID');
  return descriptor.value;
}
function parseRequestForWork(raw:unknown,scope:{workspaceId:string;inspectionId:string}):M04LiveReadRequest {
  const fields=[
    'version','executionMode','networkRequested','credentialedFetchRequested','rawPayloadRequested',
    'outreachRequested','workspaceId','inspectionId','canonicalBusinessId','domainVerificationId',
    'verifiedDomain','sourceKey','sourceAdmissionDecisionRef','sourcePolicyId','sourcePolicyVersion',
    'transportPolicyId','transportPolicyVersion','targetUrl','maxResponseBytes','timeoutMs',
  ] as const;
  const pinned:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const key of fields)pinned[key]=property(raw,key);
  if(pinned.workspaceId!==scope.workspaceId||pinned.inspectionId!==scope.inspectionId||
     pinned.version!=='2.0.0'||pinned.executionMode!=='live'||pinned.networkRequested!==true||
     pinned.credentialedFetchRequested!==false||pinned.rawPayloadRequested!==false||
     pinned.outreachRequested!==false)
    throw new PermanentWorkError('M04_LIVE_WORK_REQUEST_SCOPE_MISMATCH');
  return Object.freeze(pinned) as unknown as M04LiveReadRequest;
}
/** Registration creates a handler ONLY; never starts DNS, queue, PG pool or HTTP. */
export function createM04LiveWorkerHandlers(deps:M04LiveWorkerDeps):Readonly<Record<typeof M04_LIVE_WORK_TYPE,WorkHandler>> {
  if(deps.enabled!==true||typeof deps.loadRequest!=='function'||typeof deps.loadPermit!=='function'||
     typeof deps.admitM02Hop!=='function'||typeof deps.getStoragePolicy!=='function'||
     !deps.pool||typeof deps.pool.connect!=='function')
    throw new RangeError('M04 live worker requires an explicit trusted DB, permit and M02 configuration.');
  const pollMs=deps.cancellationPollMs??1000;
  if(!Number.isSafeInteger(pollMs)||pollMs<100||pollMs>30000)
    throw new RangeError('M04 live cancellation interval must be 100-30000ms.');
  const cancellationTimeoutMs=deps.cancellationCheckTimeoutMs??5000;
  if(!Number.isSafeInteger(cancellationTimeoutMs)||cancellationTimeoutMs<100||cancellationTimeoutMs>30000)
    throw new RangeError('M04 live cancellation check timeout must be 100-30000ms.');
  const requestLoadTimeoutMs=deps.requestLoadTimeoutMs??5000;
  if(!Number.isSafeInteger(requestLoadTimeoutMs)||requestLoadTimeoutMs<100||requestLoadTimeoutMs>30000)
    throw new RangeError('M04 live request lookup timeout must be 100-30000ms.');
  const handler:WorkHandler=async(context)=>{
    if(context.workType!==M04_LIVE_WORK_TYPE||context.workVersion!==M04_LIVE_WORK_VERSION||
       !uuid.test(context.workspaceId))throw new PermanentWorkError('M04_LIVE_WORK_CONTEXT_INVALID');
    if(!context.payload||typeof context.payload!=='object'||
       Reflect.ownKeys(context.payload).length!==2||
       property(context.payload,'kind')!=='website_live_v2')
      throw new PermanentWorkError('M04_LIVE_WORK_PAYLOAD_INVALID');
    const inspectionId=property(context.payload,'inspectionId');
    if(typeof inspectionId!=='string'||!id.test(inspectionId))
      throw new PermanentWorkError('M04_LIVE_WORK_PAYLOAD_INVALID');
    const scope=Object.freeze({workspaceId:context.workspaceId,inspectionId});
    const controller=new AbortController();
    let monitorFailure:RetryableWorkError|null=null;
    let pollPending:Promise<void>|null=null;
    let ended=false;
    const poll=():Promise<void>=>{
      if(ended || controller.signal.aborted)return Promise.resolve();
      if(pollPending)return pollPending;
      pollPending=(async()=>{
        try {
          const cancellationRequested=await awaitM04LiveStage(
            context.isCancellationRequested, {timeoutMs:cancellationTimeoutMs},
          );
          if(cancellationRequested&&!ended)controller.abort();
        }
        catch {
          if(!ended && !controller.signal.aborted) {
            monitorFailure=new RetryableWorkError('M04_LIVE_CANCELLATION_CHECK_FAILED');
            controller.abort();
          }
        }
      })().finally(()=>{pollPending=null;});
      return pollPending;
    };
    let timer:ReturnType<typeof setInterval>|undefined;
    try {
      await poll();
      if(controller.signal.aborted)throw new CancelledWorkError('M04_LIVE_WORK_CANCELLED');
      timer=setInterval(()=>{void poll();},pollMs);
      // Deadline and cancellation both fence a stale tenant-store callback.
      // This does not cancel the database query; late results are discarded.
      const raw=await awaitM04LiveStage(() => deps.loadRequest(scope), {
        timeoutMs:requestLoadTimeoutMs, signal:controller.signal,
      });
      if(controller.signal.aborted)throw new CancelledWorkError('M04_LIVE_WORK_CANCELLED');
      if(raw==null)throw new PermanentWorkError('M04_LIVE_WORK_REQUEST_MISSING');
      const request=parseRequestForWork(raw,scope);
      const result=await inspectAndPersistM04LiveRoot(request,{...deps,signal:controller.signal});
      // The evidence transaction has COMMITted by the time this promise
      // resolves. A subsequent cancellation poll must not convert a durable
      // success into a cancelled delivery (and force a stale-grant replay).
      // Cancellation during pre-commit awaits remains enforced in integration.
      const hash=createHash('sha256').update(JSON.stringify([scope.workspaceId,scope.inspectionId,'v2'])).digest('hex');
      return {effectKey:`m04.website_live.${hash}`,effectData:{
        inspectionId:result.inspectionId,replayed:result.replayed,version:'2.0.0',
        bodyIncluded:false,executionMode:'live',
      }};
    }catch(error){
      if(monitorFailure!==null)throw monitorFailure;
      if(controller.signal.aborted)throw new CancelledWorkError('M04_LIVE_WORK_CANCELLED');
      if(error instanceof M04LiveAsyncBoundaryError) {
        if(error.code==='M04_LIVE_CANCELLED') throw new CancelledWorkError('M04_LIVE_WORK_CANCELLED');
        throw new RetryableWorkError('M04_LIVE_STAGE_TIMEOUT');
      }
      if(error instanceof M04LiveAcquisitionError) {
        if(error.code==='M04_LIVE_CANCELLED') throw new CancelledWorkError('M04_LIVE_WORK_CANCELLED');
        if(error.code==='M04_LIVE_TIMEOUT'||error.code==='M04_LIVE_TRANSPORT_FAILED')
          throw new RetryableWorkError(error.code);
        // Policy denials, forbidden destinations and malformed evidence never retry.
        throw new PermanentWorkError(error.code);
      }
      // Retry known transient DNS and PostgreSQL conditions, never arbitrary errors.
      const code=error instanceof Error ?
        Object.getOwnPropertyDescriptor(error,'code')?.value : undefined;
      // Deferred PostgreSQL authorization constraints run at COMMIT. A
      // revoked/expired owner grant is never retryable without a fresh grant;
      // keep SQL text and membership details out of canonical work effects.
      const constraint=error instanceof Error ?
        Object.getOwnPropertyDescriptor(error,'constraint')?.value : undefined;
      if(code==='23514' && constraint==='website_live_evidence_active_grant_guard')
        throw new PermanentWorkError('M04_LIVE_GRANT_NOT_ACTIVE_AT_COMMIT');
      if(code==='23514' && constraint==='website_live_registry_current_guard')
        throw new PermanentWorkError('M04_LIVE_SOURCE_REGISTRY_REVOKED');
      if(code==='23514' && new Set([
        'website_live_grant_owner_guard','website_live_grant_source_guard',
        'website_live_grant_commit_guard',
      ]).has(constraint))
        throw new PermanentWorkError('M04_LIVE_GRANT_NOT_ACTIVE_AT_COMMIT');
      if(code==='M04_LIVE_DB_GRANT_INACTIVE')
        throw new PermanentWorkError('M04_LIVE_GRANT_NOT_ACTIVE_ON_REPLAY');
      if(code==='M04_LIVE_DB_INPUT_INVALID'||code==='M04_LIVE_DB_ID_CONFLICT'||
         code==='M04_LIVE_GRANT_INVALID'||code==='M04_LIVE_GRANT_CONFLICT'||
         code==='M04_LIVE_GRANT_INACTIVE')
        throw new PermanentWorkError('M04_LIVE_AUTHORIZATION_OR_EVIDENCE_INVALID');
      if(typeof code==='string' && new Set([
        'EAI_AGAIN','ETIMEDOUT','ECONNRESET','ECONNREFUSED','ENETUNREACH',
        'EHOSTUNREACH','08000','08001','08003','08006','40001','40P01','53300','57P01',
      ]).has(code)) throw new RetryableWorkError('M04_LIVE_TRANSIENT_DEPENDENCY');
      throw error;
    }finally{ended=true;if(timer!==undefined)clearInterval(timer);}
  };
  return Object.freeze({[M04_LIVE_WORK_TYPE]:handler});
}