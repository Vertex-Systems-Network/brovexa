"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourceExecutionHandlers = createSourceExecutionHandlers;
const db_1 = require("@brovexa/db");
const errors_1 = require("./errors");
const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const executablePolicyStates = new Set(['APPROVED', 'APPROVED_WITH_LIMITS', 'TRANSIENT_ONLY']);
function assertVersion(value, field) {
    if (!value.trim() || value.length > 64) {
        throw new RangeError(`${field} must be a non-empty version no longer than 64 characters.`);
    }
}
function assertRegistry(options) {
    assertVersion(options.registryVersion, 'Source executor registryVersion');
    if (!Number.isSafeInteger(options.maxHealthAgeSeconds) ||
        options.maxHealthAgeSeconds < 1 ||
        options.maxHealthAgeSeconds > 86_400) {
        throw new RangeError('Source executor maxHealthAgeSeconds must be an integer between 1 and 86400.');
    }
    const entries = Object.entries(options.executors);
    if (entries.length > 128)
        throw new RangeError('Source executor registry supports at most 128 executors.');
    for (const [connectorKey, registration] of entries) {
        if (!connectorKeyPattern.test(connectorKey)) {
            throw new RangeError(`Invalid source executor connector key: ${connectorKey}.`);
        }
        assertVersion(registration.connectorVersion, `${connectorKey}.connectorVersion`);
        assertVersion(registration.implementationVersion, `${connectorKey}.implementationVersion`);
        if (registration.networkAccess !== 'none') {
            throw new RangeError(`${connectorKey} must not request network access in this bounded slice.`);
        }
    }
}
function executionNow(options) {
    const now = options.now?.() ?? new Date();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_CLOCK_INVALID');
    }
    return now;
}
function sameInstant(value, expected) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp === expected.getTime();
}
function readExecutionPayload(context) {
    const payload = context.payload;
    if (context.workType !== db_1.SOURCE_EXECUTION_WORK_TYPE ||
        context.workVersion !== 1 ||
        payload.kind !== 'source_task_execution' ||
        typeof payload.sourceTaskId !== 'string' ||
        typeof payload.researchJobId !== 'string' ||
        typeof payload.preflightId !== 'string' ||
        typeof payload.admissionSnapshotId !== 'string' ||
        !identifierPattern.test(payload.sourceTaskId) ||
        !identifierPattern.test(payload.researchJobId) ||
        !identifierPattern.test(payload.preflightId) ||
        !identifierPattern.test(payload.admissionSnapshotId)) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_PAYLOAD_INVALID');
    }
    return {
        kind: 'source_task_execution',
        sourceTaskId: payload.sourceTaskId,
        researchJobId: payload.researchJobId,
        preflightId: payload.preflightId,
        admissionSnapshotId: payload.admissionSnapshotId,
    };
}
function assertTaskBinding(context, payload, task) {
    if (task.workspaceId !== context.workspaceId ||
        task.sourceTaskId !== payload.sourceTaskId ||
        task.researchJobId !== payload.researchJobId ||
        task.preflightId !== payload.preflightId ||
        task.admissionSnapshotId !== payload.admissionSnapshotId ||
        task.workUnitId !== context.workUnitId ||
        task.jobRunId !== context.jobRunId ||
        task.correlationId !== context.correlationId ||
        task.status !== 'running' ||
        task.attemptCount !== context.attempt) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_TASK_BINDING_MISMATCH');
    }
}
function assertIdentifiers(values, field, options) {
    if ((!options.allowEmpty && values.length === 0) ||
        values.length > options.maxItems ||
        values.some((value) => typeof value !== 'string' || !identifierPattern.test(value)) ||
        new Set(values).size !== values.length) {
        const cardinality = options.allowEmpty ? `at most ${options.maxItems}` : `between 1 and ${options.maxItems}`;
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_PROVENANCE_REQUIRED', `${field} must contain ${cardinality} unique canonical identifiers.`);
    }
    return [...values];
}
function buildCompletionEffect(input) {
    if (!identifierPattern.test(input.resultRef)) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_RESULT_REF_INVALID');
    }
    if (!identifierPattern.test(input.healthSnapshotId)) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_HEALTH_IDENTITY_INVALID');
    }
    const sourceReferenceIds = assertIdentifiers(input.result.sourceReferences.map((reference) => reference.referenceId), 'result.sourceReferences', { allowEmpty: true, maxItems: 2048 });
    const provenanceRefs = assertIdentifiers(input.provenanceRefs, 'provenanceRefs', {
        allowEmpty: false,
        maxItems: 512,
    });
    return {
        effectKey: db_1.SOURCE_EXECUTION_RESULT_EFFECT,
        effectData: {
            kind: 'source_task_result_reference',
            sourceTaskId: input.task.sourceTaskId,
            admissionSnapshotId: input.task.admissionSnapshotId,
            healthSnapshotId: input.healthSnapshotId,
            sourceKey: input.task.sourceKey,
            connectorKey: input.task.connectorKey,
            connectorVersion: input.task.connectorVersion,
            policyId: input.task.policyId,
            policyVersion: input.task.policyVersion,
            sourceReferenceIds,
            provenanceRefs,
            resultRef: input.resultRef,
        },
    };
}
function resultFailure(result) {
    if (result.status === 'blocked')
        return new errors_1.PermanentWorkError('SOURCE_EXECUTION_RESULT_BLOCKED');
    if (result.status !== 'failed')
        return null;
    const permanent = result.errors.find((error) => error.classification === 'permanent' ||
        error.classification === 'policy' ||
        error.classification === 'quota');
    if (permanent)
        return new errors_1.PermanentWorkError(permanent.code, permanent.message);
    const retryable = result.errors.find((error) => error.classification === 'retryable');
    if (retryable)
        return new errors_1.RetryableWorkError(retryable.code, retryable.message);
    return new errors_1.PermanentWorkError('SOURCE_EXECUTION_RESULT_FAILED');
}
function asPermanent(error) {
    return new errors_1.PermanentWorkError(error.code, error.message);
}
function parseFrozenContracts(options, snapshot, registry) {
    try {
        return {
            request: options.contracts.parseRequest(snapshot.request),
            admission: options.contracts.parseAdmission(snapshot.admission),
            capability: options.contracts.parseCapability(registry.capability),
            policy: options.contracts.parsePolicy(registry.policy),
            definition: options.contracts.parseDefinition(registry.definition),
        };
    }
    catch {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_CONTRACT_INVALID');
    }
}
function assertExecutionPolicy(registry, policy, now) {
    if (policy.state !== registry.policyState ||
        !sameInstant(policy.reviewedAt, registry.reviewedAt) ||
        !sameInstant(policy.nextReviewAt, registry.nextReviewAt)) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_POLICY_IDENTITY_MISMATCH');
    }
    if (!executablePolicyStates.has(registry.policyState)) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_POLICY_NOT_EXECUTABLE');
    }
    if (registry.reviewedAt.getTime() > now.getTime()) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_POLICY_CLOCK_INVALID');
    }
    if (registry.nextReviewAt.getTime() <= now.getTime()) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_POLICY_REVIEW_EXPIRED');
    }
}
function assertExecutionHealth(input) {
    const { task, registryDefinitionId, health, now, maxHealthAgeSeconds } = input;
    if (health.connectorDefinitionId !== registryDefinitionId ||
        health.connectorKey !== task.connectorKey ||
        health.connectorVersion !== task.connectorVersion) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_HEALTH_IDENTITY_MISMATCH');
    }
    const ageMs = now.getTime() - health.observedAt.getTime();
    if (ageMs < 0)
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_HEALTH_FROM_FUTURE');
    if (ageMs > maxHealthAgeSeconds * 1000) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_HEALTH_STALE');
    }
    if (health.status === 'rate_limited') {
        throw new errors_1.RetryableWorkError('SOURCE_EXECUTION_HEALTH_RATE_LIMITED');
    }
    if (health.status === 'circuit_open') {
        throw new errors_1.RetryableWorkError('SOURCE_EXECUTION_HEALTH_CIRCUIT_OPEN');
    }
    if (health.status === 'disabled' || health.status === 'unknown') {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_HEALTH_NOT_EXECUTABLE');
    }
    const remainingRequests = task.effectiveBudget.maxRequests - task.consumed.requests;
    if (!Number.isSafeInteger(remainingRequests) || remainingRequests <= 0) {
        throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_REQUEST_BUDGET_EXHAUSTED');
    }
    if (health.quotaRemaining !== null && health.quotaRemaining < remainingRequests) {
        throw new errors_1.RetryableWorkError('SOURCE_EXECUTION_HEALTH_QUOTA_INSUFFICIENT');
    }
}
function buildSourceExecutionHandler(options) {
    return async (workContext) => {
        try {
            const payload = readExecutionPayload(workContext);
            const task = await (0, db_1.getSourceTaskState)(options.pool, workContext.workspaceId, payload.sourceTaskId);
            if (!task)
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_TASK_NOT_FOUND');
            assertTaskBinding(workContext, payload, task);
            const snapshot = await (0, db_1.getSourceAdmissionSnapshot)(options.pool, workContext.workspaceId, payload.admissionSnapshotId);
            if (!snapshot)
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_ADMISSION_NOT_FOUND');
            if (snapshot.decision !== 'allow')
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_ADMISSION_NOT_ALLOWED');
            if (snapshot.sourceTaskId !== task.sourceTaskId ||
                snapshot.requestId !== task.requestId ||
                snapshot.sourceKey !== task.sourceKey ||
                snapshot.capabilityVersion !== task.capabilityVersion ||
                snapshot.connectorKey !== task.connectorKey ||
                snapshot.connectorVersion !== task.connectorVersion ||
                snapshot.policyId !== task.policyId ||
                snapshot.policyVersion !== task.policyVersion) {
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_ADMISSION_IDENTITY_MISMATCH');
            }
            const registry = await (0, db_1.resolveConnectorRegistryEntry)(options.pool, {
                connectorKey: task.connectorKey,
                connectorVersion: task.connectorVersion,
            });
            if (!registry)
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_REGISTRY_NOT_FOUND');
            if (registry.sourceKey !== task.sourceKey ||
                registry.capabilityVersion !== task.capabilityVersion ||
                registry.policyId !== task.policyId ||
                registry.policyVersion !== task.policyVersion ||
                registry.status !== 'approved' ||
                registry.activation !== 'enabled') {
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_REGISTRY_IDENTITY_MISMATCH');
            }
            if (registry.credentialMode !== 'none') {
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_CREDENTIAL_MODE_UNSUPPORTED');
            }
            const { request, admission, capability, policy, definition } = parseFrozenContracts(options, snapshot, registry);
            if (request.executionIntent !== 'execute' ||
                request.workspaceId !== workContext.workspaceId ||
                request.sourceTaskId !== task.sourceTaskId ||
                request.requestId !== task.requestId ||
                request.sourceKey !== task.sourceKey ||
                request.connectorKey !== task.connectorKey ||
                request.connectorVersion !== task.connectorVersion ||
                request.policySnapshot.policyId !== task.policyId ||
                request.policySnapshot.policyVersion !== task.policyVersion ||
                capability.sourceKey !== task.sourceKey ||
                capability.version !== task.capabilityVersion ||
                policy.policyId !== task.policyId ||
                policy.version !== task.policyVersion ||
                policy.sourceKey !== task.sourceKey ||
                policy.connectorKey !== task.connectorKey ||
                definition.connectorKey !== task.connectorKey ||
                definition.version !== task.connectorVersion ||
                definition.sourceKey !== task.sourceKey ||
                definition.capabilityVersion !== task.capabilityVersion ||
                definition.policyId !== task.policyId ||
                definition.policyVersion !== task.policyVersion ||
                admission.decision !== 'allow') {
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_FROZEN_ADMISSION_MISMATCH');
            }
            const now = executionNow(options);
            assertExecutionPolicy(registry, policy, now);
            const health = await (0, db_1.getLatestConnectorHealthSnapshot)(options.pool, {
                connectorKey: task.connectorKey,
                connectorVersion: task.connectorVersion,
            });
            if (!health)
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_HEALTH_MISSING');
            assertExecutionHealth({
                task,
                registryDefinitionId: registry.connectorDefinitionId,
                health,
                now,
                maxHealthAgeSeconds: options.maxHealthAgeSeconds,
            });
            const registration = options.executors[task.connectorKey];
            if (!registration)
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_EXECUTOR_UNAVAILABLE');
            if (registration.connectorVersion !== task.connectorVersion ||
                registration.implementationVersion !== definition.implementationVersion ||
                registration.networkAccess !== 'none') {
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_EXECUTOR_VERSION_MISMATCH');
            }
            if (await workContext.isCancellationRequested())
                throw new errors_1.CancelledWorkError();
            const outcome = await registration.execute({
                workspaceId: workContext.workspaceId,
                sourceTaskId: task.sourceTaskId,
                researchJobId: task.researchJobId,
                workUnitId: workContext.workUnitId,
                jobRunId: workContext.jobRunId,
                correlationId: workContext.correlationId,
                attempt: workContext.attempt,
                request,
                admission,
                capability,
                policy,
                definition,
                health,
                isCancellationRequested: workContext.isCancellationRequested,
            });
            let result;
            try {
                result = options.contracts.parseResult(outcome.result);
            }
            catch {
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_RESULT_SCHEMA_INVALID');
            }
            const validation = options.contracts.validateResult({ result, request, capability, policy, admission });
            if (!validation.valid) {
                throw new errors_1.PermanentWorkError('SOURCE_EXECUTION_RESULT_CONTRACT_INVALID', `Source result violates frozen admission: ${validation.issues.join(',')}.`);
            }
            await (0, db_1.recordSourceTaskUsage)(options.pool, {
                eventId: `source-usage-${workContext.workUnitId}-${workContext.attempt}`,
                workspaceId: workContext.workspaceId,
                sourceTaskId: task.sourceTaskId,
                usage: result.usage,
                metadata: {
                    registryVersion: options.registryVersion,
                    connectorKey: task.connectorKey,
                    connectorVersion: task.connectorVersion,
                    healthSnapshotId: health.id,
                    resultStatus: result.status,
                },
                occurredAt: new Date(result.completedAt),
            });
            const failure = resultFailure(result);
            if (failure)
                throw failure;
            if (await workContext.isCancellationRequested())
                throw new errors_1.CancelledWorkError();
            return buildCompletionEffect({
                task,
                healthSnapshotId: health.id,
                result,
                resultRef: outcome.resultRef,
                provenanceRefs: outcome.provenanceRefs,
            });
        }
        catch (error) {
            if (error instanceof errors_1.RetryableWorkError || error instanceof errors_1.PermanentWorkError || error instanceof errors_1.CancelledWorkError) {
                throw error;
            }
            if (error instanceof db_1.SourceTaskPersistenceError ||
                error instanceof db_1.SourceRegistryPersistenceError ||
                error instanceof db_1.ConnectorHealthPersistenceError) {
                throw asPermanent(error);
            }
            throw new errors_1.PermanentWorkError('UNCLASSIFIED_SOURCE_EXECUTION_ERROR');
        }
    };
}
function createSourceExecutionHandlers(options) {
    assertRegistry(options);
    return { [db_1.SOURCE_EXECUTION_WORK_TYPE]: buildSourceExecutionHandler(options) };
}
//# sourceMappingURL=source-execution-runtime.js.map