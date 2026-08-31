import {
  AgentDefinitionSchema,
  type AgentAutonomyTier,
  type AgentDefinition,
  type MemoryCapabilityAction,
  type MemoryScope,
  type MemoryType,
  type ToolAccess,
} from '@brovexa/contracts';

const autonomyRank: Record<AgentAutonomyTier, number> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

const memoryActionMaxTier: Record<MemoryCapabilityAction, AgentAutonomyTier> = {
  read: 'T0',
  propose: 'T1',
  commit: 'T2',
  supersede: 'T2',
};

export type AgentRegistryErrorCode =
  | 'DUPLICATE_AGENT_DEFINITION'
  | 'AUTONOMY_TIER_NOT_ALLOWED'
  | 'EXTERNAL_TOOL_ACCESS_NOT_ALLOWED'
  | 'TOOL_ACCESS_EXCEEDS_AUTONOMY'
  | 'MEMORY_ACCESS_EXCEEDS_AUTONOMY'
  | 'SYSTEM_PROCEDURAL_MEMORY_WRITE_NOT_ALLOWED'
  | 'AGENT_DEFINITION_NOT_FOUND';

export class AgentRegistryError extends Error {
  readonly code: AgentRegistryErrorCode;

  constructor(code: AgentRegistryErrorCode, message: string) {
    super(message);
    this.name = 'AgentRegistryError';
    this.code = code;
  }
}

export interface AgentRegistryOptions {
  maxAutonomyTier?: AgentAutonomyTier;
  allowExternalToolAccess?: boolean;
}

function definitionId(key: string, version: number): string {
  return `${key}@${version}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function assertToolAutonomy(definition: AgentDefinition, access: ToolAccess): void {
  const tier = autonomyRank[definition.autonomyTier];

  if (access === 'internal.write' && tier < autonomyRank.T2) {
    throw new AgentRegistryError(
      'TOOL_ACCESS_EXCEEDS_AUTONOMY',
      `${definition.key}@${definition.version} cannot receive internal write tools below T2.`,
    );
  }

  if (access === 'external.write' && tier < autonomyRank.T3) {
    throw new AgentRegistryError(
      'TOOL_ACCESS_EXCEEDS_AUTONOMY',
      `${definition.key}@${definition.version} cannot receive external write tools below T3.`,
    );
  }
}

function assertMemoryAutonomy(definition: AgentDefinition): void {
  const definitionTier = autonomyRank[definition.autonomyTier];

  for (const capability of definition.memoryCapabilities) {
    if (
      capability.scope === 'system.procedural' &&
      capability.actions.some((action) => action !== 'read')
    ) {
      throw new AgentRegistryError(
        'SYSTEM_PROCEDURAL_MEMORY_WRITE_NOT_ALLOWED',
        `${definition.key}@${definition.version} cannot mutate system procedural memory.`,
      );
    }

    for (const action of capability.actions) {
      if (definitionTier < autonomyRank[memoryActionMaxTier[action]]) {
        throw new AgentRegistryError(
          'MEMORY_ACCESS_EXCEEDS_AUTONOMY',
          `${definition.key}@${definition.version} memory action ${action} exceeds ${definition.autonomyTier}.`,
        );
      }
    }
  }
}

export class AgentRegistry {
  readonly #definitions = new Map<string, AgentDefinition>();
  readonly #maxAutonomyTier: AgentAutonomyTier;
  readonly #allowExternalToolAccess: boolean;

  constructor(definitions: readonly AgentDefinition[] = [], options: AgentRegistryOptions = {}) {
    this.#maxAutonomyTier = options.maxAutonomyTier ?? 'T2';
    this.#allowExternalToolAccess = options.allowExternalToolAccess ?? false;
    for (const definition of definitions) this.register(definition);
  }

  register(candidate: AgentDefinition): AgentDefinition {
    const definition = AgentDefinitionSchema.parse(candidate);
    const id = definitionId(definition.key, definition.version);

    if (this.#definitions.has(id)) {
      throw new AgentRegistryError(
        'DUPLICATE_AGENT_DEFINITION',
        `Agent definition already registered: ${id}.`,
      );
    }

    if (autonomyRank[definition.autonomyTier] > autonomyRank[this.#maxAutonomyTier]) {
      throw new AgentRegistryError(
        'AUTONOMY_TIER_NOT_ALLOWED',
        `${id} autonomy ${definition.autonomyTier} exceeds registry maximum ${this.#maxAutonomyTier}.`,
      );
    }

    for (const tool of definition.tools) {
      assertToolAutonomy(definition, tool.access);
      if (!this.#allowExternalToolAccess && tool.access.startsWith('external.')) {
        throw new AgentRegistryError(
          'EXTERNAL_TOOL_ACCESS_NOT_ALLOWED',
          `${id} requests external tool access while the registry is internal-only.`,
        );
      }
    }

    assertMemoryAutonomy(definition);

    const frozen = deepFreeze(definition);
    this.#definitions.set(id, frozen);
    return frozen;
  }

  get(key: string, version: number): AgentDefinition {
    const definition = this.#definitions.get(definitionId(key, version));
    if (!definition) {
      throw new AgentRegistryError(
        'AGENT_DEFINITION_NOT_FOUND',
        `Agent definition not registered: ${definitionId(key, version)}.`,
      );
    }
    return definition;
  }

  getLatestActive(key: string): AgentDefinition {
    const matches = [...this.#definitions.values()]
      .filter((definition) => definition.key === key && definition.status === 'active')
      .sort((left, right) => right.version - left.version);
    const latest = matches[0];
    if (!latest) {
      throw new AgentRegistryError('AGENT_DEFINITION_NOT_FOUND', `No active agent registered for ${key}.`);
    }
    return latest;
  }

  canUseTool(key: string, version: number, toolKey: string, access: ToolAccess): boolean {
    const definition = this.get(key, version);
    return definition.tools.some((tool) => tool.key === toolKey && tool.access === access);
  }

  canAccessMemory(
    key: string,
    version: number,
    scope: MemoryScope,
    action: MemoryCapabilityAction,
    memoryType: MemoryType,
  ): boolean {
    const definition = this.get(key, version);
    return definition.memoryCapabilities.some(
      (capability) =>
        capability.scope === scope &&
        capability.actions.includes(action) &&
        capability.memoryTypes.includes(memoryType),
    );
  }

  list(): readonly AgentDefinition[] {
    return [...this.#definitions.values()].sort((left, right) => {
      if (left.key !== right.key) return left.key.localeCompare(right.key);
      return left.version - right.version;
    });
  }
}
