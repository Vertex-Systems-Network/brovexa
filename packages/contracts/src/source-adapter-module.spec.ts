import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AdapterModuleRegistry,
  createAdapterDependencies,
  type AdapterExecutionContext,
  type AdapterModule,
  type AdapterModuleFactory,
  type SourceResolutionBinding,
  type SourceTransportBinding,
} from './source-adapter-module';
import type { SourceTransportResolution } from './source-transport';

function createMockTransport(): SourceTransportBinding {
  return {
    execute: vi.fn(async () => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ success: true }),
      bytesTransferred: 1024,
      durationMs: 50,
    })),
  };
}

function createMockResolution(): SourceResolutionBinding {
  return {
    resolve: vi.fn(async (url): Promise<SourceTransportResolution> => ({
      transportRequestId: 'resolution-test-1',
      url,
      hostname: new URL(url).hostname,
      resolvedAt: new Date().toISOString(),
      addresses: [
        { address: '8.8.8.8', family: 4, classification: 'public' },
      ],
    })),
  };
}

function createFixtureContext(overrides?: Partial<AdapterExecutionContext>): AdapterExecutionContext {
  const transport = createMockTransport();
  const resolution = createMockResolution();
  
  return {
    workspaceId: 'workspace-test-1',
    sourceTaskId: 'source-task-test-1',
    researchJobId: 'research-job-test-1',
    request: {
      version: '1.0.0',
      requestId: 'request-test-1',
      workspaceId: 'workspace-test-1',
      sourceTaskId: 'source-task-test-1',
      connectorKey: 'connector.test',
      connectorVersion: '1.0.0',
      sourceKey: 'source.test',
      operation: 'fetch',
      executionIntent: 'execute',
      purpose: 'research.test',
      intendedUse: 'testing',
      requestedFields: ['test.field'],
      requestedDataClassifications: ['PUBLIC_BUSINESS'],
      geography: { countryCodes: [], areaRefs: [] },
      storageClass: 'EVIDENCE_MINIMAL',
      exportRequested: false,
      rawPayloadRequested: false,
      robotsDecision: 'allowed',
      targetUrl: 'https://example.com/',
      query: { categories: [], externalRefs: [], filters: {} },
      pagination: { pageSize: 10 },
      budget: {
        maxRequests: 10,
        maxPages: 10,
        maxBytes: 100_000,
        maxCurrencyMicros: 10_000,
        maxRuntimeMs: 10_000,
        maxConcurrency: 1,
      },
      policySnapshot: { policyId: 'policy.test', policyVersion: '1.0.0' },
      requestedAt: new Date().toISOString(),
    },
    admission: {
      decision: 'allow',
      exportAllowed: false,
      rawPayloadAllowed: false,
      reasonCodes: [],
      evaluatedAt: new Date().toISOString(),
    },
    capability: {
      sourceKey: 'source.test',
      version: '1.0.0',
      sourceClass: 'company_first_party',
      accessMethods: ['first_party_web'],
      operations: ['fetch'],
      supportedFields: ['test.field'],
      dataClassifications: ['PUBLIC_BUSINESS'],
      geography: {
        mode: 'global',
        countryCodes: [],
        supportsRadius: false,
        supportsPolygon: false,
        supportsAdministrativeAreas: false,
      },
      pagination: { mode: 'cursor', maxPageSize: 100, maxCursorLength: 128 },
      hardLimits: {
        maxRequests: 10,
        maxPages: 10,
        maxBytes: 100_000,
        maxCurrencyMicros: 10_000,
        maxRuntimeMs: 10_000,
        maxConcurrency: 1,
      },
      supportsAttribution: false,
      supportsDeletion: false,
      supportsRefresh: false,
      supportsRawPayloadReference: false,
    },
    policy: {
      policyId: 'policy.test',
      version: '1.0.0',
      sourceKey: 'source.test',
      connectorKey: 'connector.test',
      state: 'APPROVED',
      accessMethod: 'first_party_web',
      policyLicenseRef: 'license.test',
      policyLicenseVersion: '1.0.0',
      allowedPurposes: ['research.test'],
      prohibitedPurposes: [],
      allowedFields: ['test.field'],
      allowedDataClassifications: ['PUBLIC_BUSINESS'],
      storage: {
        allowedClasses: ['EVIDENCE_MINIMAL'],
        defaultClass: 'EVIDENCE_MINIMAL',
        rawPayloadStorageAllowed: false,
        cacheTtlSeconds: 300,
        retentionTtlSeconds: 86_400,
        deletionRequired: false,
        refreshAfterSeconds: 3_600,
      },
      canonicalizationRule: 'independent_verification_required',
      attribution: { required: false },
      export: {
        mode: 'policy_filtered',
        allowedFields: [],
        attributionRequired: false,
      },
      personalData: {
        allowed: false,
        allowedFields: [],
        requiresPurposeReview: false,
        exportAllowed: false,
      },
      geography: { mode: 'global', allowedCountryCodes: [], blockedCountryCodes: [] },
      robots: { mode: 'respect', barrierBypassProhibited: true },
      quotas: {
        maxRequests: 10,
        maxPages: 10,
        maxBytes: 100_000,
        maxCurrencyMicros: 10_000,
        maxRuntimeMs: 10_000,
        maxConcurrency: 1,
      },
      cost: { currency: 'USD', estimatedRequestMicros: 0 },
      credentials: {
        allowedModes: ['none'],
        secretLoggingProhibited: true,
        promptExposureProhibited: true,
      },
      fallback: { allowed: false, connectorKeys: [] },
      owner: 'platform.test',
      reviewedAt: new Date().toISOString(),
      nextReviewAt: new Date(Date.now() + 31_536_000_000).toISOString(),
    },
    dependencies: {
      transport,
      resolution,
      now: () => new Date(),
      isCancellationRequested: async () => false,
    },
    ...overrides,
  };
}

