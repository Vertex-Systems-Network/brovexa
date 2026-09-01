import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  'docs/PROJECT_PLAN.md',
  'docs/CHECKPOINT.md',
  'docs/PARALLEL_AGENT_DEVELOPMENT.md',
  'docs/AI_NATIVE_PLAN.md',
  '.agent/README.md',
  '.agent/ownership.yaml',
  '.agent/shared-files.yaml',
  '.agent/workstreams.yaml',
  '.agent/dependencies.yaml',
  '.agent/migrations.yaml',
  '.agent/supervisor.yaml',
  '.github/PULL_REQUEST_TEMPLATE.md',
];

async function read(path) {
  return readFile(resolve(root, path), 'utf8');
}

function requireText(content, expected, source) {
  if (!content.includes(expected)) {
    throw new Error(`${source} must contain: ${expected}`);
  }
}

function requireMatch(content, pattern, source, message) {
  if (!pattern.test(content)) {
    throw new Error(`${source}: ${message}`);
  }
}

for (const path of requiredFiles) {
  await read(path);
}

const agents = await read('AGENTS.md');
const readme = await read('README.md');
const plan = await read('docs/PROJECT_PLAN.md');
const checkpoint = await read('docs/CHECKPOINT.md');
const protocol = await read('docs/PARALLEL_AGENT_DEVELOPMENT.md');
const aiNativePlan = await read('docs/AI_NATIVE_PLAN.md');
const ownership = await read('.agent/ownership.yaml');
const sharedFiles = await read('.agent/shared-files.yaml');
const workstreams = await read('.agent/workstreams.yaml');
const dependencies = await read('.agent/dependencies.yaml');
const migrations = await read('.agent/migrations.yaml');
const supervisor = await read('.agent/supervisor.yaml');
const prTemplate = await read('.github/PULL_REQUEST_TEMPLATE.md');

for (const [source, content] of [
  ['AGENTS.md', agents],
  ['README.md', readme],
  ['docs/PROJECT_PLAN.md', plan],
  ['docs/CHECKPOINT.md', checkpoint],
  ['docs/PARALLEL_AGENT_DEVELOPMENT.md', protocol],
]) {
  requireText(content, 'Agent Instruction Drift Check', source);
}

for (const requiredRef of [
  'README.md',
  'docs/PROJECT_PLAN.md',
  'docs/CHECKPOINT.md',
  'docs/PARALLEL_AGENT_DEVELOPMENT.md',
  'docs/AI_NATIVE_PLAN.md',
  '.agent/',
]) {
  requireText(agents, requiredRef, 'AGENTS.md');
}

requireText(readme, 'Every coding, review or integration agent must start with `AGENTS.md`.', 'README.md');
requireText(plan, 'Cross-cutting — Parallel Multi-Agent Engineering System', 'docs/PROJECT_PLAN.md');
requireText(protocol, '1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR', 'docs/PARALLEL_AGENT_DEVELOPMENT.md');
requireText(protocol, 'Main-repository Supervisor', 'docs/PARALLEL_AGENT_DEVELOPMENT.md');
requireText(aiNativePlan, 'Brovexa AI-Native Multi-Agent Plan', 'docs/AI_NATIVE_PLAN.md');

const completionSignal = 'Work Done and Submitted';
const syncAlert = 'New changes have been merged — please merge these changes into your branch first, then resume your own work.';

for (const [source, content] of [
  ['AGENTS.md', agents],
  ['README.md', readme],
  ['docs/PROJECT_PLAN.md', plan],
  ['docs/CHECKPOINT.md', checkpoint],
  ['docs/PARALLEL_AGENT_DEVELOPMENT.md', protocol],
  ['docs/AI_NATIVE_PLAN.md', aiNativePlan],
  ['.agent/supervisor.yaml', supervisor],
]) {
  requireText(content, completionSignal, source);
  requireText(content, syncAlert, source);
}

