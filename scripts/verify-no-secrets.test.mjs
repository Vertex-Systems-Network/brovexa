import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scannerPath = resolve(dirname(fileURLToPath(import.meta.url)), 'verify-no-secrets.mjs');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'brovexa-secret-history-'));

function git(args) {
  return execFileSync('git', args, { cwd: fixtureRoot, encoding: 'utf8' });
}

try {
  git(['init']);
  git(['config', 'user.email', 'security-test@example.invalid']);
  git(['config', 'user.name', 'Brovexa Security Test']);

  writeFileSync(join(fixtureRoot, '.gitignore'), '.env\n!.env.example\n');
  writeFileSync(join(fixtureRoot, '.env.example'), '# intentionally empty\n');
  writeFileSync(join(fixtureRoot, 'README.md'), 'history-scan fixture\n');
  git(['add', '.']);
  git(['commit', '-m', 'test: initialize safe fixture']);

  const syntheticToken = ['ghp_', 'A'.repeat(36)].join('');
  writeFileSync(join(fixtureRoot, 'deleted-secret.txt'), `${syntheticToken}\n`);
  git(['add', 'deleted-secret.txt']);
  git(['commit', '-m', 'test: add synthetic historical credential']);

  git(['rm', 'deleted-secret.txt']);
  git(['commit', '-m', 'test: remove synthetic historical credential']);

  const result = spawnSync(process.execPath, [scannerPath], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      BROVEXA_SECRET_SCAN_HISTORY: 'true',
    },
  });

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  assert.equal(result.status, 1, 'history scanner must reject a credential that was later deleted');
  assert.match(output, /history:[0-9a-f]{12}:deleted-secret\.txt: possible committed GitHub token\./);
  assert.equal(
    output.includes(syntheticToken),
    false,
    'scanner diagnostics must never echo matched credential material',
  );

  console.log('Brovexa committed-secret history regression verification passed.');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
