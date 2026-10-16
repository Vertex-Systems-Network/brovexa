import {
  WebsiteInspectionRequestSchema,
  WebsiteInspectionResultSchema,
} from '@brovexa/contracts';
import {
  persistWebsiteInspectionResult,
  deleteWebsiteInspectionEvidence,
  type createPgPool,
} from '@brovexa/db';
import type { WorkHandler } from './runtime';
import type { WebsiteFixtureDecisionLookup } from './website-fixture-authorization';
import type { WebsiteInspectionDependencies } from './website-inspection-runtime';
import type { WebsiteInspectionStoragePolicy } from './website-inspection-db-bridge';
import type { WebsiteInspectionWorkerDependencies } from './website-inspection-worker';
import { createWebsiteInspectionFixtureWorkerHandlers } from './website-inspection-worker-registration';

/**
 * M04 NON-LIVE composition of the frozen WEB-001 contracts, WEB-002 atomic PG
 * evidence writer, and the WEB-003..025 fixture-only worker handler.
 *
 * This deliberately DOES NOT register the work type with an active worker,
 * queue, source registry, DNS client, HTTP client, or provider. The caller is
 * responsible for authenticating the tenant-scoped reads, RBAC and fixture
 * manifest independently of untrusted work payloads. This function creates
 * neither a DB connection nor a timer; the worker cancellation timer exists
 * only during an actual handler invocation.
 *
 * The existing DATABASE slot/PR #174 owns migration 0018; branch-level
 * integration here is not permission to mutate that standing PR.
 */
export interface M04NonLiveDatabaseIntegrationOptions {
  pool: ReturnType<typeof createPgPool>;
  loadRequest: WebsiteInspectionWorkerDependencies['loadRequest'];
  lookup: WebsiteFixtureDecisionLookup;
  exchange: WebsiteInspectionDependencies['exchange'];
  policyForWorkspace(workspaceId: string): Promise<WebsiteInspectionStoragePolicy>;
  /** Must require current workspace authorization for evidence deletion. */
  authorizeDeletion(input: Readonly<{ workspaceId: string; inspectionId: string }>): Promise<boolean>;
  cancellationPollMs?: number;
  now?: () => Date;
}

export class M04NonLiveIntegrationError extends Error {
  constructor(readonly code: 'M04_DELETION_SCOPE_INVALID' | 'M04_DELETION_NOT_AUTHORIZED') {
    super(code);
    this.name = 'M04NonLiveIntegrationError';
  }
}

const scopePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const inspectionIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export interface M04NonLiveDatabaseIntegration {
  readonly handlers: Readonly<Record<'website_inspection_fixture', WorkHandler>>;
  deleteEvidence(input: { workspaceId: string; inspectionId: string }): Promise<boolean>;
}

export function createM04NonLiveDatabaseIntegration(
  options: M04NonLiveDatabaseIntegrationOptions,
): M04NonLiveDatabaseIntegration {
  if (!options?.pool || typeof options.pool.connect !== 'function' ||
      typeof options.loadRequest !== 'function' ||
      typeof options.lookup !== 'function' ||
      typeof options.exchange !== 'function' ||
      typeof options.policyForWorkspace !== 'function' ||
      typeof options.authorizeDeletion !== 'function') {
    throw new TypeError('M04 non-live integration requires explicit scoped database and fixture adapters.');
  }
  const handlers = createWebsiteInspectionFixtureWorkerHandlers({
    contracts: {
      parseRequest: (value) => WebsiteInspectionRequestSchema.parse(value),
      parseResult: (value) => WebsiteInspectionResultSchema.parse(value),
    },
    loadRequest: options.loadRequest,
    lookup: options.lookup,
    exchange: options.exchange,
    storage: {
      policyForWorkspace: options.policyForWorkspace,
      persist: async (payload) => persistWebsiteInspectionResult(options.pool, payload),
    },
    ...(options.cancellationPollMs === undefined ? {} : { cancellationPollMs: options.cancellationPollMs }),
    ...(options.now ? { now: options.now } : {}),
  });
  const integration: M04NonLiveDatabaseIntegration = {
    handlers,
    async deleteEvidence(input) {
      if (!input || !scopePattern.test(input.workspaceId) ||
          !inspectionIdPattern.test(input.inspectionId)) {
        throw new M04NonLiveIntegrationError('M04_DELETION_SCOPE_INVALID');
      }
      // Freeze the exact ID pair used for authorization AND the DB query.
      const scope = Object.freeze({ workspaceId: input.workspaceId, inspectionId: input.inspectionId });
      if (await options.authorizeDeletion(scope) !== true) {
        throw new M04NonLiveIntegrationError('M04_DELETION_NOT_AUTHORIZED');
      }
      return deleteWebsiteInspectionEvidence(options.pool, scope);
    },
  };
  return Object.freeze(integration);
}