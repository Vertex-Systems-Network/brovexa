import type { Pool } from 'pg';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const sourceKeyPattern = /^source\.[a-z0-9_.-]+$/;
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

export type EntityEnrichmentPersistenceErrorCode =
  | 'ENTITY_ENRICHMENT_INPUT_INVALID'
  | 'DOMAIN_EVIDENCE_ID_CONFLICT'
  | 'DOMAIN_DECISION_ID_CONFLICT'
  | 'DOMAIN_DECISION_EVIDENCE_INVALID'
  | 'CONTACT_ELIGIBILITY_ID_CONFLICT'
  | 'CONTACT_EVIDENCE_ID_CONFLICT'
  | 'CONTACT_EVIDENCE_ELIGIBILITY_INVALID'
  | 'EVIDENCE_PURGE_INVALID'
  | 'EVIDENCE_NOT_FOUND';

export class EntityEnrichmentPersistenceError extends Error {
  readonly code: EntityEnrichmentPersistenceErrorCode;
  constructor(code: EntityEnrichmentPersistenceErrorCode, message: string) {
    super(message);
    this.name = 'EntityEnrichmentPersistenceError';
    this.code = code;
  }
}

export type EnrichmentStorageClass = 'REFERENCE_ONLY' | 'NORMALIZED_FACT' | 'EVIDENCE_MINIMAL';
export type DomainEvidenceKind = 'source_claim' | 'official_website' | 'registry_record' | 'dns_control';
export type DomainEvidenceEffect = 'supports_domain' | 'contradicts_domain';
export type DomainVerificationDecision = 'verified' | 'review_required' | 'rejected';
export type DomainVerificationMethod = 'deterministic' | 'human_review';
export type ContactChannel = 'email' | 'phone' | 'website_form' | 'social_profile' | 'other_public_business_channel';
export type ContactDataClassification = 'PUBLIC_BUSINESS' | 'PERSONAL_BUSINESS_CONTACT';
export type ContactEligibilityDecision = 'allow' | 'review_required' | 'blocked';
export type TerritoryMode = 'global' | 'country_allowlist' | 'provider_defined';

export interface EvidenceRetentionPolicy {
  retentionTtlSeconds: number | null;
  deletionRequired: boolean;
  refreshAfterSeconds: number | null;
}
export interface PolicySnapshot { policyId: string; policyVersion: string; }

export interface PersistBusinessDomainEvidenceInput {
  evidenceId: string;
  workspaceId: string;
  canonicalBusinessId: string;
  normalizedDomain: string;
  kind: DomainEvidenceKind;
  effect: DomainEvidenceEffect;
  sourceKey: string;
  sourceReferenceIds: readonly string[];
  sourcePolicySnapshot: PolicySnapshot;
  sourceAdmissionDecisionRef: string;
  sourceAdmissionDecision: 'allow';
  storageClass: EnrichmentStorageClass;
  retention: EvidenceRetentionPolicy;
  observedAt: Date;
  recordedAt: Date;
}

export interface PersistBusinessDomainVerificationDecisionInput {
  verificationId: string;
  workspaceId: string;
  canonicalBusinessId: string;
  normalizedDomain: string;
  decision: DomainVerificationDecision;
  method: DomainVerificationMethod;
  confidence: number;
  evidenceIds: readonly string[];
  reasonCodes: readonly string[];
  reviewDecisionRef: string | null;
  evaluatedAt: Date;
}

export interface PersistContactDataEligibilityDecisionInput {
  eligibilityId: string;
  workspaceId: string;
  canonicalBusinessId: string;
  channel: ContactChannel;
  sourceKey: string;
  connectorKey: string;
  connectorVersion: string;
  sourceRequestId: string;
  sourceAdmissionDecisionRef: string;
  sourceAdmissionDecision: 'allow';
  sourceReferenceIds: readonly string[];
  sourcePolicySnapshot: PolicySnapshot;
  compliancePolicySnapshot: PolicySnapshot;
  purpose: string;
  territory: { mode: TerritoryMode; countryCodes: readonly string[] };
  fieldName: string;
  dataClassification: ContactDataClassification;
  storageClass: EnrichmentStorageClass;
  retention: EvidenceRetentionPolicy;
  decision: ContactEligibilityDecision;
  displayAllowed: boolean;
  exportAllowed: boolean;
  reasonCodes: readonly string[];
  evaluatedAt: Date;
}

export interface PersistApprovedBusinessContactEvidenceInput {
  contactEvidenceId: string;
  workspaceId: string;
  canonicalBusinessId: string;
  channel: ContactChannel;
  normalizedValue: string;
  sourceKey: string;
  sourceReferenceIds: readonly string[];
  eligibilityId: string;
  outreachAuthorization: 'not_evaluated';
  observedAt: Date;
  recordedAt: Date;
}

