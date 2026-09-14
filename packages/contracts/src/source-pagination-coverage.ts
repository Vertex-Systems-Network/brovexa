import { z } from 'zod';
import {
  ConnectorAdmissionDecisionSchema,
  SourceBudgetSchema,
  SourceRequestEnvelopeSchema,
  SourceResultEnvelopeSchema,
  type SourceBudget,
} from './source';

const IdentifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const VersionSchema = z.string().trim().min(1).max(64);
const SafeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const SourcePaginationCoveragePageSchema = z
  .object({
    pageIndex: z.number().int().min(0).max(9_999),
    request: SourceRequestEnvelopeSchema,
    admission: ConnectorAdmissionDecisionSchema,
    result: SourceResultEnvelopeSchema,
  })
  .strict();

const SourcePaginationContinuationSchema = z
  .object({
    hasMore: z.boolean(),
    nextCursor: z.string().max(4096).optional(),
    nextPage: z.number().int().positive().optional(),
  })
  .strict();

const SourcePaginationCumulativeUsageSchema = z
  .object({
    requests: SafeIntegerSchema,
    pages: SafeIntegerSchema,
    bytes: SafeIntegerSchema,
    currencyMicros: SafeIntegerSchema,
    runtimeMs: SafeIntegerSchema,
  })
  .strict();

const SourcePaginationAggregateCoverageSchema = z
  .object({
    state: z.enum(['complete', 'partial', 'unknown']),
    returnedRecords: SafeIntegerSchema,
  })
  .strict();

function sameBudget(left: SourceBudget, right: SourceBudget): boolean {
  return (
    left.maxRequests === right.maxRequests &&
    left.maxPages === right.maxPages &&
    left.maxBytes === right.maxBytes &&
    left.maxCurrencyMicros === right.maxCurrencyMicros &&
    left.maxRuntimeMs === right.maxRuntimeMs &&
    left.maxConcurrency === right.maxConcurrency
  );
}

function budgetExceeds(requested: SourceBudget, limit: SourceBudget): boolean {
  return (
    requested.maxRequests > limit.maxRequests ||
    requested.maxPages > limit.maxPages ||
    requested.maxBytes > limit.maxBytes ||
    requested.maxCurrencyMicros > limit.maxCurrencyMicros ||
    requested.maxRuntimeMs > limit.maxRuntimeMs ||
    requested.maxConcurrency > limit.maxConcurrency
  );
}

function safeSum(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    if (value > Number.MAX_SAFE_INTEGER - total) return null;
    total += value;
  }
  return total;
}

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message });
}

