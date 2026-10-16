import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { getWebsiteLiveGrant, persistWebsiteLiveGrant } from './website-live-grant-persistence';
import { persistWebsiteLiveInspectionResult } from './website-live-persistence';

const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
const inspectionId = 'inspect.1';
const registryStates = ["cd.status='approved'", "cd.activation='enabled'",
  "cd.credential_mode='none'", "cp.state IN ('APPROVED','APPROVED_WITH_LIMITS')",
  'cp.reviewed_at<=clock_timestamp()', 'cp.next_review_at>clock_timestamp()'];

describe('M04 WEB-043/044 current connector registry revocation', () => {
  it('requires active connector, credential-free fetch and an unexpired policy on every trusted grant read', async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({ rows: [] }));
    const pool = { query } as unknown as Pool;
    await expect(getWebsiteLiveGrant(pool, { workspaceId, inspectionId })).resolves.toBeNull();
    const sql = query.mock.calls[0]?.[0] ?? '';
    for (const invariant of registryStates) expect(sql).toContain(invariant);
    expect(sql).toContain('cd.id=s.connector_definition_id');
    expect(sql).toContain('cp.id=s.connector_policy_db_id');
    expect(query.mock.calls[0]?.[1]).toEqual([workspaceId, inspectionId]);
  });

  it('requires locked current registry rows even when an identical grant is replayed', async () => {
    const src = await readFile(resolve(import.meta.dirname, 'website-live-grant-persistence.ts'), 'utf8');
    const replay = src.slice(src.indexOf('const active=await client.query'), src.indexOf('if(!active.rows[0])'));
    for (const invariant of registryStates) expect(replay).toContain(invariant);
    expect(replay).toContain('FOR SHARE OF g,w,wm,u,wmr,wr,d,s,cd,cp');
  });

  it('requires locked current connector rows even when old evidence is replayed', async () => {
    const src = await readFile(resolve(import.meta.dirname, 'website-live-persistence.ts'), 'utf8');
    const replay = src.slice(src.indexOf('async function assertActiveLiveGrantOnReplay'), src.indexOf('/** Atomic parent+receipt'));
    for (const invariant of registryStates) expect(replay).toContain(invariant);
    expect(replay).toContain('FOR SHARE OF g,w,wm,u,wmr,wr,d,s,cd,cp');
  });

  it('pins forward and down migrations to both deferred COMMIT-time registry checks', async () => {
    const dir = resolve(import.meta.dirname, '..', 'migrations');
    const up = await readFile(resolve(dir,'0024_website_live_registry_revocation_guard.up.sql'),'utf8');
    const down = await readFile(resolve(dir,'down','0024_website_live_registry_revocation_guard.down.sql'),'utf8');
    expect(up).toContain('AFTER INSERT ON website_live_inspection_grants');
    expect(up).toContain('AFTER INSERT ON website_live_inspection_runs');
    expect(up).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(up).toContain('FOR SHARE OF s,cd,cp');
    for (const invariant of registryStates) expect(up).toContain(invariant);
    expect(down).toContain('DROP TRIGGER IF EXISTS website_live_evidence_registry_guard');
    expect(down).toContain('DROP TRIGGER IF EXISTS website_live_grant_registry_guard');
  });
});