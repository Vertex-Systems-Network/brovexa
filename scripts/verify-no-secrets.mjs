import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const failures = [];
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const textExtensions = new Set([
  '.css',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const extensionlessTextFiles = new Set(['.editorconfig', '.env.example', '.gitignore', '.npmrc']);

const highConfidencePatterns = [
  {
    label: 'private key material',
    current: /-{5}BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-{5}/,
    history: '-{5}BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-{5}',
  },
  {
    label: 'AWS access key',
    current: /\bAKIA[0-9A-Z]{16}\b/,
    history: 'AKIA[0-9A-Z]{16}',
  },
  {
    label: 'GitHub token',
    current: /\bgh[pousr]_[0-9A-Za-z]{30,}\b/,
    history: 'gh[pousr]_[0-9A-Za-z]{30,}',
  },
  {
    label: 'GitLab personal token',
    current: /\bglpat-[0-9A-Za-z_-]{20,}\b/,
    history: 'glpat-[0-9A-Za-z_-]{20,}',
  },
  {
    label: 'Slack token',
    current: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/,
    history: 'xox[baprs]-[0-9A-Za-z-]{20,}',
  },
  {
    label: 'Stripe live secret key',
    current: /\bsk_live_[0-9A-Za-z]{16,}\b/,
    history: 'sk_live_[0-9A-Za-z]{16,}',
  },
  {
    label: 'OpenAI-style secret key',
    current: /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}\b/,
    history: 'sk-(proj-)?[0-9A-Za-z_-]{20,}',
  },
  {
    label: 'Google API key',
    current: /\bAIza[0-9A-Za-z_-]{35}\b/,
    history: 'AIza[0-9A-Za-z_-]{35}',
  },
  {
    label: 'npm access token',
    current: /\bnpm_[0-9A-Za-z]{20,}\b/,
    history: 'npm_[0-9A-Za-z]{20,}',
  },
];

function isTextCandidate(path) {
  return extensionlessTextFiles.has(path) || textExtensions.has(extname(path));
}

function scanCurrentTree() {
  for (const path of trackedFiles) {
    if (!isTextCandidate(path)) continue;
    const content = readFileSync(path, 'utf8');

    for (const { label, current } of highConfidencePatterns) {
      if (current.test(content)) failures.push(`${path}: possible committed ${label}.`);
    }
  }

  for (const path of trackedFiles.filter((path) => /^\.env(?:\.|$)/.test(path))) {
    const content = readFileSync(path, 'utf8');
    for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (!match) continue;
      const [, key = '', rawValue = ''] = match;
      if (!/(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)/.test(key)) continue;
      const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
      if (value) {
        failures.push(
          `${path}:${index + 1}: sensitive-looking key ${key} must not contain a committed value.`,
        );
      }
    }
  }

  const gitignore = readFileSync('.gitignore', 'utf8');
  if (!gitignore.split(/\r?\n/).includes('.env')) {
    failures.push('.gitignore must ignore local .env files.');
  }
  if (!gitignore.split(/\r?\n/).includes('!.env.example')) {
    failures.push('.gitignore must explicitly retain the secrets-free .env.example template.');
  }

  if (trackedFiles.some((path) => path === '.env')) {
    failures.push('A real .env file must never be tracked.');
  }
}

function scanReachableHistory() {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    encoding: 'utf8',
  }).trim();

  if (shallow !== 'false') {
    failures.push(
      'git-history: full-history secret scan was requested but the repository is shallow; fetch full history before retrying.',
    );
    return;
  }

  for (const { label, history } of highConfidencePatterns) {
    const output = execFileSync(
      'git',
      [
        'log',
        '--all',
        '--format=COMMIT:%H',
        '--name-only',
        '--no-renames',
        '--extended-regexp',
        `-G${history}`,
        '--',
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );

    let currentCommit = null;
    const seen = new Set();

    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('COMMIT:')) {
        currentCommit = line.slice('COMMIT:'.length);
        continue;
      }
      if (!currentCommit) continue;

      const key = `${currentCommit}:${line}:${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push(
        `history:${currentCommit.slice(0, 12)}:${line}: possible committed ${label}.`,
      );
    }
  }
}

scanCurrentTree();

const historyScanRequested = process.env.BROVEXA_SECRET_SCAN_HISTORY === 'true';
if (historyScanRequested) scanReachableHistory();

if (failures.length > 0) {
  console.error('Brovexa committed-secret gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const historySuffix = historyScanRequested ? ' with reachable-history scan' : '';
console.log(
  `Brovexa committed-secret gate passed for ${trackedFiles.length} tracked files${historySuffix}.`,
);
