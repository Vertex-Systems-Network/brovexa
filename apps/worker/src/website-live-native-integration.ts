import { WebsiteLivePersistenceError, persistWebsiteLiveInspectionResult,
  deleteWebsiteLiveInspectionEvidence, type createPgPool } from '@brovexa/db';
import { inspectAuthorizedM04LiveRoot } from './website-live-assessment';
import { awaitM04LiveStage } from './website-live-async-boundary';
import type { M04LiveAcquisitionDependencies, M04LiveReadRequest } from './website-live-acquisition';

/** Separate v2 live persistence handoff. Requires a trusted M02 and permit adapter. */
type Pool = ReturnType<typeof createPgPool>;
interface PersistPolicy {
  workspaceId: string;
  inspectionId: string;
  retentionTtlSeconds: number;
  deletionRequired: true;
}
export interface M04LiveNativeIntegrationDeps extends M04LiveAcquisitionDependencies {
  readonly pool: Pool;
  /** Independent workspace-scoped policy source, not queue payload. */
  readonly getStoragePolicy: (scope: Readonly<{workspaceId:string;inspectionId:string}>) => Promise<PersistPolicy | null>;
  /** Independent RBAC result from authenticated backend, not a client boolean. */
  readonly authorizeDeletion: (scope: Readonly<{workspaceId:string;inspectionId:string}>) => Promise<boolean>;
  /** Independent deletion RBAC check is deadline bounded and abortable. */
  readonly deletionAuthorizationTimeoutMs?: number;
}
function own(o: unknown,k:string):unknown {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('M04_LIVE_POLICY_INVALID');
  const d=Object.getOwnPropertyDescriptor(o,k);
  if(!d || !('value' in d))throw new Error('M04_LIVE_POLICY_INVALID');
  return d.value;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
function scopeOf(r:M04LiveReadRequest):{workspaceId:string;inspectionId:string}{
  const workspaceId=own(r,'workspaceId'),inspectionId=own(r,'inspectionId');
  if(typeof workspaceId!=='string'||!uuid.test(workspaceId)||typeof inspectionId!=='string'||!id.test(inspectionId))
    throw new Error('M04_LIVE_SCOPE_INVALID');
  return Object.freeze({workspaceId,inspectionId});
}
export async function inspectAndPersistM04LiveRoot(
  request: M04LiveReadRequest, deps: M04LiveNativeIntegrationDeps,
):Promise<{inspectionId:string;replayed:boolean}> {
  if(deps.signal?.aborted)throw new Error('M04_LIVE_CANCELLED');
  const scope=scopeOf(request);
  const assessment=await inspectAuthorizedM04LiveRoot(request,deps);
  if(deps.signal?.aborted)throw new Error('M04_LIVE_CANCELLED');
  const policyTimeout=own(assessment.request,'timeoutMs');
  if(typeof policyTimeout!=='number'||!Number.isSafeInteger(policyTimeout)||
     policyTimeout<100||policyTimeout>30_000)throw new Error('M04_LIVE_POLICY_INVALID');
  const source=await awaitM04LiveStage(
    () => deps.getStoragePolicy(scope),
    { timeoutMs: policyTimeout, ...(deps.signal ? {signal: deps.signal} : {}) },
  );
  if(deps.signal?.aborted)throw new Error('M04_LIVE_CANCELLED');
  const workspaceId=own(source,'workspaceId'),inspectionId=own(source,'inspectionId');
  const retentionTtlSeconds=own(source,'retentionTtlSeconds');
  const deletionRequired=own(source,'deletionRequired');
  if(workspaceId!==scope.workspaceId||inspectionId!==scope.inspectionId||
     typeof retentionTtlSeconds!=='number'||!Number.isSafeInteger(retentionTtlSeconds)||
     retentionTtlSeconds<1||retentionTtlSeconds>31_536_000||deletionRequired!==true)
    throw new Error('M04_LIVE_POLICY_INVALID');
  if(deps.signal?.aborted)throw new Error('M04_LIVE_CANCELLED');
  // This is a commit fence, not a claim that started PG writes can be rolled back on cancellation.
  return persistWebsiteLiveInspectionResult(deps.pool, {
    ...assessment, retentionTtlSeconds, deletionRequired:true,
  });
}
export async function deleteAuthorizedM04LiveRootEvidence(
  scope: {workspaceId:string;inspectionId:string},deps:M04LiveNativeIntegrationDeps,
):Promise<boolean> {
  const stable=scopeOf(scope as M04LiveReadRequest);
  const timeoutMs=deps.deletionAuthorizationTimeoutMs??5000;
  const authorized=await awaitM04LiveStage(() => deps.authorizeDeletion(stable), {
    timeoutMs, ...(deps.signal ? {signal: deps.signal} : {}),
  });
  if(authorized!==true)
    throw new WebsiteLivePersistenceError('M04_LIVE_DB_INPUT_INVALID','Live evidence deletion requires explicit RBAC.');
  if(deps.signal?.aborted)throw new Error('M04_LIVE_CANCELLED');
  return deleteWebsiteLiveInspectionEvidence(deps.pool,stable);
}