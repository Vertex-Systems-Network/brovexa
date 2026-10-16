import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const yaml = readFileSync(new URL('../.github/workflows/m04-native-checkpoint.yml', import.meta.url), 'utf8');

test('M04 native QA cannot run on main, pull_request, deploy or production secrets', () => {
  assert.match(yaml, /^  push:\n    branches:\n      - checkpoint\/m04-local-web006-20261016$/m);
  assert.doesNotMatch(yaml, /\b(?:pull_request|pull_request_target|deploy|production|secrets\.)\s*:/i);
  assert.match(yaml, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(yaml, /BROVEXA_DB_TEST_ALLOW_RESET: (?!'true')/);
});

test('native acceptance pins actual toolchain and all four isolated service environments', () => {
  assert.equal((yaml.match(/node-version: 24\.20\.0/g) ?? []).length, 4);
  assert.equal((yaml.match(/pnpm@11\.23\.0/g) ?? []).length, 4);
  assert.equal((yaml.match(/postgres:18\.6@sha256:/g) ?? []).length, 3);
  assert.equal((yaml.match(/valkey:9\.1\.1-alpine3\.24@sha256:/g) ?? []).length, 1);
  assert.match(yaml, /pnpm run quality:runtime/);
  assert.match(yaml, /pnpm run verify:db/);
  assert.match(yaml, /pnpm run verify:identity/);
  assert.match(yaml, /pnpm run verify:queue/);
  assert.match(yaml, /^  native-m04-security:$/m);
  assert.match(yaml, /node scripts\/verify-m04-live-security\.mjs/);
});

test('all destructive test URLs are loopback and point to disposable qa databases', () => {
  const urls = [...yaml.matchAll(/DATABASE_URL:\s*(postgresql:\/\/[^\s]+)/g)].map(x=>new URL(x[1]));
  assert.equal(urls.length, 3);
  for (const url of urls) {
    assert.equal(url.hostname, '127.0.0.1');
    assert.match(url.pathname, /^\/brovexa_m04_qa_[a-z0-9_]+_test$/);
  }
  assert.equal((yaml.match(/BROVEXA_DB_TEST_ALLOW_RESET: 'true'/g)??[]).length,3);
  assert.equal((yaml.match(/BROVEXA_M04_QA_ISOLATED: 'true'/g)??[]).length,3);
  assert.equal((yaml.match(/pnpm install --frozen-lockfile/g)??[]).length,4);
});