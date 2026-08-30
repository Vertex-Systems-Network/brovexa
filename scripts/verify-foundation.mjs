import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const packageManifests = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/config/package.json',
  'packages/contracts/package.json',
];

const nodeTsconfigs = [
  ['API', 'apps/api/tsconfig.json'],
  ['Config', 'packages/config/tsconfig.json'],
  ['Contracts', 'packages/contracts/tsconfig.json'],
];

const sharedBuildConfigs = [
  ['Config', 'packages/config/tsconfig.build.json'],
  ['Contracts', 'packages/contracts/tsconfig.build.json'],
];

const requiredPaths = [
  ...packageManifests,
  ...nodeTsconfigs.map(([, path]) => path),
  ...sharedBuildConfigs.map(([, path]) => path),
  'apps/api/tsconfig.build.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  '.gitignore',
  '.env.example',
  'docs/DEVELOPMENT.md',
  'apps/api/src/main.ts',
  'apps/api/src/health.controller.spec.ts',
  'packages/config/src/index.spec.ts',
  'packages/contracts/src/index.spec.ts',
  '.github/workflows/ci.yml',
  '.github/workflows/ci-self-hosted.yml',
  'scripts/dev-api.mjs',
  'scripts/verify-foundation.test.mjs',
];

for (const path of requiredPaths) {
  check(existsSync(path), `Missing required foundation path: ${path}`);
}

const verifyWorkflow = (workflow, label) => {
  check(/uses:\s*actions\/checkout@[0-9a-f]{40}\b/.test(workflow), `${label}: actions/checkout must be pinned to an immutable commit SHA.`);
  check(/uses:\s*actions\/setup-node@[0-9a-f]{40}\b/.test(workflow), `${label}: actions/setup-node must be pinned to an immutable commit SHA.`);
  check(workflow.includes('permissions:\n  contents: read'), `${label}: GitHub token permissions must remain contents: read.`);
  check(workflow.includes('pnpm run quality'), `${label}: must execute the explicit root quality script.`);
  check(!workflow.includes('run: pnpm ci'), `${label}: must not use bare \`pnpm ci\` as the quality gate.`);

  const installCommand = existsSync('pnpm-lock.yaml') ? 'pnpm install --frozen-lockfile' : 'pnpm install --no-frozen-lockfile';
  check(workflow.includes(installCommand), `${label}: install mode must match lockfile state: expected \`${installCommand}\`.`);
};

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const verifyDependencyPins = (path, manifest) => {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      check(spec.startsWith('workspace:') || exactVersion.test(spec), `${path}: ${section}.${name} must use an exact version or workspace: protocol, found ${spec}.`);
    }
  }
};

const verifyNodeTsconfig = (name, path) => {
  const config = JSON.parse(read(path));
  const moduleKind = String(config.compilerOptions?.module ?? '').toLowerCase();
  const resolution = String(config.compilerOptions?.moduleResolution ?? '').toLowerCase();
  check(moduleKind === 'nodenext', `${name} TypeScript module must be NodeNext for the pinned TypeScript 7 / modern Node runtime.`);
  check(resolution === 'nodenext', `${name} TypeScript moduleResolution must be NodeNext; legacy Node/node10 resolution is removed in TypeScript 7.`);
};

const verifySharedBuild = (name, manifest, buildConfigPath) => {
  check(manifest.scripts?.build === 'tsc -p tsconfig.build.json', `${name} package production build must use tsconfig.build.json.`);
  const buildConfig = JSON.parse(read(buildConfigPath));
  const excludes = new Set(buildConfig.exclude ?? []);
  check(excludes.has('src/**/*.spec.ts') && excludes.has('src/**/*.test.ts'), `${name} production build must exclude spec/test source files.`);
};

