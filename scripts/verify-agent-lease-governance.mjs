import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function read(path) {
  return readFile(resolve(root, path), 'utf8');
}

function requireText(content, expected, source) {
  if (!content.includes(expected)) throw new Error(`${source} must contain: ${expected}`);
}

const required = [
  'AGENTS.md',
  'README.md',
  'docs/PARALLEL_AGENT_DEVELOPMENT.md',
  'docs/AI_NATIVE_PLAN.md',
  'docs/NEW_AGENT_ONBOARDING.md',
  'docs/AGENT_BRANCH_LEASES.md',
  'docs/PROJECT_PLAN.md',
  'docs/CHECKPOINT.md',
  '.agent/README.md',
  '.agent/supervisor.yaml',
  '.agent/workstreams.yaml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/ci.yml',
  'scripts/verify-pr-agent-lease.mjs',
];

const content = Object.fromEntries(await Promise.all(required.map(async (path) => [path, await read(path)])));

for (const source of [
  'AGENTS.md',
  'README.md',
  'docs/PARALLEL_AGENT_DEVELOPMENT.md',
  'docs/AI_NATIVE_PLAN.md',
  'docs/NEW_AGENT_ONBOARDING.md',
  'docs/PROJECT_PLAN.md',
  'docs/CHECKPOINT.md',
  '.agent/README.md',
]) {
  requireText(content[source], 'docs/AGENT_BRANCH_LEASES.md', source);
}

const leaseDoc = content['docs/AGENT_BRANCH_LEASES.md'];
for (const expected of [
  'coordination/leases',
  'one occupied slot = at most one live mutating agent instance',
  '.leases/SUPERVISOR.json',
  'agent_instance_id',
  'lease_id',
  'compare-and-swap',
  'Leases do not expire silently.',
  'The Supervisor is not exempt.',
]) {
  requireText(leaseDoc, expected, 'docs/AGENT_BRANCH_LEASES.md');
}

const supervisor = content['.agent/supervisor.yaml'];
for (const expected of [
  'lease_branch: coordination/leases',
  'lease_scope: per-slot-single-live-instance',
  'lease_required_before_branch_mutation: true',
  'lease_required_for_supervisor: true',
  'lease_takeover_requires_explicit_recovery_audit: true',
  'pr_lease_verifier: scripts/verify-pr-agent-lease.mjs',
]) {
  requireText(supervisor, expected, '.agent/supervisor.yaml');
}

const workstreams = content['.agent/workstreams.yaml'];
for (const expected of [
  'branch_lease_source: coordination/leases',
  'one_live_instance_per_occupied_slot: true',
  'agent_instance_id',
  'lease_id',
  'lease_lock_path',
]) {
  requireText(workstreams, expected, '.agent/workstreams.yaml');
}

const template = content['.github/PULL_REQUEST_TEMPLATE.md'];
for (const expected of [
  'Agent instance ID:',
  'Lease ID:',
  'Lease lock path:',
  'Active slot lease verified on `coordination/leases`:',
]) {
  requireText(template, expected, '.github/PULL_REQUEST_TEMPLATE.md');
}

const ci = content['.github/workflows/ci.yml'];
requireText(ci, 'Verify PR agent branch lease', '.github/workflows/ci.yml');
requireText(ci, 'node scripts/verify-pr-agent-lease.mjs', '.github/workflows/ci.yml');
requireText(ci, 'Verify atomic branch lease governance', '.github/workflows/ci.yml');
requireText(ci, 'node scripts/verify-agent-lease-governance.mjs', '.github/workflows/ci.yml');

const prLease = content['scripts/verify-pr-agent-lease.mjs'];
for (const expected of [
  "eventName !== 'pull_request'",
  'coordination/leases',
  'agent_instance_id',
  'work_packet_id',
  'acquired_branch_head_sha',
  "apiUrl('issues/53')",
]) {
  requireText(prLease, expected, 'scripts/verify-pr-agent-lease.mjs');
}

console.log('Brovexa atomic agent branch lease governance verification passed.');
