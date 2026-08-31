import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredPaths = [
  'docs/AGENT_MEMORY_FOUNDATION.md',
  'packages/contracts/src/agents.ts',
  'packages/contracts/src/agent-definition.ts',
  'packages/contracts/src/agent-registry.ts',
  'packages/contracts/src/agent-context.ts',
  'packages/db/src/agent-schema.ts',
  'packages/db/src/agent-memory.ts',
  'packages/db/migrations/0003_agent_memory_foundation.up.sql',
  'packages/db/migrations/down/0003_agent_memory_foundation.down.sql',
  'scripts/verify-agent-memory.mjs',
  '.github/workflows/ci.yml',
];
for (const path of requiredPaths) check(existsSync(path), `Missing M01A foundation path: ${path}`);

check(
  !existsSync('packages/agents/package.json'),
  'M01A foundation must not introduce a second workspace importer solely for dependency-free agent core logic.',
);

if (failures.length === 0) {
  const root = JSON.parse(read('package.json'));
  const contractsIndex = read('packages/contracts/src/index.ts');
  const contracts = read('packages/contracts/src/agents.ts');
  const registry = read('packages/contracts/src/agent-registry.ts');
  const context = read('packages/contracts/src/agent-context.ts');
  const migration = read('packages/db/migrations/0003_agent_memory_foundation.up.sql');
  const downMigration = read('packages/db/migrations/down/0003_agent_memory_foundation.down.sql');
  const persistence = read('packages/db/src/agent-memory.ts');
  const verifier = read('scripts/verify-agent-memory.mjs');
  const workflow = read('.github/workflows/ci.yml');
  const docs = read('docs/AGENT_MEMORY_FOUNDATION.md');

  check(
    root.scripts?.['verify:agent-memory'] ===
      'pnpm --filter @brovexa/contracts build && pnpm --filter @brovexa/db build && node scripts/verify-agent-memory.mjs',
    'Root verify:agent-memory must build canonical contracts + DB before PostgreSQL verification.',
  );
  check(
    root.scripts?.['verify:m01a:foundation'] === 'node scripts/verify-m01a-foundation.mjs',
    'Root verify:m01a:foundation must expose this zero-dependency readiness contract.',
  );

  for (const exportPath of ['./agents', './agent-definition', './agent-registry', './agent-context']) {
    check(contractsIndex.includes(`export * from '${exportPath}'`), `Contracts index must export ${exportPath}.`);
  }

  for (const requiredContract of [
    'AgentDefinitionSchema',
    'AgentRunSchema',
    'AgentCheckpointSchema',
    'MemoryRecordSchema',
    'ContextReceiptSchema',
  ]) {
    check(contracts.includes(requiredContract), `Agent contracts must include ${requiredContract}.`);
  }

  check(registry.includes("this.#maxAutonomyTier = options.maxAutonomyTier ?? 'T2'"), 'Foundation registry must default to a T2 ceiling.');
  check(registry.includes('options.allowExternalToolAccess ?? false'), 'Foundation registry must default external tool access to denied.');
  check(registry.includes('EXTERNAL_TOOL_ACCESS_NOT_ALLOWED'), 'Registry must fail closed on external tool access.');
  check(registry.includes('SYSTEM_PROCEDURAL_MEMORY_WRITE_NOT_ALLOWED'), 'Registry must forbid ordinary system procedural-memory writes.');

  for (const rejection of [
    'WORKSPACE_MISMATCH',
    'USER_SCOPE_MISMATCH',
    'MEMORY_NOT_ACTIVE',
    'MEMORY_CONFLICTED',
    'MEMORY_EXPIRED',
    'REQUIRED_CONTEXT_EXCEEDS_BUDGET',
  ]) {
    check(context.includes(rejection), `Context builder must enforce ${rejection}.`);
  }

  for (const constraint of [
    'agent_runs_parent_workspace_fk',
    'agent_runs_requester_workspace_fk',
    'memory_records_user_workspace_fk',
    'memory_records_run_workspace_fk',
    'memory_records_writer_run_identity_fk',
    'memory_records_revision_workspace_fk',
    'context_receipts_run_definition_workspace_fk',
    'memory_record_content_immutable',
    'memory_record_terminal_state_immutable',
    'context_receipt_immutable',
  ]) {
    check(migration.includes(constraint), `Migration 0003 must enforce ${constraint}.`);
  }

  for (const table of ['context_receipts', 'memory_conflicts', 'memory_records', 'agent_checkpoints', 'agent_runs']) {
    check(downMigration.includes(`DROP TABLE IF EXISTS ${table}`), `Rollback migration must remove ${table}.`);
  }

  check(persistence.includes("mr.workspace_id = $1"), 'Memory retrieval must scope canonical rows to workspace.');
  check(persistence.includes("mr.user_id IS NULL OR mr.user_id = $2::uuid"), 'Memory retrieval must enforce user-scoped visibility.');
  check(persistence.includes("mr.status = 'active'"), 'Memory retrieval must reject non-active memory by default.');
  check(persistence.includes('mc.status = \'open\''), 'Memory retrieval must reject open conflicts.');
  check(persistence.includes('mr.expires_at > $3'), 'Memory retrieval must reject expired memory.');

  for (const evidence of [
    'REQUESTER_NOT_ACTIVE',
    'agent_runs_parent_workspace_fk',
    'memory_records_writer_run_identity_fk',
    'memory_records_namespace_scope_check',
    'memory_records_user_workspace_fk',
    'memory_record_content_immutable',
    'context_receipts_run_definition_workspace_fk',
    'context_receipt_immutable',
    'memory_record_terminal_state_immutable',
    "rollbackLatestMigration(pool, migrationsDir), '0003_agent_memory_foundation'",
  ]) {
    check(verifier.includes(evidence), `Executable M01A verifier must cover ${evidence}.`);
  }

  const installIndex = workflow.indexOf('pnpm install --frozen-lockfile');
  const m01aStaticIndex = workflow.indexOf('node scripts/verify-m01a-foundation.mjs');
  check(m01aStaticIndex >= 0, 'Hosted CI must execute the M01A zero-dependency readiness contract.');
  check(
    installIndex > 0 && m01aStaticIndex < installIndex,
    'M01A static readiness must execute before dependency installation.',
  );
  check(workflow.includes('pnpm run verify:agent-memory'), 'Hosted PostgreSQL CI must execute agent-memory integration verification.');

  for (const boundary of [
    'no production model provider',
    'no external agent tool',
    'proposal-only memory writes',
    'not DEPLOYED',
  ]) {
    check(docs.includes(boundary), `M01A foundation documentation must preserve boundary: ${boundary}.`);
  }
}

if (failures.length > 0) {
  console.error('Brovexa M01A agent-memory readiness contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Brovexa M01A agent-memory readiness contract passed.');
