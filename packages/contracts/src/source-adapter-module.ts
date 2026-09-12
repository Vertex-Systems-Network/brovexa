/**
 * M02 MODULE Slot — Source Adapter Module Infrastructure
 *
 * Provides bounded module-level adapter seams and dependency injection for
 * provider-neutral source execution. This layer sits between the execution
 * runtime and concrete adapter implementations, enabling:
 *
 * - Explicit capability/policy binding at module initialization
 * - Injected transport/resolution dependencies (no implicit network access)
 * - Adapter lifecycle management (registration, health reporting, teardown)
 * - Contract validation boundaries before adapter invocation
 *
 * Security boundary: networkAccess='none' for all registered adapters.
 * No production HTTP, credentials, or external provider activation.
 */

import { z } from 'zod';
import type {
  ConnectorAdmissionDecision,
  ConnectorPolicy,
  SourceCapability,
  SourceRequestEnvelope,
  SourceResultEnvelope,
} from './source-adapter';
import type { SourceTransportPolicy, SourceTransportRequest, SourceTransportResolution } from './source-transport';

/**
 * Test-only transport binding interface for injected HTTP behavior.
 */
export interface SourceTransportBinding {
  /** Execute a transport request with injected responses */
  execute(request: SourceTransportRequest): Promise<SourceTransportResult>;
}

/**
 * Transport execution result.
 */
export interface SourceTransportResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  bytesTransferred: number;
  durationMs: number;
  redirectChain?: readonly string[];
}

/**
 * Resolution binding interface for DNS/redirect evidence injection.
 */
export interface SourceResolutionBinding {
  /** Resolve a URL to address evidence */
  resolve(url: string): Promise<SourceTransportResolution>;
}

/**
 * Adapter module identity and versioning contract.
 */
export const AdapterModuleIdentitySchema = z.object({
  /** Canonical connector key matching registry definition */
  connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
  /** Adapter implementation semantic version */
  adapterVersion: z.string().min(1).max(64),
  /** Capability version this adapter implements */
  capabilityVersion: z.string().min(1).max(64),
  /** Network access mode — must be 'none' in M02 bounded slice */
  networkAccess: z.literal('none'),
});

export type AdapterModuleIdentity = z.infer<typeof AdapterModuleIdentitySchema>;

/**
 * Adapter module dependencies injected by the runtime host.
 * All dependencies are explicitly provided—no implicit globals.
 */
export interface AdapterModuleDependencies {
  /** Test-only transport binding for deterministic HTTP behavior */
  transport: SourceTransportBinding;
  /** Resolution binding for DNS/redirect evidence (test-injected) */
  resolution: SourceResolutionBinding;
  /** Current timestamp provider for audit consistency */
  now: () => Date;
  /** Cancellation signal for cooperative shutdown */
  isCancellationRequested: () => Promise<boolean>;
}

/**
 * Adapter execution context passed to module implementations.
 * Contains frozen admission snapshot and runtime bindings.
 */
export interface AdapterExecutionContext {
  /** Workspace isolation boundary */
  workspaceId: string;
  /** Source task identifier for audit correlation */
  sourceTaskId: string;
  /** Research job identifier for aggregation */
  researchJobId: string;
  /** Frozen request envelope from admission snapshot */
  request: SourceRequestEnvelope;
  /** Frozen admission decision from preflight */
  admission: ConnectorAdmissionDecision;
  /** Frozen capability contract */
  capability: SourceCapability;
  /** Frozen policy contract with quotas/limits */
  policy: ConnectorPolicy;
  /** Injected dependencies (transport, resolution, clock, cancellation) */
  dependencies: AdapterModuleDependencies;
}

/**
 * Adapter execution result with provenance tracking.
 */
export interface AdapterExecutionResult {
  /** Normalized result envelope matching source contracts */
  result: SourceResultEnvelope;
  /** Result reference identifier for persistence layer */
  resultRef: string;
  /** Provenance references (health snapshots, resolution evidence, etc.) */
  provenanceRefs: readonly string[];
}

