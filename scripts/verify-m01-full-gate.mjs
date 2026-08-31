import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredPaths = [
  'docs/CHECKPOINT.md',
  'docs/DEVELOPMENT.md',
  'docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md',
  'docs/API_OBSERVABILITY_HEALTH_FOUNDATION.md',
  'scripts/verify-source-hygiene.mjs',
  'scripts/verify-no-secrets.mjs',
  'scripts/verify-dev-api.mjs',
  'scripts/verify-db.mjs',
  'scripts/verify-identity.mjs',
  'scripts/verify-queue.mjs',
  '.github/workflows/ci.yml',
];
for (const path of requiredPaths) check(existsSync(path), `Missing M01 FULL GATE path: ${path}`);

if (failures.length === 0) {
  const root = JSON.parse(read('package.json'));
  const checkpoint = read('docs/CHECKPOINT.md');
  const development = read('docs/DEVELOPMENT.md');
  const integrationPolicy = read('docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md');
  const workflow = read('.github/workflows/ci.yml');
  const queueVerification = read('scripts/verify-queue.mjs');

  check(root.scripts?.['verify:format'] === 'node scripts/verify-source-hygiene.mjs', 'Root verify:format must execute the deterministic source-hygiene gate.');
  check(root.scripts?.lint === 'node scripts/verify-source-hygiene.mjs', 'Root lint must execute the deterministic M01 source-hygiene policy.');
  check(root.scripts?.['verify:no-secrets'] === 'node scripts/verify-no-secrets.mjs', 'Root verify:no-secrets must execute the tracked-secret gate.');
  check(root.scripts?.['verify:m01:full-gate'] === 'node scripts/verify-m01-full-gate.mjs', 'Root verify:m01:full-gate must expose this readiness contract.');
  check(root.scripts?.['audit:dependencies'] === 'pnpm audit --audit-level high', 'Root audit:dependencies must fail on high/critical registry advisories.');

  for (const command of [
    'pnpm run verify:format',
    'pnpm run lint',
    'pnpm run verify:no-secrets',
    'pnpm run verify:m01:full-gate',
    'pnpm run audit:dependencies',
    'pnpm run quality:runtime',
    'pnpm run verify:dev-api',
    'pnpm run verify:db',
    'pnpm run verify:identity',
    'pnpm run verify:queue',
  ]) {
    check(workflow.includes(command), `Hosted CI FULL GATE must execute: ${command}`);
  }

  check(workflow.includes('pnpm install --frozen-lockfile'), 'Hosted CI must prove a clean frozen-lockfile installation.');
  check(workflow.includes('name: M01 FULL GATE quality and security'), 'Hosted CI quality job must be explicitly identified as the M01 FULL GATE quality/security lane.');
  check(workflow.includes('name: PostgreSQL 18 migration + RBAC FULL GATE'), 'Hosted CI database job must identify migration + RBAC FULL GATE coverage.');
  check(workflow.includes('name: Canonical worker + Valkey FULL GATE'), 'Hosted CI queue job must identify recovery/idempotency FULL GATE coverage.');

  for (const verifiedIssue of ['ABD-259', 'ABD-260', 'ABD-261', 'ABD-262', 'ABD-263']) {
    check(checkpoint.includes(`${verifiedIssue}`), `Checkpoint must include ${verifiedIssue}.`);
  }
  check(checkpoint.includes('ABD-263 — API / observability / health'), 'Checkpoint must persist the verified ABD-263 lane.');
  check(checkpoint.includes('ABD-264 — M01 FULL GATE'), 'Checkpoint must persist the active ABD-264 lane.');
  check(checkpoint.includes('ABD-266 — default-branch protection / compensating controls'), 'Checkpoint must persist the ABD-266 release-gate state.');
  check(!checkpoint.includes('Current active lane — ABD-261'), 'Checkpoint is stale: ABD-261 may not remain the current lane.');
  check(!checkpoint.includes('ABD-262` — identity/RBAC/tenant enforcement — dependency-gated by stable DB contract; not started'), 'Checkpoint is stale: ABD-262 is verified.');

  check(development.includes('pnpm run verify:m01:full-gate'), 'Development runbook must document the M01 FULL GATE readiness command.');
  check(development.includes('pnpm run audit:dependencies'), 'Development runbook must document dependency vulnerability auditing.');
  check(development.includes('pnpm run verify:no-secrets'), 'Development runbook must document tracked-secret verification.');
  check(development.includes('pnpm run verify:format'), 'Development runbook must document format verification.');
  check(development.includes('pnpm run lint'), 'Development runbook must document lint verification.');

  check(integrationPolicy.includes('protected: false'), 'Default-branch policy must record the observed native protection state.');
  check(integrationPolicy.includes('rulesets: none observed'), 'Default-branch policy must record the observed repository ruleset state.');
  check(integrationPolicy.includes('expected PR head SHA'), 'Default-branch policy must preserve expected-head verification.');
  check(integrationPolicy.includes('No auto-merge'), 'Default-branch policy must preserve no-auto-merge behavior.');

  check(queueVerification.includes('correlationIdsSeen'), 'Queue FULL GATE must explicitly observe handler correlation IDs.');
  check(queueVerification.includes('retryWork.correlationId'), 'Queue FULL GATE must compare execution correlation against canonical PostgreSQL correlation truth.');
}

if (failures.length > 0) {
  console.error('Brovexa M01 FULL GATE readiness contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Brovexa M01 FULL GATE readiness contract passed.');
