export const REQUIRED_PR_HANDOFF_LABELS = Object.freeze([
  'Task/workstream ID',
  'Agent ID / role',
  'Agent instance ID',
  'Assigned slot ID',
  'Lease ID',
  'Lease lock path',
  'Branch',
  'Exact head SHA',
  'Synced main SHA',
  'Sync epoch',
]);

function metadata(body, label, { numeric = false } = {}) {
  const escaped = label.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`^- ${escaped}:\\s*(?:\\x60([^\\x60]+)\\x60|([^\\n]+))$`, 'm'));
  if (!match) throw new Error(`PR handoff missing required metadata: ${label}.`);
  const value = (match[1] ?? match[2]).trim();
  if (numeric) {
    const parsed = Number(value.replace(/[^0-9-]/g, ''));
    if (!Number.isSafeInteger(parsed)) throw new Error(`PR handoff ${label} must be a safe integer.`);
    return parsed;
  }
  return value;
}

export function parsePrHandoffBody(body) {
  if (typeof body !== 'string' || body.length === 0) throw new Error('PR handoff body must be a non-empty string.');
  const taskId = metadata(body, 'Task/workstream ID');
  const agentRole = metadata(body, 'Agent ID / role');
  const agentId = agentRole.includes(' / ') ? agentRole.split(' / ')[0] : agentRole;
  const slotId = metadata(body, 'Assigned slot ID');
  const agentInstanceId = metadata(body, 'Agent instance ID');
  const leaseId = metadata(body, 'Lease ID');
  const leasePath = metadata(body, 'Lease lock path');
  const declaredBranch = metadata(body, 'Branch');
  const declaredHeadSha = metadata(body, 'Exact head SHA');
  const syncedMainSha = metadata(body, 'Synced main SHA');
  const syncEpoch = metadata(body, 'Sync epoch', { numeric: true });
  if (!/^[A-Z0-9_-]+$/.test(slotId)) throw new Error(`Invalid assigned slot ID: ${slotId}.`);
  if (!/^[0-9a-f]{40}$/.test(declaredHeadSha)) throw new Error('Exact head SHA must be a 40-character lowercase git SHA.');
  if (!/^[0-9a-f]{40}$/.test(syncedMainSha)) throw new Error('Synced main SHA must be a 40-character lowercase git SHA.');
  if (syncEpoch < 1) throw new Error('Sync epoch must be a positive integer.');
  const expectedLeasePath = `.leases/${slotId}.json`;
  if (leasePath !== expectedLeasePath) throw new Error(`Lease lock path must be exactly ${expectedLeasePath}; received ${leasePath}.`);
  return { taskId, agentRole, agentId, slotId, agentInstanceId, leaseId, leasePath, declaredBranch, declaredHeadSha, syncedMainSha, syncEpoch };
}

export function assertPrHandoffExpected(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (value === undefined) continue;
    if (actual[key] !== value) throw new Error(`PR handoff ${key} mismatch: expected ${JSON.stringify(value)}, received ${JSON.stringify(actual[key])}.`);
  }
}
