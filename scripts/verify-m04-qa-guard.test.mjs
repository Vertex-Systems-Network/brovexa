import test from 'node:test';
import assert from 'node:assert/strict';
import { validateM04QaEnvironment } from './verify-m04-qa-guard.mjs';
const valid = () => ({
  nodeVersion: 'v24.20.0', pnpmVersion: '11.23.0', isolated: 'true', resetOptIn: 'true',
  databaseUrl: 'postgresql://brovexa:test@127.0.0.1:5432/brovexa_m04_qa_disposable_test',
});
test('accepts only pinned runtime and disposable local database', () => {
  assert.equal(validateM04QaEnvironment(valid()).allowed, true);
});
test('rejects non-Node24 or unpinned pnpm', () => {
  assert.equal(validateM04QaEnvironment({ ...valid(), nodeVersion: 'v22.16.0' }).allowed, false);
  assert.equal(validateM04QaEnvironment({ ...valid(), pnpmVersion: '11.24.0' }).allowed, false);
});
test('requires explicit disposable database and reset flags', () => {
  assert.equal(validateM04QaEnvironment({ ...valid(), isolated: undefined }).allowed, false);
  assert.equal(validateM04QaEnvironment({ ...valid(), resetOptIn: undefined }).allowed, false);
  assert.equal(validateM04QaEnvironment({ ...valid(), databaseUrl: undefined }).allowed, false);
});
test('refuses remote, production, wrong databases or non-postgres protocols', () => {
  for (const databaseUrl of [
    'postgresql://qa:pass@production.internal/brovexa_m04_qa_disposable_test',
    'postgresql://qa:pass@127.0.0.1/brovexa_production',
    'https://127.0.0.1/brovexa_m04_qa_disposable_test',
    'postgresql://qa:pass@127.0.0.1/brovexa_m04_qa_disposable_test?sslmode=require',
  ]) {
    assert.equal(validateM04QaEnvironment({ ...valid(), databaseUrl }).allowed, false, databaseUrl);
  }
});