import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const check = (condition, message) => { if (!condition) failures.push(message); };

const packageManifests = ['package.json','apps/api/package.json','apps/web/package.json','packages/config/package.json','packages/contracts/package.json'];
const nodeTsconfigs = [['API','apps/api/tsconfig.json'],['Config','packages/config/tsconfig.json'],['Contracts','packages/contracts/tsconfig.json']];
const requiredPaths = [
  ...packageManifests,
  ...nodeTsconfigs.map(([, path]) => path),
  'apps/api/tsconfig.build.json','packages/config/tsconfig.build.json','packages/contracts/tsconfig.build.json',
  'pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','tsconfig.base.json','.gitignore','.env.example','docs/DEVELOPMENT.md',
  'apps/api/src/main.ts','apps/api/src/health.controller.ts','apps/api/src/health.controller.spec.ts','packages/config/src/index.spec.ts','packages/contracts/src/index.spec.ts',
  '.github/workflows/ci.yml','.github/workflows/ci-self-hosted.yml','scripts/dev-api.mjs','scripts/verify-dev-api.mjs','scripts/verify-foundation.test.mjs',
];
for (const path of requiredPaths) check(existsSync(path), `Missing required foundation path: ${path}`);

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
function verifyDependencyPins(path, manifest) {
  for (const section of ['dependencies','devDependencies','optionalDependencies']) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      check(spec.startsWith('workspace:') || exactVersion.test(spec), `${path}: ${section}.${name} must use an exact version or workspace: protocol, found ${spec}.`);
    }
  }
}
function verifyNodeTsconfig(name, path) {
  const config = JSON.parse(read(path));
  check(String(config.compilerOptions?.module ?? '').toLowerCase() === 'nodenext', `${name} TypeScript module must be NodeNext for the pinned TypeScript 7 / modern Node runtime.`);
  check(String(config.compilerOptions?.moduleResolution ?? '').toLowerCase() === 'nodenext', `${name} TypeScript moduleResolution must be NodeNext; legacy Node/node10 resolution is removed in TypeScript 7.`);
}
function verifyBuildExcludes(name, manifest, path) {
  check(manifest.scripts?.build === 'tsc -p tsconfig.build.json', `${name} package production build must use tsconfig.build.json.`);
  const excludes = new Set(JSON.parse(read(path)).exclude ?? []);
  check(excludes.has('src/**/*.spec.ts') && excludes.has('src/**/*.test.ts'), `${name} production build must exclude spec/test source files.`);
}
function verifyWorkflow(workflow, label) {
  check(/uses:\s*actions\/checkout@[0-9a-f]{40}\b/.test(workflow), `${label}: actions/checkout must be pinned to an immutable commit SHA.`);
  check(/uses:\s*actions\/setup-node@[0-9a-f]{40}\b/.test(workflow), `${label}: actions/setup-node must be pinned to an immutable commit SHA.`);
  check(workflow.includes('permissions:\n  contents: read'), `${label}: GitHub token permissions must remain contents: read.`);
  check(workflow.includes('pnpm install --frozen-lockfile'), `${label}: must install from the committed lockfile with \`pnpm install --frozen-lockfile\`.`);
  check(!workflow.includes('--no-frozen-lockfile'), `${label}: bootstrap/non-frozen dependency installation is forbidden after lockfile adoption.`);
  check(workflow.includes('pnpm run quality:runtime'), `${label}: must execute the runtime quality gate after dependency installation.`);
  check(!/^\s*run:\s*pnpm run quality\s*$/m.test(workflow), `${label}: must not rerun the preflight quality gate after dependency installation.`);
  check(!workflow.includes('run: pnpm ci'), `${label}: must not use bare \`pnpm ci\` as the quality gate.`);
}

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
  const apiDevSmoke = read('scripts/verify-dev-api.mjs');
  const apiEntrypoint = read('apps/api/src/main.ts');

  for (const [path, manifest] of Object.entries(manifests)) verifyDependencyPins(path, manifest);
  for (const [name, path] of nodeTsconfigs) verifyNodeTsconfig(name, path);

  check(root.private === true, 'Root package must remain private.');
  check(root.packageManager === 'pnpm@11.23.0', 'Root packageManager must pin pnpm@11.23.0.');
  check(root.engines?.node === '>=24.20.0 <25', 'Node engine must remain pinned to the approved Node 24 line.');
  check(root.engines?.pnpm === '11.23.0', 'pnpm engine must remain exactly 11.23.0.');
  check(!Object.hasOwn(root.scripts ?? {}, 'ci'), 'Do not define a root script named "ci"; pnpm 11 owns `pnpm ci` as a built-in clean-install command.');
  check(root.scripts?.['quality:runtime'] === 'pnpm run build && pnpm run typecheck && pnpm run test', 'Root `quality:runtime` must be the post-install build/typecheck/test gate.');
  check(root.scripts?.quality?.includes('verify:foundation'), 'Root quality script must include verify:foundation.');
  check(root.scripts?.quality?.includes('verify:foundation:test'), 'Root quality script must include verify:foundation:test.');
  check(root.scripts?.quality?.includes('quality:runtime'), 'Root quality script must delegate post-install checks to quality:runtime.');
  check(root.scripts?.['dev:api'] === 'node scripts/dev-api.mjs', 'Root dev:api script must use the dependency-free API supervisor.');
  check(root.scripts?.['verify:dev-api'] === 'node scripts/verify-dev-api.mjs', 'Root verify:dev-api script must expose the live API reload smoke gate.');
  check(apiPackage.scripts?.dev === 'node ../../scripts/dev-api.mjs', 'API dev script must use the shared API supervisor.');

  for (const [name, manifest] of [['API',apiPackage],['Config',configPackage],['Contracts',contractsPackage]]) check(manifest.scripts?.test === 'vitest run', `${name} package must expose the Vitest test gate.`);
  verifyBuildExcludes('API', apiPackage, 'apps/api/tsconfig.build.json');
  verifyBuildExcludes('Config', configPackage, 'packages/config/tsconfig.build.json');
  verifyBuildExcludes('Contracts', contractsPackage, 'packages/contracts/tsconfig.build.json');

  check(workspace.includes('apps/*'), 'pnpm workspace must include apps/*.');
  check(workspace.includes('packages/*'), 'pnpm workspace must include packages/*.');
  check(/minimumReleaseAgeExclude:\s*\n\s*-\s*zod@4\.5\.4\b/.test(workspace), 'pnpm workspace must explicitly document the exact zod@4.5.4 release-age exception used by the locked bootstrap.');
  check(gitignore.includes('.env'), '.gitignore must exclude local .env files.');
  check(gitignore.includes('!.env.example'), '.gitignore must explicitly allow the secrets-free .env.example template.');

  const exampleKeys = envExample.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => line.split('=',1)[0]);
  const allowedFoundationKeys = new Set(['NODE_ENV','HOST','PORT']);
  for (const key of exampleKeys) check(allowedFoundationKeys.has(key), `.env.example contains an unapproved Foundation Slice 1 key: ${key}`);
  for (const key of allowedFoundationKeys) check(exampleKeys.includes(key), `.env.example is missing ${key}.`);
  check(!/(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)\s*=\s*\S+/i.test(envExample), '.env.example must not contain credential-like values.');

  check(developmentRunbook.includes('pnpm install --frozen-lockfile'), 'Development runbook must document frozen-lockfile installs as the steady-state path.');
  check(developmentRunbook.includes('.github/workflows/m01-self-hosted-dispatch.yml'), 'Development runbook must identify the default-branch self-hosted dispatcher.');
  check(developmentRunbook.includes('reference mirror'), 'Development runbook must distinguish the branch-local self-hosted workflow as a reference mirror.');
  check(developmentRunbook.includes('pnpm run dev:api'), 'Development runbook must document the canonical API development loop.');

  for (const path of ['packages/config/tsconfig.build.json','packages/contracts/tsconfig.build.json','apps/api/tsconfig.build.json']) check(apiDevSupervisor.includes(path), `API dev supervisor must compile/watch ${path}.`);
  check(apiDevSupervisor.includes("'--watch'"), 'API dev supervisor must use Node/TypeScript watch mode.');
  check(apiDevSupervisor.includes("'--env-file-if-exists=.env'"), 'API dev supervisor runtime must load repo-root .env safely.');
  check(apiDevSmoke.includes("'0.1.0-dev-reload'"), 'API reload smoke must verify a temporary source-to-runtime version mutation.');
  check(apiDevSmoke.includes('await writeFile(sourcePath, originalSource);'), 'API reload smoke must restore the original source in its cleanup path.');

  check(!apiEntrypoint.includes('void bootstrap();'), 'API entrypoint must not discard the bootstrap promise.');
  check(apiEntrypoint.includes('bootstrap().catch('), 'API entrypoint must handle startup rejection explicitly.');
  check(apiEntrypoint.includes("console.error('Brovexa API failed to start.');"), 'API startup failure must use the safe generic error message.');
  check(apiEntrypoint.includes('process.exitCode = 1;'), 'API startup failure must set a non-zero process exit code.');

  verifyWorkflow(hostedWorkflow, 'Hosted CI');
  verifyWorkflow(selfHostedWorkflow, 'Self-hosted CI reference');
  check(hostedWorkflow.includes('persist-credentials: false'), 'Hosted CI checkout must not persist GitHub credentials.');
  check(!hostedWorkflow.includes('contents: write'), 'Hosted CI must not retain bootstrap write permission after lockfile adoption.');
  check(!hostedWorkflow.includes('upload-artifact'), 'Hosted CI must not retain bootstrap lockfile artifact machinery after lockfile adoption.');
  check(hostedWorkflow.includes('pnpm run verify:dev-api'), 'Hosted CI must execute the API source-to-runtime reload smoke gate.');
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
