export type SourcePaginationResumeMode = 'cursor' | 'page';
export type SourcePaginationResumeCoverage = 'complete' | 'partial' | 'unknown';

export interface SourcePaginationResumeUsage {
  requests: number;
  pages: number;
  bytes: number;
  currencyMicros: number;
  runtimeMs: number;
}

export interface SourcePaginationResumeState {
  mode: SourcePaginationResumeMode;
  pageIndex: number;
  nextCursor: string | null;
  nextPage: number | null;
  usage: SourcePaginationResumeUsage;
  coverage: SourcePaginationResumeCoverage;
  returnedRecords: number;
  terminal: boolean;
}

export interface SourcePaginationPageEvidence {
  pageIndex: number;
  requestedCursor?: string;
  requestedPage?: number;
  nextCursor?: string;
  usage: SourcePaginationResumeUsage;
  coverage: SourcePaginationResumeCoverage;
  returnedRecords: number;
}

export class SourcePaginationResumeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SourcePaginationResumeError';
  }
}

function safeAdd(left: number, right: number, code: string): number {
  if (!Number.isSafeInteger(left) || left < 0 || !Number.isSafeInteger(right) || right < 0) {
    throw new SourcePaginationResumeError(code);
  }
  if (right > Number.MAX_SAFE_INTEGER - left) throw new SourcePaginationResumeError(code);
  return left + right;
}

function validateUsage(usage: SourcePaginationResumeUsage): void {
  for (const value of Object.values(usage)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new SourcePaginationResumeError('SOURCE_PAGINATION_USAGE_INVALID');
  }
}

function validateCursorToken(token: string | undefined | null): void {
  if (token !== undefined && token !== null && (typeof token !== 'string' || token.trim().length === 0)) {
    throw new SourcePaginationResumeError('SOURCE_PAGINATION_CURSOR_INVALID');
  }
}

export function createSourcePaginationResumeState(mode: SourcePaginationResumeMode): SourcePaginationResumeState {
  if (mode !== 'cursor' && mode !== 'page') throw new SourcePaginationResumeError('SOURCE_PAGINATION_MODE_INVALID');
  return {
    mode,
    pageIndex: -1,
    nextCursor: null,
    nextPage: mode === 'page' ? 1 : null,
    usage: { requests: 0, pages: 0, bytes: 0, currencyMicros: 0, runtimeMs: 0 },
    coverage: 'unknown',
    returnedRecords: 0,
    terminal: false,
  };
}

export function applySourcePaginationPage(
  state: SourcePaginationResumeState,
  page: SourcePaginationPageEvidence,
): SourcePaginationResumeState {
  if (state.terminal) throw new SourcePaginationResumeError('SOURCE_PAGINATION_ALREADY_TERMINAL');
  if (
    !Number.isSafeInteger(state.pageIndex) ||
    state.pageIndex < -1 ||
    state.pageIndex >= Number.MAX_SAFE_INTEGER ||
    !Number.isSafeInteger(page.pageIndex) ||
    page.pageIndex < 0 ||
    page.pageIndex !== state.pageIndex + 1
  ) {
    throw new SourcePaginationResumeError('SOURCE_PAGINATION_PAGE_INDEX_DISCONTINUITY');
  }
  validateUsage(page.usage);
  if (!Number.isSafeInteger(page.returnedRecords) || page.returnedRecords < 0) {
    throw new SourcePaginationResumeError('SOURCE_PAGINATION_RETURNED_RECORDS_INVALID');
  }
  if (page.coverage !== 'complete' && page.coverage !== 'partial' && page.coverage !== 'unknown') {
    throw new SourcePaginationResumeError('SOURCE_PAGINATION_COVERAGE_INVALID');
  }

  if (state.mode === 'cursor') {
    validateCursorToken(state.nextCursor);
    validateCursorToken(page.requestedCursor);
    validateCursorToken(page.nextCursor);
    const expectedCursor = state.pageIndex < 0 ? undefined : state.nextCursor ?? undefined;
    if (page.requestedPage !== undefined || page.requestedCursor !== expectedCursor) {
      throw new SourcePaginationResumeError('SOURCE_PAGINATION_CURSOR_DISCONTINUITY');
    }
    if (page.nextCursor !== undefined && page.nextCursor === page.requestedCursor) {
      throw new SourcePaginationResumeError('SOURCE_PAGINATION_CURSOR_CYCLE');
    }
  } else {
    if (
      !Number.isSafeInteger(state.nextPage) ||
      state.nextPage === null ||
      state.nextPage < 1 ||
      !Number.isSafeInteger(page.requestedPage) ||
      (page.requestedPage ?? 0) < 1 ||
      page.requestedCursor !== undefined ||
      page.nextCursor !== undefined ||
      page.requestedPage !== state.nextPage
    ) {
      throw new SourcePaginationResumeError('SOURCE_PAGINATION_PAGE_DISCONTINUITY');
    }
  }

  const usage = {
    requests: safeAdd(state.usage.requests, page.usage.requests, 'SOURCE_PAGINATION_USAGE_OVERFLOW'),
    pages: safeAdd(state.usage.pages, page.usage.pages, 'SOURCE_PAGINATION_USAGE_OVERFLOW'),
    bytes: safeAdd(state.usage.bytes, page.usage.bytes, 'SOURCE_PAGINATION_USAGE_OVERFLOW'),
    currencyMicros: safeAdd(state.usage.currencyMicros, page.usage.currencyMicros, 'SOURCE_PAGINATION_USAGE_OVERFLOW'),
    runtimeMs: safeAdd(state.usage.runtimeMs, page.usage.runtimeMs, 'SOURCE_PAGINATION_USAGE_OVERFLOW'),
  };
  const returnedRecords = safeAdd(
    state.returnedRecords,
    page.returnedRecords,
    'SOURCE_PAGINATION_RETURNED_RECORDS_OVERFLOW',
  );
  const terminal = page.coverage === 'complete' || (state.mode === 'cursor' && page.nextCursor === undefined);
  const nextPage =
    terminal || state.mode === 'cursor'
      ? null
      : safeAdd(page.requestedPage ?? 0, 1, 'SOURCE_PAGINATION_PAGE_OVERFLOW');

  return {
    mode: state.mode,
    pageIndex: page.pageIndex,
    nextCursor: terminal || state.mode === 'page' ? null : page.nextCursor ?? null,
    nextPage,
    usage,
    coverage: page.coverage,
    returnedRecords,
    terminal,
  };
}

export function sourcePaginationResumeToken(state: SourcePaginationResumeState): string | number | null {
  if (state.terminal) return null;
  return state.mode === 'cursor' ? state.nextCursor : state.nextPage;
}