export const SourcePaginationCoverageChainSchema = z
  .object({
    version: z.literal('1.0.0'),
    chainId: IdentifierSchema,
    mode: z.enum(['cursor', 'page']),
    workspaceId: IdentifierSchema,
    sourceTaskId: IdentifierSchema,
    connectorKey: z.string().regex(/^connector\.[a-z0-9_.-]+$/),
    connectorVersion: VersionSchema,
    sourceKey: z.string().regex(/^source\.[a-z0-9_.-]+$/),
    policySnapshot: z.object({ policyId: IdentifierSchema, policyVersion: VersionSchema }).strict(),
    budgetSnapshot: SourceBudgetSchema,
    pages: z.array(SourcePaginationCoveragePageSchema).min(1).max(10_000),
    continuation: SourcePaginationContinuationSchema,
    cumulativeUsage: SourcePaginationCumulativeUsageSchema,
    coverage: SourcePaginationAggregateCoverageSchema,
    reasonCodes: z.array(IdentifierSchema).max(64),
  })
  .strict()
  .superRefine((chain, ctx) => {
    const requestIds = chain.pages.map((page) => page.request.requestId);
    if (new Set(requestIds).size !== requestIds.length) {
      addIssue(ctx, ['pages'], 'Pagination chain request IDs must be unique.');
    }

    if (chain.pages.length > chain.budgetSnapshot.maxPages) {
      addIssue(ctx, ['pages'], 'Pagination chain page count exceeds the frozen page budget.');
    }

    const seenRequestCursors = new Set<string>();
    const returnedRecordValues: number[] = [];
    const requestUsageValues: number[] = [];
    const pageUsageValues: number[] = [];
    const byteUsageValues: number[] = [];
    const currencyUsageValues: number[] = [];
    const runtimeUsageValues: number[] = [];

    for (let index = 0; index < chain.pages.length; index += 1) {
      const page = chain.pages[index];
      if (!page) continue;
      const { request, admission, result } = page;

      if (page.pageIndex !== index) {
        addIssue(ctx, ['pages', index, 'pageIndex'], 'Pagination page indexes must be contiguous and start at zero.');
      }

      if (
        request.workspaceId !== chain.workspaceId ||
        request.sourceTaskId !== chain.sourceTaskId ||
        request.connectorKey !== chain.connectorKey ||
        request.connectorVersion !== chain.connectorVersion ||
        request.sourceKey !== chain.sourceKey ||
        request.policySnapshot.policyId !== chain.policySnapshot.policyId ||
        request.policySnapshot.policyVersion !== chain.policySnapshot.policyVersion
      ) {
        addIssue(ctx, ['pages', index, 'request'], 'Pagination request identity must match the frozen chain identity.');
      }
      if (request.executionIntent !== 'execute') {
        addIssue(ctx, ['pages', index, 'request', 'executionIntent'], 'Pagination execution pages require executionIntent=execute.');
      }
      if (!sameBudget(request.budget, chain.budgetSnapshot)) {
        addIssue(ctx, ['pages', index, 'request', 'budget'], 'Every pagination request must carry the frozen chain budget snapshot.');
      }

      if (admission.decision !== 'allow') {
        addIssue(ctx, ['pages', index, 'admission', 'decision'], 'Executed pagination pages require an allow admission decision.');
      }
      if (
        admission.connectorKey !== request.connectorKey ||
        admission.connectorVersion !== request.connectorVersion ||
        admission.sourceKey !== request.sourceKey ||
        admission.policySnapshot.policyId !== request.policySnapshot.policyId ||
        admission.policySnapshot.policyVersion !== request.policySnapshot.policyVersion ||
        admission.operation !== request.operation ||
        admission.storageClass !== request.storageClass
      ) {
        addIssue(ctx, ['pages', index, 'admission'], 'Pagination admission must exactly bind the page request identity and policy.');
      }
      if (budgetExceeds(chain.budgetSnapshot, admission.effectiveBudget)) {
        addIssue(ctx, ['pages', index, 'admission', 'effectiveBudget'], 'Frozen pagination budget must not exceed the admitted effective budget.');
      }
      if (Date.parse(admission.evaluatedAt) < Date.parse(request.requestedAt)) {
        addIssue(ctx, ['pages', index, 'admission', 'evaluatedAt'], 'Pagination admission cannot predate its request.');
      }

      if (
        result.requestId !== request.requestId ||
        result.workspaceId !== request.workspaceId ||
        result.sourceTaskId !== request.sourceTaskId ||
        result.connectorKey !== request.connectorKey ||
        result.connectorVersion !== request.connectorVersion ||
        result.sourceKey !== request.sourceKey ||
        result.policySnapshot.policyId !== request.policySnapshot.policyId ||
        result.policySnapshot.policyVersion !== request.policySnapshot.policyVersion
      ) {
        addIssue(ctx, ['pages', index, 'result'], 'Pagination result identity must exactly bind the admitted page request.');
      }
      if (Date.parse(result.completedAt) < Date.parse(admission.evaluatedAt)) {
        addIssue(ctx, ['pages', index, 'result', 'completedAt'], 'Pagination result cannot predate its admission decision.');
      }
      if (result.coverage.returnedRecords !== result.candidates.length) {
        addIssue(ctx, ['pages', index, 'result', 'coverage', 'returnedRecords'], 'Page coverage returnedRecords must equal normalized candidate count.');
      }
      if (index < chain.pages.length - 1 && result.coverage.state === 'complete') {
        addIssue(ctx, ['pages', index, 'result', 'coverage', 'state'], 'An intermediate pagination page cannot declare complete coverage.');
      }

      returnedRecordValues.push(result.coverage.returnedRecords);
      requestUsageValues.push(result.usage.requests);
      pageUsageValues.push(result.usage.pages);
      byteUsageValues.push(result.usage.bytes);
      currencyUsageValues.push(result.usage.currencyMicros);
      runtimeUsageValues.push(result.usage.runtimeMs);

      if (chain.mode === 'cursor') {
        if (request.pagination.page !== undefined) {
          addIssue(ctx, ['pages', index, 'request', 'pagination', 'page'], 'Cursor pagination must not mix numeric page state.');
        }

        const requestCursor = request.pagination.cursor;
        if (requestCursor !== undefined) {
          if (seenRequestCursors.has(requestCursor)) {
            addIssue(ctx, ['pages', index, 'request', 'pagination', 'cursor'], 'Cursor pagination must not revisit a previous request cursor.');
          }
          seenRequestCursors.add(requestCursor);
        }

        if (index > 0) {
          const previous = chain.pages[index - 1];
          if (!previous?.result.nextCursor || requestCursor !== previous.result.nextCursor) {
            addIssue(ctx, ['pages', index, 'request', 'pagination', 'cursor'], 'Each cursor page must consume the immediately previous result nextCursor.');
          }
        }

        if (result.nextCursor !== undefined && requestCursor === result.nextCursor) {
          addIssue(ctx, ['pages', index, 'result', 'nextCursor'], 'A result nextCursor must advance beyond the current request cursor.');
        }
        if (result.nextCursor !== undefined && seenRequestCursors.has(result.nextCursor) && index === chain.pages.length - 1) {
          addIssue(ctx, ['pages', index, 'result', 'nextCursor'], 'Terminal continuation cursor must not cycle to an already consumed cursor.');
        }
      } else {
        if (request.pagination.cursor !== undefined) {
          addIssue(ctx, ['pages', index, 'request', 'pagination', 'cursor'], 'Numeric page pagination must not mix cursor state.');
        }
        if (request.pagination.page === undefined) {
          addIssue(ctx, ['pages', index, 'request', 'pagination', 'page'], 'Numeric page pagination requires an explicit page number.');
        }
        if (result.nextCursor !== undefined) {
          addIssue(ctx, ['pages', index, 'result', 'nextCursor'], 'Numeric page pagination must not emit cursor continuation state.');
        }
        if (index > 0) {
          const previousPage = chain.pages[index - 1]?.request.pagination.page;
          if (previousPage !== undefined && request.pagination.page !== previousPage + 1) {
            addIssue(ctx, ['pages', index, 'request', 'pagination', 'page'], 'Numeric page pagination must advance by exactly one page.');
          }
        }
      }
    }

    const sums = {
      returnedRecords: safeSum(returnedRecordValues),
      requests: safeSum(requestUsageValues),
      pages: safeSum(pageUsageValues),
      bytes: safeSum(byteUsageValues),
      currencyMicros: safeSum(currencyUsageValues),
      runtimeMs: safeSum(runtimeUsageValues),
    };
    if (Object.values(sums).some((value) => value === null)) {
      addIssue(ctx, ['cumulativeUsage'], 'Pagination cumulative counters overflow Number.MAX_SAFE_INTEGER.');
      return;
    }

    if (
      chain.cumulativeUsage.requests !== sums.requests ||
      chain.cumulativeUsage.pages !== sums.pages ||
      chain.cumulativeUsage.bytes !== sums.bytes ||
      chain.cumulativeUsage.currencyMicros !== sums.currencyMicros ||
      chain.cumulativeUsage.runtimeMs !== sums.runtimeMs
    ) {
      addIssue(ctx, ['cumulativeUsage'], 'Declared pagination cumulative usage must equal the sum of page usage evidence.');
    }
    if (chain.coverage.returnedRecords !== sums.returnedRecords) {
      addIssue(ctx, ['coverage', 'returnedRecords'], 'Aggregate returnedRecords must equal the sum of page coverage records.');
    }

    if (
      (sums.requests ?? 0) > chain.budgetSnapshot.maxRequests ||
      (sums.pages ?? 0) > chain.budgetSnapshot.maxPages ||
      (sums.bytes ?? 0) > chain.budgetSnapshot.maxBytes ||
      (sums.currencyMicros ?? 0) > chain.budgetSnapshot.maxCurrencyMicros ||
      (sums.runtimeMs ?? 0) > chain.budgetSnapshot.maxRuntimeMs
    ) {
      addIssue(ctx, ['cumulativeUsage'], 'Pagination cumulative usage exceeds the frozen chain budget.');
    }

    const finalPage = chain.pages.at(-1);
    if (!finalPage) return;
    const hasUnknown = chain.pages.some((page) => page.result.coverage.state === 'unknown');
    const hasPartial = chain.pages.some((page) => page.result.coverage.state === 'partial');

    if (chain.coverage.state === 'complete') {
      if (chain.continuation.hasMore) {
        addIssue(ctx, ['continuation', 'hasMore'], 'Complete aggregate coverage cannot advertise additional pagination work.');
      }
      if (finalPage.result.coverage.state !== 'complete') {
        addIssue(ctx, ['coverage', 'state'], 'Complete aggregate coverage requires a terminal page with complete coverage.');
      }
      if (hasUnknown) {
        addIssue(ctx, ['coverage', 'state'], 'Complete aggregate coverage cannot contain unknown page coverage.');
      }
    }
    if (chain.coverage.state === 'unknown' && !hasUnknown) {
      addIssue(ctx, ['coverage', 'state'], 'Unknown aggregate coverage requires at least one page with unknown coverage.');
    }
    if (chain.coverage.state === 'partial' && !hasPartial && !chain.continuation.hasMore) {
      addIssue(ctx, ['coverage', 'state'], 'Partial aggregate coverage requires partial page evidence or additional work.');
    }

    if (!chain.continuation.hasMore) {
      if (chain.continuation.nextCursor !== undefined || chain.continuation.nextPage !== undefined) {
        addIssue(ctx, ['continuation'], 'A terminal pagination chain must not declare continuation state.');
      }
      if (chain.mode === 'cursor' && finalPage.result.nextCursor !== undefined) {
        addIssue(ctx, ['pages', chain.pages.length - 1, 'result', 'nextCursor'], 'A terminal cursor chain must not retain a nextCursor.');
      }
    } else if (chain.mode === 'cursor') {
      if (
        chain.continuation.nextCursor === undefined ||
        finalPage.result.nextCursor === undefined ||
        chain.continuation.nextCursor !== finalPage.result.nextCursor
      ) {
        addIssue(ctx, ['continuation', 'nextCursor'], 'Cursor continuation must exactly match the terminal page nextCursor.');
      }
      if (chain.continuation.nextPage !== undefined) {
        addIssue(ctx, ['continuation', 'nextPage'], 'Cursor pagination must not declare nextPage.');
      }
      if (chain.continuation.nextCursor !== undefined && seenRequestCursors.has(chain.continuation.nextCursor)) {
        addIssue(ctx, ['continuation', 'nextCursor'], 'Cursor continuation must not cycle to an already consumed cursor.');
      }
    } else {
      const currentPage = finalPage.request.pagination.page;
      if (currentPage === undefined || chain.continuation.nextPage !== currentPage + 1) {
        addIssue(ctx, ['continuation', 'nextPage'], 'Numeric page continuation must advance to exactly the next page.');
      }
      if (chain.continuation.nextCursor !== undefined) {
        addIssue(ctx, ['continuation', 'nextCursor'], 'Numeric page pagination must not declare nextCursor.');
      }
    }
  });

export type SourcePaginationCoverageChain = z.infer<typeof SourcePaginationCoverageChainSchema>;

export function parseSourcePaginationCoverageChain(rawChain: unknown): SourcePaginationCoverageChain {
  return SourcePaginationCoverageChainSchema.parse(rawChain);
}
