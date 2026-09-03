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
  'docs/NEW_AGENT_ONBOARDING.md',
  '.agent/README.md',
  '.agent/ownership.yaml',
  '.agent/shared-files.yaml',
  '.agent/workstreams.yaml',
  '.agent/slots.yaml',
  '.agent/dependencies.yaml',
  '.agent/migrations.yaml',
  '.agent/supervisor.yaml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/ci.yml',
  'scripts/verify-main-integration-provenance.mjs',
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

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function field(block, key, source) {
  const match = block.match(new RegExp(`^    ${key}: (.+)$`, 'm'));
  if (!match) throw new Error(`${source}: slot block missing ${key}.`);
  return parseScalar(match[1]);
}

function migrationReservations(content) {
  return [...content.matchAll(/^  - number: "(\d{4})"\n((?:    .*(?:\n|$))*)/gm)].map((match) => {
    const number = match[1];
    const block = match[2];
    return {
      number,
      name: field(block, 'name', '.agent/migrations.yaml'),
      taskId: field(block, 'task_id', '.agent/migrations.yaml'),
      branch: field(block, 'branch', '.agent/migrations.yaml'),
      owner: field(block, 'owner', '.agent/migrations.yaml'),
      status: field(block, 'status', '.agent/migrations.yaml'),
    };
  });
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
const onboarding = await read('docs/NEW_AGENT_ONBOARDING.md');
const agentReadme = await read('.agent/README.md');
const ownership = await read('.agent/ownership.yaml');
const sharedFiles = await read('.agent/shared-files.yaml');
const workstreams = await read('.agent/workstreams.yaml');
const slots = await read('.agent/slots.yaml');
const dependencies = await read('.agent/dependencies.yaml');
const migrations = await read('.agent/migrations.yaml');
const supervisor = await read('.agent/supervisor.yaml');
const prTemplate = await read('.github/PULL_REQUEST_TEMPLATE.md');
const ci = await read('.github/workflows/ci.yml');
const mainProvenance = await read('scripts/verify-main-integration-provenance.mjs');

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
  'docs/NEW_AGENT_ONBOARDING.md',
  '.agent/',
  '.agent/slots.yaml',
]) {
  requireText(agents, requiredRef, 'AGENTS.md');
}

requireText(readme, 'Every coding, review or integration agent must start with `AGENTS.md`.', 'README.md');
requireText(plan, 'Cross-cutting — Parallel Multi-Agent Engineering System', 'docs/PROJECT_PLAN.md');
requireText(protocol, '1 agent = 1 work packet = 1 isolated branch/worktree = 1 PR', 'docs/PARALLEL_AGENT_DEVELOPMENT.md');
requireText(protocol, 'Main-repository Supervisor', 'docs/PARALLEL_AGENT_DEVELOPMENT.md');
requireText(aiNativePlan, 'Brovexa AI-Native Multi-Agent Plan', 'docs/AI_NATIVE_PLAN.md');
requireText(aiNativePlan, 'Standing slot definitions', 'docs/AI_NATIVE_PLAN.md');
requireText(aiNativePlan, 'latest valid Supervisor broadcast comment', 'docs/AI_NATIVE_PLAN.md');
requireText(onboarding, 'Brovexa New Agent Onboarding', 'docs/NEW_AGENT_ONBOARDING.md');
requireText(onboarding, '.agent/slots.yaml', 'docs/NEW_AGENT_ONBOARDING.md');

const completionSignal = 'Work Done and Submitted';
const syncAlert = 'New changes have been merged — please merge these changes into your branch first, then resume your own work.';
const noSlotResponse = 'Go Home Come Back Next Time';

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

for (const [source, content] of [
  ['AGENTS.md', agents],
  ['README.md', readme],
  ['docs/PROJECT_PLAN.md', plan],
  ['docs/CHECKPOINT.md', checkpoint],
  ['docs/PARALLEL_AGENT_DEVELOPMENT.md', protocol],
  ['docs/AI_NATIVE_PLAN.md', aiNativePlan],
  ['docs/NEW_AGENT_ONBOARDING.md', onboarding],
  ['.agent/supervisor.yaml', supervisor],
  ['.agent/workstreams.yaml', workstreams],
  ['.agent/slots.yaml', slots],
]) {
  requireText(content, noSlotResponse, source);
}

