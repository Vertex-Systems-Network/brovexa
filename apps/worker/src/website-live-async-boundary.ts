/**
 * WEB-029: bound awaits on independently injected approval, DNS and storage
 * adapters. This races an uncooperative adapter; it does NOT kill its internal
 * work or guarantee that an already-started external DB transaction rolled back.
 * Callers must not schedule any further effects after a rejected stage.
 */
export class M04LiveAsyncBoundaryError extends Error {
  readonly code: 'M04_LIVE_CANCELLED' | 'M04_LIVE_TIMEOUT';
  constructor(code: 'M04_LIVE_CANCELLED' | 'M04_LIVE_TIMEOUT') {
    super(code);
    this.code = code;
    this.name = 'M04LiveAsyncBoundaryError';
  }
}

export function awaitM04LiveStage<T>(
  run: () => T | Promise<T>,
  options: Readonly<{ timeoutMs: number; signal?: AbortSignal }>,
): Promise<T> {
  const { timeoutMs, signal } = options;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new RangeError('M04 live stage timeout must be a bounded positive integer.');
  }
  if (signal?.aborted) return Promise.reject(new M04LiveAsyncBoundaryError('M04_LIVE_CANCELLED'));
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (result: { ok: true; value: T } | { ok: false; error: unknown }): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result.ok) resolve(result.value);
      else reject(result.error);
    };
    const onAbort = (): void => finish({ ok: false, error: new M04LiveAsyncBoundaryError('M04_LIVE_CANCELLED') });
    signal?.addEventListener('abort', onAbort, { once: true });
    // An abort can happen between the initial check and listener registration.
    if (signal?.aborted) { onAbort(); return; }
    timer = setTimeout(() => finish({ ok: false, error: new M04LiveAsyncBoundaryError('M04_LIVE_TIMEOUT') }), timeoutMs);
    // Defer invocation until after the abort listener and deadline are installed.
    void Promise.resolve().then(run).then(
      value => finish({ ok: true, value }),
      error => finish({ ok: false, error }),
    );
  });
}