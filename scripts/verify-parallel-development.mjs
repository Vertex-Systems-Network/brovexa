import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  'docs/PROJECT_PLAN.md',
  'docs/CHECKPOINT.md',
  'docs/PARALLEL_AGENT_DEVELOPMENT.md',
  '.agent/README.md',
  '.agent/ownership.yaml',
  '.agent/shared-files.yaml',
  '.agent/workstreams.yaml',
  '.agent/dependencies.yaml',
  '.agent/migrations.yaml',
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
const ownership = await read('.agent/ownership.yaml');
const sharedFiles = await read('.agent/shared-files.yaml');
const workstreams = await read('.agent/workstreams.yaml');
const migrations = await read('.agent/migrations.yaml');

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
  '.agent/',
]) {
  requireText(agents, requiredRef, 'AGENTS.md');
}

requireText(readme, 'Every coding, review or integration agent must start with `AGENTS.md`.', 'README.md');
requireText(plan, 'Cross-cutting — Parallel Multi-Agent Engineering System', 'docs/PROJECT_PLAN.md');
requireText(protocol, '1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR', 'docs/PARALLEL_AGENT_DEVELOPMENT.md');

requireMatch(workstreams, /target_agents:\s*6\b/, '.agent/workstreams.yaml', 'default target_agents must remain 6 unless the governance docs are deliberately revised.');
requireMatch(workstreams, /soft_max_agents:\s*8\b/, '.agent/workstreams.yaml', 'soft_max_agents must remain 8 unless supported by a metrics-backed governance change.');
requireText(ownership, 'policy: default-deny-outside-assigned-write-scope', '.agent/ownership.yaml');
requireText(sharedFiles, '- AGENTS.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- README.md', '.agent/shared-files.yaml');

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