for (const [source, content] of [
  ['AGENTS.md', agents],
  ['README.md', readme],
  ['docs/PROJECT_PLAN.md', plan],
  ['docs/CHECKPOINT.md', checkpoint],
  ['docs/PARALLEL_AGENT_DEVELOPMENT.md', protocol],
  ['docs/AI_NATIVE_PLAN.md', aiNativePlan],
  ['docs/NEW_AGENT_ONBOARDING.md', onboarding],
  ['.agent/README.md', agentReadme],
  ['.agent/supervisor.yaml', supervisor],
  ['.agent/workstreams.yaml', workstreams],
  ['.agent/slots.yaml', slots],
]) {
  requireText(content, '#53', source);
}

requireText(agents, 'always starts from the exact current `main` branch/head', 'AGENTS.md');
requireText(onboarding, 'Every new agent starts from the exact current `main` branch/head.', 'docs/NEW_AGENT_ONBOARDING.md');
requireText(slots, 'version: 2', '.agent/slots.yaml');
requireText(slots, 'required_start_branch: main', '.agent/slots.yaml');
requireText(slots, 'new_agent_must_not_start_on_module_branch: true', '.agent/slots.yaml');
requireText(slots, 'issue_number: 53', '.agent/slots.yaml');
requireText(slots, 'state_authority: github-issue-53-body', '.agent/slots.yaml');
requireText(slots, 'Live assignment/release does not require a repository governance PR', '.agent/slots.yaml');
requireText(supervisor, 'live_slot_registry_issue: 53', '.agent/supervisor.yaml');
requireText(supervisor, 'live_slot_registry_authority: github-issue-53-body', '.agent/supervisor.yaml');
requireText(supervisor, 'versioned_docs_do_not_track_live_occupancy: true', '.agent/supervisor.yaml');
requireText(supervisor, 'assign_only_status: OPEN', '.agent/supervisor.yaml');
requireText(supervisor, 'arrival_must_not_expand_capacity: true', '.agent/supervisor.yaml');
requireText(workstreams, 'live_occupancy_issue: 53', '.agent/workstreams.yaml');
requireText(workstreams, 'slot_occupancy_source: github-issue-53-body', '.agent/workstreams.yaml');
requireText(workstreams, 'versioned_manifest_is_live_slot_registry: false', '.agent/workstreams.yaml');
requireText(workstreams, 'new_agent_start_branch: main', '.agent/workstreams.yaml');
requireText(workstreams, 'assignment_authority: SUPERVISOR', '.agent/workstreams.yaml');
requireText(workstreams, 'assigned_slot_id', '.agent/workstreams.yaml');

requireText(supervisor, 'head_change_invalidates_prior_signal: true', '.agent/supervisor.yaml');
requireText(supervisor, 'latest_signal_must_postdate_current_head: true', '.agent/supervisor.yaml');
requireText(agents, 'Any commit pushed after `Work Done and Submitted` invalidates the prior signal.', 'AGENTS.md');
requireText(protocol, 'Any commit pushed after the completion signal invalidates it.', 'docs/PARALLEL_AGENT_DEVELOPMENT.md');

requireText(supervisor, 'issue_number: 50', '.agent/supervisor.yaml');
requireText(supervisor, 'live_state_authority: latest-supervisor-broadcast-comment', '.agent/supervisor.yaml');
requireText(supervisor, 'live_epoch_source: github-issue-50-latest-supervisor-broadcast', '.agent/supervisor.yaml');
requireText(supervisor, 'live_main_sha_source: github-issue-50-latest-supervisor-broadcast', '.agent/supervisor.yaml');
requireText(supervisor, 'policy: fifo-with-dependency-priority', '.agent/supervisor.yaml');
requireText(supervisor, 'MERGE_WITH_EXPECTED_HEAD', '.agent/supervisor.yaml');
requireText(supervisor, 'BROADCAST_ALL_ACTIVE_AGENTS', '.agent/supervisor.yaml');
requireText(supervisor, 'RESUME_SUPERVISOR_WORK', '.agent/supervisor.yaml');
requireText(supervisor, 'must_sync_before_completion_signal: true', '.agent/supervisor.yaml');

