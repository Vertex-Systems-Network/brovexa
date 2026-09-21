import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertPrHandoffExpected, parsePrHandoffBody } from './pr-handoff-contract.mjs';

const root = resolve(import.meta.dirname, '..');
const files = [
  ['.agent/state/CURRENT-STATE.yaml', 12 * 1024],
  ['.agent/state/LAST-CHECKPOINT.md', 16 * 1024],
  ['.agent/state/EXECUTION-JOURNAL.md', 32 * 1024],
];

function requireText(content, expected, source) {
  if (!content.includes(expected)) throw new Error(`${source} must contain: ${expected}`);
}
function requireMatch(content, pattern, source, message) {
  if (!pattern.test(content)) throw new Error(`${source}: ${message}`);
}

for (const [path, maxBytes] of files) {
  const info = await stat(resolve(root, path));
  if (!info.isFile()) throw new Error(`${path} must be a regular file.`);
  if (info.size > maxBytes) throw new Error(`${path} exceeds compact-state limit ${maxBytes} bytes.`);
}

const current = await readFile(resolve(root, '.agent/state/CURRENT-STATE.yaml'), 'utf8');
const checkpoint = await readFile(resolve(root, '.agent/state/LAST-CHECKPOINT.md'), 'utf8');
const journal = await readFile(resolve(root, '.agent/state/EXECUTION-JOURNAL.md'), 'utf8');
const supervisor = await readFile(resolve(root, '.agent/supervisor.yaml'), 'utf8');
const aiPlan = await readFile(resolve(root, 'docs/AI_NATIVE_PLAN.md'), 'utf8');
const rootReadme = await readFile(resolve(root, 'README.md'), 'utf8');
const agentReadme = await readFile(resolve(root, '.agent/README.md'), 'utf8');
const leasePolicy = await readFile(resolve(root, 'docs/AGENT_BRANCH_LEASES.md'), 'utf8');
const prVerifier = await readFile(resolve(root, 'scripts/verify-pr-agent-lease.mjs'), 'utf8');
const preflight = await readFile(resolve(root, 'scripts/verify-pr-handoff-preflight.mjs'), 'utf8');
const persistentSupervisorWorkflow = await readFile(resolve(root, '.github/workflows/persistent-supervisor.yml'), 'utf8');

requireText(current, 'version: 1', '.agent/state/CURRENT-STATE.yaml');
requireMatch(current, /^status: (VERIFYING|WAITING_EXTERNAL|BLOCKED)$/m, '.agent/state/CURRENT-STATE.yaml', 'status must be a durable resume state');
requireMatch(current, /^baseline_main_sha: "[0-9a-f]{40}"$/m, '.agent/state/CURRENT-STATE.yaml', 'baseline_main_sha must be a git SHA');
requireMatch(current, /^sync_epoch: [1-9][0-9]*$/m, '.agent/state/CURRENT-STATE.yaml', 'sync_epoch must be positive');
requireMatch(current, /^registry_revision: [1-9][0-9]*$/m, '.agent/state/CURRENT-STATE.yaml', 'registry_revision must be positive');
requireText(current, 'current_work_packet:', '.agent/state/CURRENT-STATE.yaml');
requireText(current, 'exact_next_action:', '.agent/state/CURRENT-STATE.yaml');
requireText(checkpoint, '# Last Supervisor Checkpoint', '.agent/state/LAST-CHECKPOINT.md');
requireText(checkpoint, '## Source of truth', '.agent/state/LAST-CHECKPOINT.md');
requireText(checkpoint, '## Exact next action', '.agent/state/LAST-CHECKPOINT.md');
requireText(journal, '# Supervisor Execution Journal', '.agent/state/EXECUTION-JOURNAL.md');

