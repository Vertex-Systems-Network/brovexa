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

  it('accepts an optional PostgreSQL URL and treats an empty value as unconfigured', () => {
    expect(
      parseRuntimeEnvironment({ DATABASE_URL: 'postgresql://brovexa:local@localhost:5432/brovexa' })
        .DATABASE_URL,
    ).toBe('postgresql://brovexa:local@localhost:5432/brovexa');
    expect(parseRuntimeEnvironment({ DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
  });

  it('rejects a non-PostgreSQL DATABASE_URL', () => {
    expect(() => parseRuntimeEnvironment({ DATABASE_URL: 'mysql://localhost/example' })).toThrow();
  });
});
