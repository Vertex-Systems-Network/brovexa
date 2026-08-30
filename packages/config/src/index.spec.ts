import { describe, expect, it } from 'vitest';
import { parseRuntimeEnvironment } from './index';

describe('parseRuntimeEnvironment', () => {
  it('applies safe foundation defaults', () => {
    expect(parseRuntimeEnvironment({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3001,
    });
  });

  it('coerces a valid string port', () => {
    expect(parseRuntimeEnvironment({ PORT: '4321' }).PORT).toBe(4321);
  });

  it.each(['0', '65536', 'not-a-port'])('rejects invalid PORT=%s', (PORT) => {
    expect(() => parseRuntimeEnvironment({ PORT })).toThrow();
  });

  it('rejects an unsupported environment name', () => {
    expect(() => parseRuntimeEnvironment({ NODE_ENV: 'preview' })).toThrow();
  });
});
