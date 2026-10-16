import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const order = (src, names) => {
  const positions = names.map(name => {
    const marker = `DROP TABLE IF EXISTS ${name}`;
    const count = src.split(marker).length - 1;
    assert.equal(count, 1, `${name} needs exactly one explicit reset DROP`);
    return src.indexOf(marker);
  });
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
};
const dependencyOrder = [
  'website_live_capability_observations',
  'website_live_retention_work_receipts',
  'website_live_inspection_runs',
  'website_live_inspection_grants',
  'website_capability_observations',
  'website_inspection_runs',
  'approved_business_contact_evidence',
  'contact_data_eligibility_decisions',
  'business_domain_verification_decisions',
  'business_domain_evidence',
];
for (const script of ['verify-db.mjs', 'verify-queue.mjs']) {
  test(`${script} drops M04 children and grants before identity/domain parent tables`, () => {
    const source = read(script);
    order(source, dependencyOrder);
    order(source, ['business_domain_verification_decisions', 'canonical_businesses', 'source_admission_snapshots', 'workspaces']);
    assert.match(source, /BROVEXA_DB_TEST_ALLOW_RESET/);
  });
}