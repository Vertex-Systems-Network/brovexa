import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve(import.meta.dirname, '../apps/worker/src');
const files = [
  'website-inspection-runtime.ts',
  'website-inspection-db-bridge.ts',
  'website-fixture-authorization.ts',
  'website-fixture-extractor.ts',
  'website-inspection-pipeline.ts',
];
const contents = Object.fromEntries(files.map(name => [name, readFileSync(resolve(src, name), 'utf8')]));

test('all M04 local runtime units remain test-only with no built-in network or shell dependency', () => {
  for (const [name, code] of Object.entries(contents)) {
    assert.doesNotMatch(code, /from\s*['"](?:node:)?(?:http|https|dns|net|tls|dgram|child_process)(?:\/|['"])/,
      `${name} unexpectedly imported network or shell primitives`);
    assert.doesNotMatch(code, /\b(?:fetch|XMLHttpRequest|execSync|spawnSync|connect)\s*\(/,
      `${name} unexpectedly acquired a network or subprocess primitive`);
  }
});

test('runtime enforces exact inspection-bound admission and uses attested buffer snapshot', () => {
  const source=contents['website-inspection-runtime.ts'];
  assert.match(source,/admission\.inspectionId === request\.inspectionId/);
  assert.match(source,/const response = snapshotExchange\(rawResponse, request\.limits\.maxResponseBytes\)/);
  assert.match(source,/verifyAttestedFixture\(response, manifest\)/);
  assert.match(source,/body: Uint8Array\.from\(response\.body\)/);
});

test('pipeline pins extractor rather than accepting untrusted findings from options', () => {
  const source=contents['website-inspection-pipeline.ts'];
  assert.match(source,/extract: extractWebsiteCapabilitiesFromFixture/);
  assert.match(source,/createWebsiteStoredFixtureAuthorizer\(dependencies\.lookup\)/);
  assert.match(source,/createWebsiteInspectionPersistenceHandoff/);
  assert.doesNotMatch(source,/dependencies\.extract/);
});

test('storage bridge projects explicit allowlisted inspection fields without raw HTML', () => {
  const source=contents['website-inspection-db-bridge.ts'];
  assert.match(source,/deletionRequired: true/);
  assert.match(source,/transportReceiptIds: \[\.\.\.result\.transportReceiptIds\]/);
  assert.doesNotMatch(source,/request:\s*\{\s*\.\.\.request/);
});