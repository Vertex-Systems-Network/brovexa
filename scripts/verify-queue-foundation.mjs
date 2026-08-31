import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const check = (condition, message) => { if (!condition) failures.push(message); };

const requiredPaths = [
  'packages/queue/package.json',
  'packages/queue/tsconfig.json',
  'packages/queue/tsconfig.build.json',
  'packages/queue/src/index.ts',
  'apps/worker/package.json',
  'apps/worker/tsconfig.json',
  'apps/worker/tsconfig.build.json',
  'apps/worker/src/runtime.ts',
  'apps/worker/src/main.ts',
  'packages/db/src/jobs.ts',
  'packages/db/migrations/0001_job_execution_foundation.up.sql',
  'packages/db/migrations/down/0001_job_execution_foundation.down.sql',
  'scripts/verify-queue.mjs',
  'docs/WORKER_QUEUE.md',
];

for (const path of requiredPaths) check(existsSync(path), `Missing queue foundation path: ${path}`);

if (failures.length === 0) {
  const queuePackage = JSON.parse(read('packages/queue/package.json'));
  const workerPackage = JSON.parse(read('apps/worker/package.json'));
  const queueSource = read('packages/queue/src/index.ts');
  const workerRuntime = read('apps/worker/src/runtime.ts');
  const compose = read('compose.dev.yml');
  const workflow = read('.github/workflows/ci.yml');
  const workspace = read('pnpm-workspace.yaml');

  check(queuePackage.dependencies?.bullmq === '5.81.4', 'BullMQ must remain pinned to reviewed v5.81.4 until a later ADR changes the major.');
  check(!Object.hasOwn(queuePackage.dependencies ?? {}, 'ioredis'), 'M01 queue package must not add a direct ioredis dependency when BullMQ connection options are sufficient.');
  check(workerPackage.dependencies?.['@brovexa/db'] === 'workspace:*', 'Worker must consume canonical DB through workspace protocol.');
  check(workerPackage.dependencies?.['@brovexa/queue'] === 'workspace:*', 'Worker must consume queue transport through workspace protocol.');
  check(queueSource.includes("BROVEXA_WORK_QUEUE = 'brovexa-work-v1'"), 'Queue name/version convention drifted.');
  check(queueSource.includes('attempts: 1'), 'BullMQ automatic retries must remain disabled; canonical retry state belongs to PostgreSQL.');
  check(workerRuntime.includes('listRecoverableWorkUnits'), 'Worker recovery must derive runnable work from PostgreSQL.');
  check(workerRuntime.includes('completeWorkUnitWithEffect'), 'Worker completion must pass through canonical effect guard.');
  check(compose.includes('ghcr.io/valkey-io/valkey:9.1.1-alpine3.24@sha256:de31910896150d5e754a07d57d227cfdde4e258ddd0d1aa4607f2d2f95843715'), 'Valkey local transport must remain pinned by reviewed immutable digest.');
  check(compose.includes('--appendonly", "no"'), 'M01 Valkey transport should remain intentionally non-canonical/ephemeral.');
  check(workflow.includes('Canonical worker + Valkey') && workflow.includes('pnpm run verify:queue'), 'Hosted CI must include queue/worker integration verification that executes verify:queue.');
  check(!workflow.includes('dangerouslyAllowAllBuilds'), 'Broad package lifecycle-script execution must remain forbidden.');
  check(workspace.includes("'msgpackr-extract@3.0.4': true"), 'BullMQ native helper allowBuilds entry must remain exact to msgpackr-extract@3.0.4.');
  check(!/msgpackr-extract@[^'\n]*\|\|/.test(workspace), 'msgpackr-extract lifecycle trust must not expand to multiple/future versions implicitly.');
  check(workspace.includes('apps/*') && workspace.includes('packages/*'), 'Workspace globs must include worker and queue packages.');
}

if (failures.length > 0) {
  console.error('Brovexa queue foundation preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Brovexa queue foundation preflight passed.');
