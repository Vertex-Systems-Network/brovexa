import type { WorkHandler } from './runtime';
import {
  M04_WEBSITE_INSPECTION_WORK_TYPE,
  createWebsiteInspectionWorkHandler,
  type WebsiteInspectionWorkerDependencies,
} from './website-inspection-worker';
import {
  createWebsiteFixturePipeline,
  type WebsiteFixturePipelineDependencies,
} from './website-inspection-pipeline';

/**
 * WEB-025: opt-in, non-production worker registration seam. This function only
 * constructs a handler map; it does NOT register any queue, create a worker,
 * connect to a database, start timers, perform DNS, or send HTTP requests.
 *
 * An owner of the canonical queue runtime must explicitly merge the resulting
 * map into its handlers AFTER the native M04 security, DB and worker gates pass.
 * Injected exchange callbacks must remain deterministic test fixtures.
 */
export interface WebsiteInspectionWorkerRegistrationDependencies extends WebsiteFixturePipelineDependencies {
  /** Independent, tenant-scoped DB lookup (not the untrusted queue payload). */
  loadRequest: WebsiteInspectionWorkerDependencies['loadRequest'];
  /** Per-work-unit DB cancellation polling cadence, in milliseconds. */
  cancellationPollMs?: number;
}

export function createWebsiteInspectionFixtureWorkerHandlers(
  dependencies: WebsiteInspectionWorkerRegistrationDependencies,
): Readonly<Record<typeof M04_WEBSITE_INSPECTION_WORK_TYPE, WorkHandler>> {
  const pipeline = createWebsiteFixturePipeline(dependencies);
  const handler = createWebsiteInspectionWorkHandler({
    parseRequest: dependencies.contracts.parseRequest,
    parseResult: dependencies.contracts.parseResult,
    loadRequest: dependencies.loadRequest,
    runInspection: pipeline,
    ...(dependencies.cancellationPollMs === undefined
      ? {}
      : { cancellationPollMs: dependencies.cancellationPollMs }),
  });
  return Object.freeze({ [M04_WEBSITE_INSPECTION_WORK_TYPE]: handler });
}