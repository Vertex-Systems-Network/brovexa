import {
  ConnectorAdmissionDecisionSchema,
  ConnectorAdmissionInputSchema,
  SourceCapabilitySchema,
  SourceRequestEnvelopeSchema,
  SourceResultEnvelopeSchema,
  evaluateConnectorAdmission as evaluateBaseConnectorAdmission,
  validateSourceResultAgainstAdmission as validateBaseSourceResultAgainstAdmission,
} from './source';
import type {
  ConnectorAdmissionDecision,
  ConnectorAdmissionInput,
  ConnectorPolicy,
  SourceCapability,
  SourceRequestEnvelope,
  SourceResultEnvelope,
  SourceResultValidation,
} from './source';

export {
  ConnectorAdmissionDecisionSchema,
  ConnectorAdmissionInputSchema,
  ConnectorDefinitionSchema,
  ConnectorHealthSnapshotSchema,
  ConnectorPolicySchema,
  ConnectorPolicyStateSchema,
  SourceAccessMethodSchema,
  SourceBudgetSchema,
  SourceCandidateSchema,
  SourceCapabilitySchema,
  SourceClassSchema,
  SourceDataClassificationSchema,
  SourceOperationSchema,
  SourceReferenceSchema,
  SourceRequestEnvelopeSchema,
  SourceResultEnvelopeSchema,
  SourceResultValidationSchema,
  SourceStorageClassSchema,
  connectorCredentialModeValues,
  connectorPolicyStateValues,
  sourceAccessMethodValues,
  sourceClassValues,
  sourceDataClassificationValues,
  sourceOperationValues,
  sourceStorageClassValues,
} from './source';
export type {
  ConnectorAdmissionDecision,
  ConnectorAdmissionInput,
  ConnectorCredentialMode,
  ConnectorDefinition,
  ConnectorHealthSnapshot,
  ConnectorPolicy,
  ConnectorPolicyState,
  SourceAccessMethod,
  SourceBudget,
  SourceCandidate,
  SourceCapability,
  SourceClass,
  SourceDataClassification,
  SourceOperation,
  SourceReference,
  SourceRequestEnvelope,
  SourceResultEnvelope,
  SourceResultValidation,
  SourceStorageClass,
} from './source';

function isSubset(values: readonly string[], allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return values.every((value) => allowedSet.has(value));
}

function hardenAdmissionDecision(
  base: ConnectorAdmissionDecision,
  blockedReasons: ReadonlySet<string>,
  reviewReasons: ReadonlySet<string>,
): ConnectorAdmissionDecision {
  const reasonCodes = [...new Set([...base.reasonCodes, ...blockedReasons, ...reviewReasons])].sort();
  const decision = blockedReasons.size > 0
    ? 'blocked'
    : base.decision === 'blocked'
      ? 'blocked'
      : reviewReasons.size > 0 || base.decision === 'review_required'
        ? 'review_required'
        : 'allow';

  return ConnectorAdmissionDecisionSchema.parse({
    ...base,
    decision,
    reasonCodes,
    exportAllowed: decision === 'allow' ? base.exportAllowed : false,
    rawPayloadAllowed: decision === 'allow' ? base.rawPayloadAllowed : false,
  });
}

/**
 * Public M02 admission boundary. The lower-level contract evaluator remains an
 * implementation detail; callers receive this stricter policy/capability gate.
 */
export function evaluateConnectorAdmission(rawInput: ConnectorAdmissionInput): ConnectorAdmissionDecision {
  const input = ConnectorAdmissionInputSchema.parse(rawInput);
  const base = evaluateBaseConnectorAdmission(input);
  const blockedReasons = new Set<string>();
  const reviewReasons = new Set<string>();
  const { capability, policy, request } = input;

  if (request.exportRequested && !isSubset(request.requestedFields, policy.export.allowedFields)) {
    blockedReasons.add('source_export_field_not_allowed');
  }

  if ((policy.attribution.required || (request.exportRequested && policy.export.attributionRequired)) && !capability.supportsAttribution) {
    blockedReasons.add('source_attribution_unsupported');
  }

  const pageSize = request.pagination.pageSize;
  if (capability.pagination.mode === 'none' && Object.keys(request.pagination).length > 0) {
    blockedReasons.add('source_pagination_not_supported');
  }
  if (
    pageSize !== undefined &&
    capability.pagination.maxPageSize !== undefined &&
    pageSize > capability.pagination.maxPageSize
  ) {
    blockedReasons.add('source_page_size_exceeds_capability');
  }
  const cursor = request.pagination.cursor;
  if (
    cursor !== undefined &&
    capability.pagination.maxCursorLength !== undefined &&
    cursor.length > capability.pagination.maxCursorLength
  ) {
    blockedReasons.add('source_cursor_exceeds_capability');
  }

  if (
    request.requestedDataClassifications.includes('PERSONAL_BUSINESS_CONTACT') &&
    policy.personalData.allowed &&
    request.requestedFields.some((field) => !policy.personalData.allowedFields.includes(field))
  ) {
    reviewReasons.add('source_personal_data_mixed_field_review_required');
  }

  return hardenAdmissionDecision(base, blockedReasons, reviewReasons);
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Validates a normalized adapter result against the frozen request/admission.
 * Provider payloads remain unverified candidates with explicit provenance.
 */
export function validateSourceResultAgainstAdmission(input: {
  result: SourceResultEnvelope;
  request: SourceRequestEnvelope;
  capability: SourceCapability;
  policy: ConnectorPolicy;
  admission: ConnectorAdmissionDecision;
}): SourceResultValidation {
  const result = SourceResultEnvelopeSchema.parse(input.result);
  const request = SourceRequestEnvelopeSchema.parse(input.request);
  const capability = SourceCapabilitySchema.parse(input.capability);
  const base = validateBaseSourceResultAgainstAdmission({
    ...input,
    result,
    request,
    capability,
  });
  const issues = new Set(base.issues);

  for (const candidate of result.candidates) {
    if (!sameStrings(Object.keys(candidate.fields), candidate.fieldNames)) {
      issues.add('source_result_field_declaration_mismatch');
    }
    if (request.exportRequested && !isSubset(candidate.fieldNames, input.policy.export.allowedFields)) {
      issues.add('source_result_export_field_violation');
    }
  }

  const attributionRequired =
    input.policy.attribution.required || (request.exportRequested && input.policy.export.attributionRequired);
  if (
    attributionRequired &&
    result.sourceReferences.some((reference) => reference.attribution === undefined || reference.attribution.trim().length === 0)
  ) {
    issues.add('source_result_attribution_missing');
  }

  if (
    result.nextCursor !== undefined &&
    capability.pagination.maxCursorLength !== undefined &&
    result.nextCursor.length > capability.pagination.maxCursorLength
  ) {
    issues.add('source_result_cursor_exceeds_capability');
  }

  return { valid: issues.size === 0, issues: [...issues].sort() };
}
