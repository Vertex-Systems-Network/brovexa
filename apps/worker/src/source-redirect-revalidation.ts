export interface SourceRedirectRevalidationInput {
  currentHop: number;
  maxRedirectHops: number;
  targetUrl: string;
  resolvedAddressClasses: readonly string[];
}

export type SourceRedirectRevalidationDecision =
  | { decision: 'allow'; reason: 'REDIRECT_TARGET_REVALIDATED'; canonicalUrl: string }
  | {
      decision: 'block';
      reason:
        | 'REDIRECT_HOP_BUDGET_EXCEEDED'
        | 'REDIRECT_TARGET_INVALID'
        | 'REDIRECT_PROTOCOL_FORBIDDEN'
        | 'REDIRECT_RESOLUTION_MISSING'
        | 'REDIRECT_NON_PUBLIC_ADDRESS';
    };

export function revalidateSourceRedirect(
  input: SourceRedirectRevalidationInput,
): SourceRedirectRevalidationDecision {
  if (!Number.isSafeInteger(input.currentHop) || !Number.isSafeInteger(input.maxRedirectHops) || input.currentHop < 1) {
    return { decision: 'block', reason: 'REDIRECT_HOP_BUDGET_EXCEEDED' };
  }
  if (input.currentHop > input.maxRedirectHops) {
    return { decision: 'block', reason: 'REDIRECT_HOP_BUDGET_EXCEEDED' };
  }

  let target: URL;
  try {
    target = new URL(input.targetUrl);
  } catch {
    return { decision: 'block', reason: 'REDIRECT_TARGET_INVALID' };
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return { decision: 'block', reason: 'REDIRECT_PROTOCOL_FORBIDDEN' };
  }
  if (input.resolvedAddressClasses.length === 0) {
    return { decision: 'block', reason: 'REDIRECT_RESOLUTION_MISSING' };
  }
  if (input.resolvedAddressClasses.some((classification) => classification !== 'public')) {
    return { decision: 'block', reason: 'REDIRECT_NON_PUBLIC_ADDRESS' };
  }

  return { decision: 'allow', reason: 'REDIRECT_TARGET_REVALIDATED', canonicalUrl: target.href };
}
