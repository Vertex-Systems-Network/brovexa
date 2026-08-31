import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const check = (condition, message) => { if (!condition) failures.push(message); };

const packageManifests = [
  'package.json','apps/api/package.json','apps/web/package.json','packages/config/package.json','packages/contracts/package.json','packages/db/package.json',
];
const nodeTsconfigs = [
  ['API','apps/api/tsconfig.json'],['Config','packages/config/tsconfig.json'],['Contracts','packages/contracts/tsconfig.json'],['DB','packages/db/tsconfig.json'],
];
const requiredPaths = [
  ...packageManifests,
  ...nodeTsconfigs.map(([, path]) => path),
  'apps/api/tsconfig.build.json','packages/config/tsconfig.build.json','packages/contracts/tsconfig.build.json','packages/db/tsconfig.build.json',
  'pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','tsconfig.base.json','.gitignore','.env.example','docs/DEVELOPMENT.md','docs/DATABASE.md','compose.dev.yml',
  'apps/api/src/main.ts','apps/api/src/health.controller.ts','apps/api/src/health.controller.spec.ts','apps/api/src/database.service.ts','apps/api/src/readiness.controller.ts','apps/api/src/readiness.controller.spec.ts',
  'packages/config/src/index.spec.ts','packages/contracts/src/index.spec.ts','packages/db/src/schema.ts','packages/db/src/schema.spec.ts','packages/db/src/client.ts','packages/db/src/migrations.ts',
  'packages/db/migrations/0000_workspace_foundation.up.sql','packages/db/migrations/down/0000_workspace_foundation.down.sql',
  '.github/workflows/ci.yml','.github/workflows/ci-self-hosted.yml','scripts/dev-api.mjs','scripts/verify-dev-api.mjs','scripts/verify-db.mjs','scripts/verify-foundation.test.mjs',
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
  check(!workflow.includes('run: pnpm ci'), `${label}: must not use bare \`pnpm ci\` as the quality gate.`);
}

