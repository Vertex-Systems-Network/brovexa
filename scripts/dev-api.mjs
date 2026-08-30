import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const pollIntervalMs = 500;

if (!existsSync(tscBin)) {
  console.error('Brovexa API dev requires installed workspace dependencies. Run pnpm install first.');
  process.exit(1);
}

const projects = [
  ['Config', 'packages/config/tsconfig.build.json'],
  ['Contracts', 'packages/contracts/tsconfig.build.json'],
  ['API', 'apps/api/tsconfig.build.json'],
];

const watchRoots = [
  'packages/config/src',
  'packages/contracts/src',
  'apps/api/src',
];

const watchFiles = projects.map(([, configPath]) => configPath);

function compileProject(label, configPath, initial = false) {
  console.log(`[dev:api] ${initial ? 'Initial ' : ''}${label} compile`);
  const result = spawnSync(process.execPath, [tscBin, '-p', configPath], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[dev:api] Failed to start ${label} compiler:`, result.error);
    return false;
  }

  if (result.status !== 0) {
    console.error(`[dev:api] ${label} compile failed.`);
    return false;
  }

  return true;
}

function compileAll(initial = false) {
  for (const [label, configPath] of projects) {
    if (!compileProject(label, configPath, initial)) return false;
  }
  return true;
}

if (!compileAll(true)) process.exit(1);

async function collectFiles(relativeDirectory, files) {
  const absoluteDirectory = resolve(repoRoot, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(relativePath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(relativePath);
    }
  }
}

async function createSnapshot() {
  const files = [...watchFiles];
  for (const root of watchRoots) await collectFiles(root, files);
  files.sort();

  const snapshot = new Map();
  for (const relativePath of files) {
    const metadata = await stat(resolve(repoRoot, relativePath));
    snapshot.set(relativePath, `${metadata.mtimeMs}:${metadata.size}`);
  }
  return snapshot;
}

function snapshotsDiffer(previous, next) {
  if (previous.size !== next.size) return true;
  for (const [path, signature] of next) {
    if (previous.get(path) !== signature) return true;
  }
  return false;
}

let shuttingDown = false;
let restartingRuntime = false;
let polling = false;
let runtime;
let sourceSnapshot = await createSnapshot();
let pollTimer;

function waitForExit(child, graceMs = 2_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise((resolveExit) => {
    const onExit = () => {
      clearTimeout(timer);
      resolveExit();
    };
    child.once('exit', onExit);
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      resolveExit();
    }, graceMs);
  });
}

function startRuntime() {
  const child = spawn(process.execPath, [
    '--env-file-if-exists=.env',
    'apps/api/dist/main.js',
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    if (shuttingDown || restartingRuntime) return;
    console.error('[dev:api] API runtime failed to start:', error);
    void shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown || restartingRuntime) return;
    console.error(`[dev:api] API runtime exited unexpectedly (code=${String(code)}, signal=${String(signal)}).`);
    void shutdown(typeof code === 'number' && code !== 0 ? code : 1);
  });

  runtime = child;
}

async function restartRuntime() {
  restartingRuntime = true;
  const previousRuntime = runtime;
  if (previousRuntime && previousRuntime.exitCode === null && previousRuntime.signalCode === null) {
    previousRuntime.kill('SIGTERM');
    await waitForExit(previousRuntime);
  }
  startRuntime();
  restartingRuntime = false;
}

async function pollForChanges() {
  if (polling || shuttingDown) return;
  polling = true;

  try {
    const nextSnapshot = await createSnapshot();
    if (!snapshotsDiffer(sourceSnapshot, nextSnapshot)) return;

    sourceSnapshot = nextSnapshot;
    console.log('[dev:api] Source change detected; rebuilding Config, Contracts and API.');

    if (!compileAll(false)) {
      console.error('[dev:api] Reload compile failed; keeping the last-good API runtime alive.');
      return;
    }

    await restartRuntime();
    console.log('[dev:api] API runtime restarted after successful rebuild.');
  } catch (error) {
    console.error('[dev:api] Source polling failed:', error);
    void shutdown(1);
  } finally {
    polling = false;
  }
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code;
  if (pollTimer) clearInterval(pollTimer);

  const activeRuntime = runtime;
  if (activeRuntime && activeRuntime.exitCode === null && activeRuntime.signalCode === null) {
    activeRuntime.kill('SIGTERM');
    await waitForExit(activeRuntime);
  }

  process.exit(code);
}

startRuntime();
pollTimer = setInterval(() => { void pollForChanges(); }, pollIntervalMs);

process.on('SIGINT', () => { void shutdown(130); });
process.on('SIGTERM', () => { void shutdown(143); });

console.log('[dev:api] Polling Config, Contracts and API sources; last-good runtime stays active across compile errors. Press Ctrl+C to stop.');
