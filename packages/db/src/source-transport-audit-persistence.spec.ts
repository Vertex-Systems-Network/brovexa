import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { buildSourceTransportAuditRecord, type SourceTransportAuditRecordInput } from './source-transport-audit-record';
import {
  getSourceTransportAuditRecord,
  persistSourceTransportAuditRecord,
  SourceTransportAuditPersistenceError,
} from './source-transport-audit-persistence';

function fixture(): SourceTransportAuditRecordInput {
  return {
    id: 'transport-audit-1',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    transportRequestId: 'transport-request-1',
    sourceRequestId: 'source-request-1',
    sourceTaskId: 'source-task-1',
    connectorKey: 'connector.company_sites',
    connectorVersion: '1.0.0',
    transportPolicyId: 'transport-policy.company-sites',
    transportPolicyVersion: '1.0.0',
    decision: 'allow',
    reasonCodes: [],
    warnings: [],
    canonicalUrl: 'https://example.com/business',
    hostname: 'example.com',
    port: 443,
    maxResponseBytes: 500_000,
    timeoutMs: 5_000,
    evaluatedAt: new Date('2026-09-03T00:00:10.000Z'),
  };
}

function rowFor(input: SourceTransportAuditRecordInput) {
  const record = buildSourceTransportAuditRecord(input);
  return {
    id: record.id,
    workspace_id: record.workspaceId,
    transport_request_id: record.transportRequestId,
    source_request_id: record.sourceRequestId,
    source_task_id: record.sourceTaskId,
    connector_key: record.connectorKey,
    connector_version: record.connectorVersion,
    transport_policy_id: record.transportPolicyId,
    transport_policy_version: record.transportPolicyVersion,
    decision: record.decision,
    reason_codes: [...record.reasonCodes],
    warnings: [...record.warnings],
    canonical_url: record.canonicalUrl,
    hostname: record.hostname,
    port: record.port,
    max_response_bytes: String(record.maxResponseBytes),
    timeout_ms: String(record.timeoutMs),
    evaluated_at: new Date(record.evaluatedAt.getTime()),
    envelope: { ...record.envelope },
    created_at: new Date('2026-09-03T00:00:11.000Z'),
  };
}

function taskIdentity(input: SourceTransportAuditRecordInput) {
  return {
    request_id: input.sourceRequestId,
    connector_key: input.connectorKey,
    connector_version: input.connectorVersion,
  };
}

function poolWith(query: ReturnType<typeof vi.fn>): Pool {
  return { query } as unknown as Pool;
}

describe('persistSourceTransportAuditRecord', () => {
  it('persists a normalized audit record bound to the source-task identity', async () => {
    const input = fixture();
    const row = rowFor(input);
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [taskIdentity(input)] })
      .mockResolvedValueOnce({ rows: [row] });

    const result = await persistSourceTransportAuditRecord(poolWith(query), input);

    expect(result.created).toBe(true);
    expect(result.record).toMatchObject({
      id: input.id,
      workspaceId: input.workspaceId,
      sourceTaskId: input.sourceTaskId,
      sourceRequestId: input.sourceRequestId,
      connectorKey: input.connectorKey,
      connectorVersion: input.connectorVersion,
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('treats an exact replay as idempotent', async () => {
    const input = fixture();
    const row = rowFor(input);
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [taskIdentity(input)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...row, same_record: true }] });

    const result = await persistSourceTransportAuditRecord(poolWith(query), input);

    expect(result.created).toBe(false);
    expect(result.record.id).toBe(input.id);
  });

  it('fails before insert when request or connector identity drifts from the source task', async () => {
    const input = fixture();
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ ...taskIdentity(input), request_id: 'source-request-other' }],
    });

    await expect(persistSourceTransportAuditRecord(poolWith(query), input)).rejects.toMatchObject({
      code: 'SOURCE_TRANSPORT_AUDIT_SOURCE_TASK_IDENTITY_MISMATCH',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects an audit ID replay with different durable content', async () => {
    const input = fixture();
    const row = rowFor(input);
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [taskIdentity(input)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...row, same_record: false }] });

    await expect(persistSourceTransportAuditRecord(poolWith(query), input)).rejects.toMatchObject({
      code: 'SOURCE_TRANSPORT_AUDIT_ID_CONFLICT',
    });
  });

  it('rejects invalid normalized input before touching persistence', async () => {
    const input = { ...fixture(), workspaceId: 'not-a-uuid' };
    const query = vi.fn();

    await expect(persistSourceTransportAuditRecord(poolWith(query), input)).rejects.toBeInstanceOf(
      SourceTransportAuditPersistenceError,
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe('getSourceTransportAuditRecord', () => {
  it('reads by workspace plus audit ID and returns a defensive record copy', async () => {
    const input = fixture();
    const row = rowFor(input);
    const query = vi.fn().mockResolvedValueOnce({ rows: [row] });

    const result = await getSourceTransportAuditRecord(poolWith(query), input.workspaceId, input.id);

    expect(result?.id).toBe(input.id);
    expect(result?.workspaceId).toBe(input.workspaceId);
    expect(Object.isFrozen(result?.envelope)).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE workspace_id = $1 AND id = $2'), [
      input.workspaceId,
      input.id,
    ]);
  });
});
