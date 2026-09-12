import type { ConnectorAdmissionDecision, ConnectorAdmissionInput, ConnectorPolicy, SourceCapability, SourceRequestEnvelope, SourceResultEnvelope, SourceResultValidation } from './source';
export { ConnectorAdmissionDecisionSchema, ConnectorAdmissionInputSchema, ConnectorDefinitionSchema, ConnectorHealthSnapshotSchema, ConnectorPolicySchema, ConnectorPolicyStateSchema, SourceAccessMethodSchema, SourceBudgetSchema, SourceCandidateSchema, SourceCapabilitySchema, SourceClassSchema, SourceDataClassificationSchema, SourceOperationSchema, SourceReferenceSchema, SourceRequestEnvelopeSchema, SourceResultEnvelopeSchema, SourceResultValidationSchema, SourceStorageClassSchema, connectorCredentialModeValues, connectorPolicyStateValues, sourceAccessMethodValues, sourceClassValues, sourceDataClassificationValues, sourceOperationValues, sourceStorageClassValues, } from './source';
export type { ConnectorAdmissionDecision, ConnectorAdmissionInput, ConnectorCredentialMode, ConnectorDefinition, ConnectorHealthSnapshot, ConnectorPolicy, ConnectorPolicyState, SourceAccessMethod, SourceBudget, SourceCandidate, SourceCapability, SourceClass, SourceDataClassification, SourceOperation, SourceReference, SourceRequestEnvelope, SourceResultEnvelope, SourceResultValidation, SourceStorageClass, } from './source';
/**
 * Public M02 admission boundary. The lower-level contract evaluator remains an
 * implementation detail; callers receive this stricter policy/capability gate.
 */
export declare function evaluateConnectorAdmission(rawInput: ConnectorAdmissionInput): ConnectorAdmissionDecision;
/**
 * Validates a normalized adapter result against the frozen request/admission.
 * Provider payloads remain unverified candidates with explicit provenance.
 */
export declare function validateSourceResultAgainstAdmission(input: {
    result: SourceResultEnvelope;
    request: SourceRequestEnvelope;
    capability: SourceCapability;
    policy: ConnectorPolicy;
    admission: ConnectorAdmissionDecision;
}): SourceResultValidation;