requireText(prTemplate, 'Assigned slot ID:', '.github/PULL_REQUEST_TEMPLATE.md');
requireText(prTemplate, 'Synced main SHA:', '.github/PULL_REQUEST_TEMPLATE.md');
requireText(prTemplate, 'Sync epoch:', '.github/PULL_REQUEST_TEMPLATE.md');
requireText(prTemplate, 'Agent Instruction Drift Check completed:', '.github/PULL_REQUEST_TEMPLATE.md');

requireMatch(workstreams, /target_agents:\s*6\b/, '.agent/workstreams.yaml', 'default target_agents must remain 6 unless governance docs are deliberately revised.');
requireMatch(workstreams, /soft_max_agents:\s*8\b/, '.agent/workstreams.yaml', 'default soft_max_agents must remain 8 unless supported by metrics-backed governance.');
requireText(workstreams, 'PAUSED_FOR_SYNC', '.agent/workstreams.yaml');
requireText(workstreams, 'synced_main_sha', '.agent/workstreams.yaml');
requireText(workstreams, 'sync_epoch', '.agent/workstreams.yaml');
requireText(workstreams, 'active_workstreams_source: pull-requests-and-handoffs', '.agent/workstreams.yaml');
requireText(workstreams, 'synchronization_source: github-issue-50-latest-supervisor-broadcast', '.agent/workstreams.yaml');
requireText(workstreams, 'versioned_manifest_is_live_task_registry: false', '.agent/workstreams.yaml');

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

const slotMatches = [...slots.matchAll(/^  - slot_id: ([A-Z0-9_-]+)\n((?:    .*(?:\n|$))*)/gm)];
if (slotMatches.length !== requiredStandingBranches.length) {
  throw new Error(`.agent/slots.yaml must define exactly ${requiredStandingBranches.length} standing slots; found ${slotMatches.length}.`);
}

const staticMarker = '### Standing slot definitions';
const staticStart = aiNativePlan.indexOf(staticMarker);
if (staticStart < 0) throw new Error('docs/AI_NATIVE_PLAN.md is missing standing slot definitions.');
const staticTail = aiNativePlan.slice(staticStart + staticMarker.length);
const nextHeadingIndex = staticTail.indexOf('\n### ');
const staticSection = nextHeadingIndex >= 0 ? staticTail.slice(0, nextHeadingIndex) : staticTail;

const seenSlotIds = new Set();
const seenSlotBranches = new Set();

for (const match of slotMatches) {
  const slotId = match[1];
  const block = match[2];
  const module = field(block, 'module', '.agent/slots.yaml');
  const branch = field(block, 'branch', '.agent/slots.yaml');
  const assignable = field(block, 'assignable_to_new_agent', '.agent/slots.yaml');

  if (seenSlotIds.has(slotId)) throw new Error(`.agent/slots.yaml duplicate slot_id: ${slotId}`);
  if (seenSlotBranches.has(branch)) throw new Error(`.agent/slots.yaml duplicate branch: ${branch}`);
  seenSlotIds.add(slotId);
  seenSlotBranches.add(branch);

  if (!requiredStandingBranches.includes(branch)) {
    throw new Error(`.agent/slots.yaml slot ${slotId} uses unregistered standing branch ${branch}.`);
  }
  if (typeof assignable !== 'boolean') throw new Error(`.agent/slots.yaml slot ${slotId} assignable_to_new_agent must be boolean.`);
  if (/^    (status|assigned_agent|start_status):/m.test(block)) {
    throw new Error(`.agent/slots.yaml slot ${slotId} must not store live occupancy fields.`);
  }

  if (slotId === 'SUPERVISOR') {
    if (branch !== 'supervisor/integration-control') throw new Error('SUPERVISOR slot must map to supervisor/integration-control.');
    if (assignable !== false) throw new Error('SUPERVISOR slot must not be assignable to a new agent.');
  } else if (assignable !== true) {
    throw new Error(`Non-Supervisor standing slot ${slotId} must be assignable_to_new_agent: true.`);
  }

  requireText(workstreams, `slot_id: ${slotId}`, '.agent/workstreams.yaml');
  requireText(workstreams, `module: ${module}`, '.agent/workstreams.yaml');
  requireText(workstreams, `branch: ${branch}`, '.agent/workstreams.yaml');

  const row = staticSection.split('\n').find((line) => line.startsWith(`| \`${slotId}\` |`));
  if (!row) throw new Error(`docs/AI_NATIVE_PLAN.md static slot table missing row for ${slotId}.`);
  const columns = row.split('|').slice(1, -1).map((cell) => cell.trim());
  if (columns.length !== 3) throw new Error(`docs/AI_NATIVE_PLAN.md static slot row ${slotId} must have three columns.`);
  const [, planBranchCell, planAssignableCell] = columns;
  const planBranch = planBranchCell.startsWith('`') && planBranchCell.endsWith('`')
    ? planBranchCell.slice(1, -1)
    : planBranchCell;
  const planAssignable = planAssignableCell === 'Yes' ? true : planAssignableCell === 'No' ? false : null;
  if (planBranch !== branch) throw new Error(`AI-Native Plan slot ${slotId} branch differs from .agent/slots.yaml.`);
  if (planAssignable !== assignable) throw new Error(`AI-Native Plan slot ${slotId} assignable flag differs from .agent/slots.yaml.`);
}

