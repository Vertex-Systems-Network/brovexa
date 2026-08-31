import { createHash } from 'node:crypto';
import { AgentDefinitionSchema, type AgentDefinition } from '@brovexa/contracts';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function hashAgentDefinition(candidate: AgentDefinition): string {
  const definition = AgentDefinitionSchema.parse(candidate);
  return createHash('sha256').update(JSON.stringify(stableValue(definition))).digest('hex');
}