requireText(supervisor, 'issue_number: 50', '.agent/supervisor.yaml');
requireText(supervisor, 'live_state_authority: latest-supervisor-broadcast-comment', '.agent/supervisor.yaml');
requireText(supervisor, 'policy: fifo-with-dependency-priority', '.agent/supervisor.yaml');
requireText(supervisor, 'MERGE_WITH_EXPECTED_HEAD', '.agent/supervisor.yaml');
requireText(supervisor, 'BROADCAST_ALL_ACTIVE_AGENTS', '.agent/supervisor.yaml');
requireText(supervisor, 'RESUME_SUPERVISOR_WORK', '.agent/supervisor.yaml');
requireText(supervisor, 'must_sync_before_completion_signal: true', '.agent/supervisor.yaml');

requireText(prTemplate, 'Synced main SHA:', '.github/PULL_REQUEST_TEMPLATE.md');
requireText(prTemplate, 'Sync epoch:', '.github/PULL_REQUEST_TEMPLATE.md');
requireText(prTemplate, 'Agent Instruction Drift Check completed:', '.github/PULL_REQUEST_TEMPLATE.md');

requireMatch(workstreams, /target_agents:\s*6\b/, '.agent/workstreams.yaml', 'default target_agents must remain 6 unless the governance docs are deliberately revised.');
requireMatch(workstreams, /soft_max_agents:\s*8\b/, '.agent/workstreams.yaml', 'soft_max_agents must remain 8 unless supported by a metrics-backed governance change.');
requireText(workstreams, 'PAUSED_FOR_SYNC', '.agent/workstreams.yaml');
requireText(workstreams, 'synced_main_sha', '.agent/workstreams.yaml');
requireText(workstreams, 'sync_epoch', '.agent/workstreams.yaml');

const requiredStandingBranches = [
  'supervisor/integration-control',
  'agent/contracts-policy',
  'agent/database-persistence',
  'agent/worker-runtime',
  'agent/module-infrastructure',
  'agent/verification-security',
];

for (const branch of requiredStandingBranches) {
  requireText(workstreams, `branch: ${branch}`, '.agent/workstreams.yaml');
  requireText(aiNativePlan, `\`${branch}\``, 'docs/AI_NATIVE_PLAN.md');
}

requireText(ownership, 'policy: default-deny-outside-assigned-write-scope', '.agent/ownership.yaml');
requireText(ownership, 'supervisor_of_main: true', '.agent/ownership.yaml');
requireText(ownership, 'review_incoming_agent_pull_requests', '.agent/ownership.yaml');
requireText(ownership, 'broadcast_all_active_agents_after_merge', '.agent/ownership.yaml');
requireText(sharedFiles, '- AGENTS.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- README.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- docs/AI_NATIVE_PLAN.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- .github/PULL_REQUEST_TEMPLATE.md', '.agent/shared-files.yaml');

requireText(dependencies, 'A completion signal does not override dependency order.', '.agent/dependencies.yaml');
requireText(dependencies, 'contracts_policy', '.agent/dependencies.yaml');
requireText(dependencies, 'database_persistence', '.agent/dependencies.yaml');
requireText(dependencies, 'worker_runtime', '.agent/dependencies.yaml');

const migrationFiles = (await readdir(resolve(root, 'packages/db/migrations')))
  .filter((name) => /^\d{4}_.+\.up\.sql$/.test(name))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error('No PostgreSQL up migrations found for migration coordination verification.');
}

const latestMigrationFile = migrationFiles.at(-1);
const latestMigrationId = latestMigrationFile.slice(0, -'.up.sql'.length);
const latestNumber = Number(latestMigrationId.slice(0, 4));
const expectedNext = String(latestNumber + 1).padStart(4, '0');

requireText(
  migrations,
  `latest_integrated_migration: "${latestMigrationId}"`,
  '.agent/migrations.yaml',
);
requireText(
  migrations,
  `next_unreserved_number: "${expectedNext}"`,
  '.agent/migrations.yaml',
);

const reservationNumbers = [...migrations.matchAll(/^\s{2}"?(\d{4})"?:/gm)].map((match) => match[1]);
if (new Set(reservationNumbers).size !== reservationNumbers.length) {
  throw new Error('.agent/migrations.yaml contains duplicate migration reservation numbers.');
}

console.log('Brovexa parallel-agent governance verification passed.');
