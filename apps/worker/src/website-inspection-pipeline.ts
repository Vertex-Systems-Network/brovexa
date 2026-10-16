import type { WebsiteInspectionResult } from '@brovexa/contracts';
import {
  executeWebsiteInspectionFixture,
  type WebsiteInspectionDependencies,
} from './website-inspection-runtime';
import {
  createWebsiteStoredFixtureAuthorizer,
  type WebsiteFixtureDecisionLookup,
} from './website-fixture-authorization';
import { extractWebsiteCapabilitiesFromFixture } from './website-fixture-extractor';
import {
  createWebsiteInspectionPersistenceHandoff,
  type WebsiteInspectionPersistenceHandoffDependencies,
} from './website-inspection-db-bridge';

/**
 * M04 WEB-003/004/005 compositional integration, fixtures ONLY.
 * Locks extraction to conservative local evidence (not caller-provided claims).
 * All authorization records and tenant retention policies come from independent
 * stores. This function never opens sockets, performs DNS, or fetches any URL.
 * Not a production inspection runner or a replacement for M02 SSRF gates.
 */
export interface WebsiteFixturePipelineDependencies {
  contracts: WebsiteInspectionDependencies['contracts'];
  /** Must be an independently trusted read by (workspaceId, inspectionId). */
  lookup: WebsiteFixtureDecisionLookup;
  /** Only deterministic test transport; never the global fetch API. */
  exchange: WebsiteInspectionDependencies['exchange'];
  /** Native WEB-002 persistence adapter is wired ONLY after integration. */
  storage: Pick<WebsiteInspectionPersistenceHandoffDependencies,
    'policyForWorkspace' | 'persist'>;
  now?: () => Date;
}

export interface WebsiteFixtureRunOptions {
  /** WEB-021: per-work-unit signal, never shared between concurrent inspections. */
  cancellationSignal?: AbortSignal;
}

export function createWebsiteFixturePipeline(dependencies: WebsiteFixturePipelineDependencies):
  (request: unknown, options?: WebsiteFixtureRunOptions) => Promise<WebsiteInspectionResult> {
  const authorize = createWebsiteStoredFixtureAuthorizer(dependencies.lookup);
  const handoff = createWebsiteInspectionPersistenceHandoff({
    parseResult: (raw) => dependencies.contracts.parseResult(raw),
    policyForWorkspace: dependencies.storage.policyForWorkspace,
    persist: dependencies.storage.persist,
  });
  return (rawRequest, options) => executeWebsiteInspectionFixture(rawRequest, {
    contracts: dependencies.contracts,
    authorize,
    exchange: dependencies.exchange,
    // Do not expose an arbitrary extractor here; the only supported path
    // must derive findings deterministically from the attested fixture bytes.
    extract: extractWebsiteCapabilitiesFromFixture,
    persist: async (result) => { await handoff(result); },
    ...(dependencies.now ? { now: dependencies.now } : {}),
    ...(options?.cancellationSignal ? { cancellationSignal: options.cancellationSignal } : {}),
  });
}