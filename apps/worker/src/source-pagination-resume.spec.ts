import { describe, expect, it } from 'vitest';
import {
  SourcePaginationResumeError,
  applySourcePaginationPage,
  createSourcePaginationResumeState,
  sourcePaginationResumeToken,
} from './source-pagination-resume';

const usage = { requests: 1, pages: 1, bytes: 100, currencyMicros: 10, runtimeMs: 20 };

describe('source pagination resume reducer', () => {
  it('advances cursor pagination deterministically and reconciles cumulative usage', () => {
    const first = applySourcePaginationPage(createSourcePaginationResumeState('cursor'), {
      pageIndex: 0,
      nextCursor: 'cursor-2',
      usage,
      coverage: 'partial',
      returnedRecords: 3,
    });
    expect(sourcePaginationResumeToken(first)).toBe('cursor-2');

    const second = applySourcePaginationPage(first, {
      pageIndex: 1,
      requestedCursor: 'cursor-2',
      usage: { ...usage, bytes: 120 },
      coverage: 'complete',
      returnedRecords: 2,
    });
    expect(second).toMatchObject({ terminal: true, returnedRecords: 5, pageIndex: 1 });
    expect(second.usage).toEqual({ requests: 2, pages: 2, bytes: 220, currencyMicros: 20, runtimeMs: 40 });
    expect(sourcePaginationResumeToken(second)).toBeNull();
  });

  it('advances numeric pages by exactly one and accepts explicit provider exhaustion', () => {
    const first = applySourcePaginationPage(createSourcePaginationResumeState('page'), {
      pageIndex: 0,
      requestedPage: 1,
      hasMore: true,
      usage,
      coverage: 'partial',
      returnedRecords: 1,
    });
    expect(sourcePaginationResumeToken(first)).toBe(2);
    expect(
      applySourcePaginationPage(first, {
        pageIndex: 1,
        requestedPage: 2,
        hasMore: false,
        usage,
        coverage: 'partial',
        returnedRecords: 1,
      }),
    ).toMatchObject({ terminal: true, coverage: 'partial', nextPage: null });
  });

  it('rejects cursor gaps, cycles and page-index discontinuity', () => {
    const first = applySourcePaginationPage(createSourcePaginationResumeState('cursor'), {
      pageIndex: 0,
      nextCursor: 'cursor-2',
      usage,
      coverage: 'partial',
      returnedRecords: 1,
    });
    expect(() =>
      applySourcePaginationPage(first, {
        pageIndex: 1,
        requestedCursor: 'cursor-other',
        usage,
        coverage: 'partial',
        returnedRecords: 1,
      }),
    ).toThrowError(SourcePaginationResumeError);
    expect(() =>
      applySourcePaginationPage(first, {
        pageIndex: 1,
        requestedCursor: 'cursor-2',
        nextCursor: 'cursor-2',
        usage,
        coverage: 'partial',
        returnedRecords: 1,
      }),
    ).toThrowError('SOURCE_PAGINATION_CURSOR_CYCLE');
    expect(() =>
      applySourcePaginationPage(first, {
        pageIndex: 3,
        requestedCursor: 'cursor-2',
        usage,
        coverage: 'partial',
        returnedRecords: 1,
      }),
    ).toThrowError('SOURCE_PAGINATION_PAGE_INDEX_DISCONTINUITY');
  });

  it('rejects blank cursor continuation tokens before they become resumable state', () => {
    expect(() =>
      applySourcePaginationPage(createSourcePaginationResumeState('cursor'), {
        pageIndex: 0,
        nextCursor: '   ',
        usage,
        coverage: 'partial',
        returnedRecords: 1,
      }),
    ).toThrowError('SOURCE_PAGINATION_CURSOR_INVALID');

    const first = applySourcePaginationPage(createSourcePaginationResumeState('cursor'), {
      pageIndex: 0,
      nextCursor: 'cursor-2',
      usage,
      coverage: 'partial',
      returnedRecords: 1,
    });
    expect(() =>
      applySourcePaginationPage(first, {
        pageIndex: 1,
        requestedCursor: '   ',
        usage,
        coverage: 'complete',
        returnedRecords: 0,
      }),
    ).toThrowError('SOURCE_PAGINATION_CURSOR_INVALID');
  });

  it('requires explicit page continuation evidence and rejects complete coverage with more pages', () => {
    expect(() =>
      applySourcePaginationPage(createSourcePaginationResumeState('page'), {
        pageIndex: 0,
        requestedPage: 1,
        usage,
        coverage: 'partial',
        returnedRecords: 1,
      }),
    ).toThrowError('SOURCE_PAGINATION_PAGE_DISCONTINUITY');

    expect(() =>
      applySourcePaginationPage(createSourcePaginationResumeState('page'), {
        pageIndex: 0,
        requestedPage: 1,
        hasMore: true,
        usage,
        coverage: 'complete',
        returnedRecords: 1,
      }),
    ).toThrowError('SOURCE_PAGINATION_PAGE_CONTINUATION_INVALID');
  });

  it('refuses unsafe page arithmetic and invalid page-index state', () => {
    const maxPageState = {
      ...createSourcePaginationResumeState('page'),
      pageIndex: Number.MAX_SAFE_INTEGER - 1,
      nextPage: Number.MAX_SAFE_INTEGER,
    };
    expect(() =>
      applySourcePaginationPage(maxPageState, {
        pageIndex: Number.MAX_SAFE_INTEGER,
        requestedPage: Number.MAX_SAFE_INTEGER,
        hasMore: true,
        usage,
        coverage: 'partial',
        returnedRecords: 0,
      }),
    ).toThrowError('SOURCE_PAGINATION_PAGE_OVERFLOW');

    const unsafeIndexState = {
      ...createSourcePaginationResumeState('cursor'),
      pageIndex: Number.MAX_SAFE_INTEGER,
    };
    expect(() =>
      applySourcePaginationPage(unsafeIndexState, {
        pageIndex: Number.MAX_SAFE_INTEGER + 1,
        usage,
        coverage: 'complete',
        returnedRecords: 0,
      }),
    ).toThrowError('SOURCE_PAGINATION_PAGE_INDEX_DISCONTINUITY');
  });

  it('rejects invalid runtime coverage evidence', () => {
    expect(() =>
      applySourcePaginationPage(createSourcePaginationResumeState('cursor'), {
        pageIndex: 0,
        usage,
        coverage: 'unsupported' as never,
        returnedRecords: 0,
      }),
    ).toThrowError('SOURCE_PAGINATION_COVERAGE_INVALID');
  });

  it('refuses to advance a terminal checkpoint or overflow safe counters', () => {
    const terminal = applySourcePaginationPage(createSourcePaginationResumeState('page'), {
      pageIndex: 0,
      requestedPage: 1,
      hasMore: false,
      usage,
      coverage: 'complete',
      returnedRecords: 0,
    });
    expect(() =>
      applySourcePaginationPage(terminal, {
        pageIndex: 1,
        requestedPage: 2,
        hasMore: false,
        usage,
        coverage: 'complete',
        returnedRecords: 0,
      }),
    ).toThrowError('SOURCE_PAGINATION_ALREADY_TERMINAL');

    const nearLimit = {
      ...createSourcePaginationResumeState('cursor'),
      usage: { requests: Number.MAX_SAFE_INTEGER, pages: 0, bytes: 0, currencyMicros: 0, runtimeMs: 0 },
    };
    expect(() =>
      applySourcePaginationPage(nearLimit, {
        pageIndex: 0,
        usage,
        coverage: 'complete',
        returnedRecords: 0,
      }),
    ).toThrowError('SOURCE_PAGINATION_USAGE_OVERFLOW');
  });
});