/**
 * Adapter module interface for registration with the runtime.
 * Implementations must be pure functions of their context—no side effects
 * outside provided dependencies.
 */
export interface AdapterModule {
  /** Module identity for registry matching */
  identity: AdapterModuleIdentity;
  /**
   * Execute adapter logic within bounded context.
   * Must respect budget limits, cancellation signals, and policy constraints.
   */
  execute(context: AdapterExecutionContext): Promise<AdapterExecutionResult>;
  /**
   * Optional health check for adapter readiness.
   * Returns true if adapter can accept work.
   */
  healthCheck?(): Promise<boolean>;
  /**
   * Optional teardown for resource cleanup.
   * Called when adapter is deregistered or runtime shuts down.
   */
  teardown?(): Promise<void>;
}

/**
 * Adapter module factory function signature.
 * Factories receive dependencies and return configured adapter instances.
 */
export type AdapterModuleFactory = (
  dependencies: AdapterModuleDependencies,
) => AdapterModule | Promise<AdapterModule>;

/**
 * Registered adapter entry in the module registry.
 * Includes metadata for lifecycle management and health tracking.
 */
export interface RegisteredAdapter {
  /** Adapter module instance */
  module: AdapterModule;
  /** Registration timestamp */
  registeredAt: Date;
  /** Last health check timestamp */
  lastHealthCheckAt?: Date;
  /** Health status from last check */
  lastHealthStatus?: boolean;
  /** Execution count since registration */
  executionCount: number;
  /** Last error encountered (if any) */
  lastError?: Error;
  /** Last execution timestamp */
  lastExecutionAt?: Date;
}

/**
 * Adapter module registry options.
 */
export interface AdapterRegistryOptions {
  /** Maximum number of registered adapters (M02 limit: 64) */
  maxAdapters: number;
  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number;
  /** Whether to run periodic health checks */
  enableHealthChecks: boolean;
  /** Timestamp provider */
  now?: () => Date;
}

/**
 * Adapter module registry for managing adapter lifecycle.
 * Provides registration, discovery, and health monitoring.
 */
export class AdapterModuleRegistry {
  private readonly adapters = new Map<string, RegisteredAdapter>();
  private readonly maxAdapters: number;
  private readonly healthCheckIntervalMs: number;
  private readonly enableHealthChecks: boolean;
  private readonly now: () => Date;
  private healthCheckTimer?: NodeJS.Timeout | undefined;

