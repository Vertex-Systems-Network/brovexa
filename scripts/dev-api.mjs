import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

if (!existsSync(tscBin)) {
  console.error('Brovexa API dev requires installed workspace dependencies. Run pnpm install first.');
  process.exit(1);
}

const projects = [
  ['Config', 'packages/config/tsconfig.build.json'],
  ['Contracts', 'packages/contracts/tsconfig.build.json'],
  ['API', 'apps/api/tsconfig.build.json'],
];

function compileOnce(label, configPath) {
  console.log(`[dev:api] Initial ${label} compile`);
  const result = spawnSync(process.execPath, [tscBin, '-p', configPath], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[dev:api] Failed to start ${label} compiler:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[dev:api] Initial ${label} compile failed.`);
    process.exit(result.status ?? 1);
  }
}

for (const [label, configPath] of projects) {
  compileOnce(label, configPath);
}

let shuttingDown = false;
const children = [];

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  setTimeout(() => process.exit(code), 50).unref();
}

function startChild(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  children.push(child);

  child.on('error', (error) => {
    if (shuttingDown) return;
    console.error(`[dev:api] ${label} failed to start:`, error);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[dev:api] ${label} exited unexpectedly (code=${String(code)}, signal=${String(signal)}).`,
    );
    shutdown(code ?? 1);
  });
}

for (const [label, configPath] of projects) {
  startChild(`${label} TypeScript watcher`, [
    tscBin,
    '-p',
    configPath,
    '--watch',
    '--preserveWatchOutput',
  ]);
}

startChild('API runtime watcher', [
  '--watch',
  '--env-file-if-exists=.env',
  'apps/api/dist/main.js',
]);

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

console.log('[dev:api] Watching Config, Contracts, API and runtime. Press Ctrl+C to stop.');
