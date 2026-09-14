import { readFile } from 'node:fs/promises';

const eventName = process.env.GITHUB_EVENT_NAME;

if (eventName !== 'pull_request') {
  console.log('Brovexa PR agent lease verification skipped outside pull_request.');
  process.exit(0);
}

const eventPath = process.env.GITHUB_EVENT_PATH;
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!eventPath || !repository || !token) {
  throw new Error('PR agent lease verification requires GITHUB_EVENT_PATH, GITHUB_REPOSITORY, and GITHUB_TOKEN.');
}

const event = JSON.parse(await readFile(eventPath, 'utf8'));
const pullRequest = event.pull_request;

if (!pullRequest?.head?.ref || !pullRequest?.head?.sha || !pullRequest?.body) {
  throw new Error('PR agent lease verification requires pull_request head ref/SHA and a populated handoff body.');
}

const body = pullRequest.body;
const headBranch = pullRequest.head.ref;
const headSha = pullRequest.head.sha;

function metadata(label, { numeric = false } = {}) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

const taskId = metadata('Task/workstream ID');
const agentRole = metadata('Agent ID / role');
const agentId = agentRole.includes(' / ') ? agentRole.split(' / ')[0] : agentRole;
const slotId = metadata('Assigned slot ID');
const agentInstanceId = metadata('Agent instance ID');
const leaseId = metadata('Lease ID');
const leasePath = metadata('Lease lock path');
const declaredBranch = metadata('Branch');
const declaredHeadSha = metadata('Exact head SHA');
const syncedMainSha = metadata('Synced main SHA');
const syncEpoch = metadata('Sync epoch', { numeric: true });

if (!/^[A-Z0-9_-]+$/.test(slotId)) throw new Error(`Invalid assigned slot ID: ${slotId}.`);
if (!/^[0-9a-f]{40}$/.test(declaredHeadSha)) throw new Error('Exact head SHA must be a 40-character lowercase git SHA.');
if (!/^[0-9a-f]{40}$/.test(syncedMainSha)) throw new Error('Synced main SHA must be a 40-character lowercase git SHA.');
if (declaredHeadSha !== headSha) throw new Error(`PR handoff exact head ${declaredHeadSha} does not match current PR head ${headSha}.`);
if (declaredBranch !== headBranch) throw new Error(`PR handoff branch ${declaredBranch} does not match PR head branch ${headBranch}.`);

const expectedLeasePath = `.leases/${slotId}.json`;
if (leasePath !== expectedLeasePath) {
  throw new Error(`Lease lock path must be exactly ${expectedLeasePath}; received ${leasePath}.`);
}

function apiUrl(path) {
  return `https://api.github.com/repos/${repository}/${path}`;
}

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'brovexa-pr-agent-lease-verifier',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed (${response.status}) for ${url}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

const encodedLeasePath = leasePath.split('/').map(encodeURIComponent).join('/');
const leaseFile = await githubJson(`${apiUrl(`contents/${encodedLeasePath}`)}?ref=${encodeURIComponent('coordination/leases')}`);
if (leaseFile?.type !== 'file' || leaseFile?.encoding !== 'base64' || typeof leaseFile.content !== 'string') {
  throw new Error(`Canonical lease ${leasePath} is not a readable base64 file on coordination/leases.`);
}

let lease;
try {
  lease = JSON.parse(Buffer.from(leaseFile.content.replace(/\n/g, ''), 'base64').toString('utf8'));
} catch (error) {
  throw new Error(`Canonical lease ${leasePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const expected = {
  state: 'ACTIVE',
  branch: headBranch,
  slot_id: slotId,
  agent_id: agentId,
  agent_instance_id: agentInstanceId,
  work_packet_id: taskId,
  lease_id: leaseId,
  synced_main_sha: syncedMainSha,
  sync_epoch: syncEpoch,
};

for (const [key, value] of Object.entries(expected)) {
  if (lease?.[key] !== value) {
    throw new Error(`Lease ${leasePath} ${key} mismatch: expected ${JSON.stringify(value)}, received ${JSON.stringify(lease?.[key])}.`);
  }
}

if (!/^[0-9a-f]{40}$/.test(lease.acquired_branch_head_sha ?? '')) {
  throw new Error(`Lease ${leasePath} must contain a valid acquired_branch_head_sha.`);
}

if (lease.acquired_branch_head_sha !== headSha) {
  const comparison = await githubJson(apiUrl(`compare/${lease.acquired_branch_head_sha}...${headSha}`));
  if (!['ahead', 'identical'].includes(comparison?.status)) {
    throw new Error(`Current PR head ${headSha} is not a forward descendant of lease acquisition head ${lease.acquired_branch_head_sha}.`);
  }
  if (comparison?.merge_base_commit?.sha !== lease.acquired_branch_head_sha) {
    throw new Error('PR head history does not preserve the lease acquisition head as its merge base.');
  }
}

const liveRegistry = await githubJson(apiUrl('issues/53'));
const registryBody = liveRegistry?.body;
if (typeof registryBody !== 'string') throw new Error('Live agent slot registry issue #53 has no readable body.');

const slotRow = registryBody
  .split('\n')
  .find((line) => line.startsWith(`| \`${slotId}\` |`));
if (!slotRow) throw new Error(`Live slot registry issue #53 has no row for ${slotId}.`);

const cells = slotRow.split('|').slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, ''));
if (cells.length !== 7) throw new Error(`Live slot registry row ${slotId} must contain seven columns.`);
const [, registryBranch, status, assignedAgent, , registryMainSha, registryEpochText] = cells;
const registryEpoch = Number(registryEpochText);

if (registryBranch !== headBranch && slotId !== 'SUPERVISOR') {
  throw new Error(`Live slot registry branch ${registryBranch} does not match PR branch ${headBranch}.`);
}
if (status !== 'OCCUPIED') throw new Error(`Live slot ${slotId} must be OCCUPIED while submitting a PR.`);
if (assignedAgent !== agentId) throw new Error(`Live slot ${slotId} is assigned to ${assignedAgent}, not ${agentId}.`);
if (registryMainSha !== syncedMainSha || registryEpoch !== syncEpoch) {
  throw new Error(`Live slot ${slotId} synchronization state does not match PR handoff/lease.`);
}

console.log(`Brovexa PR agent lease verification passed for ${slotId}/${agentInstanceId} on ${headBranch}.`);
