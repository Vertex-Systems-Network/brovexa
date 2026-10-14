import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePrHandoffPreflight } from './verify-pr-handoff-preflight.mjs';

const HEAD_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const metadata = [
  '- Task/workstream ID: SUP-GITHUB-NO-CLI-001',
  '- Agent ID / role: SUPERVISOR / integration_architecture',
  '- Agent instance ID: instance-20261015-unique',
  '- Assigned slot ID: SUPERVISOR',
  '- Lease ID: lease-20261015-unique',
  '- Lease lock path: .leases/SUPERVISOR.json',
  '- Branch: supervisor/integration-control',
  `- Exact head SHA: ${HEAD_SHA}`,
  `- Synced main SHA: ${BASE_SHA}`,
  '- Sync epoch: 87',
].join('\n');

const expected = {
  taskId: 'SUP-GITHUB-NO-CLI-001',
  agentRole: 'SUPERVISOR / integration_architecture',
  slotId: 'SUPERVISOR',
  agentInstanceId: 'instance-20261015-unique',
  leaseId: 'lease-20261015-unique',
  leasePath: '.leases/SUPERVISOR.json',
  declaredBranch: 'supervisor/integration-control',
  declaredHeadSha: HEAD_SHA,
  syncedMainSha: BASE_SHA,
  syncEpoch: 87,
};

test('accepts a current complete PR handoff', () => {
  const actual = validatePrHandoffPreflight(metadata, expected);
  assert.equal(actual.agentId, 'SUPERVISOR');
  assert.equal(actual.declaredHeadSha, HEAD_SHA);
});

test('rejects stale exact-head metadata after a commit', () => {
  assert.throws(() => validatePrHandoffPreflight(metadata, {
    ...expected,
    declaredHeadSha: 'c'.repeat(40),
  }), /declaredHeadSha mismatch/);
});

test('rejects an instance or lease takeover', () => {
  assert.throws(() => validatePrHandoffPreflight(metadata, {
    ...expected,
    agentInstanceId: 'different-instance',
  }), /agentInstanceId mismatch/);
  assert.throws(() => validatePrHandoffPreflight(metadata, {
    ...expected,
    leaseId: 'different-lease',
  }), /leaseId mismatch/);
});

test('rejects a mismatched declared lock path', () => {
  const invalid = metadata.replace('.leases/SUPERVISOR.json', '.leases/VERIFY.json');
  assert.throws(() => validatePrHandoffPreflight(invalid, expected), /Lease lock path must be exactly/);
});

test('rejects missing required metadata', () => {
  const invalid = metadata.replace('- Sync epoch: 87', '');
  assert.throws(() => validatePrHandoffPreflight(invalid, expected), /missing required metadata: Sync epoch/);
});

test('rejects a changed synchronization epoch', () => {
  assert.throws(() => validatePrHandoffPreflight(metadata, { ...expected, syncEpoch: 88 }), /syncEpoch mismatch/);
});
