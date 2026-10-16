import {
  SourceTransportAdmissionInputSchema, evaluateSourceTransportAdmission,
} from '@brovexa/contracts';
import { isPublicM04Ipv4, type M04LiveM02HopInput,
  type M04LiveM02HopAdmission } from './website-live-acquisition';

/** WEB-028: evaluate a trusted, workspace+inspection-scoped M02 policy snapshot. */
export interface M04LiveTrustedM02Context {
  workspaceId: string;
  inspectionId: string;
  expiresAt: string;
  /** Stored policy, approved source request, admitted transport request, and DNS evidence. */
  admissionInput: unknown;
}
export interface M04LiveM02AdapterOptions {
  loadContext: (scope: Readonly<{workspaceId:string;inspectionId:string}>) => Promise<M04LiveTrustedM02Context|null>;
  now?: () => Date;
}
export class M04LiveM02Error extends Error {
  readonly code: 'M04_M02_CONTEXT_INVALID'|'M04_M02_ADMISSION_DENIED';
  constructor(code: 'M04_M02_CONTEXT_INVALID'|'M04_M02_ADMISSION_DENIED'){
    super(code);this.name='M04LiveM02Error';this.code=code;
  }
}
const invalid=():never=>{throw new M04LiveM02Error('M04_M02_CONTEXT_INVALID');};
const denied=():never=>{throw new M04LiveM02Error('M04_M02_ADMISSION_DENIED');};
function own(object:unknown,key:string):unknown {
  if(object==null||typeof object!=='object'||Array.isArray(object))return invalid();
  const d=Object.getOwnPropertyDescriptor(object,key);
  if(!d||!('value' in d))return invalid();
  return d.value;
}

/** Pure admission boundary: individual work units may pass a freshly-loaded DB
 * policy context without relying on mutable closure state shared across requests. */
export function evaluateM04LiveM02HopContext(
  hop: Readonly<M04LiveM02HopInput>,
  raw: unknown,
  now: Date,
): M04LiveM02HopAdmission {
    const scoped=Object.freeze({workspaceId:hop.workspaceId,inspectionId:hop.inspectionId});
    const workspaceId=own(raw,'workspaceId'),inspectionId=own(raw,'inspectionId');
    const expiresAt=own(raw,'expiresAt'),source=own(raw,'admissionInput');
    const nowMs=now.getTime();
    const expiry=typeof expiresAt==='string'?Date.parse(expiresAt):NaN;
    if(workspaceId!==scoped.workspaceId||inspectionId!==scoped.inspectionId||
       !Number.isFinite(nowMs)||!Number.isFinite(expiry)||expiry<=nowMs||expiry>nowMs+300_000)
      return invalid();
    let input:ReturnType<typeof SourceTransportAdmissionInputSchema.parse>;
    try{input=SourceTransportAdmissionInputSchema.parse(source);}catch{return invalid();}
    const {policy,sourceRequest,request,resolution}=input;
    if(sourceRequest.workspaceId!==hop.workspaceId||sourceRequest.sourceKey!==hop.sourceKey||
       sourceRequest.executionIntent!=='execute'||sourceRequest.operation!=='fetch'||
       sourceRequest.rawPayloadRequested!==false||sourceRequest.exportRequested!==false||
       sourceRequest.robotsDecision==='disallowed'||sourceRequest.robotsDecision==='unknown'||
       sourceRequest.targetUrl!==hop.canonicalUrl||
       sourceRequest.policySnapshot.policyId!==hop.sourcePolicyId||
       sourceRequest.policySnapshot.policyVersion!==hop.sourcePolicyVersion||
       request.url!==hop.canonicalUrl||request.method!=='GET'||request.redirectHop!==0||
       request.transportKind!=='network'||request.maxResponseBytes!==hop.maxResponseBytes||
       request.timeoutMs!==hop.timeoutMs||!request.acceptedContentTypes.includes('text/html')||
       policy.transportPolicyId!==hop.transportPolicyId||
       policy.transportPolicyVersion!==hop.transportPolicyVersion||
       policy.networkMode!=='provider_network'||
       resolution.url!==hop.canonicalUrl||resolution.hostname!==new URL(hop.canonicalUrl).hostname||
       resolution.addresses.length===0||
       !resolution.addresses.some(a=>a.family===4&&a.address===hop.resolvedIpv4)||
       resolution.addresses.some(a=>a.family!==4||a.classification!=='public'||!isPublicM04Ipv4(a.address)))
      return denied();
    const evaluatedAt=Date.parse(input.evaluatedAt);
    if(!Number.isFinite(evaluatedAt)||evaluatedAt>nowMs||nowMs-evaluatedAt>5_000)return denied();
    const outcome=evaluateSourceTransportAdmission(input);
    if(outcome.decision!=='allow'||outcome.canonicalUrl!==hop.canonicalUrl||
       outcome.transportPolicyId!==hop.transportPolicyId||
       outcome.transportPolicyVersion!==hop.transportPolicyVersion||
       outcome.maxResponseBytes!==hop.maxResponseBytes||outcome.timeoutMs!==hop.timeoutMs||
       outcome.port!==443)return denied();
    return Object.freeze({
      decision:'allow' as const,transportKind:'network' as const,
      ...hop, expiresAt:expiresAt as string,
    });
}

/** Existing callback-based adapter is kept for independently trusted sources. */
export function createM04LiveM02HopAdmission(options:M04LiveM02AdapterOptions):(
  hop:Readonly<M04LiveM02HopInput>,
)=>Promise<M04LiveM02HopAdmission> {
  if(typeof options?.loadContext!=='function')throw new TypeError('Trusted M02 context loader is required.');
  return async hop=>{
    const raw=await options.loadContext(Object.freeze({
      workspaceId:hop.workspaceId,inspectionId:hop.inspectionId,
    }));
    return evaluateM04LiveM02HopContext(hop,raw,options.now?.()??new Date());
  };
}