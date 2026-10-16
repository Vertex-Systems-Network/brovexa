import { createHash } from 'node:crypto';
import { getWebsiteLiveGrant, type WebsiteLiveTrustedGrant, type createPgPool } from '@brovexa/db';
import { createM04LiveWorkerHandlers, type M04LiveWorkerDeps } from './website-live-worker';
import { evaluateM04LiveM02HopContext } from './website-live-m02-admission';
import type { M04LiveM02HopInput } from './website-live-acquisition';
import type { WorkHandler } from './runtime';

/** WEB-035: explicit opt-in registration using trusted PostgreSQL owner grants.
 * Queue payload supplies ONLY an inspection ID; never a URL, permit, or policy.
 * This function does not connect to PG, launch HTTP/DNS, or start a queue. */
export interface M04DbLiveRegistrationOptions {
  readonly enabled: true;
  readonly pool: ReturnType<typeof createPgPool>;
  readonly authorizeDeletion: M04LiveWorkerDeps['authorizeDeletion'];
  readonly cancellationPollMs?: number;
  readonly cancellationCheckTimeoutMs?: number;
  readonly requestLoadTimeoutMs?: number;
  readonly deletionAuthorizationTimeoutMs?: number;
  readonly now?: () => Date;
}
type Scope = Readonly<{workspaceId:string;inspectionId:string}>;

function scoped(grant:WebsiteLiveTrustedGrant|null,scope:Scope):WebsiteLiveTrustedGrant|null {
  if(grant===null)return null;
  if(grant.workspaceId!==scope.workspaceId||grant.inspectionId!==scope.inspectionId)
    throw new Error('M04_LIVE_GRANT_SCOPE_MISMATCH');
  return grant;
}

function pinnedRequest(grant:WebsiteLiveTrustedGrant) {
  return Object.freeze({
    version:'2.0.0' as const,executionMode:'live' as const,networkRequested:true as const,
    credentialedFetchRequested:false as const,rawPayloadRequested:false as const,
    outreachRequested:false as const,
    workspaceId:grant.workspaceId,inspectionId:grant.inspectionId,
    canonicalBusinessId:grant.canonicalBusinessId,
    domainVerificationId:grant.domainVerificationId,verifiedDomain:grant.verifiedDomain,
    sourceKey:grant.sourceKey,sourceAdmissionDecisionRef:grant.sourceAdmissionDecisionRef,
    sourcePolicyId:grant.sourcePolicyId,sourcePolicyVersion:grant.sourcePolicyVersion,
    transportPolicyId:grant.transportPolicyId,transportPolicyVersion:grant.transportPolicyVersion,
    targetUrl:`https://${grant.verifiedDomain}/`,
    maxResponseBytes:grant.maxResponseBytes,timeoutMs:grant.timeoutMs,
  });
}

export function createM04DbLiveWorkerHandlers(
  options:M04DbLiveRegistrationOptions,
):Readonly<Record<string,WorkHandler>> {
  if(options?.enabled!==true||!options.pool||typeof options.pool.query!=='function'||
     typeof options.authorizeDeletion!=='function')
    throw new RangeError('Explicit DB pool and independent deletion RBAC are required.');
  const read=async(scope:Scope)=>scoped(await getWebsiteLiveGrant(options.pool,scope),scope);
  const deps:M04LiveWorkerDeps={
    enabled:true,
    pool:options.pool,
    loadRequest:async scope=>{
      const grant=await read(scope);
      return grant===null?null:pinnedRequest(grant);
    },
    loadPermit:async scope=>{
      const grant=await read(scope);
      return grant===null?null:Object.freeze({
        ...pinnedRequest(grant),
        decision:'allow' as const,permission:'live_root_read' as const,
        networkApproved:true as const,credentialsApproved:false as const,
        outreachApproved:false as const,rawBodyRetentionApproved:false as const,
        expiresAt:grant.expiresAt,
      });
    },
    getStoragePolicy:async scope=>{
      const grant=await read(scope);
      return grant===null?null:Object.freeze({
        workspaceId:grant.workspaceId,inspectionId:grant.inspectionId,
        retentionTtlSeconds:grant.retentionTtlSeconds,deletionRequired:true as const,
      });
    },
    admitM02Hop:async(hop:Readonly<M04LiveM02HopInput>)=>{
      const grant=await read({workspaceId:hop.workspaceId,inspectionId:hop.inspectionId});
      if(grant===null)throw new Error('M04_LIVE_GRANT_EXPIRED');
      const now=options.now?.()??new Date();
      const timestamp=now.toISOString();
      const source=grant.sourceRequest;
      // M02 evaluator independently checks source request identity, policy,
      // admitted address classes, effective budgets and DNS freshness.
      const transportRequestId='m04.'+createHash('sha256').update(JSON.stringify([
        hop.workspaceId,hop.inspectionId,hop.canonicalUrl,hop.resolvedIpv4,
      ])).digest('hex').slice(0,48);
      const context={
        workspaceId:grant.workspaceId,inspectionId:grant.inspectionId,
        expiresAt:grant.expiresAt,
        admissionInput:{
          policy:grant.m02TransportPolicy,
          sourceRequest:source,
          request:{
            version:'1.0.0',transportRequestId,
            sourceRequestId:source.requestId,sourceTaskId:source.sourceTaskId,
            connectorKey:source.connectorKey,connectorVersion:source.connectorVersion,
            url:hop.canonicalUrl,method:'GET',transportKind:'network',redirectHop:0,
            maxResponseBytes:hop.maxResponseBytes,timeoutMs:hop.timeoutMs,
            acceptedContentTypes:['text/html'],requestedAt:timestamp,
          },
          resolution:{
            transportRequestId,url:hop.canonicalUrl,
            hostname:new URL(hop.canonicalUrl).hostname,resolvedAt:timestamp,
            addresses:[{address:hop.resolvedIpv4,family:4,classification:'public'}],
          },
          evaluatedAt:timestamp,
        },
      };
      return evaluateM04LiveM02HopContext(hop,context,now);
    },
    authorizeDeletion:options.authorizeDeletion,
    ...(options.cancellationPollMs!==undefined?{cancellationPollMs:options.cancellationPollMs}:{}),
    ...(options.cancellationCheckTimeoutMs!==undefined?{cancellationCheckTimeoutMs:options.cancellationCheckTimeoutMs}:{}),
    ...(options.requestLoadTimeoutMs!==undefined?{requestLoadTimeoutMs:options.requestLoadTimeoutMs}:{}),
    ...(options.deletionAuthorizationTimeoutMs!==undefined?{deletionAuthorizationTimeoutMs:options.deletionAuthorizationTimeoutMs}:{}),
    ...(options.now!==undefined?{now:options.now}:{}),
  };
  return createM04LiveWorkerHandlers(deps);
}