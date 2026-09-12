"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterModuleRegistry = exports.AdapterModuleIdentitySchema = void 0;
exports.createAdapterDependencies = createAdapterDependencies;
const zod_1 = require("zod");
/**
 * Adapter module identity and versioning contract.
 */
exports.AdapterModuleIdentitySchema = zod_1.z.object({
    /** Canonical connector key matching registry definition */
    connectorKey: zod_1.z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    /** Adapter implementation semantic version */
    adapterVersion: zod_1.z.string().min(1).max(64),
    /** Capability version this adapter implements */
    capabilityVersion: zod_1.z.string().min(1).max(64),
    /** Network access mode — must be 'none' in M02 bounded slice */
    networkAccess: zod_1.z.literal('none'),
});
/**
 * Adapter module registry for managing adapter lifecycle.
 * Provides registration, discovery, and health monitoring.
 */
class AdapterModuleRegistry {
    adapters = new Map();
    maxAdapters;
    healthCheckIntervalMs;
    enableHealthChecks;
    now;
    healthCheckTimer;
    constructor(options) {
        if (!Number.isSafeInteger(options.maxAdapters) || options.maxAdapters < 1 || options.maxAdapters > 64) {
            throw new RangeError('AdapterRegistryOptions.maxAdapters must be an integer between 1 and 64.');
        }
        if (!Number.isSafeInteger(options.healthCheckIntervalMs) ||
            options.healthCheckIntervalMs < 1000 ||
            options.healthCheckIntervalMs > 3_600_000) {
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
    async register(connectorKey, factory, dependencies) {
        if (this.adapters.size >= this.maxAdapters) {
            throw new RangeError(`Adapter registry is full (max ${this.maxAdapters} adapters).`);
        }
        const module = await factory(dependencies);
        // Validate identity matches registration key
        if (module.identity.connectorKey !== connectorKey) {
            throw new Error(`Adapter connectorKey mismatch: expected ${connectorKey}, got ${module.identity.connectorKey}`);
        }
        // Enforce M02 security boundary
        if (module.identity.networkAccess !== 'none') {
            throw new Error(`Adapter ${connectorKey} must have networkAccess='none' in M02.`);
        }
        const registered = {
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
    async deregister(connectorKey) {
        const adapter = this.adapters.get(connectorKey);
        if (!adapter)
            return false;
        try {
            if (adapter.module.teardown) {
                await adapter.module.teardown();
            }
        }
        finally {
            this.adapters.delete(connectorKey);
        }
        return true;
    }
    /**
     * Get a registered adapter by connector key.
     */
    get(connectorKey) {
        return this.adapters.get(connectorKey)?.module;
    }
    /**
     * Check if an adapter is registered and healthy.
     */
    async isHealthy(connectorKey) {
        const adapter = this.adapters.get(connectorKey);
        if (!adapter)
            return false;
        if (adapter.module.healthCheck) {
            try {
                const status = await adapter.module.healthCheck();
                adapter.lastHealthCheckAt = this.now();
                adapter.lastHealthStatus = status;
                return status;
            }
            catch {
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
    async execute(connectorKey, context) {
        const adapter = this.adapters.get(connectorKey);
        if (!adapter) {
            throw new Error(`Adapter not found: ${connectorKey}`);
        }
        adapter.lastExecutionAt = this.now();
        adapter.executionCount += 1;
        try {
            return await adapter.module.execute(context);
        }
        catch (error) {
            adapter.lastError = error instanceof Error ? error : new Error(String(error));
            throw error;
        }
    }
    /**
     * Get all registered adapter keys.
     */
    getRegisteredKeys() {
        return [...this.adapters.keys()];
    }
    /**
     * Get adapter statistics.
     */
    getStats(connectorKey) {
        const adapter = this.adapters.get(connectorKey);
        if (!adapter)
            return undefined;
        const { module, ...stats } = adapter;
        return stats;
    }
    /**
     * Start periodic health checks for all registered adapters.
     */
    startHealthChecks() {
        this.healthCheckTimer = setInterval(async () => {
            const checks = Array.from(this.adapters.entries()).map(async ([key, adapter]) => {
                if (adapter.module.healthCheck) {
                    try {
                        adapter.lastHealthStatus = await adapter.module.healthCheck();
                        adapter.lastHealthCheckAt = this.now();
                    }
                    catch {
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
    async shutdown() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }
        const teardowns = Array.from(this.adapters.entries()).map(async ([key, adapter]) => {
            try {
                if (adapter.module.teardown) {
                    await adapter.module.teardown();
                }
            }
            catch {
                // Log but don't throw during shutdown
            }
        });
        await Promise.all(teardowns);
        this.adapters.clear();
    }
}
exports.AdapterModuleRegistry = AdapterModuleRegistry;
/**
 * Create adapter module dependencies with test-injected bindings.
 * This factory ensures all dependencies are explicitly provided.
 */
function createAdapterDependencies(input) {
    return {
        transport: input.transport,
        resolution: input.resolution,
        now: input.now ?? (() => new Date()),
        isCancellationRequested: input.isCancellationRequested ?? (async () => false),
    };
}
//# sourceMappingURL=source-adapter-module.js.map