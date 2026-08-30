import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { workspacePreferences, workspaceStatusValues, workspaces } from './schema';

describe('database schema contract', () => {
  it('keeps stable tenant-root table names', () => {
    expect(getTableName(workspaces)).toBe('workspaces');
    expect(getTableName(workspacePreferences)).toBe('workspace_preferences');
  });

  it('keeps the reviewed workspace lifecycle states', () => {
    expect(workspaceStatusValues).toEqual(['active', 'suspended', 'archived']);
  });
});