requireText(ownership, 'policy: default-deny-outside-assigned-write-scope', '.agent/ownership.yaml');
requireText(ownership, 'supervisor_of_main: true', '.agent/ownership.yaml');
requireText(ownership, '- docs/NEW_AGENT_ONBOARDING.md', '.agent/ownership.yaml');
requireText(ownership, 'onboard_new_agents_from_current_main_only', '.agent/ownership.yaml');
requireText(ownership, 'serialize_slot_assignments', '.agent/ownership.yaml');
requireText(ownership, 'reject_new_agent_when_no_open_slot', '.agent/ownership.yaml');
requireText(ownership, 'review_incoming_agent_pull_requests', '.agent/ownership.yaml');
requireText(ownership, 'broadcast_all_active_agents_after_merge', '.agent/ownership.yaml');
requireText(sharedFiles, '- AGENTS.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- README.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- docs/AI_NATIVE_PLAN.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- docs/NEW_AGENT_ONBOARDING.md', '.agent/shared-files.yaml');
requireText(sharedFiles, '- .agent/**', '.agent/shared-files.yaml');
requireText(sharedFiles, '- .github/PULL_REQUEST_TEMPLATE.md', '.agent/shared-files.yaml');

requireText(dependencies, 'A completion signal does not override dependency order.', '.agent/dependencies.yaml');
requireText(dependencies, 'contracts_policy', '.agent/dependencies.yaml');
requireText(dependencies, 'database_persistence', '.agent/dependencies.yaml');
requireText(dependencies, 'worker_runtime', '.agent/dependencies.yaml');

requireText(ci, 'push:', '.github/workflows/ci.yml');
requireText(ci, '- main', '.github/workflows/ci.yml');
requireText(ci, 'pull-requests: read', '.github/workflows/ci.yml');
requireText(ci, 'Verify main integration provenance', '.github/workflows/ci.yml');
requireText(ci, 'scripts/verify-main-integration-provenance.mjs', '.github/workflows/ci.yml');
requireText(mainProvenance, "eventName !== 'push'", 'scripts/verify-main-integration-provenance.mjs');
requireText(mainProvenance, "pullRequest.base?.ref === 'main'", 'scripts/verify-main-integration-provenance.mjs');
requireText(mainProvenance, 'Direct main pushes are prohibited', 'scripts/verify-main-integration-provenance.mjs');
requireText(supervisor, 'direct_push_prohibited: true', '.agent/supervisor.yaml');
requireText(supervisor, 'main_push_provenance_check_required: true', '.agent/supervisor.yaml');

const migrationFiles = (await readdir(resolve(root, 'packages/db/migrations')))
  .filter((name) => /^\d{4}_.+\.up\.sql$/.test(name))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error('No PostgreSQL up migrations found for migration coordination verification.');
}

