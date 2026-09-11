import { describe, expect, it } from 'vitest';
import { classifySourceIpAddress } from './source-ip-classifier';
import { sourceNetworkVerificationMatrix, verificationCaseIdsAreUnique } from './source-network-verification-matrix';

describe('sourceNetworkVerificationMatrix', () => {
  it('keeps case identifiers unique', () => {
    expect(verificationCaseIdsAreUnique()).toBe(true);
  });

  it.each(sourceNetworkVerificationMatrix)('$id matches canonical classifier safety semantics', (testCase) => {
    const classification = classifySourceIpAddress(testCase.address).classification;
    expect(classification).toBe(testCase.expectedClass);
    expect(classification === 'public' ? 'allow' : 'block').toBe(testCase.expectedDecision);
  });
});