export interface PurgeEntityEnrichmentEvidenceInput {
  evidenceId: string;
  workspaceId: string;
  purgedAt: Date;
  purgeReasonCode: string;
}

export interface PersistenceResult<T> { created: boolean; record: T; }
export interface PurgeResult { changed: boolean; evidenceId: string; workspaceId: string; purgedAt: Date; purgeReasonCode: string; }

export interface PersistedBusinessDomainEvidence extends PersistBusinessDomainEvidenceInput {
  purgedAt: Date | null;
  purgeReasonCode: string | null;
  createdAt: Date;
}
export interface PersistedBusinessDomainVerificationDecision extends PersistBusinessDomainVerificationDecisionInput { createdAt: Date; }
export interface PersistedContactDataEligibilityDecision extends PersistContactDataEligibilityDecisionInput { createdAt: Date; }
export interface PersistedApprovedBusinessContactEvidence extends PersistApprovedBusinessContactEvidenceInput {
  deletionRequired: boolean;
  purgedAt: Date | null;
  purgeReasonCode: string | null;
  createdAt: Date;
}

interface DomainEvidenceRow {
  id:string; workspace_id:string; canonical_business_id:string; normalized_domain:string|null;
  kind:DomainEvidenceKind; effect:DomainEvidenceEffect; source_key:string; source_reference_ids:string[];
  source_policy_id:string; source_policy_version:string; source_admission_decision_ref:string; source_admission_decision:'allow';
  storage_class:EnrichmentStorageClass; retention_ttl_seconds:number|null; deletion_required:boolean; refresh_after_seconds:number|null;
  observed_at:Date; recorded_at:Date; purged_at:Date|null; purge_reason_code:string|null; created_at:Date;
}
interface DomainDecisionRow {
  id:string; workspace_id:string; canonical_business_id:string; normalized_domain:string; decision:DomainVerificationDecision;
  method:DomainVerificationMethod; confidence:number; evidence_ids:string[]; reason_codes:string[]; review_decision_ref:string|null;
  evaluated_at:Date; created_at:Date;
}
interface EligibilityRow {
  id:string; workspace_id:string; canonical_business_id:string; channel:ContactChannel; source_key:string; connector_key:string;
  connector_version:string; source_request_id:string; source_admission_decision_ref:string; source_admission_decision:'allow';
  source_reference_ids:string[]; source_policy_id:string; source_policy_version:string; compliance_policy_id:string; compliance_policy_version:string;
  purpose:string; territory_mode:TerritoryMode; country_codes:string[]; field_name:string; data_classification:ContactDataClassification;
  storage_class:EnrichmentStorageClass; retention_ttl_seconds:number|null; deletion_required:boolean; refresh_after_seconds:number|null;
  decision:ContactEligibilityDecision; display_allowed:boolean; export_allowed:boolean; reason_codes:string[]; evaluated_at:Date; created_at:Date;
}
interface ContactEvidenceRow {
  id:string; workspace_id:string; canonical_business_id:string; channel:ContactChannel; normalized_value:string|null;
  source_key:string; source_reference_ids:string[]; eligibility_id:string; outreach_authorization:'not_evaluated'; deletion_required:boolean;
  observed_at:Date; recorded_at:Date; purged_at:Date|null; purge_reason_code:string|null; created_at:Date;
}

