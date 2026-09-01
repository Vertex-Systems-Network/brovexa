import {
  ConnectorAdmissionDecisionSchema,
  ConnectorDefinitionSchema,
  ConnectorPolicySchema,
  SourceCapabilitySchema,
  SourceRequestEnvelopeSchema,
  SourceResultEnvelopeSchema,
  validateSourceResultAgainstAdmission,
  type ConnectorAdmissionDecision,
  type ConnectorDefinition,
  type ConnectorPolicy,
  type SourceCapability,
  type SourceRequestEnvelope,
  type SourceResultEnvelope,
} from '@brovexa/contracts';
import {
  SOURCE_EXECUTION_RESULT_EFFECT,
  SOURCE_EXECUTION_WORK_TYPE,
  SourceRegistryPersistenceError,
  SourceTaskPersistenceError,
  getSourceAdmissionSnapshot,
  getSourceTaskState,
  recordSourceTaskUsage,
  resolveConnectorRegistryEntry,
  type SourceTaskState,
  type createPgPool,
} from '@brovexa/db';
import { CancelledWorkError, PermanentWorkError, RetryableWorkError } from './errors';
import type { WorkHandler, WorkHandlerContext } from './runtime';

const connectorKeyPattern = /^connector\.[a-z0-9_.-]+$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;

export interface SourceExecutorOutcome {
  result: SourceResultEnvelope;
  resultRef: string;
  provenanceRefs: readonly string[];
}

export interface SourceExecutorContext {
  workspaceId: string;
  sourceTaskId: string;
  researchJobId: string;
  workUnitId: string;
  jobRunId: string;
  correlationId: string;
  attempt: number;
  request: SourceRequestEnvelope;
  admission: ConnectorAdmissionDecision;
  capability: SourceCapability;
  policy: ConnectorPolicy;
  definition: ConnectorDefinition;
  isCancellationRequested: () => Promise<boolean>;
}

export type SourceExecutor = (context: SourceExecutorContext) => Promise<SourceExecutorOutcome>;

export interface SourceExecutorRegistration {
  connectorVersion: string;
  implementationVersion: string;
  /**
   * This bounded M02 slice has no built-in network transport. Registrations are
   * intentionally limited to injected no-network executors used by tests and
   * future higher-level adapters after their own security gate.
   */
  networkAccess: 'none';
  execute: SourceExecutor;
}

export interface SourceExecutionRegistryOptions {
  pool: ReturnType<typeof createPgPool>;
  registryVersion: string;
  executors: Readonly<Record<string, SourceExecutorRegistration>>;
}

interface SourceTaskExecutionPayload {
  kind: 'source_task_execution';
  sourceTaskId: string;
  researchJobId: string;
  preflightId: string;
  admissionSnapshotId: string;
}

function assertVersion(value: string, field: string): void {
  if (!value.trim() || value.length > 64) {
    throw new RangeError(`${field} must be a non-empty version no longer than 64 characters.`);
  }
}

