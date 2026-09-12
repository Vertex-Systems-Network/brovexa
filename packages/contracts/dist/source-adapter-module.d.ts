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
import type { ConnectorAdmissionDecision, ConnectorPolicy, SourceCapability, SourceRequestEnvelope, SourceResultEnvelope } from './source-adapter';
import type { SourceTransportRequest, SourceTransportResolution } from './source-transport';
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
export declare const AdapterModuleIdentitySchema: z.ZodObject<{
    connectorKey: z.ZodString;
    adapterVersion: z.ZodString;
    capabilityVersion: z.ZodString;
    networkAccess: z.ZodLiteral<"none">;
}, z.core.$strip>;
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
export type AdapterModuleFactory = (dependencies: AdapterModuleDependencies) => AdapterModule | Promise<AdapterModule>;
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
export declare class AdapterModuleRegistry {
    private readonly adapters;
    private readonly maxAdapters;
    private readonly healthCheckIntervalMs;
    private readonly enableHealthChecks;
    private readonly now;
    private healthCheckTimer?;
    constructor(options: AdapterRegistryOptions);
    /**
     * Register an adapter module factory.
     * Factory is invoked immediately to create the adapter instance.
     */
    register(connectorKey: string, factory: AdapterModuleFactory, dependencies: AdapterModuleDependencies): Promise<void>;
    /**
     * Deregister an adapter module.
     * Calls teardown if available.
     */
    deregister(connectorKey: string): Promise<boolean>;
    /**
     * Get a registered adapter by connector key.
     */
    get(connectorKey: string): AdapterModule | undefined;
    /**
     * Check if an adapter is registered and healthy.
     */
    isHealthy(connectorKey: string): Promise<boolean>;
    /**
     * Execute an adapter with the given context.
     * Tracks execution metrics and errors.
     */
    execute(connectorKey: string, context: AdapterExecutionContext): Promise<AdapterExecutionResult>;
    /**
     * Get all registered adapter keys.
     */
    getRegisteredKeys(): readonly string[];
    /**
     * Get adapter statistics.
     */
    getStats(connectorKey: string): Omit<RegisteredAdapter, 'module'> | undefined;
    /**
     * Start periodic health checks for all registered adapters.
     */
    private startHealthChecks;
    /**
     * Stop health checks and teardown all adapters.
     */
    shutdown(): Promise<void>;
}
/**
 * Create adapter module dependencies with test-injected bindings.
 * This factory ensures all dependencies are explicitly provided.
 */
export declare function createAdapterDependencies(input: {
    transport: SourceTransportBinding;
    resolution: SourceResolutionBinding;
    now?: () => Date;
    isCancellationRequested?: () => Promise<boolean>;
}): AdapterModuleDependencies;
