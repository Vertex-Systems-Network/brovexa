import { describe, expect, it } from 'vitest';
import { SourcePaginationCoverageChainSchema } from './source-pagination-coverage';

const identity = {
  workspaceId: 'workspace-pagination-1',
  sourceTaskId: 'source-task-pagination-1',
  connectorKey: 'connector.company_sites',
  connectorVersion: '1.0.0',
  sourceKey: 'source.company_sites',
  policySnapshot: { policyId: 'policy.company-sites', policyVersion: '1.0.0' },
};

const budget = {
  maxRequests: 4,
  maxPages: 4,
  maxBytes: 1_000,
  maxCurrencyMicros: 0,
  maxRuntimeMs: 1_000,
  maxConcurrency: 1,
};

function request(requestId: string, requestedAt: string, pagination: { cursor?: string; page?: number; pageSize?: number }) {
  return {
    version: '1.0.0' as const,
    requestId,
    ...identity,
    operation: 'list' as const,
    executionIntent: 'execute' as const,
    purpose: 'business_discovery',
    intendedUse: 'research',
    requestedFields: ['name'],
    requestedDataClassifications: ['PUBLIC_BUSINESS' as const],
    geography: { countryCodes: [], areaRefs: [] },
    storageClass: 'NORMALIZED_FACT' as const,
    exportRequested: false,
    rawPayloadRequested: false,
    robotsDecision: 'not_applicable' as const,
    query: { categories: [], externalRefs: [], filters: {} },
    pagination,
    budget,
    policySnapshot: identity.policySnapshot,
    requestedAt,
  };
}

function admission(evaluatedAt: string) {
  return {
    decision: 'allow' as const,
    reasonCodes: [],
    warnings: [],
    policySnapshot: identity.policySnapshot,
    connectorKey: identity.connectorKey,
    connectorVersion: identity.connectorVersion,
    sourceKey: identity.sourceKey,
    operation: 'list' as const,
    storageClass: 'NORMALIZED_FACT' as const,
    allowedStorageClasses: ['NORMALIZED_FACT' as const],
    exportAllowed: false,
    rawPayloadAllowed: false,
    effectiveBudget: budget,
    evaluatedAt,
  };
}

function result(input: {
  requestId: string;
  completedAt: string;
  state: 'complete' | 'partial' | 'unknown';
  status?: 'complete' | 'partial';
  nextCursor?: string;
  bytes?: number;
  runtimeMs?: number;
}) {
  return {
    version: '1.0.0' as const,
    requestId: input.requestId,
    ...identity,
    policySnapshot: identity.policySnapshot,
    status: input.status ?? (input.state === 'complete' ? ('complete' as const) : ('partial' as const)),
    sourceReferences: [],
    candidates: [],
    rawPayloadRefs: [],
    ...(input.nextCursor === undefined ? {} : { nextCursor: input.nextCursor }),
    usage: {
      requests: 1,
      pages: 1,
      bytes: input.bytes ?? 100,
      currencyMicros: 0,
      runtimeMs: input.runtimeMs ?? 10,
    },
    coverage: {
      state: input.state,
      returnedRecords: 0,
      estimatedTotalRecords: null,
      notes: [],
    },
    errors: [],
    completedAt: input.completedAt,
  };
}

function cursorChain() {
  return {
    version: '1.0.0' as const,
    chainId: 'pagination-chain-cursor-1',
    mode: 'cursor' as const,
    ...identity,
    budgetSnapshot: budget,
    pages: [
      {
        pageIndex: 0,
        request: request('request-cursor-1', '2026-09-03T00:00:00.000Z', { pageSize: 100 }),
        admission: admission('2026-09-03T00:00:01.000Z'),
        result: result({
          requestId: 'request-cursor-1',
          completedAt: '2026-09-03T00:00:02.000Z',
          state: 'partial',
          nextCursor: 'cursor-2',
        }),
      },
      {
        pageIndex: 1,
        request: request('request-cursor-2', '2026-09-03T00:00:03.000Z', { cursor: 'cursor-2', pageSize: 100 }),
        admission: admission('2026-09-03T00:00:04.000Z'),
        result: result({
          requestId: 'request-cursor-2',
          completedAt: '2026-09-03T00:00:05.000Z',
          state: 'complete',
          bytes: 120,
          runtimeMs: 12,
        }),
      },
    ],
    continuation: { hasMore: false },
    cumulativeUsage: { requests: 2, pages: 2, bytes: 220, currencyMicros: 0, runtimeMs: 22 },
    coverage: { state: 'complete' as const, returnedRecords: 0 },
    reasonCodes: [],
  };
}

