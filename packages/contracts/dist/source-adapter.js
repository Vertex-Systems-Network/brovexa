"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceStorageClassValues = exports.sourceOperationValues = exports.sourceDataClassificationValues = exports.sourceClassValues = exports.sourceAccessMethodValues = exports.connectorPolicyStateValues = exports.connectorCredentialModeValues = exports.SourceStorageClassSchema = exports.SourceResultValidationSchema = exports.SourceResultEnvelopeSchema = exports.SourceRequestEnvelopeSchema = exports.SourceReferenceSchema = exports.SourceOperationSchema = exports.SourceDataClassificationSchema = exports.SourceClassSchema = exports.SourceCapabilitySchema = exports.SourceCandidateSchema = exports.SourceBudgetSchema = exports.SourceAccessMethodSchema = exports.ConnectorPolicyStateSchema = exports.ConnectorPolicySchema = exports.ConnectorHealthSnapshotSchema = exports.ConnectorDefinitionSchema = exports.ConnectorAdmissionInputSchema = exports.ConnectorAdmissionDecisionSchema = void 0;
exports.evaluateConnectorAdmission = evaluateConnectorAdmission;
exports.validateSourceResultAgainstAdmission = validateSourceResultAgainstAdmission;
const source_1 = require("./source");
var source_2 = require("./source");
Object.defineProperty(exports, "ConnectorAdmissionDecisionSchema", { enumerable: true, get: function () { return source_2.ConnectorAdmissionDecisionSchema; } });
Object.defineProperty(exports, "ConnectorAdmissionInputSchema", { enumerable: true, get: function () { return source_2.ConnectorAdmissionInputSchema; } });
Object.defineProperty(exports, "ConnectorDefinitionSchema", { enumerable: true, get: function () { return source_2.ConnectorDefinitionSchema; } });
Object.defineProperty(exports, "ConnectorHealthSnapshotSchema", { enumerable: true, get: function () { return source_2.ConnectorHealthSnapshotSchema; } });
Object.defineProperty(exports, "ConnectorPolicySchema", { enumerable: true, get: function () { return source_2.ConnectorPolicySchema; } });
Object.defineProperty(exports, "ConnectorPolicyStateSchema", { enumerable: true, get: function () { return source_2.ConnectorPolicyStateSchema; } });
Object.defineProperty(exports, "SourceAccessMethodSchema", { enumerable: true, get: function () { return source_2.SourceAccessMethodSchema; } });
Object.defineProperty(exports, "SourceBudgetSchema", { enumerable: true, get: function () { return source_2.SourceBudgetSchema; } });
Object.defineProperty(exports, "SourceCandidateSchema", { enumerable: true, get: function () { return source_2.SourceCandidateSchema; } });
Object.defineProperty(exports, "SourceCapabilitySchema", { enumerable: true, get: function () { return source_2.SourceCapabilitySchema; } });
Object.defineProperty(exports, "SourceClassSchema", { enumerable: true, get: function () { return source_2.SourceClassSchema; } });
Object.defineProperty(exports, "SourceDataClassificationSchema", { enumerable: true, get: function () { return source_2.SourceDataClassificationSchema; } });
Object.defineProperty(exports, "SourceOperationSchema", { enumerable: true, get: function () { return source_2.SourceOperationSchema; } });
Object.defineProperty(exports, "SourceReferenceSchema", { enumerable: true, get: function () { return source_2.SourceReferenceSchema; } });
Object.defineProperty(exports, "SourceRequestEnvelopeSchema", { enumerable: true, get: function () { return source_2.SourceRequestEnvelopeSchema; } });
Object.defineProperty(exports, "SourceResultEnvelopeSchema", { enumerable: true, get: function () { return source_2.SourceResultEnvelopeSchema; } });
Object.defineProperty(exports, "SourceResultValidationSchema", { enumerable: true, get: function () { return source_2.SourceResultValidationSchema; } });
Object.defineProperty(exports, "SourceStorageClassSchema", { enumerable: true, get: function () { return source_2.SourceStorageClassSchema; } });
Object.defineProperty(exports, "connectorCredentialModeValues", { enumerable: true, get: function () { return source_2.connectorCredentialModeValues; } });
Object.defineProperty(exports, "connectorPolicyStateValues", { enumerable: true, get: function () { return source_2.connectorPolicyStateValues; } });
Object.defineProperty(exports, "sourceAccessMethodValues", { enumerable: true, get: function () { return source_2.sourceAccessMethodValues; } });
Object.defineProperty(exports, "sourceClassValues", { enumerable: true, get: function () { return source_2.sourceClassValues; } });
Object.defineProperty(exports, "sourceDataClassificationValues", { enumerable: true, get: function () { return source_2.sourceDataClassificationValues; } });
Object.defineProperty(exports, "sourceOperationValues", { enumerable: true, get: function () { return source_2.sourceOperationValues; } });
Object.defineProperty(exports, "sourceStorageClassValues", { enumerable: true, get: function () { return source_2.sourceStorageClassValues; } });
function isSubset(values, allowed) {
    const allowedSet = new Set(allowed);
    return values.every((value) => allowedSet.has(value));
}
function hardenAdmissionDecision(base, blockedReasons, reviewReasons) {
    const reasonCodes = [...new Set([...base.reasonCodes, ...blockedReasons, ...reviewReasons])].sort();
    const decision = blockedReasons.size > 0
        ? 'blocked'
        : base.decision === 'blocked'
            ? 'blocked'
            : reviewReasons.size > 0 || base.decision === 'review_required'
                ? 'review_required'
                : 'allow';
    return source_1.ConnectorAdmissionDecisionSchema.parse({
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
function evaluateConnectorAdmission(rawInput) {
    const input = source_1.ConnectorAdmissionInputSchema.parse(rawInput);
    const base = (0, source_1.evaluateConnectorAdmission)(input);
    const blockedReasons = new Set();
    const reviewReasons = new Set();
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
    if (pageSize !== undefined &&
        capability.pagination.maxPageSize !== undefined &&
        pageSize > capability.pagination.maxPageSize) {
        blockedReasons.add('source_page_size_exceeds_capability');
    }
    const cursor = request.pagination.cursor;
    if (cursor !== undefined &&
        capability.pagination.maxCursorLength !== undefined &&
        cursor.length > capability.pagination.maxCursorLength) {
        blockedReasons.add('source_cursor_exceeds_capability');
    }
    if (request.requestedDataClassifications.includes('PERSONAL_BUSINESS_CONTACT') &&
        policy.personalData.allowed &&
        request.requestedFields.some((field) => !policy.personalData.allowedFields.includes(field))) {
        reviewReasons.add('source_personal_data_mixed_field_review_required');
    }
    return hardenAdmissionDecision(base, blockedReasons, reviewReasons);
}
function sorted(values) {
    return [...values].sort();
}
function sameStrings(left, right) {
    const a = sorted(left);
    const b = sorted(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
}
/**
 * Validates a normalized adapter result against the frozen request/admission.
 * Provider payloads remain unverified candidates with explicit provenance.
 */
function validateSourceResultAgainstAdmission(input) {
    const result = source_1.SourceResultEnvelopeSchema.parse(input.result);
    const request = source_1.SourceRequestEnvelopeSchema.parse(input.request);
    const capability = source_1.SourceCapabilitySchema.parse(input.capability);
    const base = (0, source_1.validateSourceResultAgainstAdmission)({
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
    const attributionRequired = input.policy.attribution.required || (request.exportRequested && input.policy.export.attributionRequired);
    if (attributionRequired &&
        result.sourceReferences.some((reference) => reference.attribution === undefined || reference.attribution.trim().length === 0)) {
        issues.add('source_result_attribution_missing');
    }
    if (result.nextCursor !== undefined &&
        capability.pagination.maxCursorLength !== undefined &&
        result.nextCursor.length > capability.pagination.maxCursorLength) {
        issues.add('source_result_cursor_exceeds_capability');
    }
    return { valid: issues.size === 0, issues: [...issues].sort() };
}
//# sourceMappingURL=source-adapter.js.map