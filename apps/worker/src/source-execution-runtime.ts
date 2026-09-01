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

export interface ParsedSourceRequest extends Record<string, unknown> {
  executionIntent: 'execute';
  workspaceId: string;
  sourceTaskId: string;
  requestId: string;
  sourceKey: string;
  connectorKey: string;
  connectorVersion: string;
  policySnapshot: {
    policyId: string;
    policyVersion: string;
  };
}

export interface ParsedSourceAdmission extends Record<string, unknown> {
  decision: 'allow' | 'review_required' | 'blocked';
}

export interface ParsedSourceCapability extends Record<string, unknown> {
  sourceKey: string;
  version: string;
}

export interface ParsedConnectorPolicy extends Record<string, unknown> {
  policyId: string;
  version: string;
  sourceKey: string;
  connectorKey: string;
}

export interface ParsedConnectorDefinition extends Record<string, unknown> {
  connectorKey: string;
  version: string;
  sourceKey: string;
  capabilityVersion: string;
  policyId: string;
  policyVersion: string;
  implementationVersion: string;
}

export interface ParsedSourceResult extends Record<string, unknown> {
  status: 'complete' | 'partial' | 'empty' | 'blocked' | 'failed';
  sourceReferences: readonly { referenceId: string }[];
  usage: {
    requests: number;
    pages: number;
    bytes: number;
    currencyMicros: number;
    runtimeMs: number;
  };
  errors: readonly {
    code: string;
    classification: 'retryable' | 'permanent' | 'policy' | 'quota' | 'partial';
    message: string;
  }[];
  completedAt: string;
}

export interface SourceExecutionContractValidation {
  valid: boolean;
  issues: readonly string[];
}

export interface SourceExecutionContractAdapter {
  parseRequest(value: unknown): ParsedSourceRequest;
  parseAdmission(value: unknown): ParsedSourceAdmission;
  parseCapability(value: unknown): ParsedSourceCapability;
  parsePolicy(value: unknown): ParsedConnectorPolicy;
  parseDefinition(value: unknown): ParsedConnectorDefinition;
  parseResult(value: unknown): ParsedSourceResult;
  validateResult(input: {
    result: ParsedSourceResult;
    request: ParsedSourceRequest;
    capability: ParsedSourceCapability;
    policy: ParsedConnectorPolicy;
    admission: ParsedSourceAdmission;
  }): SourceExecutionContractValidation;
}

export interface SourceExecutorOutcome {
  result: unknown;
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
  request: ParsedSourceRequest;
  admission: ParsedSourceAdmission;
  capability: ParsedSourceCapability;
  policy: ParsedConnectorPolicy;
  definition: ParsedConnectorDefinition;
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
  contracts: SourceExecutionContractAdapter;
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

function assertIdentifiers(
  values: readonly string[],
  field: string,
  options: { allowEmpty: boolean; maxItems: number },
): string[] {
  if (
    (!options.allowEmpty && values.length === 0) ||
    values.length > options.maxItems ||
    values.some((value) => typeof value !== 'string' || !identifierPattern.test(value)) ||
    new Set(values).size !== values.length
  ) {
    const cardinality = options.allowEmpty ? `at most ${options.maxItems}` : `between 1 and ${options.maxItems}`;
    throw new PermanentWorkError(
      'SOURCE_EXECUTION_PROVENANCE_REQUIRED',
      `${field} must contain ${cardinality} unique canonical identifiers.`,
    );
  }
  return [...values];
}

function buildCompletionEffect(input: {
  task: SourceTaskState;
  result: ParsedSourceResult;
  resultRef: string;
  provenanceRefs: readonly string[];
}): { effectKey: string; effectData: Record<string, unknown> } {
  if (!identifierPattern.test(input.resultRef)) {
    throw new PermanentWorkError('SOURCE_EXECUTION_RESULT_REF_INVALID');
  }
  const sourceReferenceIds = assertIdentifiers(
    input.result.sourceReferences.map((reference) => reference.referenceId),
    'result.sourceReferences',
    { allowEmpty: true, maxItems: 2048 },
  );
  const provenanceRefs = assertIdentifiers(input.provenanceRefs, 'provenanceRefs', {
    allowEmpty: false,
    maxItems: 512,
  });
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

function resultFailure(result: ParsedSourceResult): RetryableWorkError | PermanentWorkError | null {
  if (result.status === 'blocked') return new PermanentWorkError('SOURCE_EXECUTION_RESULT_BLOCKED');
  if (result.status !== 'failed') return null;

  const permanent = result.errors.find(
    (error) =>
      error.classification === 'permanent' ||
      error.classification === 'policy' ||
      error.classification === 'quota',
  );
  if (permanent) return new PermanentWorkError(permanent.code, permanent.message);
  const retryable = result.errors.find((error) => error.classification === 'retryable');
  if (retryable) return new RetryableWorkError(retryable.code, retryable.message);
  return new PermanentWorkError('SOURCE_EXECUTION_RESULT_FAILED');
}

function asPermanent(error: SourceTaskPersistenceError | SourceRegistryPersistenceError): PermanentWorkError {
  return new PermanentWorkError(error.code, error.message);
}

function parseFrozenContracts(
  options: SourceExecutionRegistryOptions,
  snapshot: { request: Record<string, unknown>; admission: Record<string, unknown> },
  registry: {
    capability: Record<string, unknown>;
    policy: Record<string, unknown>;
    definition: Record<string, unknown>;
  },
): {
  request: ParsedSourceRequest;
  admission: ParsedSourceAdmission;
  capability: ParsedSourceCapability;
  policy: ParsedConnectorPolicy;
  definition: ParsedConnectorDefinition;
} {
  try {
    return {
      request: options.contracts.parseRequest(snapshot.request),
      admission: options.contracts.parseAdmission(snapshot.admission),
      capability: options.contracts.parseCapability(registry.capability),
      policy: options.contracts.parsePolicy(registry.policy),
      definition: options.contracts.parseDefinition(registry.definition),
    };
  } catch {
    throw new PermanentWorkError('SOURCE_EXECUTION_CONTRACT_INVALID');
  }
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

      const { request, admission, capability, policy, definition } = parseFrozenContracts(options, snapshot, registry);

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

      let result: ParsedSourceResult;
      try {
        result = options.contracts.parseResult(outcome.result);
      } catch {
        throw new PermanentWorkError('SOURCE_EXECUTION_RESULT_SCHEMA_INVALID');
      }
      const validation = options.contracts.validateResult({ result, request, capability, policy, admission });
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
