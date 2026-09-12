"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeterministicSpecialistHandlers = createDeterministicSpecialistHandlers;
const db_1 = require("@brovexa/db");
const errors_1 = require("./errors");
function assertRegistry(options) {
    if (!options.registryVersion.trim() || options.registryVersion.length > 64) {
        throw new RangeError('Specialist handler registryVersion must be a non-empty version identifier.');
    }
    const entries = Object.entries(options.handlers);
    if (entries.length > 128)
        throw new RangeError('Specialist handler registry supports at most 128 handlers.');
    for (const [agentKey, registration] of entries) {
        if (!/^agent\.[a-z0-9_.-]+$/.test(agentKey) || agentKey === 'agent.control.orchestrator') {
            throw new RangeError(`Invalid deterministic specialist agent key: ${agentKey}.`);
        }
        if (!registration.agentVersion.trim() || registration.agentVersion.length > 64) {
            throw new RangeError(`Invalid deterministic specialist version for ${agentKey}.`);
        }
    }
}
function normalizedResult(result) {
    return {
        result: result.result,
        confidence: result.confidence,
        validationState: result.validationState,
        uncertainty: result.uncertainty ?? [],
        evidenceIds: result.evidenceIds ?? [],
        factIds: result.factIds ?? [],
        sourceIds: result.sourceIds ?? [],
        assumptions: result.assumptions ?? [],
        conflicts: result.conflicts ?? [],
        toolSummary: result.toolSummary ?? [],
        cost: {
            inputTokens: result.cost?.inputTokens ?? 0,
            outputTokens: result.cost?.outputTokens ?? 0,
            searches: result.cost?.searches ?? 0,
            apiCalls: result.cost?.apiCalls ?? 0,
            credits: result.cost?.credits ?? 0,
            currencyMicros: result.cost?.currencyMicros ?? 0,
        },
        proposedActions: result.proposedActions ?? [],
    };
}
function lifecycleTime(after) {
    return new Date(Math.max(Date.now(), after.getTime() + 1));
}
async function transitionAttempt(options, input) {
    const occurredAt = lifecycleTime(input.updatedAt);
    await (0, db_1.transitionAgentRun)(options.pool, {
        transitionId: (0, db_1.createAgentSpecialistTransitionId)(input.runId, input.phase),
        workspaceId: input.workspaceId,
        runId: input.runId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reasonCode: input.reasonCode,
        actorType: 'worker',
        metadata: input.metadata,
        occurredAt,
    });
    return occurredAt;
}
function executionEffect(runId, contextReceiptId, payload, attempt, result) {
    return {
        effectKey: 'agent.execution.specialist.result',
        effectData: {
            kind: 'agent_specialist_execution_result',
            runId,
            contextReceiptId,
            dispatchId: payload.dispatchId,
            planId: payload.planId,
            stepKey: payload.stepKey,
            agentKey: payload.agentKey,
            agentVersion: payload.agentVersion,
            attempt,
            result,
        },
    };
}
function asPermanent(error) {
    return new errors_1.PermanentWorkError(error.code, error.message);
}
function assertHandlerIdentityBeforeAdmission(workContext, registryVersion, agentKey, agentVersion) {
    const payload = workContext.payload;
    if (payload.handlerRegistryVersion !== registryVersion) {
        throw new errors_1.PermanentWorkError('AGENT_SPECIALIST_REGISTRY_VERSION_MISMATCH', `WorkUnit requires handler registry ${String(payload.handlerRegistryVersion)}, not ${registryVersion}.`);
    }
    if (workContext.workType !== agentKey ||
        payload.agentKey !== agentKey ||
        payload.agentVersion !== agentVersion) {
        throw new errors_1.PermanentWorkError('AGENT_SPECIALIST_HANDLER_IDENTITY_MISMATCH', `Registered specialist handler does not match ${String(payload.agentKey)}@${String(payload.agentVersion)}.`);
    }
}
function buildHandler(options, agentKey, registration) {
    return async (workContext) => {
        let runId = null;
        let runStatus = null;
        let runUpdatedAt = null;
        try {
            assertHandlerIdentityBeforeAdmission(workContext, options.registryVersion, agentKey, registration.agentVersion);
            const prepared = await (0, db_1.prepareAgentSpecialistAttempt)(options.pool, {
                workspaceId: workContext.workspaceId,
                jobRunId: workContext.jobRunId,
                workUnitId: workContext.workUnitId,
                correlationId: workContext.correlationId,
                attempt: workContext.attempt,
                workType: workContext.workType,
                workVersion: workContext.workVersion,
                payload: workContext.payload,
            });
            if (prepared.replayResult) {
                return executionEffect(prepared.runId, prepared.contextReceiptId, prepared.payload, workContext.attempt, prepared.replayResult);
            }
            for (const abandoned of prepared.abandonedRuns) {
                await transitionAttempt(options, {
                    runId: abandoned.runId,
                    workspaceId: workContext.workspaceId,
                    fromStatus: abandoned.status,
                    toStatus: 'failed',
                    phase: 'lease-recovery-failed',
                    reasonCode: 'specialist_attempt_abandoned_after_lease',
                    updatedAt: abandoned.updatedAt,
                    metadata: {
                        workUnitId: workContext.workUnitId,
                        recoveredByAttempt: workContext.attempt,
                    },
                });
            }
            runId = prepared.runId;
            runStatus = prepared.runStatus;
            runUpdatedAt = prepared.runUpdatedAt;
            if (await workContext.isCancellationRequested()) {
                runUpdatedAt = await transitionAttempt(options, {
                    runId,
                    workspaceId: workContext.workspaceId,
                    fromStatus: runStatus,
                    toStatus: 'cancelled',
                    phase: 'cancelled-before-start',
                    reasonCode: 'specialist_cancellation_requested',
                    updatedAt: runUpdatedAt,
                    metadata: { workUnitId: workContext.workUnitId, attempt: workContext.attempt },
                });
                runStatus = null;
                throw new errors_1.CancelledWorkError();
            }
            if (runStatus === 'queued') {
                runUpdatedAt = await transitionAttempt(options, {
                    runId,
                    workspaceId: workContext.workspaceId,
                    fromStatus: 'queued',
                    toStatus: 'running',
                    phase: 'start',
                    reasonCode: 'specialist_execution_started',
                    updatedAt: runUpdatedAt,
                    metadata: { workUnitId: workContext.workUnitId, attempt: workContext.attempt },
                });
                runStatus = 'running';
            }
            const result = await registration.execute({
                runId,
                contextReceiptId: prepared.contextReceiptId,
                workUnitId: workContext.workUnitId,
                jobRunId: workContext.jobRunId,
                workspaceId: workContext.workspaceId,
                correlationId: workContext.correlationId,
                attempt: workContext.attempt,
                payload: prepared.payload,
                isCancellationRequested: workContext.isCancellationRequested,
                checkpoint: (checkpointKey, data) => (0, db_1.writeAgentExecutionCheckpoint)(options.pool, {
                    workspaceId: workContext.workspaceId,
                    dispatchId: prepared.payload.dispatchId,
                    stepKey: prepared.payload.stepKey,
                    checkpointKey,
                    data,
                }),
                recordUsage: (eventId, usage, metadata) => (0, db_1.recordAgentExecutionBudgetUsage)(options.pool, {
                    eventId,
                    workspaceId: workContext.workspaceId,
                    dispatchId: prepared.payload.dispatchId,
                    stepKey: prepared.payload.stepKey,
                    usage,
                    ...(metadata ? { metadata } : {}),
                    occurredAt: new Date(),
                }),
            });
            if (await workContext.isCancellationRequested()) {
                runUpdatedAt = await transitionAttempt(options, {
                    runId,
                    workspaceId: workContext.workspaceId,
                    fromStatus: 'running',
                    toStatus: 'cancelled',
                    phase: 'cancelled-after-handler',
                    reasonCode: 'specialist_cancellation_requested',
                    updatedAt: runUpdatedAt,
                    metadata: { workUnitId: workContext.workUnitId, attempt: workContext.attempt },
                });
                runStatus = null;
                throw new errors_1.CancelledWorkError();
            }
            const completion = await (0, db_1.completeAgentSpecialistAttempt)(options.pool, {
                workspaceId: workContext.workspaceId,
                jobRunId: workContext.jobRunId,
                workUnitId: workContext.workUnitId,
                correlationId: workContext.correlationId,
                attempt: workContext.attempt,
                workType: workContext.workType,
                workVersion: workContext.workVersion,
                payload: workContext.payload,
                runId,
                result: normalizedResult(result),
                occurredAt: lifecycleTime(runUpdatedAt),
            });
            runStatus = null;
            return executionEffect(runId, prepared.contextReceiptId, prepared.payload, workContext.attempt, completion.result);
        }
        catch (error) {
            if (runId && runStatus && runUpdatedAt) {
                let target = 'review_required';
                let reasonCode = 'specialist_execution_requires_review';
                if (error instanceof errors_1.CancelledWorkError) {
                    target = 'cancelled';
                    reasonCode = 'specialist_execution_cancelled';
                }
                else if (error instanceof errors_1.RetryableWorkError) {
                    target = 'failed';
                    reasonCode = 'specialist_retryable_failure';
                }
                else if (error instanceof db_1.AgentExecutionDispatchError && error.code === 'AGENT_DISPATCH_BUDGET_EXCEEDED') {
                    target = 'budget_stopped';
                    reasonCode = 'specialist_budget_stopped';
                }
                try {
                    await transitionAttempt(options, {
                        runId,
                        workspaceId: workContext.workspaceId,
                        fromStatus: runStatus,
                        toStatus: target,
                        phase: target,
                        reasonCode,
                        updatedAt: runUpdatedAt,
                        metadata: {
                            workUnitId: workContext.workUnitId,
                            attempt: workContext.attempt,
                            errorCode: error instanceof errors_1.RetryableWorkError ||
                                error instanceof errors_1.PermanentWorkError ||
                                error instanceof errors_1.CancelledWorkError ||
                                error instanceof db_1.AgentSpecialistExecutionError ||
                                error instanceof db_1.AgentExecutionDispatchError
                                ? error.code
                                : 'UNCLASSIFIED_SPECIALIST_ERROR',
                        },
                    });
                }
                catch {
                    // The canonical worker will still record the WorkUnit failure. The original error remains authoritative.
                }
            }
            if (error instanceof errors_1.RetryableWorkError || error instanceof errors_1.PermanentWorkError || error instanceof errors_1.CancelledWorkError) {
                throw error;
            }
            if (error instanceof db_1.AgentSpecialistExecutionError)
                throw asPermanent(error);
            if (error instanceof db_1.AgentExecutionDispatchError) {
                throw new errors_1.PermanentWorkError(error.code, error.message);
            }
            throw new errors_1.PermanentWorkError('UNCLASSIFIED_SPECIALIST_ERROR');
        }
    };
}
function createDeterministicSpecialistHandlers(options) {
    assertRegistry(options);
    return Object.fromEntries(Object.entries(options.handlers).map(([agentKey, registration]) => [
        agentKey,
        buildHandler(options, agentKey, registration),
    ]));
}
//# sourceMappingURL=agent-specialist-runtime.js.map