function fail(code:EntityEnrichmentPersistenceErrorCode,message:string):never { throw new EntityEnrichmentPersistenceError(code,message); }
function assertWorkspace(value:string):void { if(!uuidPattern.test(value)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','workspaceId must be a canonical UUID.'); }
function assertIdentifier(value:string,field:string):void { if(typeof value!=='string'||!identifierPattern.test(value)) fail('ENTITY_ENRICHMENT_INPUT_INVALID',`${field} is invalid.`); }
function assertDate(value:Date,field:string):void { if(!(value instanceof Date)||Number.isNaN(value.getTime())) fail('ENTITY_ENRICHMENT_INPUT_INVALID',`${field} must be a valid Date.`); }
function assertConfidence(value:number):void { if(!Number.isFinite(value)||value<0||value>1) fail('ENTITY_ENRICHMENT_INPUT_INVALID','confidence must be between 0 and 1.'); }
function assertSafeSeconds(value:number|null,field:string):void { if(value!==null&&(!Number.isSafeInteger(value)||value<0)) fail('ENTITY_ENRICHMENT_INPUT_INVALID',`${field} must be a non-negative safe integer or null.`); }
function array(values:readonly string[],field:string,{min=1,max=256,pattern=identifierPattern}:{min?:number;max?:number;pattern?:RegExp}={}):string[] {
  if(!Array.isArray(values)||values.length<min||values.length>max) fail('ENTITY_ENRICHMENT_INPUT_INVALID',`${field} length is invalid.`);
  const out=values.map(v=>{ if(typeof v!=='string'||!pattern.test(v)) fail('ENTITY_ENRICHMENT_INPUT_INVALID',`${field} contains an invalid value.`); return v; });
  if(new Set(out).size!==out.length) fail('ENTITY_ENRICHMENT_INPUT_INVALID',`${field} must not contain duplicates.`);
  return out;
}
function sameArray(a:readonly string[],b:readonly string[]):boolean { return a.length===b.length&&a.every((v,i)=>v===b[i]); }
function assertPolicy(p:PolicySnapshot,field:string):void { assertIdentifier(p.policyId,`${field}.policyId`); if(!versionPattern.test(p.policyVersion)) fail('ENTITY_ENRICHMENT_INPUT_INVALID',`${field}.policyVersion is invalid.`); }
function assertRetention(r:EvidenceRetentionPolicy):void { assertSafeSeconds(r.retentionTtlSeconds,'retentionTtlSeconds'); assertSafeSeconds(r.refreshAfterSeconds,'refreshAfterSeconds'); if(typeof r.deletionRequired!=='boolean') fail('ENTITY_ENRICHMENT_INPUT_INVALID','deletionRequired must be boolean.'); }
function assertDomain(value:string):void { if(!domainPattern.test(value)||value!==value.toLowerCase()) fail('ENTITY_ENRICHMENT_INPUT_INVALID','normalizedDomain is invalid.'); }
function assertSourceKey(value:string):void { if(!sourceKeyPattern.test(value)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','sourceKey is invalid.'); }
function assertContactValue(channel:ContactChannel,value:string):string {
  if(typeof value!=='string'||value.trim().length<1||value.length>2048) fail('ENTITY_ENRICHMENT_INPUT_INVALID','normalizedValue length is invalid.');
  if(channel==='email'&&(value!==value.toLowerCase()||!emailPattern.test(value))) fail('ENTITY_ENRICHMENT_INPUT_INVALID','email must be normalized lowercase.');
  if(channel==='phone'&&!phonePattern.test(value)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','phone must use E.164.');
  if(channel==='website_form'||channel==='social_profile'){
    let url:URL; try { url=new URL(value); } catch { fail('ENTITY_ENRICHMENT_INPUT_INVALID','URL contact evidence is invalid.'); }
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password) fail('ENTITY_ENRICHMENT_INPUT_INVALID','URL contact evidence must be credential-free HTTP(S).');
  }
  return value.trim();
}
function toDomain(row:DomainEvidenceRow):PersistedBusinessDomainEvidence {
  if(row.purged_at!==null||row.normalized_domain===null) fail('EVIDENCE_PURGE_INVALID','Purged domain evidence cannot be materialized as active contract evidence.');
  return { evidenceId:row.id,workspaceId:row.workspace_id,canonicalBusinessId:row.canonical_business_id,normalizedDomain:row.normalized_domain,kind:row.kind,effect:row.effect,sourceKey:row.source_key,sourceReferenceIds:Object.freeze([...row.source_reference_ids]),sourcePolicySnapshot:Object.freeze({policyId:row.source_policy_id,policyVersion:row.source_policy_version}),sourceAdmissionDecisionRef:row.source_admission_decision_ref,sourceAdmissionDecision:'allow',storageClass:row.storage_class,retention:Object.freeze({retentionTtlSeconds:row.retention_ttl_seconds,deletionRequired:row.deletion_required,refreshAfterSeconds:row.refresh_after_seconds}),observedAt:row.observed_at,recordedAt:row.recorded_at,purgedAt:null,purgeReasonCode:null,createdAt:row.created_at };
}
function toDecision(row:DomainDecisionRow):PersistedBusinessDomainVerificationDecision { return { verificationId:row.id,workspaceId:row.workspace_id,canonicalBusinessId:row.canonical_business_id,normalizedDomain:row.normalized_domain,decision:row.decision,method:row.method,confidence:row.confidence,evidenceIds:Object.freeze([...row.evidence_ids]),reasonCodes:Object.freeze([...row.reason_codes]),reviewDecisionRef:row.review_decision_ref,evaluatedAt:row.evaluated_at,createdAt:row.created_at }; }
function toEligibility(row:EligibilityRow):PersistedContactDataEligibilityDecision { return { eligibilityId:row.id,workspaceId:row.workspace_id,canonicalBusinessId:row.canonical_business_id,channel:row.channel,sourceKey:row.source_key,connectorKey:row.connector_key,connectorVersion:row.connector_version,sourceRequestId:row.source_request_id,sourceAdmissionDecisionRef:row.source_admission_decision_ref,sourceAdmissionDecision:'allow',sourceReferenceIds:Object.freeze([...row.source_reference_ids]),sourcePolicySnapshot:Object.freeze({policyId:row.source_policy_id,policyVersion:row.source_policy_version}),compliancePolicySnapshot:Object.freeze({policyId:row.compliance_policy_id,policyVersion:row.compliance_policy_version}),purpose:row.purpose,territory:Object.freeze({mode:row.territory_mode,countryCodes:Object.freeze([...row.country_codes])}),fieldName:row.field_name,dataClassification:row.data_classification,storageClass:row.storage_class,retention:Object.freeze({retentionTtlSeconds:row.retention_ttl_seconds,deletionRequired:row.deletion_required,refreshAfterSeconds:row.refresh_after_seconds}),decision:row.decision,displayAllowed:row.display_allowed,exportAllowed:row.export_allowed,reasonCodes:Object.freeze([...row.reason_codes]),evaluatedAt:row.evaluated_at,createdAt:row.created_at }; }
function toContact(row:ContactEvidenceRow):PersistedApprovedBusinessContactEvidence { if(row.purged_at!==null||row.normalized_value===null) fail('EVIDENCE_PURGE_INVALID','Purged contact evidence cannot be materialized as active contract evidence.'); return { contactEvidenceId:row.id,workspaceId:row.workspace_id,canonicalBusinessId:row.canonical_business_id,channel:row.channel,normalizedValue:row.normalized_value,sourceKey:row.source_key,sourceReferenceIds:Object.freeze([...row.source_reference_ids]),eligibilityId:row.eligibility_id,outreachAuthorization:'not_evaluated',observedAt:row.observed_at,recordedAt:row.recorded_at,deletionRequired:row.deletion_required,purgedAt:null,purgeReasonCode:null,createdAt:row.created_at }; }

export async function persistBusinessDomainEvidence(pool:Pool,input:PersistBusinessDomainEvidenceInput):Promise<PersistenceResult<PersistedBusinessDomainEvidence>> {
  assertWorkspace(input.workspaceId); assertIdentifier(input.evidenceId,'evidenceId'); assertIdentifier(input.canonicalBusinessId,'canonicalBusinessId'); assertDomain(input.normalizedDomain);
  if(!['source_claim','official_website','registry_record','dns_control'].includes(input.kind)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','kind is invalid.');
  if(!['supports_domain','contradicts_domain'].includes(input.effect)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','effect is invalid.');
  assertSourceKey(input.sourceKey); const refs=array(input.sourceReferenceIds,'sourceReferenceIds',{max:64}); assertPolicy(input.sourcePolicySnapshot,'sourcePolicySnapshot'); assertIdentifier(input.sourceAdmissionDecisionRef,'sourceAdmissionDecisionRef');
  if(input.sourceAdmissionDecision!=='allow') fail('ENTITY_ENRICHMENT_INPUT_INVALID','source admission must be allow.');
  if(!['REFERENCE_ONLY','NORMALIZED_FACT','EVIDENCE_MINIMAL'].includes(input.storageClass)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','storageClass is invalid.');
  assertRetention(input.retention); assertDate(input.observedAt,'observedAt'); assertDate(input.recordedAt,'recordedAt'); if(input.recordedAt<input.observedAt) fail('ENTITY_ENRICHMENT_INPUT_INVALID','recordedAt cannot precede observedAt.');
  const values=[input.evidenceId,input.workspaceId,input.canonicalBusinessId,input.normalizedDomain,input.kind,input.effect,input.sourceKey,JSON.stringify(refs),input.sourcePolicySnapshot.policyId,input.sourcePolicySnapshot.policyVersion,input.sourceAdmissionDecisionRef,input.storageClass,input.retention.retentionTtlSeconds,input.retention.deletionRequired,input.retention.refreshAfterSeconds,input.observedAt,input.recordedAt];
  const inserted=await pool.query<DomainEvidenceRow>(`INSERT INTO business_domain_evidence
    (id,workspace_id,canonical_business_id,normalized_domain,kind,effect,source_key,source_reference_ids,source_policy_id,source_policy_version,source_admission_decision_ref,source_admission_decision,storage_class,retention_ttl_seconds,deletion_required,refresh_after_seconds,observed_at,recorded_at)
    VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,'allow',$12,$13,$14,$15,$16,$17)
    ON CONFLICT (id) DO NOTHING
    RETURNING id,workspace_id,canonical_business_id,normalized_domain,kind,effect,source_key,source_reference_ids,source_policy_id,source_policy_version,source_admission_decision_ref,source_admission_decision,storage_class,retention_ttl_seconds,deletion_required,refresh_after_seconds,observed_at,recorded_at,purged_at,purge_reason_code,created_at`,values);
  if(inserted.rows[0]) return {created:true,record:toDomain(inserted.rows[0])};
  const existing=await pool.query<DomainEvidenceRow>(`SELECT * FROM business_domain_evidence WHERE id=$1 AND workspace_id=$2::uuid`,[input.evidenceId,input.workspaceId]);
  const row=existing.rows[0]; if(!row||row.purged_at!==null||row.canonical_business_id!==input.canonicalBusinessId||row.normalized_domain!==input.normalizedDomain||row.kind!==input.kind||row.effect!==input.effect||row.source_key!==input.sourceKey||!sameArray(row.source_reference_ids,refs)||row.source_policy_id!==input.sourcePolicySnapshot.policyId||row.source_policy_version!==input.sourcePolicySnapshot.policyVersion||row.source_admission_decision_ref!==input.sourceAdmissionDecisionRef||row.source_admission_decision!=='allow'||row.storage_class!==input.storageClass||row.retention_ttl_seconds!==input.retention.retentionTtlSeconds||row.deletion_required!==input.retention.deletionRequired||row.refresh_after_seconds!==input.retention.refreshAfterSeconds||row.observed_at.getTime()!==input.observedAt.getTime()||row.recorded_at.getTime()!==input.recordedAt.getTime()) fail('DOMAIN_EVIDENCE_ID_CONFLICT',`Domain evidence ${input.evidenceId} conflicts with existing durable content.`);
  return {created:false,record:toDomain(row)};
}

export async function persistBusinessDomainVerificationDecision(pool:Pool,input:PersistBusinessDomainVerificationDecisionInput):Promise<PersistenceResult<PersistedBusinessDomainVerificationDecision>> {
  assertWorkspace(input.workspaceId); assertIdentifier(input.verificationId,'verificationId'); assertIdentifier(input.canonicalBusinessId,'canonicalBusinessId'); assertDomain(input.normalizedDomain); assertConfidence(input.confidence);
  const evidenceIds=array(input.evidenceIds,'evidenceIds',{max:256}); const reasons=array(input.reasonCodes,'reasonCodes',{max:64}); assertDate(input.evaluatedAt,'evaluatedAt');
  if(!['verified','review_required','rejected'].includes(input.decision)||!['deterministic','human_review'].includes(input.method)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','domain decision or method is invalid.');
  if(input.method==='human_review'&&input.reviewDecisionRef===null) fail('ENTITY_ENRICHMENT_INPUT_INVALID','human_review requires reviewDecisionRef.');
  if(input.method==='deterministic'&&input.reviewDecisionRef!==null) fail('ENTITY_ENRICHMENT_INPUT_INVALID','deterministic method cannot declare reviewDecisionRef.');
  if(input.decision==='review_required'&&input.method!=='deterministic') fail('ENTITY_ENRICHMENT_INPUT_INVALID','review_required must remain deterministic.');
  if(input.reviewDecisionRef!==null) assertIdentifier(input.reviewDecisionRef,'reviewDecisionRef');
  const evidence=await pool.query<{id:string;kind:DomainEvidenceKind;effect:DomainEvidenceEffect}>(`SELECT id,kind,effect FROM business_domain_evidence WHERE workspace_id=$1::uuid AND canonical_business_id=$2 AND normalized_domain=$3 AND purged_at IS NULL AND id=ANY($4::text[])`,[input.workspaceId,input.canonicalBusinessId,input.normalizedDomain,evidenceIds]);
  if(evidence.rows.length!==evidenceIds.length||new Set(evidence.rows.map(r=>r.id)).size!==evidenceIds.length) fail('DOMAIN_DECISION_EVIDENCE_INVALID','Every decision evidence ID must exist in the same workspace, business and domain.');
  if(input.decision==='verified'&&!evidence.rows.some(r=>r.effect==='supports_domain')) fail('DOMAIN_DECISION_EVIDENCE_INVALID','verified domain requires supporting evidence.');
  if(input.decision==='verified'&&input.method==='deterministic'&&(!evidence.rows.some(r=>r.effect==='supports_domain'&&r.kind!=='source_claim')||evidence.rows.some(r=>r.effect==='contradicts_domain'))) fail('DOMAIN_DECISION_EVIDENCE_INVALID','deterministic verification requires independent non-contradictory evidence.');
  const inserted=await pool.query<DomainDecisionRow>(`INSERT INTO business_domain_verification_decisions
    (id,workspace_id,canonical_business_id,normalized_domain,decision,method,confidence,evidence_ids,reason_codes,review_decision_ref,evaluated_at)
    VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)
    ON CONFLICT (id) DO NOTHING
    RETURNING id,workspace_id,canonical_business_id,normalized_domain,decision,method,confidence,evidence_ids,reason_codes,review_decision_ref,evaluated_at,created_at`,[input.verificationId,input.workspaceId,input.canonicalBusinessId,input.normalizedDomain,input.decision,input.method,input.confidence,JSON.stringify(evidenceIds),JSON.stringify(reasons),input.reviewDecisionRef,input.evaluatedAt]);
  if(inserted.rows[0]) return {created:true,record:toDecision(inserted.rows[0])};
  const existing=await pool.query<DomainDecisionRow>(`SELECT * FROM business_domain_verification_decisions WHERE id=$1 AND workspace_id=$2::uuid`,[input.verificationId,input.workspaceId]);
  const row=existing.rows[0]; if(!row||row.canonical_business_id!==input.canonicalBusinessId||row.normalized_domain!==input.normalizedDomain||row.decision!==input.decision||row.method!==input.method||row.confidence!==input.confidence||!sameArray(row.evidence_ids,evidenceIds)||!sameArray(row.reason_codes,reasons)||row.review_decision_ref!==input.reviewDecisionRef||row.evaluated_at.getTime()!==input.evaluatedAt.getTime()) fail('DOMAIN_DECISION_ID_CONFLICT',`Domain verification ${input.verificationId} conflicts with existing durable content.`);
  return {created:false,record:toDecision(row)};
}

export async function persistContactDataEligibilityDecision(pool:Pool,input:PersistContactDataEligibilityDecisionInput):Promise<PersistenceResult<PersistedContactDataEligibilityDecision>> {
  assertWorkspace(input.workspaceId); assertIdentifier(input.eligibilityId,'eligibilityId'); assertIdentifier(input.canonicalBusinessId,'canonicalBusinessId'); assertSourceKey(input.sourceKey);
  if(!connectorKeyPattern.test(input.connectorKey)||!versionPattern.test(input.connectorVersion)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','connector identity/version is invalid.');
  assertIdentifier(input.sourceRequestId,'sourceRequestId'); assertIdentifier(input.sourceAdmissionDecisionRef,'sourceAdmissionDecisionRef'); if(input.sourceAdmissionDecision!=='allow') fail('ENTITY_ENRICHMENT_INPUT_INVALID','source admission must be allow.');
  const refs=array(input.sourceReferenceIds,'sourceReferenceIds',{max:64}); assertPolicy(input.sourcePolicySnapshot,'sourcePolicySnapshot'); assertPolicy(input.compliancePolicySnapshot,'compliancePolicySnapshot'); assertIdentifier(input.purpose,'purpose'); assertIdentifier(input.fieldName,'fieldName');
  if(!['email','phone','website_form','social_profile','other_public_business_channel'].includes(input.channel)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','channel is invalid.');
  if(!['PUBLIC_BUSINESS','PERSONAL_BUSINESS_CONTACT'].includes(input.dataClassification)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','dataClassification is invalid.');
  if(!['REFERENCE_ONLY','NORMALIZED_FACT','EVIDENCE_MINIMAL'].includes(input.storageClass)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','storageClass is invalid.');
  if(!['global','country_allowlist','provider_defined'].includes(input.territory.mode)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','territory.mode is invalid.');
  const countries=array(input.territory.countryCodes,'countryCodes',{min:0,max:249,pattern:/^[A-Z]{2}$/}); if(input.territory.mode==='country_allowlist'&&countries.length===0) fail('ENTITY_ENRICHMENT_INPUT_INVALID','country_allowlist requires countries.'); if(input.territory.mode==='global'&&countries.length>0) fail('ENTITY_ENRICHMENT_INPUT_INVALID','global territory cannot list countries.');
  assertRetention(input.retention); if(!['allow','review_required','blocked'].includes(input.decision)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','decision is invalid.'); if(input.decision!=='allow'&&(input.displayAllowed||input.exportAllowed)) fail('ENTITY_ENRICHMENT_INPUT_INVALID','blocked/review-required data cannot be display/export authorized.');
  const reasons=array(input.reasonCodes,'reasonCodes',{max:64}); assertDate(input.evaluatedAt,'evaluatedAt');
  const inserted=await pool.query<EligibilityRow>(`INSERT INTO contact_data_eligibility_decisions
    (id,workspace_id,canonical_business_id,channel,source_key,connector_key,connector_version,source_request_id,source_admission_decision_ref,source_admission_decision,source_reference_ids,source_policy_id,source_policy_version,compliance_policy_id,compliance_policy_version,purpose,territory_mode,country_codes,field_name,data_classification,storage_class,retention_ttl_seconds,deletion_required,refresh_after_seconds,decision,display_allowed,export_allowed,reason_codes,evaluated_at)
    VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,'allow',$10::jsonb,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28)
    ON CONFLICT (id) DO NOTHING
    RETURNING *`,[input.eligibilityId,input.workspaceId,input.canonicalBusinessId,input.channel,input.sourceKey,input.connectorKey,input.connectorVersion,input.sourceRequestId,input.sourceAdmissionDecisionRef,JSON.stringify(refs),input.sourcePolicySnapshot.policyId,input.sourcePolicySnapshot.policyVersion,input.compliancePolicySnapshot.policyId,input.compliancePolicySnapshot.policyVersion,input.purpose,input.territory.mode,JSON.stringify(countries),input.fieldName,input.dataClassification,input.storageClass,input.retention.retentionTtlSeconds,input.retention.deletionRequired,input.retention.refreshAfterSeconds,input.decision,input.displayAllowed,input.exportAllowed,JSON.stringify(reasons),input.evaluatedAt]);
  if(inserted.rows[0]) return {created:true,record:toEligibility(inserted.rows[0])};
  const existing=await pool.query<EligibilityRow>(`SELECT * FROM contact_data_eligibility_decisions WHERE id=$1 AND workspace_id=$2::uuid`,[input.eligibilityId,input.workspaceId]); const row=existing.rows[0];
  const expected=toEligibility(row as EligibilityRow); if(!row||row.canonical_business_id!==input.canonicalBusinessId||row.channel!==input.channel||row.source_key!==input.sourceKey||row.connector_key!==input.connectorKey||row.connector_version!==input.connectorVersion||row.source_request_id!==input.sourceRequestId||row.source_admission_decision_ref!==input.sourceAdmissionDecisionRef||!sameArray(row.source_reference_ids,refs)||row.source_policy_id!==input.sourcePolicySnapshot.policyId||row.source_policy_version!==input.sourcePolicySnapshot.policyVersion||row.compliance_policy_id!==input.compliancePolicySnapshot.policyId||row.compliance_policy_version!==input.compliancePolicySnapshot.policyVersion||row.purpose!==input.purpose||row.territory_mode!==input.territory.mode||!sameArray(row.country_codes,countries)||row.field_name!==input.fieldName||row.data_classification!==input.dataClassification||row.storage_class!==input.storageClass||row.retention_ttl_seconds!==input.retention.retentionTtlSeconds||row.deletion_required!==input.retention.deletionRequired||row.refresh_after_seconds!==input.retention.refreshAfterSeconds||row.decision!==input.decision||row.display_allowed!==input.displayAllowed||row.export_allowed!==input.exportAllowed||!sameArray(row.reason_codes,reasons)||row.evaluated_at.getTime()!==input.evaluatedAt.getTime()) fail('CONTACT_ELIGIBILITY_ID_CONFLICT',`Contact eligibility ${input.eligibilityId} conflicts with existing durable content.`);
  return {created:false,record:expected};
}

export async function persistApprovedBusinessContactEvidence(pool:Pool,input:PersistApprovedBusinessContactEvidenceInput):Promise<PersistenceResult<PersistedApprovedBusinessContactEvidence>> {
  assertWorkspace(input.workspaceId); assertIdentifier(input.contactEvidenceId,'contactEvidenceId'); assertIdentifier(input.canonicalBusinessId,'canonicalBusinessId'); assertIdentifier(input.eligibilityId,'eligibilityId'); assertSourceKey(input.sourceKey);
  const value=assertContactValue(input.channel,input.normalizedValue); const refs=array(input.sourceReferenceIds,'sourceReferenceIds',{max:64}); assertDate(input.observedAt,'observedAt'); assertDate(input.recordedAt,'recordedAt'); if(input.recordedAt<input.observedAt) fail('ENTITY_ENRICHMENT_INPUT_INVALID','recordedAt cannot precede observedAt.'); if(input.outreachAuthorization!=='not_evaluated') fail('ENTITY_ENRICHMENT_INPUT_INVALID','outreach authorization is outside this persistence boundary.');
  const eligibility=await pool.query<EligibilityRow>(`SELECT * FROM contact_data_eligibility_decisions WHERE id=$1 AND workspace_id=$2::uuid`,[input.eligibilityId,input.workspaceId]); const e=eligibility.rows[0];
  if(!e||e.decision!=='allow'||e.source_admission_decision!=='allow'||e.canonical_business_id!==input.canonicalBusinessId||e.channel!==input.channel||e.source_key!==input.sourceKey||refs.some(r=>!e.source_reference_ids.includes(r))) fail('CONTACT_EVIDENCE_ELIGIBILITY_INVALID','Contact evidence requires a matching allowed eligibility decision and approved provenance.');
  const inserted=await pool.query<ContactEvidenceRow>(`INSERT INTO approved_business_contact_evidence
    (id,workspace_id,canonical_business_id,channel,normalized_value,source_key,source_reference_ids,eligibility_id,outreach_authorization,deletion_required,observed_at,recorded_at)
    VALUES ($1,$2::uuid,$3,$4,$5,$6,$7::jsonb,$8,'not_evaluated',$9,$10,$11)
    ON CONFLICT (id) DO NOTHING
    RETURNING *`,[input.contactEvidenceId,input.workspaceId,input.canonicalBusinessId,input.channel,value,input.sourceKey,JSON.stringify(refs),input.eligibilityId,e.deletion_required,input.observedAt,input.recordedAt]);
  if(inserted.rows[0]) return {created:true,record:toContact(inserted.rows[0])};
  const existing=await pool.query<ContactEvidenceRow>(`SELECT * FROM approved_business_contact_evidence WHERE id=$1 AND workspace_id=$2::uuid`,[input.contactEvidenceId,input.workspaceId]); const row=existing.rows[0];
  if(!row||row.purged_at!==null||row.canonical_business_id!==input.canonicalBusinessId||row.channel!==input.channel||row.normalized_value!==value||row.source_key!==input.sourceKey||!sameArray(row.source_reference_ids,refs)||row.eligibility_id!==input.eligibilityId||row.outreach_authorization!=='not_evaluated'||row.deletion_required!==e.deletion_required||row.observed_at.getTime()!==input.observedAt.getTime()||row.recorded_at.getTime()!==input.recordedAt.getTime()) fail('CONTACT_EVIDENCE_ID_CONFLICT',`Contact evidence ${input.contactEvidenceId} conflicts with existing durable content.`);
  return {created:false,record:toContact(row)};
}

async function purge(pool:Pool,table:'business_domain_evidence'|'approved_business_contact_evidence',input:PurgeEntityEnrichmentEvidenceInput):Promise<PurgeResult> {
  assertWorkspace(input.workspaceId); assertIdentifier(input.evidenceId,'evidenceId'); assertIdentifier(input.purgeReasonCode,'purgeReasonCode'); assertDate(input.purgedAt,'purgedAt');
  const clearValue=table==='business_domain_evidence'?'normalized_domain = NULL':'normalized_value = NULL';
  const result=await pool.query<{id:string;workspace_id:string;purged_at:Date;purge_reason_code:string}>(`UPDATE ${table} SET ${clearValue}, source_reference_ids='[]'::jsonb, purged_at=$3, purge_reason_code=$4 WHERE id=$1 AND workspace_id=$2::uuid AND purged_at IS NULL AND deletion_required=true RETURNING id,workspace_id,purged_at,purge_reason_code`,[input.evidenceId,input.workspaceId,input.purgedAt,input.purgeReasonCode]);
  if(result.rows[0]) return {changed:true,evidenceId:result.rows[0].id,workspaceId:result.rows[0].workspace_id,purgedAt:result.rows[0].purged_at,purgeReasonCode:result.rows[0].purge_reason_code};
  const existing=await pool.query<{id:string;workspace_id:string;deletion_required:boolean;purged_at:Date|null;purge_reason_code:string|null}>(`SELECT id,workspace_id,deletion_required,purged_at,purge_reason_code FROM ${table} WHERE id=$1 AND workspace_id=$2::uuid`,[input.evidenceId,input.workspaceId]); const row=existing.rows[0];
  if(!row) fail('EVIDENCE_NOT_FOUND',`Evidence ${input.evidenceId} was not found in the workspace.`);
  if(!row.deletion_required) fail('EVIDENCE_PURGE_INVALID','Evidence policy does not authorize deletion.');
  if(row.purged_at&&row.purge_reason_code===input.purgeReasonCode&&row.purged_at.getTime()===input.purgedAt.getTime()) return {changed:false,evidenceId:row.id,workspaceId:row.workspace_id,purgedAt:row.purged_at,purgeReasonCode:row.purge_reason_code};
  fail('EVIDENCE_PURGE_INVALID','Evidence is already purged with different durable purge metadata.');
}
export const purgeBusinessDomainEvidence=(pool:Pool,input:PurgeEntityEnrichmentEvidenceInput)=>purge(pool,'business_domain_evidence',input);
export const purgeApprovedBusinessContactEvidence=(pool:Pool,input:PurgeEntityEnrichmentEvidenceInput)=>purge(pool,'approved_business_contact_evidence',input);