const migrationIds = migrationFiles.map((file) => file.slice(0, -'.up.sql'.length));
const migrationNumbers = migrationIds.map((id) => Number(id.slice(0, 4)));
const integratedMatch = migrations.match(/^latest_integrated_migration: "([^"\n]+)"$/m);
if (!integratedMatch) throw new Error('.agent/migrations.yaml is missing latest_integrated_migration.');
const integratedId = integratedMatch[1];
const integratedNumber = Number(integratedId.slice(0, 4));
if (!/^\d{4}_.+/.test(integratedId) || !migrationIds.includes(integratedId)) {
  throw new Error(`.agent/migrations.yaml latest_integrated_migration ${integratedId} must reference an existing migration file.`);
}

const reservations = migrationReservations(migrations);
const reservationNumbers = reservations.map((reservation) => reservation.number);
if (new Set(reservationNumbers).size !== reservationNumbers.length) {
  throw new Error('.agent/migrations.yaml contains duplicate migration reservation numbers.');
}

const allowedReservationStatuses = new Set(['RESERVED', 'IMPLEMENTED', 'INTEGRATED', 'RELEASED', 'CANCELLED']);
for (const reservation of reservations) {
  if (!allowedReservationStatuses.has(reservation.status)) {
    throw new Error(`Migration ${reservation.number} has unsupported reservation status ${reservation.status}.`);
  }
  if (
    typeof reservation.name !== 'string' || reservation.name.length === 0 ||
    typeof reservation.taskId !== 'string' || reservation.taskId.length === 0 ||
    typeof reservation.branch !== 'string' || reservation.branch.length === 0 ||
    typeof reservation.owner !== 'string' || reservation.owner.length === 0
  ) {
    throw new Error(`Migration ${reservation.number} reservation must declare name, task_id, branch and owner.`);
  }

  const number = Number(reservation.number);
  const migrationId = migrationIds.find((id) => Number(id.slice(0, 4)) === number);
  const expectedId = `${reservation.number}_${reservation.name}`;

  if (reservation.status === 'RESERVED') {
    if (number <= integratedNumber) {
      throw new Error(`Reserved migration ${reservation.number} must be newer than integrated watermark ${integratedId}.`);
    }
    if (migrationId) {
      throw new Error(`Reserved migration ${reservation.number} already has a migration file; mark it IMPLEMENTED before verification.`);
    }
  }

  if (reservation.status === 'IMPLEMENTED') {
    if (number <= integratedNumber) {
      throw new Error(`Implemented migration ${reservation.number} must be newer than integrated watermark ${integratedId}.`);
    }
    if (!migrationId) {
      throw new Error(`Implemented migration ${reservation.number} must have an up migration file.`);
    }
    if (migrationId !== expectedId) {
      throw new Error(`Implemented migration ${reservation.number} name must match file ${migrationId}.`);
    }
  }

  if (reservation.status === 'INTEGRATED') {
    if (!migrationId) throw new Error(`Integrated migration reservation ${reservation.number} must have a migration file.`);
    if (number > integratedNumber) {
      throw new Error(`Integrated reservation ${reservation.number} cannot be newer than integrated watermark ${integratedId}.`);
    }
  }
}

for (let index = 1; index < migrationNumbers.length; index += 1) {
  if (migrationNumbers[index] !== migrationNumbers[index - 1] + 1) {
    throw new Error(`PostgreSQL migration numbers must remain contiguous; found ${migrationNumbers[index - 1]} then ${migrationNumbers[index]}.`);
  }
}

for (const migrationId of migrationIds) {
  const number = Number(migrationId.slice(0, 4));
  if (number <= integratedNumber) continue;
  const reservation = reservations.find((entry) => Number(entry.number) === number);
  if (!reservation || reservation.status !== 'IMPLEMENTED') {
    throw new Error(`Unintegrated migration ${migrationId} requires a matching IMPLEMENTED reservation.`);
  }
}

const occupiedNumbers = [
  ...migrationNumbers,
  ...reservations
    .filter((reservation) => reservation.status === 'RESERVED' || reservation.status === 'IMPLEMENTED')
    .map((reservation) => Number(reservation.number)),
];
const highestOccupiedNumber = Math.max(...occupiedNumbers);
const expectedNext = String(highestOccupiedNumber + 1).padStart(4, '0');
requireText(migrations, `next_unreserved_number: "${expectedNext}"`, '.agent/migrations.yaml');

console.log('Brovexa parallel-agent governance verification passed.');