function pageChain() {
  const base = cursorChain();
  return {
    ...base,
    chainId: 'pagination-chain-page-1',
    mode: 'page' as const,
    pages: [
      {
        pageIndex: 0,
        request: request('request-page-1', '2026-09-03T00:00:00.000Z', { page: 1, pageSize: 100 }),
        admission: admission('2026-09-03T00:00:01.000Z'),
        result: result({ requestId: 'request-page-1', completedAt: '2026-09-03T00:00:02.000Z', state: 'partial' }),
      },
      {
        pageIndex: 1,
        request: request('request-page-2', '2026-09-03T00:00:03.000Z', { page: 2, pageSize: 100 }),
        admission: admission('2026-09-03T00:00:04.000Z'),
        result: result({
          requestId: 'request-page-2',
          completedAt: '2026-09-03T00:00:05.000Z',
          state: 'complete',
          bytes: 120,
          runtimeMs: 12,
        }),
      },
    ],
  };
}

function expectInvalid(value: unknown): void {
  expect(SourcePaginationCoverageChainSchema.safeParse(value).success).toBe(false);
}

describe('SourcePaginationCoverageChainSchema', () => {
  it('accepts a contiguous two-page cursor chain with reconciled usage and complete coverage', () => {
    const parsed = SourcePaginationCoverageChainSchema.parse(cursorChain());
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.coverage.state).toBe('complete');
    expect(parsed.cumulativeUsage.bytes).toBe(220);
  });

  it('accepts a resumable cursor chain only when continuation matches the terminal nextCursor', () => {
    const base = cursorChain();
    const firstPage = base.pages[0]!;
    const resumable = {
      ...base,
      chainId: 'pagination-chain-resumable-1',
      pages: [firstPage],
      continuation: { hasMore: true, nextCursor: 'cursor-2' },
      cumulativeUsage: { requests: 1, pages: 1, bytes: 100, currencyMicros: 0, runtimeMs: 10 },
      coverage: { state: 'partial' as const, returnedRecords: 0 },
    };
    expect(SourcePaginationCoverageChainSchema.safeParse(resumable).success).toBe(true);
    expectInvalid({ ...resumable, continuation: { hasMore: true, nextCursor: 'cursor-other' } });
  });

  it('rejects cursor discontinuity and cycles to consumed cursor state', () => {
    const base = cursorChain();
    const second = base.pages[1]!;
    expectInvalid({
      ...base,
      pages: [base.pages[0]!, { ...second, request: { ...second.request, pagination: { cursor: 'cursor-other', pageSize: 100 } } }],
    });
    expectInvalid({
      ...base,
      pages: [
        base.pages[0]!,
        {
          ...second,
          result: { ...second.result, coverage: { ...second.result.coverage, state: 'partial' as const }, nextCursor: 'cursor-2' },
        },
      ],
      continuation: { hasMore: true, nextCursor: 'cursor-2' },
      coverage: { state: 'partial' as const, returnedRecords: 0 },
    });
  });

  it('rejects numeric page gaps and mixing cursor state into page mode', () => {
    const base = pageChain();
    const second = base.pages[1]!;
    expect(SourcePaginationCoverageChainSchema.safeParse(base).success).toBe(true);
    expectInvalid({
      ...base,
      pages: [base.pages[0]!, { ...second, request: { ...second.request, pagination: { page: 3, pageSize: 100 } } }],
    });
    expectInvalid({
      ...base,
      pages: [base.pages[0]!, { ...second, request: { ...second.request, pagination: { page: 2, cursor: 'forbidden' } } }],
    });
  });

  it('rejects blocked admissions, duplicate request IDs and result identity drift', () => {
    const base = cursorChain();
    const first = base.pages[0]!;
    const second = base.pages[1]!;
    expectInvalid({
      ...base,
      pages: [
        { ...first, admission: { ...first.admission, decision: 'blocked' as const, reasonCodes: ['policy_blocked'] } },
        second,
      ],
    });
    expectInvalid({
      ...base,
      pages: [first, { ...second, request: { ...second.request, requestId: first.request.requestId } }],
    });
    expectInvalid({
      ...base,
      pages: [first, { ...second, result: { ...second.result, requestId: 'request-other' } }],
    });
  });

  it('rejects cumulative usage drift and usage that exceeds the frozen budget', () => {
    const base = cursorChain();
    expectInvalid({ ...base, cumulativeUsage: { ...base.cumulativeUsage, bytes: 219 } });

    const first = base.pages[0]!;
    const second = base.pages[1]!;
    expectInvalid({
      ...base,
      pages: [first, { ...second, result: { ...second.result, usage: { ...second.result.usage, bytes: 950 } } }],
      cumulativeUsage: { ...base.cumulativeUsage, bytes: 1_050 },
    });
  });

  it('rejects aggregate coverage claims that contradict continuation or page evidence', () => {
    const base = cursorChain();
    expectInvalid({ ...base, continuation: { hasMore: true, nextCursor: 'cursor-3' } });

    const second = base.pages[1]!;
    expectInvalid({
      ...base,
      pages: [base.pages[0]!, { ...second, result: { ...second.result, coverage: { ...second.result.coverage, state: 'partial' as const } } }],
    });
  });
});
