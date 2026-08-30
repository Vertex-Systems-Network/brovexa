import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verifier = join(repoRoot, 'scripts', 'verify-foundation.mjs');
const fixtureFiles = [
  'package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','tsconfig.base.json','.gitignore','.env.example','docs/DEVELOPMENT.md',
  'apps/api/package.json','apps/api/tsconfig.json','apps/api/tsconfig.build.json','apps/api/src/main.ts','apps/api/src/health.controller.ts','apps/api/src/health.controller.spec.ts',
  'apps/web/package.json','packages/config/package.json','packages/config/tsconfig.json','packages/config/tsconfig.build.json','packages/contracts/package.json','packages/contracts/tsconfig.json','packages/contracts/tsconfig.build.json',
  'packages/config/src/index.spec.ts','packages/contracts/src/index.spec.ts','.github/workflows/ci.yml','.github/workflows/ci-self-hosted.yml','scripts/dev-api.mjs','scripts/verify-dev-api.mjs','scripts/verify-foundation.test.mjs',
];

const fixtures = [];
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'brovexa-foundation-'));
  fixtures.push(root);
  for (const path of fixtureFiles) {
    const source = join(repoRoot, path);
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  return root;
}
function runVerifier(cwd) { return spawnSync(process.execPath, [verifier], { cwd, encoding: 'utf8' }); }
function assertPass(name, result) { if (result.status !== 0) throw new Error(`${name} expected PASS but failed:\n${result.stdout}${result.stderr}`); }
function assertFailure(name, result, expectedText) {
  const output = `${result.stdout}${result.stderr}`;
  if (result.status === 0 || !output.includes(expectedText)) throw new Error(`${name} expected failure containing ${JSON.stringify(expectedText)} but got:\n${output}`);
}
function mutate(path, transform) { writeFileSync(path, transform(readFileSync(path, 'utf8'))); }

try {
  { const root = makeFixture(); assertPass('current foundation fixture', runVerifier(root)); }
  {
    const root = makeFixture();
    const path = join(root, 'package.json');
    const json = JSON.parse(readFileSync(path, 'utf8')); json.scripts.ci = 'echo unsafe-collision'; writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    assertFailure('pnpm ci collision', runVerifier(root), 'Do not define a root script named "ci"');
  }
  {
    const root = makeFixture();
    const path = join(root, 'package.json');
    const json = JSON.parse(readFileSync(path, 'utf8')); json.devDependencies.turbo = '^2.10.3'; writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    assertFailure('dependency range drift', runVerifier(root), 'devDependencies.turbo must use an exact version or workspace: protocol');
  }
  {
    const root = makeFixture();
    const path = join(root, 'apps/api/package.json');
    const json = JSON.parse(readFileSync(path, 'utf8')); json.scripts.dev = 'node --watch dist/main.js'; writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    assertFailure('stale API dev loop', runVerifier(root), 'API dev script must use the shared API supervisor.');
  }
  {
    const root = makeFixture();
    mutate(join(root, 'apps/api/src/main.ts'), (source) => source.replace(/bootstrap\(\)\.catch\([\s\S]*?\n\}\);\n?$/, 'void bootstrap();\n'));
    assertFailure('discarded API bootstrap promise', runVerifier(root), 'API entrypoint must not discard the bootstrap promise.');
  }
  {
    const root = makeFixture();
    const path = join(root, 'apps/api/tsconfig.build.json');
    const json = JSON.parse(readFileSync(path, 'utf8')); json.exclude = ['src/**/*.spec.ts']; writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    assertFailure('API production build includes test sources', runVerifier(root), 'API production build must exclude spec/test source files.');
  }
  {
    const root = makeFixture(); mutate(join(root, '.env.example'), (source) => `${source}\nAPI_TOKEN=not-allowed\n`);
    assertFailure('credential-like env example', runVerifier(root), 'unapproved Foundation Slice 1 key: API_TOKEN');
  }
  { const root = makeFixture(); rmSync(join(root, 'pnpm-lock.yaml')); assertFailure('missing lockfile', runVerifier(root), 'Missing required foundation path: pnpm-lock.yaml'); }
  {
    const root = makeFixture(); mutate(join(root, '.github/workflows/ci.yml'), (source) => source.replace('pnpm install --frozen-lockfile', 'pnpm install --no-frozen-lockfile'));
    assertFailure('hosted non-frozen install', runVerifier(root), 'must install from the committed lockfile');
  }
  {
    const root = makeFixture(); mutate(join(root, '.github/workflows/ci.yml'), (source) => source.replace(/actions\/checkout@[0-9a-f]{40}/g, 'actions/checkout@v7'));
    assertFailure('mutable GitHub Action tag', runVerifier(root), 'actions/checkout must be pinned to an immutable commit SHA.');
  }
  {
    const root = makeFixture(); mutate(join(root, '.github/workflows/ci.yml'), (source) => source.replace('permissions:\n  contents: read', 'permissions:\n  contents: write'));
    assertFailure('hosted write permission', runVerifier(root), 'GitHub token permissions must remain contents: read.');
  }
  {
    const root = makeFixture(); mutate(join(root, '.github/workflows/ci.yml'), (source) => source.replace('      - name: Verify API source-to-runtime reload loop\n        run: pnpm run verify:dev-api\n', ''));
    assertFailure('missing live reload CI gate', runVerifier(root), 'Hosted CI must execute the API source-to-runtime reload smoke gate.');
  }
  {
    const root = makeFixture(); mutate(join(root, '.github/workflows/ci-self-hosted.yml'), (source) => source.replace('  workflow_dispatch:', '  workflow_dispatch:\n  pull_request:'));
    assertFailure('self-hosted pull-request auto-trigger', runVerifier(root), 'Self-hosted CI reference must not auto-run on pull requests.');
  }
  {
    const root = makeFixture(); mutate(join(root, '.github/workflows/ci-self-hosted.yml'), (source) => source.replace('ref: m01/platform-foundation', 'ref: m01/unapproved-branch'));
    assertFailure('self-hosted arbitrary ref drift', runVerifier(root), 'Self-hosted CI reference must checkout exactly m01/platform-foundation.');
  }
  {
    const root = makeFixture(); mutate(join(root, '.github/workflows/ci-self-hosted.yml'), (source) => source.replace('persist-credentials: false', 'persist-credentials: true'));
    assertFailure('self-hosted persisted credentials', runVerifier(root), 'Self-hosted CI reference must not persist checkout credentials.');
  }
  {
    const root = makeFixture();
    const path = join(root, 'apps/api/tsconfig.json');
    const json = JSON.parse(readFileSync(path, 'utf8')); json.compilerOptions.moduleResolution = 'Node'; writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    assertFailure('legacy TypeScript module resolution', runVerifier(root), 'API TypeScript moduleResolution must be NodeNext');
  }
  {
    const root = makeFixture();
    const path = join(root, 'packages/contracts/package.json');
    const json = JSON.parse(readFileSync(path, 'utf8')); json.scripts.build = 'tsc -p tsconfig.json'; writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    assertFailure('production build includes test sources', runVerifier(root), 'Contracts package production build must use tsconfig.build.json.');
  }
  { const root = makeFixture(); rmSync(join(root, '.gitignore')); assertFailure('missing gitignore', runVerifier(root), 'Missing required foundation path: .gitignore'); }

  console.log('Brovexa foundation preflight regression tests passed.');
} finally {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
}
