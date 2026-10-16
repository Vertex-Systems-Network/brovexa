import { describe, expect, it, vi } from 'vitest';
import { awaitM04LiveStage } from './website-live-async-boundary';

describe('WEB-029 live adapter cancellation and timeout fence', () => {
  it('refuses to start a callback when the work was already cancelled', async () => {
    const controller = new AbortController(); controller.abort();
    const task = vi.fn();
    await expect(awaitM04LiveStage(task, {timeoutMs: 500, signal: controller.signal}))
      .rejects.toMatchObject({code:'M04_LIVE_CANCELLED'});
    expect(task).not.toHaveBeenCalled();
  });
  it('promptly aborts a hanging callback and ignores its late completion', async () => {
    const controller = new AbortController();
    let finish: ((value:string) => void) | undefined;
    const task = new Promise<string>(resolve => {finish = resolve;});
    const pending = awaitM04LiveStage(() => task, {timeoutMs: 500,signal:controller.signal});
    controller.abort();
    await expect(pending).rejects.toMatchObject({code:'M04_LIVE_CANCELLED'});
    finish?.('late success');
  });
  it('expires a hanging callback without using callback-reported time', async () => {
    const pending = awaitM04LiveStage(() => new Promise<never>(() => {}), {timeoutMs:10});
    await expect(pending).rejects.toMatchObject({code:'M04_LIVE_TIMEOUT'});
  });
  it('does not accept invalid or unbounded stage deadlines', () => {
    expect(() => awaitM04LiveStage(() => true,{timeoutMs:0})).toThrow(RangeError);
    expect(() => awaitM04LiveStage(() => true,{timeoutMs:30001})).toThrow(RangeError);
  });
});