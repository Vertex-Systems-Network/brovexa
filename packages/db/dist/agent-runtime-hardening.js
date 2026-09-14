"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRuntimeHardeningError = void 0;
exports.resolveAgentExecutionRoute = resolveAgentExecutionRoute;
exports.getAgentExecutionTrace = getAgentExecutionTrace;
const agent_context_runtime_1 = require("./agent-context-runtime");
const identity_1 = require("./identity");
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const maxTraceWorkUnits = 64;
const maxTraceEffects = 1024;
const maxTraceCheckpoints = 512;
const maxTraceAgentRuns = 256;
const maxTraceTransitions = 2048;
const maxTraceEvaluations = 256;
class AgentRuntimeHardeningError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'AgentRuntimeHardeningError';
        this.code = code;
    }
}
exports.AgentRuntimeHardeningError = AgentRuntimeHardeningError;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function assertIdentifier(value, field, code) {
    if (typeof value !== 'string' || !identifierPattern.test(value)) {
        throw new AgentRuntimeHardeningError(code, `${field} must use the canonical identifier format.`);
    }
}
function readUniqueIdentifiers(value, maxItems) {
    if (!Array.isArray(value) || value.length > maxItems)
        return null;
    const result = [];
    for (const item of value) {
        if (typeof item !== 'string' || !identifierPattern.test(item))
            return null;
        if (!result.includes(item))
            result.push(item);
    }
    return result;
}
function parseModelPolicy(definition) {
    const policy = isRecord(definition.specification.modelPolicy)
        ? definition.specification.modelPolicy
        : null;
    if (!policy || (policy.routingMode !== 'deterministic_only' && policy.routingMode !== 'approved_models')) {
        throw new AgentRuntimeHardeningError('AGENT_ROUTE_POLICY_INVALID', `Agent definition ${definition.agentKey}@${definition.version} has an invalid model policy.`);
    }
    const allowedProviderIds = readUniqueIdentifiers(policy.allowedProviderIds, 32);
    const allowedModelIds = readUniqueIdentifiers(policy.allowedModelIds, 64);
    const fallbackModelIds = readUniqueIdentifiers(policy.fallbackModelIds, 16);
    if (!allowedProviderIds || !allowedModelIds || !fallbackModelIds) {
        throw new AgentRuntimeHardeningError('AGENT_ROUTE_POLICY_INVALID', `Agent definition ${definition.agentKey}@${definition.version} has invalid route allowlists.`);
    }
    if (policy.routingMode === 'deterministic_only' &&
        (allowedProviderIds.length > 0 || allowedModelIds.length > 0 || fallbackModelIds.length > 0)) {
        throw new AgentRuntimeHardeningError('AGENT_ROUTE_POLICY_INVALID', `Deterministic-only definition ${definition.agentKey}@${definition.version} cannot declare model routes.`);
    }
    if (policy.routingMode === 'approved_models' &&
        (allowedProviderIds.length === 0 || allowedModelIds.length === 0)) {
        throw new AgentRuntimeHardeningError('AGENT_ROUTE_POLICY_INVALID', `Model-routed definition ${definition.agentKey}@${definition.version} requires provider and model allowlists.`);
    }
    return {
        routingMode: policy.routingMode,
        allowedProviderIds,
        allowedModelIds,
        fallbackModelIds,
    };
}
function iso(value) {
    return value ? value.toISOString() : null;
}
function requireBoundedCount(count, limit, label) {
    if (count > limit) {
        throw new AgentRuntimeHardeningError('AGENT_TRACE_LIMIT_EXCEEDED', `${label} exceeded the bounded trace limit of ${limit}.`);
    }
}
function readStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}
async function resolveAgentExecutionRoute(pool, input) {
    assertIdentifier(input.agentKey, 'agentKey', 'AGENT_ROUTE_INPUT_INVALID');
    assertIdentifier(input.agentVersion, 'agentVersion', 'AGENT_ROUTE_INPUT_INVALID');
    if (input.providerId !== undefined) {
        assertIdentifier(input.providerId, 'providerId', 'AGENT_ROUTE_INPUT_INVALID');
    }
    if (input.modelId !== undefined) {
        assertIdentifier(input.modelId, 'modelId', 'AGENT_ROUTE_INPUT_INVALID');
    }
    const definition = await (0, agent_context_runtime_1.resolveApprovedAgentDefinition)(pool, {
        agentKey: input.agentKey,
        version: input.agentVersion,
    });
    const policy = parseModelPolicy(definition);
    if (policy.routingMode === 'deterministic_only') {
        if (input.providerId !== undefined || input.modelId !== undefined) {
            throw new AgentRuntimeHardeningError('AGENT_ROUTE_DETERMINISTIC_PROVIDER_FORBIDDEN', `Deterministic-only definition ${definition.agentKey}@${definition.version} cannot use provider/model execution.`);
        }
        return {
            definitionId: definition.id,
            agentKey: definition.agentKey,
            agentVersion: definition.version,
            routingMode: policy.routingMode,
            executionMode: 'deterministic',
            providerId: null,
            modelId: null,
            fallbackUsed: false,
            allowedProviderIds: policy.allowedProviderIds,
            allowedModelIds: policy.allowedModelIds,
            fallbackModelIds: policy.fallbackModelIds,
        };
    }
    if (!input.providerId || !input.modelId) {
        throw new AgentRuntimeHardeningError('AGENT_ROUTE_SELECTION_REQUIRED', `Model-routed definition ${definition.agentKey}@${definition.version} requires an explicit providerId and modelId.`);
    }
    if (!policy.allowedProviderIds.includes(input.providerId)) {
        throw new AgentRuntimeHardeningError('AGENT_ROUTE_PROVIDER_NOT_APPROVED', `Provider ${input.providerId} is not approved for ${definition.agentKey}@${definition.version}.`);
    }
    let fallbackUsed = false;
    if (!policy.allowedModelIds.includes(input.modelId)) {
        if (!policy.fallbackModelIds.includes(input.modelId)) {
            throw new AgentRuntimeHardeningError('AGENT_ROUTE_MODEL_NOT_APPROVED', `Model ${input.modelId} is not approved for ${definition.agentKey}@${definition.version}.`);
        }
        if (input.allowFallback !== true) {
            throw new AgentRuntimeHardeningError('AGENT_ROUTE_FALLBACK_NOT_ENABLED', `Fallback model ${input.modelId} requires explicit allowFallback=true.`);
        }
        fallbackUsed = true;
    }
    return {
        definitionId: definition.id,
        agentKey: definition.agentKey,
        agentVersion: definition.version,
        routingMode: policy.routingMode,
        executionMode: 'model',
        providerId: input.providerId,
        modelId: input.modelId,
        fallbackUsed,
        allowedProviderIds: policy.allowedProviderIds,
        allowedModelIds: policy.allowedModelIds,
        fallbackModelIds: policy.fallbackModelIds,
    };
}
async function getAgentExecutionTrace(pool, input) {
    assertIdentifier(input.workspaceId, 'workspaceId', 'AGENT_TRACE_INPUT_INVALID');
    assertIdentifier(input.userId, 'userId', 'AGENT_TRACE_INPUT_INVALID');
    assertIdentifier(input.dispatchId, 'dispatchId', 'AGENT_TRACE_INPUT_INVALID');
    const authorization = await (0, identity_1.resolveWorkspaceAuthorization)(pool, {
        workspaceId: input.workspaceId,
        userId: input.userId,
    });
    (0, identity_1.assertWorkspaceCapability)(authorization, 'workspace.read');
    const projection = await pool.query(`SELECT DISTINCT
       job.id AS job_run_id,
       job.job_type,
       job.job_version,
       job.correlation_id,
       job.status AS job_status,
       job.started_at AS job_started_at,
       job.completed_at AS job_completed_at,
       job.created_at AS job_created_at,
       job.updated_at AS job_updated_at,
       plan.id AS plan_id,
       plan.user_id AS plan_user_id,
       plan.run_id AS plan_run_id,
       plan.context_receipt_id AS plan_context_receipt_id,
       plan.orchestrator_definition_id,
       plan.orchestrator_key,
       plan.orchestrator_version,
       plan.plan_version,
       plan.max_parallelism,
       plan.step_count,
       plan.envelope AS plan_envelope,
       plan.created_at AS plan_created_at,
       work.payload->>'orchestratorRunId' AS payload_orchestrator_run_id
     FROM job_work_units AS work
     INNER JOIN job_runs AS job ON job.id = work.job_run_id
     INNER JOIN agent_execution_plans AS plan
       ON plan.workspace_id = work.workspace_id
      AND plan.id = work.payload->>'planId'
     WHERE work.workspace_id = $1
       AND work.payload->>'dispatchId' = $2`, [input.workspaceId, input.dispatchId]);
    if (projection.rows.length === 0)
        return null;
    if (projection.rows.length !== 1) {
        throw new AgentRuntimeHardeningError('AGENT_TRACE_PROJECTION_CONFLICT', `Dispatch ${input.dispatchId} maps to multiple execution projections.`);
    }
    const root = projection.rows[0];
    if (!root || root.payload_orchestrator_run_id !== root.plan_run_id) {
        throw new AgentRuntimeHardeningError('AGENT_TRACE_PROJECTION_CONFLICT', `Dispatch ${input.dispatchId} does not match its orchestrator execution plan.`);
    }
    const workResult = await pool.query(`SELECT
       id, queue_name, work_type, work_version, correlation_id, status,
       attempt_count, max_attempts, next_attempt_at, cancellation_requested_at,
       worker_id, lease_expires_at, last_error_code, last_error_class, payload,
       started_at, completed_at, created_at, updated_at
     FROM job_work_units
     WHERE workspace_id = $1
       AND job_run_id = $2
       AND payload->>'dispatchId' = $3
     ORDER BY COALESCE(payload->>'stepKey', ''), id
     LIMIT $4`, [input.workspaceId, root.job_run_id, input.dispatchId, maxTraceWorkUnits + 1]);
    requireBoundedCount(workResult.rows.length, maxTraceWorkUnits, 'WorkUnit trace');
    if (workResult.rows.length !== root.step_count) {
        throw new AgentRuntimeHardeningError('AGENT_TRACE_PROJECTION_CONFLICT', `Dispatch ${input.dispatchId} WorkUnit count does not match its immutable plan.`);
    }
    const workUnitIds = workResult.rows.map((row) => row.id);
    const effectRows = workUnitIds.length
        ? await pool.query(`SELECT id, work_unit_id, effect_key, data, created_at
         FROM job_effects
         WHERE work_unit_id = ANY($1::uuid[])
         ORDER BY work_unit_id, effect_key, id
         LIMIT $2`, [workUnitIds, maxTraceEffects + 1])
        : { rows: [] };
    requireBoundedCount(effectRows.rows.length, maxTraceEffects, 'Effect trace');
    const checkpointRows = workUnitIds.length
        ? await pool.query(`SELECT id, work_unit_id, checkpoint_key, data, created_at, updated_at
         FROM job_checkpoints
         WHERE work_unit_id = ANY($1::uuid[])
         ORDER BY work_unit_id, checkpoint_key, id
         LIMIT $2`, [workUnitIds, maxTraceCheckpoints + 1])
        : { rows: [] };
    requireBoundedCount(checkpointRows.rows.length, maxTraceCheckpoints, 'Checkpoint trace');
    const runResult = await pool.query(`SELECT
       id, agent_definition_id, agent_key, agent_version, context_receipt_id,
       parent_run_id, handoff_id, execution_mode, provider_id, model_id, status,
       last_transition_id, envelope, started_at, completed_at, created_at, updated_at
     FROM agent_runs
     WHERE workspace_id = $1
       AND (id = $2 OR parent_run_id = $2)
     ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END, created_at, id
     LIMIT $3`, [input.workspaceId, root.plan_run_id, maxTraceAgentRuns + 1]);
    requireBoundedCount(runResult.rows.length, maxTraceAgentRuns, 'AgentRun trace');
    const orchestrator = runResult.rows.find((row) => row.id === root.plan_run_id);
    if (!orchestrator) {
        throw new AgentRuntimeHardeningError('AGENT_TRACE_PROJECTION_CONFLICT', `Execution plan ${root.plan_id} is missing its orchestrator AgentRun.`);
    }
    const runIds = runResult.rows.map((row) => row.id);
    const transitionRows = runIds.length
        ? await pool.query(`SELECT
           id, run_id, from_status, to_status, reason_code,
           actor_type, actor_id, metadata, occurred_at
         FROM agent_run_transitions
         WHERE workspace_id = $1
           AND run_id = ANY($2::text[])
         ORDER BY occurred_at, id
         LIMIT $3`, [input.workspaceId, runIds, maxTraceTransitions + 1])
        : { rows: [] };
    requireBoundedCount(transitionRows.rows.length, maxTraceTransitions, 'AgentRun transition trace');
    const evaluationRows = await pool.query(`SELECT
       id, evaluator_run_id, subject_run_id, decision, evidence_state,
       reason_codes, evidence_refs, policy_refs, confidence, envelope, created_at
     FROM agent_eval_results
     WHERE workspace_id = $1
       AND subject_run_id = $2
     ORDER BY created_at, id
     LIMIT $3`, [input.workspaceId, root.plan_run_id, maxTraceEvaluations + 1]);
    requireBoundedCount(evaluationRows.rows.length, maxTraceEvaluations, 'Evaluation trace');
    const effectsByWork = new Map();
    for (const row of effectRows.rows) {
        const list = effectsByWork.get(row.work_unit_id) ?? [];
        list.push({
            id: row.id,
            effectKey: row.effect_key,
            data: row.data,
            createdAt: row.created_at.toISOString(),
        });
        effectsByWork.set(row.work_unit_id, list);
    }
    const checkpointsByWork = new Map();
    for (const row of checkpointRows.rows) {
        const list = checkpointsByWork.get(row.work_unit_id) ?? [];
        list.push({
            id: row.id,
            checkpointKey: row.checkpoint_key,
            data: row.data,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
        });
        checkpointsByWork.set(row.work_unit_id, list);
    }
    return {
        authorization,
        workspaceId: input.workspaceId,
        dispatchId: input.dispatchId,
        jobRun: {
            id: root.job_run_id,
            jobType: root.job_type,
            jobVersion: root.job_version,
            correlationId: root.correlation_id,
            status: root.job_status,
            startedAt: iso(root.job_started_at),
            completedAt: iso(root.job_completed_at),
            createdAt: root.job_created_at.toISOString(),
            updatedAt: root.job_updated_at.toISOString(),
        },
        plan: {
            id: root.plan_id,
            userId: root.plan_user_id,
            runId: root.plan_run_id,
            contextReceiptId: root.plan_context_receipt_id,
            orchestratorDefinitionId: root.orchestrator_definition_id,
            orchestratorKey: root.orchestrator_key,
            orchestratorVersion: root.orchestrator_version,
            planVersion: root.plan_version,
            maxParallelism: root.max_parallelism,
            stepCount: root.step_count,
            envelope: root.plan_envelope,
            createdAt: root.plan_created_at.toISOString(),
        },
        workUnits: workResult.rows.map((row) => ({
            id: row.id,
            queueName: row.queue_name,
            workType: row.work_type,
            workVersion: row.work_version,
            correlationId: row.correlation_id,
            status: row.status,
            attemptCount: row.attempt_count,
            maxAttempts: row.max_attempts,
            nextAttemptAt: iso(row.next_attempt_at),
            cancellationRequestedAt: iso(row.cancellation_requested_at),
            workerId: row.worker_id,
            leaseExpiresAt: iso(row.lease_expires_at),
            lastErrorCode: row.last_error_code,
            lastErrorClass: row.last_error_class,
            payload: row.payload,
            startedAt: iso(row.started_at),
            completedAt: iso(row.completed_at),
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            effects: effectsByWork.get(row.id) ?? [],
            checkpoints: checkpointsByWork.get(row.id) ?? [],
        })),
        agentRuns: runResult.rows.map((row) => ({
            id: row.id,
            agentDefinitionId: row.agent_definition_id,
            agentKey: row.agent_key,
            agentVersion: row.agent_version,
            contextReceiptId: row.context_receipt_id,
            parentRunId: row.parent_run_id,
            handoffId: row.handoff_id,
            executionMode: row.execution_mode,
            providerId: row.provider_id,
            modelId: row.model_id,
            status: row.status,
            lastTransitionId: row.last_transition_id,
            envelope: row.envelope,
            startedAt: iso(row.started_at),
            completedAt: iso(row.completed_at),
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
        })),
        transitions: transitionRows.rows.map((row) => ({
            id: row.id,
            runId: row.run_id,
            fromStatus: row.from_status,
            toStatus: row.to_status,
            reasonCode: row.reason_code,
            actorType: row.actor_type,
            actorId: row.actor_id,
            metadata: row.metadata,
            occurredAt: row.occurred_at.toISOString(),
        })),
        evaluations: evaluationRows.rows.map((row) => ({
            id: row.id,
            evaluatorRunId: row.evaluator_run_id,
            subjectRunId: row.subject_run_id,
            decision: row.decision,
            evidenceState: row.evidence_state,
            reasonCodes: readStringArray(row.reason_codes),
            evidenceRefs: readStringArray(row.evidence_refs),
            policyRefs: readStringArray(row.policy_refs),
            confidence: row.confidence,
            envelope: row.envelope,
            createdAt: row.created_at.toISOString(),
        })),
    };
}
//# sourceMappingURL=agent-runtime-hardening.js.map