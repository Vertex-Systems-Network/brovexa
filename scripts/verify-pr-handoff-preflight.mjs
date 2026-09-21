import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPrHandoffExpected, parsePrHandoffBody } from './pr-handoff-contract.mjs';

export function validatePrHandoffPreflight(body, expected) {
  const actual = parsePrHandoffBody(body);
  assertPrHandoffExpected(actual, expected);
  return actual;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required argument ${name}.`);
  return process.argv[index + 1];
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  const body = await readFile(resolve(argument('--body-file')), 'utf8');
  const slotId = argument('--slot-id');
  const syncEpoch = Number(argument('--sync-epoch'));
  if (!Number.isSafeInteger(syncEpoch)) throw new Error('--sync-epoch must be an integer.');
  validatePrHandoffPreflight(body, {
    taskId: argument('--task-id'),
    agentRole: argument('--agent-role'),
    slotId,
    agentInstanceId: argument('--agent-instance-id'),
    leaseId: argument('--lease-id'),
    leasePath: `.leases/${slotId}.json`,
    declaredBranch: argument('--branch'),
    declaredHeadSha: argument('--head-sha'),
    syncedMainSha: argument('--synced-main-sha'),
    syncEpoch,
  });
  console.log('Brovexa PR handoff preflight passed.');
}
