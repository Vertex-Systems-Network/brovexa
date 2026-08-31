import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

describe('sha256Hex', () => {
  it('matches standard ASCII SHA-256 vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes Unicode using canonical UTF-8 bytes', () => {
    expect(sha256Hex('Brovexa 🚀')).toBe('4573a7c2c199b0ad94a08fb4fec05845d62434c3a5b9edfe3010b76a6b3e5995');
  });
});
