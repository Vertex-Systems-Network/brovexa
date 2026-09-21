import { describe, expect, it } from 'vitest';
import * as publicDb from './index';

describe('@brovexa/db public security surface', () => {
  it('does not expose the first-owner provisioning primitive', () => {
    expect(Object.prototype.hasOwnProperty.call(publicDb, 'bootstrapWorkspaceOwner')).toBe(false);
  });

  it('keeps ordinary workspace authorization operations public', () => {
    expect(typeof publicDb.resolveWorkspaceAuthorization).toBe('function');
    expect(typeof publicDb.assertWorkspaceCapability).toBe('function');
  });
});
