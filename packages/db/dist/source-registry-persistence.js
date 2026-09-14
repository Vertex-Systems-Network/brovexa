"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceRegistryPersistenceError = void 0;
exports.persistSourceCapability = persistSourceCapability;
exports.persistConnectorPolicy = persistConnectorPolicy;
exports.persistConnectorDefinition = persistConnectorDefinition;
exports.resolveConnectorRegistryEntry = resolveConnectorRegistryEntry;
exports.persistSourceAdmissionSnapshot = persistSourceAdmissionSnapshot;
exports.getSourceAdmissionSnapshot = getSourceAdmissionSnapshot;
const sourceKeyPattern = /^source\.[a-z0-9_.-]+$/;
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
class SourceRegistryPersistenceError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'SourceRegistryPersistenceError';
        this.code = code;
    }
}
exports.SourceRegistryPersistenceError = SourceRegistryPersistenceError;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function assertIdentifier(value, field, pattern = identifierPattern) {
    if (typeof value !== 'string' || !pattern.test(value)) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', `${field} must use the canonical identifier format.`);
    }
}
function assertVersion(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', `${field} must be a non-empty version no longer than 64 characters.`);
    }
}
function assertDate(value, field) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', `${field} must be a valid Date.`);
    }
}
function assertEnvelopeIdentity(envelope, expected, label) {
    for (const [field, value] of Object.entries(expected)) {
        if (envelope[field] !== value) {
            throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', `${label}.${field} must match the persisted registry identity.`);
        }
    }
}
function readStringArray(value, field, maxItems = 512) {
    if (!Array.isArray(value) ||
        value.length > maxItems ||
        value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0 || entry.length > 512)) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', `${field} must be a bounded string array.`);
    }
    const values = value.map((entry) => entry.trim());
    if (new Set(values).size !== values.length) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', `${field} must not contain duplicates.`);
    }
    return values;
}
function parseAdmissionDecision(admission) {
    const decision = admission.decision;
    if (decision !== 'allow' && decision !== 'review_required' && decision !== 'blocked') {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', 'admission.decision is not a supported source-admission decision.');
    }
    return {
        decision,
        reasonCodes: readStringArray(admission.reasonCodes, 'admission.reasonCodes', 128),
        warnings: readStringArray(admission.warnings, 'admission.warnings', 128),
    };
}
function requestContainsAuthSecret(request) {
    const classifications = request.requestedDataClassifications;
    return Array.isArray(classifications) && classifications.includes('AUTH_SECRET');
}
async function persistSourceCapability(pool, input) {
    assertIdentifier(input.sourceKey, 'sourceKey', sourceKeyPattern);
    assertVersion(input.version, 'version');
    if (!isRecord(input.capability)) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', 'capability must be an object.');
    }
    assertEnvelopeIdentity(input.capability, { sourceKey: input.sourceKey, version: input.version, sourceClass: input.sourceClass }, 'capability');
    const inserted = await pool.query(`INSERT INTO source_capabilities (source_key, version, source_class, envelope)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (source_key, version) DO NOTHING
     RETURNING id`, [input.sourceKey, input.version, input.sourceClass, JSON.stringify(input.capability)]);
    const insertedId = inserted.rows[0]?.id;
    if (insertedId)
        return insertedId;
    const existing = await pool.query(`SELECT id, source_class = $3 AND envelope = $4::jsonb AS same_capability
     FROM source_capabilities
     WHERE source_key = $1 AND version = $2`, [input.sourceKey, input.version, input.sourceClass, JSON.stringify(input.capability)]);
    const row = existing.rows[0];
    if (!row)
        throw new Error('Source capability disappeared during idempotent persistence check.');
    if (!row.same_capability) {
        throw new SourceRegistryPersistenceError('SOURCE_CAPABILITY_VERSION_CONFLICT', `Source capability ${input.sourceKey}@${input.version} already exists with different content.`);
    }
    return row.id;
}
async function persistConnectorPolicy(pool, input) {
    assertIdentifier(input.policyId, 'policyId');
    assertVersion(input.version, 'version');
    assertIdentifier(input.sourceKey, 'sourceKey', sourceKeyPattern);
    assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
    assertDate(input.reviewedAt, 'reviewedAt');
    assertDate(input.nextReviewAt, 'nextReviewAt');
    if (input.nextReviewAt.getTime() <= input.reviewedAt.getTime()) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', 'nextReviewAt must be after reviewedAt.');
    }
    if (!isRecord(input.policy)) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', 'policy must be an object.');
    }
    assertEnvelopeIdentity(input.policy, {
        policyId: input.policyId,
        version: input.version,
        sourceKey: input.sourceKey,
        connectorKey: input.connectorKey,
        state: input.state,
        accessMethod: input.accessMethod,
    }, 'policy');
    const inserted = await pool.query(`INSERT INTO connector_policies (
       policy_id, version, source_key, connector_key, state, access_method,
       reviewed_at, next_review_at, envelope
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (policy_id, version) DO NOTHING
     RETURNING id`, [
        input.policyId,
        input.version,
        input.sourceKey,
        input.connectorKey,
        input.state,
        input.accessMethod,
        input.reviewedAt,
        input.nextReviewAt,
        JSON.stringify(input.policy),
    ]);
    const insertedId = inserted.rows[0]?.id;
    if (insertedId)
        return insertedId;
    const existing = await pool.query(`SELECT
       id,
       source_key = $3
         AND connector_key = $4
         AND state = $5
         AND access_method = $6
         AND reviewed_at = $7::timestamptz
         AND next_review_at = $8::timestamptz
         AND envelope = $9::jsonb AS same_policy
     FROM connector_policies
     WHERE policy_id = $1 AND version = $2`, [
        input.policyId,
        input.version,
        input.sourceKey,
        input.connectorKey,
        input.state,
        input.accessMethod,
        input.reviewedAt,
        input.nextReviewAt,
        JSON.stringify(input.policy),
    ]);
    const row = existing.rows[0];
    if (!row)
        throw new Error('Connector policy disappeared during idempotent persistence check.');
    if (!row.same_policy) {
        throw new SourceRegistryPersistenceError('CONNECTOR_POLICY_VERSION_CONFLICT', `Connector policy ${input.policyId}@${input.version} already exists with different content.`);
    }
    return row.id;
}
async function persistConnectorDefinition(pool, input) {
    assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
    assertVersion(input.version, 'version');
    assertIdentifier(input.sourceKey, 'sourceKey', sourceKeyPattern);
    assertVersion(input.capabilityVersion, 'capabilityVersion');
    assertIdentifier(input.policyId, 'policyId');
    assertVersion(input.policyVersion, 'policyVersion');
    assertVersion(input.implementationVersion, 'implementationVersion');
    if (!isRecord(input.definition)) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', 'definition must be an object.');
    }
    assertEnvelopeIdentity(input.definition, {
        connectorKey: input.connectorKey,
        version: input.version,
        sourceKey: input.sourceKey,
        capabilityVersion: input.capabilityVersion,
        policyId: input.policyId,
        policyVersion: input.policyVersion,
        accessMethod: input.accessMethod,
        credentialMode: input.credentialMode,
        status: input.status,
        activation: input.activation,
        implementationVersion: input.implementationVersion,
    }, 'definition');
    const capability = await pool.query(`SELECT id, envelope FROM source_capabilities WHERE source_key = $1 AND version = $2`, [input.sourceKey, input.capabilityVersion]);
    const capabilityRow = capability.rows[0];
    if (!capabilityRow) {
        throw new SourceRegistryPersistenceError('CONNECTOR_CAPABILITY_NOT_FOUND', `Source capability ${input.sourceKey}@${input.capabilityVersion} is not registered.`);
    }
    const accessMethods = readStringArray(capabilityRow.envelope.accessMethods, 'capability.accessMethods', 32);
    if (!accessMethods.includes(input.accessMethod)) {
        throw new SourceRegistryPersistenceError('CONNECTOR_REGISTRY_IDENTITY_CONFLICT', `Connector ${input.connectorKey}@${input.version} uses an access method outside its SourceCapability.`);
    }
    const policy = await pool.query(`SELECT id, access_method
     FROM connector_policies
     WHERE policy_id = $1 AND version = $2 AND source_key = $3 AND connector_key = $4`, [input.policyId, input.policyVersion, input.sourceKey, input.connectorKey]);
    const policyRow = policy.rows[0];
    if (!policyRow) {
        throw new SourceRegistryPersistenceError('CONNECTOR_POLICY_NOT_FOUND', `Connector policy ${input.policyId}@${input.policyVersion} is not registered for ${input.connectorKey}.`);
    }
    if (policyRow.access_method !== input.accessMethod) {
        throw new SourceRegistryPersistenceError('CONNECTOR_REGISTRY_IDENTITY_CONFLICT', `Connector ${input.connectorKey}@${input.version} access method does not match its ConnectorPolicy.`);
    }
    const inserted = await pool.query(`INSERT INTO connector_definitions (
       connector_key, version, source_key, capability_version, policy_id, policy_version,
       access_method, credential_mode, status, activation, implementation_version, envelope
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     ON CONFLICT (connector_key, version) DO NOTHING
     RETURNING id`, [
        input.connectorKey,
        input.version,
        input.sourceKey,
        input.capabilityVersion,
        input.policyId,
        input.policyVersion,
        input.accessMethod,
        input.credentialMode,
        input.status,
        input.activation,
        input.implementationVersion,
        JSON.stringify(input.definition),
    ]);
    const insertedId = inserted.rows[0]?.id;
    if (insertedId)
        return insertedId;
    const existing = await pool.query(`SELECT
       id,
       source_key = $3
         AND capability_version = $4
         AND policy_id = $5
         AND policy_version = $6
         AND access_method = $7
         AND credential_mode = $8
         AND status = $9
         AND activation = $10
         AND implementation_version = $11
         AND envelope = $12::jsonb AS same_definition
     FROM connector_definitions
     WHERE connector_key = $1 AND version = $2`, [
        input.connectorKey,
        input.version,
        input.sourceKey,
        input.capabilityVersion,
        input.policyId,
        input.policyVersion,
        input.accessMethod,
        input.credentialMode,
        input.status,
        input.activation,
        input.implementationVersion,
        JSON.stringify(input.definition),
    ]);
    const row = existing.rows[0];
    if (!row)
        throw new Error('Connector definition disappeared during idempotent persistence check.');
    if (!row.same_definition) {
        throw new SourceRegistryPersistenceError('CONNECTOR_DEFINITION_VERSION_CONFLICT', `Connector definition ${input.connectorKey}@${input.version} already exists with different content.`);
    }
    return row.id;
}
async function resolveConnectorRegistryEntry(pool, input) {
    assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
    assertVersion(input.connectorVersion, 'connectorVersion');
    const result = await pool.query(`SELECT
       definition.id AS connector_definition_id,
       capability.id AS source_capability_id,
       policy.id AS connector_policy_db_id,
       definition.connector_key,
       definition.version AS connector_version,
       definition.source_key,
       definition.capability_version,
       definition.policy_id,
       definition.policy_version,
       definition.status,
       definition.activation,
       policy.state AS policy_state,
       definition.access_method,
       definition.credential_mode,
       capability.envelope AS capability,
       policy.envelope AS policy,
       definition.envelope AS definition,
       policy.reviewed_at,
       policy.next_review_at
     FROM connector_definitions AS definition
     INNER JOIN source_capabilities AS capability
       ON capability.source_key = definition.source_key
      AND capability.version = definition.capability_version
     INNER JOIN connector_policies AS policy
       ON policy.policy_id = definition.policy_id
      AND policy.version = definition.policy_version
      AND policy.source_key = definition.source_key
      AND policy.connector_key = definition.connector_key
     WHERE definition.connector_key = $1 AND definition.version = $2
     LIMIT 1`, [input.connectorKey, input.connectorVersion]);
    const row = result.rows[0];
    if (!row)
        return null;
    return {
        connectorDefinitionId: row.connector_definition_id,
        sourceCapabilityId: row.source_capability_id,
        connectorPolicyDbId: row.connector_policy_db_id,
        connectorKey: row.connector_key,
        connectorVersion: row.connector_version,
        sourceKey: row.source_key,
        capabilityVersion: row.capability_version,
        policyId: row.policy_id,
        policyVersion: row.policy_version,
        status: row.status,
        activation: row.activation,
        policyState: row.policy_state,
        accessMethod: row.access_method,
        credentialMode: row.credential_mode,
        capability: row.capability,
        policy: row.policy,
        definition: row.definition,
        reviewedAt: row.reviewed_at,
        nextReviewAt: row.next_review_at,
    };
}
async function persistSourceAdmissionSnapshot(pool, input) {
    assertIdentifier(input.id, 'id');
    assertIdentifier(input.workspaceId, 'workspaceId');
    assertIdentifier(input.sourceTaskId, 'sourceTaskId');
    assertIdentifier(input.requestId, 'requestId');
    assertIdentifier(input.connectorKey, 'connectorKey', connectorKeyPattern);
    assertVersion(input.connectorVersion, 'connectorVersion');
    assertDate(input.evaluatedAt, 'evaluatedAt');
    if (!isRecord(input.request) || !isRecord(input.admission)) {
        throw new SourceRegistryPersistenceError('SOURCE_REGISTRY_INPUT_INVALID', 'request and admission snapshots must be objects.');
    }
    if (requestContainsAuthSecret(input.request)) {
        throw new SourceRegistryPersistenceError('SOURCE_ADMISSION_AUTH_SECRET_FORBIDDEN', 'Source admission snapshots cannot include AUTH_SECRET requests.');
    }
    const registry = await resolveConnectorRegistryEntry(pool, {
        connectorKey: input.connectorKey,
        connectorVersion: input.connectorVersion,
    });
    if (!registry) {
        throw new SourceRegistryPersistenceError('SOURCE_ADMISSION_REGISTRY_NOT_FOUND', `Connector ${input.connectorKey}@${input.connectorVersion} is not registered.`);
    }
    const policySnapshot = isRecord(input.request.policySnapshot) ? input.request.policySnapshot : null;
    const admissionPolicySnapshot = isRecord(input.admission.policySnapshot) ? input.admission.policySnapshot : null;
    const parsedAdmission = parseAdmissionDecision(input.admission);
    const evaluatedAtIso = input.evaluatedAt.toISOString();
    if (typeof input.request.operation !== 'string' ||
        input.request.operation.trim().length === 0 ||
        typeof input.request.storageClass !== 'string' ||
        input.request.storageClass.trim().length === 0 ||
        input.request.requestId !== input.requestId ||
        input.request.workspaceId !== input.workspaceId ||
        input.request.sourceTaskId !== input.sourceTaskId ||
        input.request.sourceKey !== registry.sourceKey ||
        input.request.connectorKey !== registry.connectorKey ||
        input.request.connectorVersion !== registry.connectorVersion ||
        policySnapshot?.policyId !== registry.policyId ||
        policySnapshot?.policyVersion !== registry.policyVersion ||
        input.admission.sourceKey !== registry.sourceKey ||
        input.admission.connectorKey !== registry.connectorKey ||
        input.admission.connectorVersion !== registry.connectorVersion ||
        admissionPolicySnapshot?.policyId !== registry.policyId ||
        admissionPolicySnapshot?.policyVersion !== registry.policyVersion ||
        input.admission.operation !== input.request.operation ||
        input.admission.storageClass !== input.request.storageClass ||
        input.admission.evaluatedAt !== evaluatedAtIso) {
        throw new SourceRegistryPersistenceError('SOURCE_ADMISSION_IDENTITY_MISMATCH', `Source admission snapshot ${input.id} does not match its exact registry/request identity.`);
    }
    const inserted = await pool.query(`INSERT INTO source_admission_snapshots (
       id, workspace_id, source_task_id, request_id,
       source_capability_id, connector_policy_db_id, connector_definition_id,
       source_key, capability_version, connector_key, connector_version,
       policy_id, policy_version, decision, reason_codes, warnings,
       request, admission, evaluated_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       $8, $9, $10, $11,
       $12, $13, $14, $15::jsonb, $16::jsonb,
       $17::jsonb, $18::jsonb, $19
     )
     ON CONFLICT (id) DO NOTHING
     RETURNING id`, [
        input.id,
        input.workspaceId,
        input.sourceTaskId,
        input.requestId,
        registry.sourceCapabilityId,
        registry.connectorPolicyDbId,
        registry.connectorDefinitionId,
        registry.sourceKey,
        registry.capabilityVersion,
        registry.connectorKey,
        registry.connectorVersion,
        registry.policyId,
        registry.policyVersion,
        parsedAdmission.decision,
        JSON.stringify(parsedAdmission.reasonCodes),
        JSON.stringify(parsedAdmission.warnings),
        JSON.stringify(input.request),
        JSON.stringify(input.admission),
        input.evaluatedAt,
    ]);
    if (inserted.rows[0]?.id)
        return input.id;
    const existing = await pool.query(`SELECT
       workspace_id = $2::uuid
         AND source_task_id = $3
         AND request_id = $4
         AND source_capability_id = $5::uuid
         AND connector_policy_db_id = $6::uuid
         AND connector_definition_id = $7::uuid
         AND source_key = $8
         AND capability_version = $9
         AND connector_key = $10
         AND connector_version = $11
         AND policy_id = $12
         AND policy_version = $13
         AND decision = $14
         AND reason_codes = $15::jsonb
         AND warnings = $16::jsonb
         AND request = $17::jsonb
         AND admission = $18::jsonb
         AND evaluated_at = $19::timestamptz AS same_snapshot
     FROM source_admission_snapshots
     WHERE id = $1`, [
        input.id,
        input.workspaceId,
        input.sourceTaskId,
        input.requestId,
        registry.sourceCapabilityId,
        registry.connectorPolicyDbId,
        registry.connectorDefinitionId,
        registry.sourceKey,
        registry.capabilityVersion,
        registry.connectorKey,
        registry.connectorVersion,
        registry.policyId,
        registry.policyVersion,
        parsedAdmission.decision,
        JSON.stringify(parsedAdmission.reasonCodes),
        JSON.stringify(parsedAdmission.warnings),
        JSON.stringify(input.request),
        JSON.stringify(input.admission),
        input.evaluatedAt,
    ]);
    if (!existing.rows[0]?.same_snapshot) {
        throw new SourceRegistryPersistenceError('SOURCE_ADMISSION_ID_CONFLICT', `Source admission snapshot ${input.id} already exists with different content or tenant scope.`);
    }
    return input.id;
}
async function getSourceAdmissionSnapshot(pool, workspaceId, snapshotId) {
    assertIdentifier(workspaceId, 'workspaceId');
    assertIdentifier(snapshotId, 'snapshotId');
    const result = await pool.query(`SELECT
       id, workspace_id, source_task_id, request_id, source_key, capability_version,
       connector_key, connector_version, policy_id, policy_version, decision,
       reason_codes, warnings, request, admission, evaluated_at
     FROM source_admission_snapshots
     WHERE workspace_id = $1 AND id = $2
     LIMIT 1`, [workspaceId, snapshotId]);
    const row = result.rows[0];
    if (!row)
        return null;
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        sourceTaskId: row.source_task_id,
        requestId: row.request_id,
        sourceKey: row.source_key,
        capabilityVersion: row.capability_version,
        connectorKey: row.connector_key,
        connectorVersion: row.connector_version,
        policyId: row.policy_id,
        policyVersion: row.policy_version,
        decision: row.decision,
        reasonCodes: row.reason_codes,
        warnings: row.warnings,
        request: row.request,
        admission: row.admission,
        evaluatedAt: row.evaluated_at,
    };
}
//# sourceMappingURL=source-registry-persistence.js.map