import { describe, expect, it } from 'vitest';
import { toBoundedSourceTransportObservation } from './source-transport-observability';

describe('toBoundedSourceTransportObservation', () => {
  it('normalizes reason codes into a bounded telemetry-safe dimension', () => {
    const observation = toBoundedSourceTransportObservation({
      outcome: 'blocked',
      reasonCode: ' non-public address / metadata ',
      transportKind: 'test',
      redirectHopCount: 1,
      resolvedAddressCount: 2,
    });

    expect(observation).toEqual({
      outcome: 'blocked',
      reasonCode: 'NON_PUBLIC_ADDRESS___METADATA',
      transportKind: 'test',
      redirectHopBucket: '1',
      resolvedAddressBucket: '2_4',
    });
    expect(observation.reasonCode.length).toBeLessThanOrEqual(64);
  });

  it('uses fixed buckets instead of raw high-cardinality counts', () => {
    expect(
      toBoundedSourceTransportObservation({
        outcome: 'failed',
        reasonCode: 'timeout',
        transportKind: 'test',
        redirectHopCount: 25,
        resolvedAddressCount: 300,
      }),
    ).toMatchObject({ redirectHopBucket: '2_plus', resolvedAddressBucket: '5_plus' });
  });

  it('does not expose URL, payload, workspace, tenant or credential fields', () => {
    const observation = toBoundedSourceTransportObservation({
      outcome: 'allowed',
      reasonCode: 'ok',
      transportKind: 'test',
      redirectHopCount: 0,
      resolvedAddressCount: 1,
    });
    expect(Object.keys(observation).sort()).toEqual(
      ['outcome', 'reasonCode', 'redirectHopBucket', 'resolvedAddressBucket', 'transportKind'].sort(),
    );
  });
});
