import { describe,it,expect,vi } from 'vitest';
import { deleteAuthorizedM04LiveRootEvidence } from './website-live-native-integration';
import { M04LiveAsyncBoundaryError } from './website-live-async-boundary';
import { deleteWebsiteLiveInspectionEvidence } from '@brovexa/db';
vi.mock('@brovexa/db',()=>({
 WebsiteLivePersistenceError:class WebsiteLivePersistenceError extends Error {
   constructor(readonly code:string,message:string){super(message);}
 },
 deleteWebsiteLiveInspectionEvidence:vi.fn(async()=>true),
 persistWebsiteLiveInspectionResult:vi.fn(async()=>({inspectionId:'inspect.1',replayed:false})),
}));
const scope={workspaceId:'550e8400-e29b-41d4-a716-446655440000',inspectionId:'inspect.1'};
const basic=()=>({
 enabled:true as const,pool:{connect:vi.fn()},
 loadPermit:vi.fn(),admitM02Hop:vi.fn(),getStoragePolicy:vi.fn(),
 authorizeDeletion:vi.fn(async()=>true),
});
describe('WEB-034 bounded live evidence deletion authorization',()=>{
 it('never deletes evidence if the workspace authorization store hangs',async()=>{
  const deps={...basic(),authorizeDeletion:()=>new Promise<boolean>(()=>{}),
   deletionAuthorizationTimeoutMs:100};
  await expect(deleteAuthorizedM04LiveRootEvidence(scope,deps as never))
   .rejects.toBeInstanceOf(M04LiveAsyncBoundaryError);
  expect(deleteWebsiteLiveInspectionEvidence).not.toHaveBeenCalled();
 });
 it('rejects an explicitly denied RBAC decision without persistence',async()=>{
  const deps=basic();deps.authorizeDeletion.mockResolvedValueOnce(false);
  await expect(deleteAuthorizedM04LiveRootEvidence(scope,deps as never))
   .rejects.toMatchObject({code:'M04_LIVE_DB_INPUT_INVALID'});
  expect(deleteWebsiteLiveInspectionEvidence).not.toHaveBeenCalled();
 });
 it('requires the exact granted tenant and forwards only the scope to DB',async()=>{
  const deps=basic();
  await expect(deleteAuthorizedM04LiveRootEvidence(scope,deps as never)).resolves.toBe(true);
  expect(deps.authorizeDeletion).toHaveBeenCalledWith(scope);
  expect(deleteWebsiteLiveInspectionEvidence).toHaveBeenCalledWith(expect.anything(),scope);
 });
});