if (failures.length === 0) {
  const manifests = Object.fromEntries(packageManifests.map((path) => [path, JSON.parse(read(path))]));
  const root = manifests['package.json'];
  const apiPackage = manifests['apps/api/package.json'];
  const configPackage = manifests['packages/config/package.json'];
  const contractsPackage = manifests['packages/contracts/package.json'];
  const hostedWorkflow = read('.github/workflows/ci.yml');
  const selfHostedWorkflow = read('.github/workflows/ci-self-hosted.yml');
  const workspace = read('pnpm-workspace.yaml');
  const gitignore = read('.gitignore');
  const envExample = read('.env.example');
  const developmentRunbook = read('docs/DEVELOPMENT.md');
  const apiDevSupervisor = read('scripts/dev-api.mjs');
  const apiEntrypoint = read('apps/api/src/main.ts');
  const apiBuildConfig = JSON.parse(read('apps/api/tsconfig.build.json'));

  for (const [path, manifest] of Object.entries(manifests)) verifyDependencyPins(path, manifest);
  for (const [name, path] of nodeTsconfigs) verifyNodeTsconfig(name, path);

  check(root.private === true, 'Root package must remain private.');
  check(root.packageManager === 'pnpm@11.23.0', 'Root packageManager must pin pnpm@11.23.0.');
  check(root.engines?.node === '>=24.20.0 <25', 'Node engine must remain pinned to the approved Node 24 line.');
  check(root.engines?.pnpm === '11.23.0', 'pnpm engine must remain exactly 11.23.0.');
  check(!Object.hasOwn(root.scripts ?? {}, 'ci'), 'Do not define a root script named "ci"; pnpm 11 owns `pnpm ci` as a built-in clean-install command.');
  check(typeof root.scripts?.quality === 'string', 'Root `quality` script is required.');
  check(root.scripts?.['dev:api'] === 'node scripts/dev-api.mjs', 'Root dev:api script must use the dependency-free API supervisor.');
  check(apiPackage.scripts?.dev === 'node ../../scripts/dev-api.mjs', 'API dev script must use the shared API supervisor.');

  for (const command of ['verify:foundation', 'verify:foundation:test', 'build', 'typecheck', 'test']) {
    check(root.scripts?.quality?.includes(command), `Root quality script must include ${command}.`);
  }

  for (const [name, manifest] of [['API', apiPackage], ['Config', configPackage], ['Contracts', contractsPackage]]) {
    check(manifest.scripts?.test === 'vitest run', `${name} package must expose the Vitest test gate.`);
  }

  verifySharedBuild('Config', configPackage, 'packages/config/tsconfig.build.json');
  verifySharedBuild('Contracts', contractsPackage, 'packages/contracts/tsconfig.build.json');
  const apiBuildExcludes = new Set(apiBuildConfig.exclude ?? []);
  check(apiPackage.scripts?.build === 'tsc -p tsconfig.build.json', 'API production build must use tsconfig.build.json.');
  check(apiBuildExcludes.has('src/**/*.spec.ts') && apiBuildExcludes.has('src/**/*.test.ts'), 'API production build must exclude spec/test source files.');

  check(workspace.includes('apps/*'), 'pnpm workspace must include apps/*.');
  check(workspace.includes('packages/*'), 'pnpm workspace must include packages/*.');
  check(gitignore.includes('.env'), '.gitignore must exclude local .env files.');
  check(gitignore.includes('!.env.example'), '.gitignore must explicitly allow the secrets-free .env.example template.');

  const exampleKeys = envExample.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => line.split('=', 1)[0]);
  const allowedFoundationKeys = new Set(['NODE_ENV', 'HOST', 'PORT']);
  for (const key of exampleKeys) check(allowedFoundationKeys.has(key), `.env.example contains an unapproved Foundation Slice 1 key: ${key}`);
  for (const requiredKey of allowedFoundationKeys) check(exampleKeys.includes(requiredKey), `.env.example is missing ${requiredKey}.`);

  check(!/(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)\s*=\s*\S+/i.test(envExample), '.env.example must not contain credential-like values.');
  check(developmentRunbook.includes('pnpm run quality'), 'Development runbook must document the canonical quality gate.');
  check(developmentRunbook.includes('pnpm install --frozen-lockfile'), 'Development runbook must document frozen-lockfile mode after bootstrap.');
  check(developmentRunbook.includes('.github/workflows/m01-self-hosted-dispatch.yml'), 'Development runbook must identify the default-branch self-hosted dispatcher.');
  check(developmentRunbook.includes('reference mirror'), 'Development runbook must distinguish the branch-local self-hosted workflow as a reference mirror.');
  check(developmentRunbook.includes('pnpm run dev:api'), 'Development runbook must document the canonical API development loop.');

  for (const configPath of ['packages/config/tsconfig.build.json', 'packages/contracts/tsconfig.build.json', 'apps/api/tsconfig.build.json']) {
    check(apiDevSupervisor.includes(configPath), `API dev supervisor must compile/watch ${configPath}.`);
  }
  check(apiDevSupervisor.includes("'--watch'"), 'API dev supervisor must use Node/TypeScript watch mode.');
  check(apiDevSupervisor.includes("'--env-file-if-exists=.env'"), 'API dev supervisor runtime must load repo-root .env safely.');

  check(!apiEntrypoint.includes('void bootstrap();'), 'API entrypoint must not discard the bootstrap promise.');
  check(apiEntrypoint.includes('bootstrap().catch('), 'API entrypoint must handle startup rejection explicitly.');
  check(apiEntrypoint.includes("console.error('Brovexa API failed to start.');"), 'API startup failure must use the safe generic error message.');
  check(apiEntrypoint.includes('process.exitCode = 1;'), 'API startup failure must set a non-zero process exit code.');

  verifyWorkflow(hostedWorkflow, 'Hosted CI');
  verifyWorkflow(selfHostedWorkflow, 'Self-hosted CI reference');
  check(selfHostedWorkflow.includes('workflow_dispatch:'), 'Self-hosted CI reference must remain manual-only.');
  check(!selfHostedWorkflow.includes('pull_request:'), 'Self-hosted CI reference must not auto-run on pull requests.');
  check(!selfHostedWorkflow.includes('\npush:'), 'Self-hosted CI reference must not auto-run on push.');
  check(selfHostedWorkflow.includes('runs-on: [self-hosted, Windows, X64]'), 'Self-hosted CI reference must target the explicit Windows x64 self-hosted labels.');
  check(selfHostedWorkflow.includes('ref: m01/platform-foundation'), 'Self-hosted CI reference must checkout exactly m01/platform-foundation.');
  check(selfHostedWorkflow.includes('persist-credentials: false'), 'Self-hosted CI reference must not persist checkout credentials.');
}

if (failures.length > 0) {
  console.error('Brovexa foundation preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Brovexa foundation preflight passed.');