function assertRegistry(options: SourceExecutionRegistryOptions): void {
  assertVersion(options.registryVersion, 'Source executor registryVersion');
  const entries = Object.entries(options.executors);
  if (entries.length > 128) throw new RangeError('Source executor registry supports at most 128 executors.');
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

function readExecutionPayload(context: WorkHandlerContext): SourceTaskExecutionPayload {
  const payload = context.payload;
  if (
    context.workType !== SOURCE_EXECUTION_WORK_TYPE ||
    context.workVersion !== 1 ||
    payload.kind !== 'source_task_execution' ||
    typeof payload.sourceTaskId !== 'string' ||
    typeof payload.researchJobId !== 'string' ||
    typeof payload.preflightId !== 'string' ||
    typeof payload.admissionSnapshotId !== 'string' ||
    !identifierPattern.test(payload.sourceTaskId) ||
    !identifierPattern.test(payload.researchJobId) ||
    !identifierPattern.test(payload.preflightId) ||
    !identifierPattern.test(payload.admissionSnapshotId)
  ) {
    throw new PermanentWorkError('SOURCE_EXECUTION_PAYLOAD_INVALID');
  }
  return {
    kind: 'source_task_execution',
    sourceTaskId: payload.sourceTaskId,
    researchJobId: payload.researchJobId,
    preflightId: payload.preflightId,
    admissionSnapshotId: payload.admissionSnapshotId,
  };
}

function assertTaskBinding(context: WorkHandlerContext, payload: SourceTaskExecutionPayload, task: SourceTaskState): void {
  if (
    task.workspaceId !== context.workspaceId ||
    task.sourceTaskId !== payload.sourceTaskId ||
    task.researchJobId !== payload.researchJobId ||
    task.preflightId !== payload.preflightId ||
    task.admissionSnapshotId !== payload.admissionSnapshotId ||
    task.workUnitId !== context.workUnitId ||
    task.jobRunId !== context.jobRunId ||
    task.correlationId !== context.correlationId ||
    task.status !== 'running' ||
    task.attemptCount !== context.attempt
  ) {
    throw new PermanentWorkError('SOURCE_EXECUTION_TASK_BINDING_MISMATCH');
  }
}

function assertNonEmptyIdentifiers(values: readonly string[], field: string): string[] {
  if (
    values.length === 0 ||
    values.length > 256 ||
    values.some((value) => typeof value !== 'string' || !identifierPattern.test(value)) ||
    new Set(values).size !== values.length
  ) {
    throw new PermanentWorkError('SOURCE_EXECUTION_PROVENANCE_REQUIRED', `${field} must contain unique canonical identifiers.`);
  }
  return [...values];
}

function buildCompletionEffect(input: {
  task: SourceTaskState;
  result: SourceResultEnvelope;
  resultRef: string;
  provenanceRefs: readonly string[];
}): { effectKey: string; effectData: Record<string, unknown> } {
  if (!identifierPattern.test(input.resultRef)) {
    throw new PermanentWorkError('SOURCE_EXECUTION_RESULT_REF_INVALID');
  }
  const sourceReferenceIds = assertNonEmptyIdentifiers(
    input.result.sourceReferences.map((reference) => reference.referenceId),
    'result.sourceReferences',
  );
  const provenanceRefs = assertNonEmptyIdentifiers(input.provenanceRefs, 'provenanceRefs');
  return {
    effectKey: SOURCE_EXECUTION_RESULT_EFFECT,
    effectData: {
      kind: 'source_task_result_reference',
      sourceTaskId: input.task.sourceTaskId,
      admissionSnapshotId: input.task.admissionSnapshotId,
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

function resultFailure(result: SourceResultEnvelope): RetryableWorkError | PermanentWorkError | null {
  if (result.status === 'blocked') return new PermanentWorkError('SOURCE_EXECUTION_RESULT_BLOCKED');
  if (result.status !== 'failed') return null;

  const permanent = result.errors.find((error) =>
    error.classification === 'permanent' || error.classification === 'policy' || error.classification === 'quota'
  );
  if (permanent) return new PermanentWorkError(permanent.code, permanent.message);
  const retryable = result.errors.find((error) => error.classification === 'retryable');
  if (retryable) return new RetryableWorkError(retryable.code, retryable.message);
  return new PermanentWorkError('SOURCE_EXECUTION_RESULT_FAILED');
}

function asPermanent(error: SourceTaskPersistenceError | SourceRegistryPersistenceError): PermanentWorkError {
  return new PermanentWorkError(error.code, error.message);
}

function buildSourceExecutionHandler(options: SourceExecutionRegistryOptions): WorkHandler {
  return async (workContext) => {
    try {
      const payload = readExecutionPayload(workContext);
      const task = await getSourceTaskState(options.pool, workContext.workspaceId, payload.sourceTaskId);
      if (!task) throw new PermanentWorkError('SOURCE_EXECUTION_TASK_NOT_FOUND');
      assertTaskBinding(workContext, payload, task);

      const snapshot = await getSourceAdmissionSnapshot(options.pool, workContext.workspaceId, payload.admissionSnapshotId);
      if (!snapshot) throw new PermanentWorkError('SOURCE_EXECUTION_ADMISSION_NOT_FOUND');
      if (snapshot.decision !== 'allow') throw new PermanentWorkError('SOURCE_EXECUTION_ADMISSION_NOT_ALLOWED');
      if (
        snapshot.sourceTaskId !== task.sourceTaskId ||
        snapshot.requestId !== task.requestId ||
        snapshot.sourceKey !== task.sourceKey ||
        snapshot.capabilityVersion !== task.capabilityVersion ||
        snapshot.connectorKey !== task.connectorKey ||
        snapshot.connectorVersion !== task.connectorVersion ||
        snapshot.policyId !== task.policyId ||
        snapshot.policyVersion !== task.policyVersion
      ) {
        throw new PermanentWorkError('SOURCE_EXECUTION_ADMISSION_IDENTITY_MISMATCH');
      }

      const registry = await resolveConnectorRegistryEntry(options.pool, {
        connectorKey: task.connectorKey,
        connectorVersion: task.connectorVersion,
      });
      if (!registry) throw new PermanentWorkError('SOURCE_EXECUTION_REGISTRY_NOT_FOUND');
      if (
        registry.sourceKey !== task.sourceKey ||
        registry.capabilityVersion !== task.capabilityVersion ||
        registry.policyId !== task.policyId ||
        registry.policyVersion !== task.policyVersion ||
        registry.status !== 'approved' ||
        registry.activation !== 'enabled'
      ) {
        throw new PermanentWorkError('SOURCE_EXECUTION_REGISTRY_IDENTITY_MISMATCH');
      }
      if (registry.credentialMode !== 'none') {
        throw new PermanentWorkError('SOURCE_EXECUTION_CREDENTIAL_MODE_UNSUPPORTED');
      }

      let request: SourceRequestEnvelope;
      let admission: ConnectorAdmissionDecision;
      let capability: SourceCapability;
      let policy: ConnectorPolicy;
      let definition: ConnectorDefinition;
      try {
        request = SourceRequestEnvelopeSchema.parse(snapshot.request);
        admission = ConnectorAdmissionDecisionSchema.parse(snapshot.admission);
        capability = SourceCapabilitySchema.parse(registry.capability);
        policy = ConnectorPolicySchema.parse(registry.policy);
        definition = ConnectorDefinitionSchema.parse(registry.definition);
      } catch {
        throw new PermanentWorkError('SOURCE_EXECUTION_CONTRACT_INVALID');
      }

      if (
        request.executionIntent !== 'execute' ||
        request.workspaceId !== workContext.workspaceId ||
        request.sourceTaskId !== task.sourceTaskId ||
        request.requestId !== task.requestId ||
        request.sourceKey !== task.sourceKey ||
        request.connectorKey !== task.connectorKey ||
        request.connectorVersion !== task.connectorVersion ||
        request.policySnapshot.policyId !== task.policyId ||
        request.policySnapshot.policyVersion !== task.policyVersion ||
        admission.decision !== 'allow'
      ) {
        throw new PermanentWorkError('SOURCE_EXECUTION_FROZEN_ADMISSION_MISMATCH');
      }

      const registration = options.executors[task.connectorKey];
      if (!registration) throw new PermanentWorkError('SOURCE_EXECUTION_EXECUTOR_UNAVAILABLE');
      if (
        registration.connectorVersion !== task.connectorVersion ||
        registration.implementationVersion !== definition.implementationVersion ||
        registration.networkAccess !== 'none'
      ) {
        throw new PermanentWorkError('SOURCE_EXECUTION_EXECUTOR_VERSION_MISMATCH');
      }

      if (await workContext.isCancellationRequested()) throw new CancelledWorkError();

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
        isCancellationRequested: workContext.isCancellationRequested,
      });

      let result: SourceResultEnvelope;
      try {
        result = SourceResultEnvelopeSchema.parse(outcome.result);
      } catch {
        throw new PermanentWorkError('SOURCE_EXECUTION_RESULT_SCHEMA_INVALID');
      }
      const validation = validateSourceResultAgainstAdmission({ result, request, capability, policy, admission });
      if (!validation.valid) {
        throw new PermanentWorkError(
          'SOURCE_EXECUTION_RESULT_CONTRACT_INVALID',
          `Source result violates frozen admission: ${validation.issues.join(',')}.`,
        );
      }

      await recordSourceTaskUsage(options.pool, {
        eventId: `source-usage-${workContext.workUnitId}-${workContext.attempt}`,
        workspaceId: workContext.workspaceId,
        sourceTaskId: task.sourceTaskId,
        usage: result.usage,
        metadata: {
          registryVersion: options.registryVersion,
          connectorKey: task.connectorKey,
          connectorVersion: task.connectorVersion,
          resultStatus: result.status,
        },
        occurredAt: new Date(result.completedAt),
      });

      const failure = resultFailure(result);
      if (failure) throw failure;
      if (await workContext.isCancellationRequested()) throw new CancelledWorkError();

      return buildCompletionEffect({
        task,
        result,
        resultRef: outcome.resultRef,
        provenanceRefs: outcome.provenanceRefs,
      });
    } catch (error) {
      if (error instanceof RetryableWorkError || error instanceof PermanentWorkError || error instanceof CancelledWorkError) {
        throw error;
      }
      if (error instanceof SourceTaskPersistenceError || error instanceof SourceRegistryPersistenceError) {
        throw asPermanent(error);
      }
      throw new PermanentWorkError('UNCLASSIFIED_SOURCE_EXECUTION_ERROR');
    }
  };
}

export function createSourceExecutionHandlers(
  options: SourceExecutionRegistryOptions,
): Readonly<Record<string, WorkHandler>> {
  assertRegistry(options);
  return { [SOURCE_EXECUTION_WORK_TYPE]: buildSourceExecutionHandler(options) };
}
