#!/usr/bin/env node
/** Explicit, opt-in, no-production native QA-01..05 runner. Does not invoke live websites. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateM04QaEnvironment } from './verify-m04-qa-guard.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const pnpmCheck = spawnSync('pnpm', ['--version'], { encoding: 'utf8', timeout: 15_000 });
const validation = validateM04QaEnvironment({
  nodeVersion: process.version,
  pnpmVersion: pnpmCheck.status === 0 ? pnpmCheck.stdout.trim() : null,
  databaseUrl: process.env.DATABASE_URL,
  isolated: process.env.BROVEXA_M04_QA_ISOLATED,
  resetOptIn: process.env.BROVEXA_DB_TEST_ALLOW_RESET,
});
if (!validation.allowed) {
  for (const problem of validation.errors) process.stderr.write(`M04 QA preflight: ${problem}\n`);
  process.exitCode = 2;
} else if (process.argv.slice(2).includes('--preflight')) {
  process.stdout.write('M04 QA native environment preflight PASS (no database queried).\n');
} else {
  // All commands are canonical package scripts, never an ad hoc schema reset.
  const jobs = [
    ['Install frozen dependencies', ['install', '--frozen-lockfile']],
    ['Native package build/typecheck/Vitest', ['run', 'quality:runtime']],
    ['PostgreSQL 18 migration verification', ['run', 'verify:db']],
    ['Full tenant RBAC verification', ['run', 'verify:identity']],
  ];
  for (const [name, args] of jobs) {
    process.stdout.write(`\nM04 QA: ${name}\n`);
    const run = spawnSync('pnpm', args, { cwd: repoRoot, stdio: 'inherit', env: process.env, timeout: 20 * 60 * 1000 });
    if (run.error || run.status !== 0) {
      process.stderr.write(`M04 QA FAILED at ${name}; native acceptance is NOT complete.\n`);
      process.exitCode = run.status && run.status > 0 ? run.status : 1;
      break;
    }
  }
  if (!process.exitCode) process.stdout.write('M04 QA-01..05 native commands PASS. Review logs and exact Git SHA before closure.\n');
}