  constructor(options: AdapterRegistryOptions) {
    if (!Number.isSafeInteger(options.maxAdapters) || options.maxAdapters < 1 || options.maxAdapters > 64) {
      throw new RangeError('AdapterRegistryOptions.maxAdapters must be an integer between 1 and 64.');
    }
    if (
      !Number.isSafeInteger(options.healthCheckIntervalMs) ||
      options.healthCheckIntervalMs < 1000 ||
      options.healthCheckIntervalMs > 3_600_000
    ) {
      throw new RangeError('AdapterRegistryOptions.healthCheckIntervalMs must be between 1000 and 3600000.');
    }

    this.maxAdapters = options.maxAdapters;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs;
    this.enableHealthChecks = options.enableHealthChecks;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Register an adapter module factory.
   * Factory is invoked immediately to create the adapter instance.
   */
  async register(
    connectorKey: string,
    factory: AdapterModuleFactory,
    dependencies: AdapterModuleDependencies,
  ): Promise<void> {
    if (this.adapters.size >= this.maxAdapters) {
      throw new RangeError(`Adapter registry is full (max ${this.maxAdapters} adapters).`);
    }

    const module = await factory(dependencies);

    // Validate identity matches registration key
    if (module.identity.connectorKey !== connectorKey) {
      throw new Error(
        `Adapter connectorKey mismatch: expected ${connectorKey}, got ${module.identity.connectorKey}`,
      );
    }

    // Enforce M02 security boundary
    if (module.identity.networkAccess !== 'none') {
      throw new Error(`Adapter ${connectorKey} must have networkAccess='none' in M02.`);
    }

    const registered: RegisteredAdapter = {
      module,
      registeredAt: this.now(),
      executionCount: 0,
    };

    this.adapters.set(connectorKey, registered);

    // Start health checks if enabled
    if (this.enableHealthChecks && !this.healthCheckTimer) {
      this.startHealthChecks();
    }
  }

  /**
   * Deregister an adapter module.
   * Calls teardown if available.
   */
  async deregister(connectorKey: string): Promise<boolean> {
    const adapter = this.adapters.get(connectorKey);
    if (!adapter) return false;

    try {
      if (adapter.module.teardown) {
        await adapter.module.teardown();
      }
    } finally {
      this.adapters.delete(connectorKey);
    }

    return true;
  }

  /**
   * Get a registered adapter by connector key.
   */
  get(connectorKey: string): AdapterModule | undefined {
    return this.adapters.get(connectorKey)?.module;
  }

  /**
   * Check if an adapter is registered and healthy.
   */
  async isHealthy(connectorKey: string): Promise<boolean> {
    const adapter = this.adapters.get(connectorKey);
    if (!adapter) return false;

    if (adapter.module.healthCheck) {
      try {
        const status = await adapter.module.healthCheck();
        adapter.lastHealthCheckAt = this.now();
        adapter.lastHealthStatus = status;
        return status;
      } catch {
        adapter.lastHealthStatus = false;
        return false;
      }
    }

    // No health check method means assume healthy
    return true;
  }

  /**
   * Execute an adapter with the given context.
   * Tracks execution metrics and errors.
   */
  async execute(connectorKey: string, context: AdapterExecutionContext): Promise<AdapterExecutionResult> {
    const adapter = this.adapters.get(connectorKey);
    if (!adapter) {
      throw new Error(`Adapter not found: ${connectorKey}`);
    }

    adapter.lastExecutionAt = this.now();
    adapter.executionCount += 1;

    try {
      return await adapter.module.execute(context);
    } catch (error) {
      adapter.lastError = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Get all registered adapter keys.
   */
  getRegisteredKeys(): readonly string[] {
    return [...this.adapters.keys()];
  }

  /**
   * Get adapter statistics.
   */
  getStats(connectorKey: string): Omit<RegisteredAdapter, 'module'> | undefined {
    const adapter = this.adapters.get(connectorKey);
    if (!adapter) return undefined;

    const { module, ...stats } = adapter;
    return stats;
  }

  /**
   * Start periodic health checks for all registered adapters.
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      const checks = Array.from(this.adapters.entries()).map(async ([key, adapter]) => {
        if (adapter.module.healthCheck) {
          try {
            adapter.lastHealthStatus = await adapter.module.healthCheck();
            adapter.lastHealthCheckAt = this.now();
          } catch {
            adapter.lastHealthStatus = false;
          }
        }
      });
      await Promise.all(checks);
    }, this.healthCheckIntervalMs);

    // Prevent timer from keeping process alive
    this.healthCheckTimer.unref?.();
  }

  /**
   * Stop health checks and teardown all adapters.
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    const teardowns = Array.from(this.adapters.entries()).map(async ([key, adapter]) => {
      try {
        if (adapter.module.teardown) {
          await adapter.module.teardown();
        }
      } catch {
        // Log but don't throw during shutdown
      }
    });

    await Promise.all(teardowns);
    this.adapters.clear();
  }
}

/**
 * Create adapter module dependencies with test-injected bindings.
 * This factory ensures all dependencies are explicitly provided.
 */
export function createAdapterDependencies(input: {
  transport: SourceTransportBinding;
  resolution: SourceResolutionBinding;
  now?: () => Date;
  isCancellationRequested?: () => Promise<boolean>;
}): AdapterModuleDependencies {
  return {
    transport: input.transport,
    resolution: input.resolution,
    now: input.now ?? (() => new Date()),
    isCancellationRequested: input.isCancellationRequested ?? (async () => false),
  };
}
