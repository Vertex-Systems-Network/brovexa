import { describe, expect, it } from 'vitest';
import { buildSourceTransportAuditRecord, SourceTransportAuditRecordError } from './source-transport-audit-record';

function fixture() {
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
    decision: 'allow' as const,
    reasonCodes: [] as string[],
    warnings: [] as string[],
    canonicalUrl: 'https://example.com/business',
    hostname: 'Example.COM',
    port: 443,
    maxResponseBytes: 500_000,
    timeoutMs: 5_000,
    evaluatedAt: new Date('2026-09-03T00:00:10.000Z'),
  };
}

function expectInvalid(run: () => unknown): void {
  expect(run).toThrow(SourceTransportAuditRecordError);
}

describe('buildSourceTransportAuditRecord', () => {
  it('produces a normalized deterministic envelope for durable persistence', () => {
    const record = buildSourceTransportAuditRecord(fixture());
    expect(record.hostname).toBe('example.com');
    expect(record.envelope).toEqual({
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
      evaluatedAt: '2026-09-03T00:00:10.000Z',
    });
    expect(Object.isFrozen(record.envelope)).toBe(true);
  });

  it('requires canonical URL evidence to be valid and bound to the hostname', () => {
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), canonicalUrl: 'not-a-url' }));
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), hostname: 'attacker.example' }));

    const trailingDot = buildSourceTransportAuditRecord({ ...fixture(), canonicalUrl: 'https://example.com./business', hostname: 'Example.COM.' });
    expect(trailingDot.hostname).toBe('example.com');
  });

  it('requires a blocked admission to retain at least one reason code', () => {
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), decision: 'blocked', reasonCodes: [] }));
  });

  it('rejects duplicate reason codes and warnings', () => {
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), reasonCodes: ['blocked.private', 'blocked.private'] }));
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), warnings: ['http.cleartext', 'http.cleartext'] }));
  });

  it('rejects invalid workspace, port, byte and timeout boundaries', () => {
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), workspaceId: 'workspace-1' }));
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), port: 0 }));
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), maxResponseBytes: 0 }));
    expectInvalid(() => buildSourceTransportAuditRecord({ ...fixture(), timeoutMs: 99 }));
  });

  it('copies mutable inputs into audit-owned structures', () => {
    const input = fixture();
    input.warnings.push('http.cleartext');
    const record = buildSourceTransportAuditRecord(input);
    input.warnings.push('later.mutation');
    input.evaluatedAt.setUTCFullYear(2030);

    expect(record.warnings).toEqual(['http.cleartext']);
    expect(record.evaluatedAt.toISOString()).toBe('2026-09-03T00:00:10.000Z');
  });
});
