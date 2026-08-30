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
];

for (const path of requiredPaths) {
  check(existsSync(path), `Missing required foundation path: ${path}`);
}

if (failures.length === 0) {
  const root = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/ci.yml');
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
  check(
    /uses:\s*actions\/checkout@[0-9a-f]{40}\b/.test(workflow),
    'actions/checkout must be pinned to an immutable commit SHA.',
  );
  check(
    /uses:\s*actions\/setup-node@[0-9a-f]{40}\b/.test(workflow),
    'actions/setup-node must be pinned to an immutable commit SHA.',
  );
  check(
    workflow.includes('permissions:\n  contents: read'),
    'CI must keep default GitHub token permissions at contents: read.',
  );
  check(workflow.includes('pnpm run quality'), 'CI must execute the explicit root quality script.');
  check(!workflow.includes('run: pnpm ci'), 'CI must not use bare `pnpm ci` as the quality gate.');

  const installCommand = existsSync('pnpm-lock.yaml')
    ? 'pnpm install --frozen-lockfile'
    : 'pnpm install --no-frozen-lockfile';

  check(
    workflow.includes(installCommand),
    `CI install mode must match lockfile state: expected \`${installCommand}\`.`,
  );
}

if (failures.length > 0) {
  console.error('Brovexa foundation preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Brovexa foundation preflight passed.');
