import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

describe('M04 WEB-040 live grant COMMIT authorization',()=>{
 it('installs a deferred constraint trigger and irreversible owner/source checks',async()=>{
  const base=resolve(process.cwd(), 'migrations');
  const up=await readFile(resolve(base,'0023_website_live_grant_commit_guard.up.sql'),'utf8');
  const down=await readFile(resolve(base,'down','0023_website_live_grant_commit_guard.down.sql'),'utf8');
  expect(up).toContain('DEFERRABLE INITIALLY DEFERRED');
  expect(up).toContain('AFTER INSERT ON website_live_inspection_grants');
  expect(up).toContain('FOR SHARE OF g,w,wm,u,wmr,wr,d,s');
  expect(up).toContain("wr.kind='owner'");
  expect(up).toContain("s.decision='allow'");
  expect(up).toContain("d.decision='verified'");
  expect(up).toContain('g.expires_at>clock_timestamp()');
  expect(up).toContain('website_live_grant_commit_guard');
  expect(down).toContain('DROP TRIGGER IF EXISTS website_live_grant_commit_guard');
  expect(down).toContain('DROP FUNCTION IF EXISTS brovexa_internal.guard_website_live_grant_at_commit');
 });
});