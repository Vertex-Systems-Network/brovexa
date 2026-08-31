import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(repoRoot, 'apps/api/src/health.controller.ts');
const supervisorPath = resolve(repoRoot, 'scripts/dev-api.mjs');
const port = 31337;
const healthUrl = `http://127.0.0.1:${port}/health`;
const initialVersion = '0.1.0';
const reloadVersion = '0.1.0-dev-reload';
const timeoutMs = 45_000;
const pollMs = 250;
const testRequestId = 'dev-smoke-request-123';
const testTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';
const testTraceparent = `00-${testTraceId}-00f067aa0ba902b7-01`;

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
      throw new Error(`dev:api supervisor exited before ${label} (code=${child.exitCode}).\n${output}`);
    }

    await delay(pollMs);
  }

  throw new Error(`Timed out waiting for ${label}: ${lastError}.\n${output}`);
}

async function waitForOutput(fragment, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (output.includes(fragment)) return;
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`dev:api supervisor exited before ${label} (code=${child.exitCode}).\n${output}`);
    }
    await delay(pollMs);
  }
  throw new Error(`Timed out waiting for ${label}.\n${output}`);
}

async function verifyCorrelationAndErrorContract() {
  const headers = {
    'x-request-id': testRequestId,
    traceparent: testTraceparent,
  };
  const response = await fetch(`${healthUrl}?token=must-not-appear-in-logs`, {
    headers,
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-request-id'), testRequestId);
  assert.equal(response.headers.get('x-trace-id'), testTraceId);

  await waitForOutput(`"requestId":"${testRequestId}"`, 'structured request correlation log');
  assert.equal(output.includes('must-not-appear-in-logs'), false, 'Request query data leaked into logs.');

  const readinessResponse = await fetch(`http://127.0.0.1:${port}/ready`, {
    headers,
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(readinessResponse.status, 503);
  assert.equal(readinessResponse.headers.get('x-request-id'), testRequestId);
  assert.equal(readinessResponse.headers.get('x-trace-id'), testTraceId);
  assert.deepEqual(await readinessResponse.json(), {
    code: 'DATABASE_NOT_CONFIGURED',
    message: 'Database readiness is not configured.',
    requestId: testRequestId,
    traceId: testTraceId,
  });

  const missingResponse = await fetch(`http://127.0.0.1:${port}/missing?token=must-not-echo`, {
    headers,
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.headers.get('x-request-id'), testRequestId);
  assert.equal(missingResponse.headers.get('x-trace-id'), testTraceId);
  assert.deepEqual(await missingResponse.json(), {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    requestId: testRequestId,
    traceId: testTraceId,
  });
}

async function stopChild() {
  if (!child || child.exitCode !== null) return;

  child.kill('SIGTERM');
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  await Promise.race([exited, delay(5_000)]);

  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  child = spawn(process.execPath, [supervisorPath], {
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
  child.on('error', (error) => { output += `\nspawn error: ${error instanceof Error ? error.message : String(error)}\n`; });

  await waitForVersion(initialVersion, 'initial API health response');
  await verifyCorrelationAndErrorContract();

  const mutatedSource = originalSource.replace(`version: '${initialVersion}'`, `version: '${reloadVersion}'`);
  await writeFile(sourcePath, mutatedSource);
  await waitForVersion(reloadVersion, 'source-to-runtime reload response');

  await writeFile(sourcePath, originalSource);
  await waitForVersion(initialVersion, 'restored source-to-runtime response');

  console.log('Brovexa dev:api correlation/error/reload smoke passed.');
} finally {
  await writeFile(sourcePath, originalSource);
  await stopChild();
}
