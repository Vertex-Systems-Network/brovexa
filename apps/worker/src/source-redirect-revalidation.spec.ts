import { describe, expect, it } from 'vitest';
import { revalidateSourceRedirect } from './source-redirect-revalidation';

const valid = {
  currentHop: 1,
  maxRedirectHops: 3,
  targetUrl: 'https://example.com/next',
  resolvedAddressClasses: ['public'],
};

describe('revalidateSourceRedirect', () => {
  it('allows an in-budget HTTP(S) target with public-only resolution evidence', () => {
    expect(revalidateSourceRedirect(valid)).toEqual({
      decision: 'allow',
      reason: 'REDIRECT_TARGET_REVALIDATED',
      canonicalUrl: 'https://example.com/next',
    });
  });

  it('blocks forbidden protocols', () => {
    expect(revalidateSourceRedirect({ ...valid, targetUrl: 'file:///etc/passwd' })).toEqual({
      decision: 'block',
      reason: 'REDIRECT_PROTOCOL_FORBIDDEN',
    });
  });

  it('blocks missing and non-public resolution evidence', () => {
    expect(revalidateSourceRedirect({ ...valid, resolvedAddressClasses: [] })).toEqual({
      decision: 'block',
      reason: 'REDIRECT_RESOLUTION_MISSING',
    });
    expect(revalidateSourceRedirect({ ...valid, resolvedAddressClasses: ['public', 'metadata'] })).toEqual({
      decision: 'block',
      reason: 'REDIRECT_NON_PUBLIC_ADDRESS',
    });
  });

  it('blocks redirect hop budget overruns', () => {
    expect(revalidateSourceRedirect({ ...valid, currentHop: 4 })).toEqual({
      decision: 'block',
      reason: 'REDIRECT_HOP_BUDGET_EXCEEDED',
    });
  });
});
