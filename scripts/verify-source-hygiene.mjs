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
const extensionlessTextFiles = new Set([
  '.editorconfig',
  '.env.example',
  '.gitignore',
  '.node-version',
  '.npmrc',
  '.nvmrc',
]);
const strictPrefixes = ['apps/', 'packages/', 'scripts/', '.github/workflows/'];
const strictRootFiles = new Set([
  '.editorconfig',
  '.env.example',
  '.gitignore',
  '.node-version',
  '.npmrc',
  '.nvmrc',
  'compose.dev.yml',
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'turbo.json',
]);
const m01OperationalDocs = new Set([
  'docs/API_OBSERVABILITY_HEALTH_FOUNDATION.md',
  'docs/CHECKPOINT.md',
  'docs/DATABASE.md',
  'docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md',
  'docs/DEVELOPMENT.md',
  'docs/IDENTITY_AUTHORIZATION_FOUNDATION.md',
  'docs/SELF_HOSTED_RUNNER_RECOVERY.md',
  'docs/WORKER_QUEUE.md',
]);

function isTextCandidate(path) {
  return extensionlessTextFiles.has(path) || textExtensions.has(extname(path));
}

function isStrictFormattingTarget(path) {
  return (
    strictRootFiles.has(path) ||
    m01OperationalDocs.has(path) ||
    strictPrefixes.some((prefix) => path.startsWith(prefix))
  );
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

for (const path of trackedFiles) {
  if (!isTextCandidate(path)) continue;

  const content = readFileSync(path, 'utf8');

  if (isStrictFormattingTarget(path)) {
    check(!content.includes('\r'), `${path}: M01-owned text must use LF line endings.`);
    check(content.length === 0 || content.endsWith('\n'), `${path}: M01-owned text must end with a newline.`);
    check(!content.includes('\t'), `${path}: tabs are forbidden by the repository EditorConfig.`);

    if (extname(path) !== '.md') {
      const lines = content.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (/[ \t]+$/.test(lines[index] ?? '')) {
          failures.push(`${path}:${index + 1}: trailing whitespace is forbidden.`);
        }
      }
    }
  }

  if (extname(path) === '.json') {
    try {
      JSON.parse(content);
    } catch (error) {
      failures.push(`${path}: invalid JSON (${error instanceof Error ? error.message : String(error)}).`);
    }
  }

  if (strictPrefixes.some((prefix) => path.startsWith(prefix))) {
    check(!/@ts-(?:ignore|nocheck)\b/.test(content), `${path}: TypeScript suppression directives are forbidden in M01 source.`);
    check(!/\bdebugger\s*;/.test(content), `${path}: committed debugger statements are forbidden.`);
    check(!/\beval\s*\(/.test(content), `${path}: dynamic evaluation calls are forbidden.`);
    check(!/new\s+Function\s*\(/.test(content), `${path}: dynamic Function construction is forbidden.`);
    check(
      !/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/.test(content),
      `${path}: disabling TLS certificate validation is forbidden.`,
    );
  }
}

const editorConfig = readFileSync('.editorconfig', 'utf8');
check(editorConfig.includes('end_of_line = lf'), '.editorconfig must enforce LF line endings.');
check(editorConfig.includes('insert_final_newline = true'), '.editorconfig must enforce a final newline.');
check(editorConfig.includes('indent_style = space'), '.editorconfig must enforce space indentation.');
check(editorConfig.includes('indent_size = 2'), '.editorconfig must enforce two-space indentation.');
check(editorConfig.includes('trim_trailing_whitespace = true'), '.editorconfig must trim trailing whitespace by default.');

if (failures.length > 0) {
  console.error('Brovexa source hygiene gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Brovexa source hygiene gate passed for ${trackedFiles.length} tracked files; strict formatting is enforced on M01-owned runtime/operational surfaces.`,
);
