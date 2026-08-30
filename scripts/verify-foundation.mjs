import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredPaths = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/config/package.json',
  'packages/contracts/package.json',
  '.github/workflows/ci.yml',
  '.github/workflows/ci-self-hosted.yml',
];

for (const path of requiredPaths) {
  check(existsSync(path), `Missing required foundation path: ${path}`);
}

const verifyWorkflow = (workflow, label) => {
  check(
    /uses:\s*actions\/checkout@[0-9a-f]{40}\b/.test(workflow),
    `${label}: actions/checkout must be pinned to an immutable commit SHA.`,
  );
  check(
    /uses:\s*actions\/setup-node@[0-9a-f]{40}\b/.test(workflow),
    `${label}: actions/setup-node must be pinned to an immutable commit SHA.`,
  );
  check(
    workflow.includes('permissions:\n  contents: read'),
    `${label}: GitHub token permissions must remain contents: read.`,
  );
  check(
    workflow.includes('pnpm run quality'),
    `${label}: must execute the explicit root quality script.`,
  );
  check(
    !workflow.includes('run: pnpm ci'),
    `${label}: must not use bare \`pnpm ci\` as the quality gate.`,
  );

  const installCommand = existsSync('pnpm-lock.yaml')
    ? 'pnpm install --frozen-lockfile'
    : 'pnpm install --no-frozen-lockfile';

  check(
    workflow.includes(installCommand),
    `${label}: install mode must match lockfile state: expected \`${installCommand}\`.`,
  );
};

if (failures.length === 0) {
  const root = JSON.parse(read('package.json'));
  const hostedWorkflow = read('.github/workflows/ci.yml');
  const selfHostedWorkflow = read('.github/workflows/ci-self-hosted.yml');
  const workspace = read('pnpm-workspace.yaml');

  check(root.private === true, 'Root package must remain private.');
  check(root.packageManager === 'pnpm@11.23.0', 'Root packageManager must pin pnpm@11.23.0.');
  check(
    root.engines?.node === '>=24.20.0 <25',
    'Node engine must remain pinned to the approved Node 24 line.',
  );
  check(root.engines?.pnpm === '11.23.0', 'pnpm engine must remain exactly 11.23.0.');
  check(
    !Object.hasOwn(root.scripts ?? {}, 'ci'),
    'Do not define a root script named "ci"; pnpm 11 owns `pnpm ci` as a built-in clean-install command.',
  );
  check(typeof root.scripts?.quality === 'string', 'Root `quality` script is required.');

  for (const command of ['verify:foundation', 'build', 'typecheck', 'test']) {
    check(root.scripts?.quality?.includes(command), `Root quality script must include ${command}.`);
  }

  check(workspace.includes('apps/*'), 'pnpm workspace must include apps/*.');
  check(workspace.includes('packages/*'), 'pnpm workspace must include packages/*.');

  verifyWorkflow(hostedWorkflow, 'Hosted CI');
  verifyWorkflow(selfHostedWorkflow, 'Self-hosted CI');

  check(
    selfHostedWorkflow.includes('workflow_dispatch:'),
    'Self-hosted CI must remain manual-only.',
  );
  check(
    !selfHostedWorkflow.includes('pull_request:'),
    'Self-hosted CI must not auto-run on pull requests.',
  );
  check(!selfHostedWorkflow.includes('\npush:'), 'Self-hosted CI must not auto-run on push.');
  check(
    selfHostedWorkflow.includes('runs-on: [self-hosted, Windows, X64]'),
    'Self-hosted CI must target the explicit Windows x64 self-hosted labels.',
  );
}

if (failures.length > 0) {
  console.error('Brovexa foundation preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Brovexa foundation preflight passed.');
