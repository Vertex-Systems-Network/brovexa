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
  ['private key material', /-{5}BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-{5}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[0-9A-Za-z]{30,}\b/],
  ['GitLab personal token', /\bglpat-[0-9A-Za-z_-]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/],
  ['Stripe live secret key', /\bsk_live_[0-9A-Za-z]{16,}\b/],
  ['OpenAI-style secret key', /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['npm access token', /\bnpm_[0-9A-Za-z]{20,}\b/],
];

function isTextCandidate(path) {
  return extensionlessTextFiles.has(path) || textExtensions.has(extname(path));
}

for (const path of trackedFiles) {
  if (!isTextCandidate(path)) continue;
  const content = readFileSync(path, 'utf8');

  for (const [label, pattern] of highConfidencePatterns) {
    if (pattern.test(content)) failures.push(`${path}: possible committed ${label}.`);
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
    if (value) failures.push(`${path}:${index + 1}: sensitive-looking key ${key} must not contain a committed value.`);
  }
}

const gitignore = readFileSync('.gitignore', 'utf8');
if (!gitignore.split(/\r?\n/).includes('.env')) {
  failures.push('.gitignore must ignore local .env files.');
}
if (!gitignore.split(/\r?\n/).includes('!.env.example')) {
  failures.push('.gitignore must explicitly retain the secrets-free .env.example template.');
}

if (trackedFiles.some((path) => path === '.env')) failures.push('A real .env file must never be tracked.');

if (failures.length > 0) {
  console.error('Brovexa tracked-secret gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Brovexa tracked-secret gate passed for ${trackedFiles.length} tracked files.`);