for (const expected of [
  'current_state_path: .agent/state/CURRENT-STATE.yaml',
  'last_checkpoint_path: .agent/state/LAST-CHECKPOINT.md',
  'execution_journal_path: .agent/state/EXECUTION-JOURNAL.md',
  'current_state_max_bytes: 12288',
  'last_checkpoint_max_bytes: 16384',
  'execution_journal_max_bytes: 32768',
  'repository_runtime_evidence_overrides_checkpoint: true',
  'timeout_resume_no_repeat_without_reconciliation: true',
  'required_before_create_pull_request: true',
  'verifier: scripts/verify-pr-handoff-preflight.mjs',
  'canonical_parser: scripts/pr-handoff-contract.mjs',
  'future_head_before_event_required_when_head_changes: true',
  'required_each_supervisor_continuation: true',
  'reconcile_before_final_response: true',
  'update_on_material_progress: true',
  'no_materially_newer_chat_state_than_readme: true',
  'self_update_merge_does_not_recurse: true',
]) requireText(supervisor, expected, '.agent/supervisor.yaml');

for (const step of [
  'READ_COMPACT_CURRENT_STATE',
  'READ_LAST_CHECKPOINT',
  'RESOLVE_EXACT_MAIN',
  'RECONCILE_OPEN_ISSUES',
  'RECONCILE_OPEN_PRS',
  'RECONCILE_CLAIMS_QUEUE_AND_LEASES',
  'READ_RUNNER_BENCHMARK',
  'ONLY_THEN_START_NEW_WORK',
]) requireText(supervisor, `- ${step}`, '.agent/supervisor.yaml');

requireText(aiPlan, '## Supervisor durable resume and PR preflight', 'docs/AI_NATIVE_PLAN.md');
requireText(aiPlan, '## Mandatory README progress reconciliation', 'docs/AI_NATIVE_PLAN.md');
requireText(rootReadme, '### Live AI-Native execution snapshot', 'README.md');
for (const expected of [
  '**Exact integrated main:**',
  '**Synchronization epoch:**',
  '**Live registry revision at reconciliation:**',
  '**Current product packet:**',
  '**M03 execution progress:**',
]) requireText(rootReadme, expected, 'README.md');
requireText(agentReadme, '.agent/state/CURRENT-STATE.yaml', '.agent/README.md');
requireText(leasePolicy, 'scripts/verify-pr-handoff-preflight.mjs', 'docs/AGENT_BRANCH_LEASES.md');
requireText(prVerifier, "from './pr-handoff-contract.mjs'", 'scripts/verify-pr-agent-lease.mjs');
requireText(preflight, "from './pr-handoff-contract.mjs'", 'scripts/verify-pr-handoff-preflight.mjs');
requireText(persistentSupervisorWorkflow, '(?:Sync|Synchronization) epoch:', '.github/workflows/persistent-supervisor.yml');

const sampleHead = 'a'.repeat(40);
const sampleMain = 'b'.repeat(40);
const sample = `- Task/workstream ID: \`SUP-TEST-001\`
- Agent ID / role: \`SUPERVISOR / integration_control\`
- Agent instance ID: \`supervisor-test-instance\`
- Assigned slot ID: \`SUPERVISOR\`
- Lease ID: \`lease-supervisor-test\`
- Lease lock path: \`.leases/SUPERVISOR.json\`
- Branch: \`supervisor/integration-control\`
- Exact head SHA: \`${sampleHead}\`
- Synced main SHA: \`${sampleMain}\`
- Sync epoch: \`68\``;
const parsed = parsePrHandoffBody(sample);
assertPrHandoffExpected(parsed, { taskId: 'SUP-TEST-001', agentId: 'SUPERVISOR', slotId: 'SUPERVISOR', declaredHeadSha: sampleHead, syncedMainSha: sampleMain, syncEpoch: 68 });
let missingFieldRejected = false;
try { parsePrHandoffBody(sample.replace(/^- Task\/workstream ID:.*\n/m, '')); } catch { missingFieldRejected = true; }
if (!missingFieldRejected) throw new Error('Canonical PR handoff parser must reject missing fields.');
console.log('Brovexa Supervisor resilience verification passed.');
