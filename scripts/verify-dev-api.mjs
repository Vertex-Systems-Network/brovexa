import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(repoRoot, 'apps/api/src/health.controller.ts');
const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const port = 31337;
const healthUrl = `http://127.0.0.1:${port}/health`;
const initialVersion = '0.1.0';
const reloadVersion = '0.1.0-dev-reload';
const timeoutMs = 45_000;
const pollMs = 250;

const originalSource = await readFile(sourcePath, 'utf8');
if (!originalSource.includes(`version: '${initialVersion}'`)) {
  throw new Error('Dev API smoke requires the canonical health version marker.');
}

let output = '';
let child;

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitForVersion(expectedVersion, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response yet';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
      } else {
        const body = await response.json();
        if (body?.version === expectedVersion) return;
        lastError = `received version ${JSON.stringify(body?.version)}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`dev:api exited before ${label} (code=${child.exitCode}).\n${output}`);
    }

    await delay(pollMs);
  }

  throw new Error(`Timed out waiting for ${label}: ${lastError}.\n${output}`);
}

async function stopChild() {
  if (!child || child.exitCode !== null) return;

  child.kill('SIGTERM');
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  await Promise.race([exited, delay(5_000)]);

  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  child = spawn(packageManager, ['run', 'dev:api'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  child.on('error', (error) => {
    output += `\nspawn error: ${error instanceof Error ? error.message : String(error)}\n`;
  });

  await waitForVersion(initialVersion, 'initial API health response');

  const mutatedSource = originalSource.replace(
    `version: '${initialVersion}'`,
    `version: '${reloadVersion}'`,
  );
  await writeFile(sourcePath, mutatedSource);
  await waitForVersion(reloadVersion, 'source-to-runtime reload response');

  await writeFile(sourcePath, originalSource);
  await waitForVersion(initialVersion, 'restored source-to-runtime response');

  console.log('Brovexa dev:api source-to-runtime reload smoke passed.');
} finally {
  await writeFile(sourcePath, originalSource);
  await stopChild();
}
