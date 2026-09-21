import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function read(path) {
  return readFile(resolve(root, path), 'utf8');
}

function requireText(content, expected, source) {
  if (!content.includes(expected)) throw new Error(`${source} must contain: ${expected}`);
}

function field(block, name, source) {
  const match = block.match(new RegExp(`^    ${name}:\\s*(.+)$`, 'm'));
  if (!match) throw new Error(`${source} task is missing ${name}.`);
  return match[1].trim().replace(/^"|"$/g, '');
}

const [
  manifest,
  policy,
  agents,
  aiPlan,
  parallel,
  onboarding,
  prTemplate,
  ci,
  packageJson,
  dispatchWorkflow,
] = await Promise.all([
  read('.agent/runner-benchmark.yaml'),
  read('docs/RUNNER_BENCHMARK.md'),
  read('AGENTS.md'),
  read('docs/AI_NATIVE_PLAN.md'),
  read('docs/PARALLEL_AGENT_DEVELOPMENT.md'),
  read('docs/NEW_AGENT_ONBOARDING.md'),
  read('.github/PULL_REQUEST_TEMPLATE.md'),
  read('.github/workflows/ci.yml'),
  read('package.json'),
  read('.github/workflows/m01-self-hosted-dispatch.yml'),
]);

for (const [content, source] of [
  [manifest, '.agent/runner-benchmark.yaml'],
  [policy, 'docs/RUNNER_BENCHMARK.md'],
]) {
  requireText(content, 'required', source);
}

for (const [content, source] of [
  [agents, 'AGENTS.md'],
  [aiPlan, 'docs/AI_NATIVE_PLAN.md'],
  [parallel, 'docs/PARALLEL_AGENT_DEVELOPMENT.md'],
  [onboarding, 'docs/NEW_AGENT_ONBOARDING.md'],
]) {
  requireText(content, 'docs/RUNNER_BENCHMARK.md', source);
  requireText(content, '.agent/runner-benchmark.yaml', source);
}

requireText(manifest, 'policy: deferred-runner-benchmark', '.agent/runner-benchmark.yaml');
requireText(manifest, 'default_batch: milestone-close', '.agent/runner-benchmark.yaml');
requireText(manifest, 'required_pr_or_main_gates_may_be_deferred: false', '.agent/runner-benchmark.yaml');
requireText(manifest, 'security_merge_blockers_may_be_deferred: false', '.agent/runner-benchmark.yaml');
requireText(manifest, 'literal_parallel_execution_required: false', '.agent/runner-benchmark.yaml');
requireText(manifest, 'retain_completed_results_as_history: true', '.agent/runner-benchmark.yaml');

for (const status of ['DEFERRED', 'READY_FOR_BATCH', 'RUNNING', 'PASS', 'FAIL', 'BLOCKED', 'SUPERSEDED']) {
  requireText(manifest, `  - ${status}`, '.agent/runner-benchmark.yaml');
}

const allowedStatuses = new Set(['DEFERRED', 'READY_FOR_BATCH', 'RUNNING', 'PASS', 'FAIL', 'BLOCKED', 'SUPERSEDED']);
const allowedGateClasses = new Set([
  'non_blocking_deferred_runner_check',
  'milestone_close_blocking_runner_check',
  'release_blocking_runner_check',
]);

const taskMatches = [...manifest.matchAll(/^  - id: ([A-Z0-9_-]+)\n((?:    .*(?:\n|$))*)/gm)];
if (taskMatches.length === 0) {
  throw new Error('.agent/runner-benchmark.yaml must contain at least one seeded Runner task.');
}

const ids = new Set();
for (const match of taskMatches) {
  const id = match[1];
  const block = match[2];
  if (ids.has(id)) throw new Error(`Duplicate Runner benchmark task ID: ${id}`);
  ids.add(id);

  for (const requiredField of [
    'title',
    'source_work_packet',
    'status',
    'runner_profile',
    'execution',
    'command',
    'security_gate_classification',
    'required_before',
  ]) {
    field(block, requiredField, `Runner task ${id}`);
  }

  const status = field(block, 'status', `Runner task ${id}`);
  if (!allowedStatuses.has(status)) {
    throw new Error(`Runner task ${id} uses unsupported status ${status}.`);
  }

  const gateClass = field(block, 'security_gate_classification', `Runner task ${id}`);
  if (!allowedGateClasses.has(gateClass)) {
    throw new Error(`Runner task ${id} uses unsupported security_gate_classification ${gateClass}.`);
  }

  for (const nested of ['prerequisites:', 'pass_criteria:', 'last_result:']) {
    if (!block.includes(`    ${nested}`)) {
      throw new Error(`Runner task ${id} must declare ${nested}`);
    }
  }

  if (status === 'PASS') {
    if (/outcome:\s*(NOT_RUN_IN_BENCHMARK|null)/.test(block)) {
      throw new Error(`Runner task ${id} cannot be PASS without a recorded execution outcome.`);
    }
    if (/main_sha:\s*null/.test(block) || /evidence:\s*null/.test(block)) {
      throw new Error(`Runner task ${id} cannot be PASS without main SHA and evidence.`);
    }
  }
}

requireText(policy, 'required hosted CI/security gates', 'docs/RUNNER_BENCHMARK.md');
requireText(policy, 'final Runner batch', 'docs/RUNNER_BENCHMARK.md');
requireText(policy, 'may **not** be deferred', 'docs/RUNNER_BENCHMARK.md');
requireText(agents, 'Runner benchmark', 'AGENTS.md');
requireText(parallel, 'Runner benchmark', 'docs/PARALLEL_AGENT_DEVELOPMENT.md');
requireText(aiPlan, 'Runner benchmark', 'docs/AI_NATIVE_PLAN.md');
requireText(prTemplate, 'Runner benchmark task IDs:', '.github/PULL_REQUEST_TEMPLATE.md');
requireText(prTemplate, 'Runner deferral justification:', '.github/PULL_REQUEST_TEMPLATE.md');
requireText(ci, 'Verify deferred Runner benchmark governance', '.github/workflows/ci.yml');
requireText(ci, 'node scripts/verify-runner-benchmark.mjs', '.github/workflows/ci.yml');
requireText(dispatchWorkflow, 'Exact branch, tag, or commit SHA to verify', '.github/workflows/m01-self-hosted-dispatch.yml');
requireText(dispatchWorkflow, 'ref: ${{ inputs.ref }}', '.github/workflows/m01-self-hosted-dispatch.yml');
requireText(manifest, 'dispatch_ref_equals_exact_current_main_sha', '.agent/runner-benchmark.yaml');
requireText(packageJson, '"verify:runner-benchmark": "node scripts/verify-runner-benchmark.mjs"', 'package.json');
requireText(packageJson, 'node scripts/verify-runner-benchmark.mjs', 'package.json');

console.log(`Brovexa Runner benchmark governance verification passed for ${taskMatches.length} registered task(s).`);
