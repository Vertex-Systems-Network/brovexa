import { describe, expect, it } from 'vitest';
import { createDeterministicSpecialistHandlers } from './agent-specialist-runtime';

const unusedPool = {} as never;

describe('deterministic specialist registry', () => {
  it('rejects invalid registry versions', () => {
    expect(() =>
      createDeterministicSpecialistHandlers({
        pool: unusedPool,
        registryVersion: '',
        handlers: {},
      }),
    ).toThrow(/registryVersion/);
  });

  it('rejects the orchestrator as a specialist handler', () => {
    expect(() =>
      createDeterministicSpecialistHandlers({
        pool: unusedPool,
        registryVersion: '1.0.0',
        handlers: {
          'agent.control.orchestrator': {
            agentVersion: '1.0.0',
            execute: async () => ({
              result: {},
              confidence: 1,
              validationState: 'passed',
            }),
          },
        },
      }),
    ).toThrow(/Invalid deterministic specialist agent key/);
  });

  it('creates exact agent-key handlers without provider/model routes', () => {
    const handlers = createDeterministicSpecialistHandlers({
      pool: unusedPool,
      registryVersion: '1.0.0',
      handlers: {
        'agent.research.verify': {
          agentVersion: '1.0.0',
          execute: async () => ({
            result: { ok: true },
            confidence: 1,
            validationState: 'passed',
          }),
        },
      },
    });
    expect(Object.keys(handlers)).toEqual(['agent.research.verify']);
  });
});