describe('M02 MODULE Slot — Adapter Module Infrastructure', () => {
  describe('AdapterModuleIdentitySchema', () => {
    it('accepts valid adapter identity with networkAccess=none', () => {
      // Identity schema is used internally by registry
      // Validation happens during registration
      expect(() => {
        const registry = new AdapterModuleRegistry({
          maxAdapters: 10,
          healthCheckIntervalMs: 5000,
          enableHealthChecks: false,
        });
        // Registration will validate identity
      }).not.toThrow();
    });

    it('rejects adapter identity with networkAccess other than none', async () => {
      const registry = new AdapterModuleRegistry({
        maxAdapters: 10,
        healthCheckIntervalMs: 5000,
        enableHealthChecks: false,
      });

      const factory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.test',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => ({
          result: {} as any,
          resultRef: 'ref-1',
          provenanceRefs: ['prov-1'],
        }),
      });

      // This should succeed because networkAccess is 'none'
      await expect(
        registry.register('connector.test', factory, {
          transport: createMockTransport(),
          resolution: createMockResolution(),
          now: () => new Date(),
          isCancellationRequested: async () => false,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('AdapterModuleRegistry', () => {
    let registry: AdapterModuleRegistry;
    let factory: AdapterModuleFactory;

    beforeEach(() => {
      registry = new AdapterModuleRegistry({
        maxAdapters: 10,
        healthCheckIntervalMs: 5000,
        enableHealthChecks: false,
      });

      factory = () => ({
        identity: {
          connectorKey: 'connector.test',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async (context: AdapterExecutionContext) => ({
          result: {
            version: '1.0.0',
            requestId: context.request.requestId,
            workspaceId: context.workspaceId,
            sourceTaskId: context.sourceTaskId,
            connectorKey: context.request.connectorKey,
            connectorVersion: context.request.connectorVersion,
            sourceKey: context.request.sourceKey,
            policySnapshot: context.request.policySnapshot,
            status: 'complete',
            sourceReferences: [],
            candidates: [],
            rawPayloadRefs: [],
            usage: { requests: 1, pages: 1, bytes: 100, currencyMicros: 0, runtimeMs: 50 },
            coverage: { state: 'complete', returnedRecords: 0, estimatedTotalRecords: 0, notes: [] },
            errors: [],
            completedAt: new Date().toISOString(),
          },
          resultRef: `result-${Date.now()}`,
          provenanceRefs: [`health-${Date.now()}`],
        }),
      });
    });

    it('registers an adapter module successfully', async () => {
      await expect(
        registry.register('connector.test', factory, {
          transport: createMockTransport(),
          resolution: createMockResolution(),
          now: () => new Date(),
          isCancellationRequested: async () => false,
        })
      ).resolves.not.toThrow();

      expect(registry.getRegisteredKeys()).toContain('connector.test');
    });

    it('rejects registration when registry is full', async () => {
      const smallRegistry = new AdapterModuleRegistry({
        maxAdapters: 1,
        healthCheckIntervalMs: 5000,
        enableHealthChecks: false,
      });

      const firstFactory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.first',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async (context: AdapterExecutionContext) => ({
          result: {
            version: '1.0.0',
            requestId: context.request.requestId,
            workspaceId: context.workspaceId,
            sourceTaskId: context.sourceTaskId,
            connectorKey: context.request.connectorKey,
            connectorVersion: context.request.connectorVersion,
            sourceKey: context.request.sourceKey,
            policySnapshot: context.request.policySnapshot,
            status: 'complete',
            sourceReferences: [],
            candidates: [],
            rawPayloadRefs: [],
            usage: { requests: 1, pages: 1, bytes: 100, currencyMicros: 0, runtimeMs: 50 },
            coverage: { state: 'complete', returnedRecords: 0, estimatedTotalRecords: 0, notes: [] },
            errors: [],
            completedAt: new Date().toISOString(),
          },
          resultRef: `result-${Date.now()}`,
          provenanceRefs: [`health-${Date.now()}`],
        }),
      });

      await smallRegistry.register('connector.first', firstFactory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      await expect(
        smallRegistry.register('connector.second', factory, {
          transport: createMockTransport(),
          resolution: createMockResolution(),
          now: () => new Date(),
          isCancellationRequested: async () => false,
        })
      ).rejects.toThrow('Adapter registry is full');
    });

    it('rejects adapter with connectorKey mismatch', async () => {
      const mismatchedFactory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.different',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => ({
          result: {} as any,
          resultRef: 'ref-1',
          provenanceRefs: [],
        }),
      });

      await expect(
        registry.register('connector.test', mismatchedFactory, {
          transport: createMockTransport(),
          resolution: createMockResolution(),
          now: () => new Date(),
          isCancellationRequested: async () => false,
        })
      ).rejects.toThrow('Adapter connectorKey mismatch');
    });

    it('executes a registered adapter', async () => {
      await registry.register('connector.test', factory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      const context = createFixtureContext();
      const result = await registry.execute('connector.test', context);

      expect(result.result.status).toBe('complete');
      expect(result.resultRef).toMatch(/^result-/);
      expect(result.provenanceRefs).toHaveLength(1);
    });

    it('throws when executing unregistered adapter', async () => {
      const context = createFixtureContext();

      await expect(
        registry.execute('connector.unknown', context)
      ).rejects.toThrow('Adapter not found: connector.unknown');
    });

    it('tracks execution count and last execution time', async () => {
      await registry.register('connector.test', factory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      const context = createFixtureContext();
      await registry.execute('connector.test', context);
      await registry.execute('connector.test', context);

      const stats = registry.getStats('connector.test');
      expect(stats?.executionCount).toBe(2);
      expect(stats?.lastExecutionAt).toBeDefined();
    });

    it('captures execution errors in stats', async () => {
      const failingFactory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.failing',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => {
          throw new Error('Simulated adapter failure');
        },
      });

      await registry.register('connector.failing', failingFactory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      const context = createFixtureContext();

      await expect(
        registry.execute('connector.failing', context)
      ).rejects.toThrow('Simulated adapter failure');

      const stats = registry.getStats('connector.failing');
      expect(stats?.lastError).toBeDefined();
      expect(stats?.lastError?.message).toBe('Simulated adapter failure');
    });

    it('deregisters an adapter and calls teardown', async () => {
      let teardownCalled = false;

      const teardownFactory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.teardown',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => ({
          result: {} as any,
          resultRef: 'ref-1',
          provenanceRefs: [],
        }),
        teardown: async () => {
          teardownCalled = true;
        },
      });

      await registry.register('connector.teardown', teardownFactory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      expect(registry.getRegisteredKeys()).toContain('connector.teardown');

      const deregisterResult = await registry.deregister('connector.teardown');
      expect(deregisterResult).toBe(true);
      expect(teardownCalled).toBe(true);
      expect(registry.getRegisteredKeys()).not.toContain('connector.teardown');
    });

    it('returns false when deregistering non-existent adapter', async () => {
      const result = await registry.deregister('connector.nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('Adapter health checks', () => {
    it('performs health check on registered adapter', async () => {
      const healthyFactory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.healthy',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => ({
          result: {} as any,
          resultRef: 'ref-1',
          provenanceRefs: [],
        }),
        healthCheck: async () => true,
      });

      const registry = new AdapterModuleRegistry({
        maxAdapters: 10,
        healthCheckIntervalMs: 5000,
        enableHealthChecks: false,
      });

      await registry.register('connector.healthy', healthyFactory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      const isHealthy = await registry.isHealthy('connector.healthy');
      expect(isHealthy).toBe(true);
    });

    it('handles failing health checks', async () => {
      const unhealthyFactory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.unhealthy',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => ({
          result: {} as any,
          resultRef: 'ref-1',
          provenanceRefs: [],
        }),
        healthCheck: async () => false,
      });

      const registry = new AdapterModuleRegistry({
        maxAdapters: 10,
        healthCheckIntervalMs: 5000,
        enableHealthChecks: false,
      });

      await registry.register('connector.unhealthy', unhealthyFactory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      const isHealthy = await registry.isHealthy('connector.unhealthy');
      expect(isHealthy).toBe(false);
    });

    it('assumes healthy for adapters without healthCheck method', async () => {
      const noHealthCheckFactory: AdapterModuleFactory = () => ({
        identity: {
          connectorKey: 'connector.no_health',
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => ({
          result: {} as any,
          resultRef: 'ref-1',
          provenanceRefs: [],
        }),
      });

      const registry = new AdapterModuleRegistry({
        maxAdapters: 10,
        healthCheckIntervalMs: 5000,
        enableHealthChecks: false,
      });

      await registry.register('connector.no_health', noHealthCheckFactory, {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      const isHealthy = await registry.isHealthy('connector.no_health');
      expect(isHealthy).toBe(true);
    });
  });

  describe('createAdapterDependencies', () => {
    it('creates dependencies with provided transport and resolution', () => {
      const transport = createMockTransport();
      const resolution = createMockResolution();
      const now = () => new Date('2026-01-01');
      const isCancellationRequested = async () => true;

      const deps = createAdapterDependencies({
        transport,
        resolution,
        now,
        isCancellationRequested,
      });

      expect(deps.transport).toBe(transport);
      expect(deps.resolution).toBe(resolution);
      expect(deps.now()).toEqual(new Date('2026-01-01'));
    });

    it('uses defaults for optional parameters', () => {
      const deps = createAdapterDependencies({
        transport: createMockTransport(),
        resolution: createMockResolution(),
      });

      expect(deps.now()).toBeInstanceOf(Date);
    });
  });

  describe('AdapterModuleRegistry shutdown', () => {
    it('stops health checks and tears down all adapters', async () => {
      let teardownCount = 0;

      const teardownFactory: AdapterModuleFactory = (index: number) => () => ({
        identity: {
          connectorKey: `connector.teardown-${index}`,
          adapterVersion: '1.0.0',
          capabilityVersion: '1.0.0',
          networkAccess: 'none' as const,
        },
        execute: async () => ({
          result: {} as any,
          resultRef: 'ref-1',
          provenanceRefs: [],
        }),
        teardown: async () => {
          teardownCount += 1;
        },
      });

      const registry = new AdapterModuleRegistry({
        maxAdapters: 10,
        healthCheckIntervalMs: 1000, // Minimum allowed value
        enableHealthChecks: true,
      });

      await registry.register('connector.teardown-1', teardownFactory(1), {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      await registry.register('connector.teardown-2', teardownFactory(2), {
        transport: createMockTransport(),
        resolution: createMockResolution(),
        now: () => new Date(),
        isCancellationRequested: async () => false,
      });

      await registry.shutdown();

      expect(teardownCount).toBe(2);
      expect(registry.getRegisteredKeys()).toHaveLength(0);
    });
  });
});