if (failures.length === 0) {
  const manifests = Object.fromEntries(packageManifests.map((path) => [path, JSON.parse(read(path))]));
  const root = manifests['package.json'];
  const apiPackage = manifests['apps/api/package.json'];
  const configPackage = manifests['packages/config/package.json'];
  const contractsPackage = manifests['packages/contracts/package.json'];
  const dbPackage = manifests['packages/db/package.json'];
  const hostedWorkflow = read('.github/workflows/ci.yml');
  const selfHostedWorkflow = read('.github/workflows/ci-self-hosted.yml');
  const workspace = read('pnpm-workspace.yaml');
  const gitignore = read('.gitignore');
  const envExample = read('.env.example');
  const developmentRunbook = read('docs/DEVELOPMENT.md');
  const databaseRunbook = read('docs/DATABASE.md');
  const compose = read('compose.dev.yml');
  const apiDevSupervisor = read('scripts/dev-api.mjs');
  const apiDevSmoke = read('scripts/verify-dev-api.mjs');
  const dbSmoke = read('scripts/verify-db.mjs');
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
  check(root.scripts?.['verify:db'] === 'pnpm --filter @brovexa/db build && node scripts/verify-db.mjs', 'Root verify:db script must execute the reviewed database integration harness.');
  check(apiPackage.dependencies?.['@brovexa/db'] === 'workspace:*', 'API must consume the shared @brovexa/db package through workspace protocol.');
  check(apiPackage.scripts?.dev === 'node ../../scripts/dev-api.mjs', 'API dev script must use the shared API supervisor.');

  for (const [name, manifest] of [['API',apiPackage],['Config',configPackage],['Contracts',contractsPackage],['DB',dbPackage]]) {
    check(manifest.scripts?.test === 'vitest run', `${name} package must expose the Vitest test gate.`);
  }
  verifyBuildExcludes('API', apiPackage, 'apps/api/tsconfig.build.json');
  verifyBuildExcludes('Config', configPackage, 'packages/config/tsconfig.build.json');
  verifyBuildExcludes('Contracts', contractsPackage, 'packages/contracts/tsconfig.build.json');
  verifyBuildExcludes('DB', dbPackage, 'packages/db/tsconfig.build.json');

  check(workspace.includes('apps/*'), 'pnpm workspace must include apps/*.');
  check(workspace.includes('packages/*'), 'pnpm workspace must include packages/*.');
  check(/minimumReleaseAgeExclude:\s*\n\s*-\s*zod@4\.5\.4\b/.test(workspace), 'pnpm workspace must retain the exact reviewed zod@4.5.4 release-age exception.');
  check(gitignore.includes('.env'), '.gitignore must exclude local .env files.');
  check(gitignore.includes('!.env.example'), '.gitignore must explicitly allow the secrets-free .env.example template.');

  const exampleKeys = envExample.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => line.split('=',1)[0]);
  const allowedFoundationKeys = new Set(['NODE_ENV','HOST','PORT','DATABASE_URL']);
  for (const key of exampleKeys) check(allowedFoundationKeys.has(key), `.env.example contains an unapproved M01 key: ${key}`);
  for (const key of allowedFoundationKeys) check(exampleKeys.includes(key), `.env.example is missing ${key}.`);
  check(!/(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)\s*=\s*\S+/i.test(envExample), '.env.example must not contain credential-like values.');

  check(developmentRunbook.includes('pnpm install --frozen-lockfile'), 'Development runbook must document frozen-lockfile installs as the steady-state path.');
  check(developmentRunbook.includes('.github/workflows/m01-self-hosted-dispatch.yml'), 'Development runbook must identify the default-branch self-hosted dispatcher.');
  check(developmentRunbook.includes('reference mirror'), 'Development runbook must distinguish the branch-local self-hosted workflow as a reference mirror.');
  check(developmentRunbook.includes('pnpm run dev:api'), 'Development runbook must document the canonical API development loop.');
  check(developmentRunbook.includes('poll'), 'Development runbook must document deterministic source polling for the API dev loop.');
  check(databaseRunbook.includes('BROVEXA_DB_TEST_ALLOW_RESET=true'), 'Database runbook must document the destructive integration-test safety guard.');
  check(databaseRunbook.includes('forward-fix preferred'), 'Database runbook must document production recovery posture.');

  for (const path of ['packages/config/tsconfig.build.json','packages/contracts/tsconfig.build.json','apps/api/tsconfig.build.json']) check(apiDevSupervisor.includes(path), `API dev supervisor must compile ${path}.`);
  check(apiDevSupervisor.includes('const pollIntervalMs = 500;'), 'API dev supervisor must use the bounded 500ms source polling interval.');
  check(apiDevSupervisor.includes("'packages/config/src'"), 'API dev supervisor must poll Config source changes.');
  check(apiDevSupervisor.includes("'packages/contracts/src'"), 'API dev supervisor must poll Contracts source changes.');
  check(apiDevSupervisor.includes("'apps/api/src'"), 'API dev supervisor must poll API source changes.');
  check(apiDevSupervisor.includes('keeping the last-good API runtime alive'), 'API dev supervisor must preserve the last-good runtime when reload compilation fails.');
  check(apiDevSupervisor.includes("'--env-file-if-exists=.env'"), 'API dev supervisor runtime must load repo-root .env safely.');
  check(!apiDevSupervisor.includes("'--watch'"), 'API dev supervisor must not depend on platform-specific native watch mode.');
  check(apiDevSmoke.includes("'0.1.0-dev-reload'"), 'API reload smoke must verify a temporary source-to-runtime version mutation.');
  check(apiDevSmoke.includes('await writeFile(sourcePath, originalSource);'), 'API reload smoke must restore the original source in its cleanup path.');

  check(dbSmoke.includes("BROVEXA_DB_TEST_ALLOW_RESET !== 'true'"), 'Database integration harness must require explicit destructive-test authorization.');
  check(dbSmoke.includes("endsWith('_test')"), 'Database integration harness must refuse destructive reset outside a *_test database.');
  check(compose.includes('postgres:18.6@sha256:'), 'Local Compose must pin PostgreSQL 18.6 by immutable image digest.');

  check(!apiEntrypoint.includes('void bootstrap();'), 'API entrypoint must not discard the bootstrap promise.');
  check(apiEntrypoint.includes('bootstrap().catch('), 'API entrypoint must handle startup rejection explicitly.');
  check(apiEntrypoint.includes("console.error('Brovexa API failed to start.');"), 'API startup failure must use the safe generic error message.');
  check(apiEntrypoint.includes('process.exitCode = 1;'), 'API startup failure must set a non-zero process exit code.');

  verifyWorkflow(hostedWorkflow, 'Hosted CI');
  verifyWorkflow(selfHostedWorkflow, 'Self-hosted CI reference');
  check(hostedWorkflow.includes('persist-credentials: false'), 'Hosted CI checkout must not persist GitHub credentials.');
  check(!hostedWorkflow.includes('contents: write'), 'Hosted CI must remain read-only.');
  check(hostedWorkflow.includes('pnpm run verify:dev-api'), 'Hosted CI must execute the API source-to-runtime reload smoke gate.');
  check(hostedWorkflow.includes('PostgreSQL 18') && hostedWorkflow.includes('pnpm run verify:db'), 'Hosted CI must include a PostgreSQL 18 database integration job that executes verify:db.');
  check(hostedWorkflow.includes('postgres:18.6@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280'), 'Hosted CI PostgreSQL service must be pinned to the reviewed 18.6 image digest.');
  check(hostedWorkflow.includes('pnpm run verify:db'), 'Hosted CI must execute the database migration/data-layer verification gate.');
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
