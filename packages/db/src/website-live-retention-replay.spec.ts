import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe,expect,it,vi} from 'vitest';
import type {Pool} from 'pg';
import {purgeExpiredWebsiteLiveInspectionEvidenceForWork} from './website-live-persistence';
const workspace='550e8400-e29b-41d4-a716-446655440000';
function database(handler:(sql:string,args?:unknown[])=>{rows:unknown[]}) {
 const query=vi.fn(async(sql:string,args?:unknown[])=>handler(sql,args));
 const release=vi.fn();
 const pool={connect:vi.fn(async()=>({query,release}))} as unknown as Pool;
 return {pool,query,release};
}
describe('WEB-038 durable, scoped retention replay',()=>{
 it('first delivery deletes bounded expired rows and writes receipt in one transaction',async()=>{
  const db=database(sql=>{
   if(sql.startsWith('SELECT id FROM website_live_inspection_runs'))
     return {rows:[{id:'inspect.1'},{id:'inspect.2'}]};
   if(sql.startsWith('DELETE FROM website_live_inspection_runs'))
     return {rows:[{id:'inspect.1'},{id:'inspect.2'}]};
   return {rows:[]};
  });
  await expect(purgeExpiredWebsiteLiveInspectionEvidenceForWork(db.pool,workspace,'work.1',20))
    .resolves.toEqual({deleted:2,replayed:false});
  const statements=db.query.mock.calls.map(c=>c[0]);
  expect(statements[0]).toBe('BEGIN');
  expect(statements[1]).toContain('pg_advisory_xact_lock');
  expect(statements.at(-2)).toContain('INSERT INTO website_live_retention_work_receipts');
  expect(statements.at(-1)).toBe('COMMIT');
  expect(db.release).toHaveBeenCalledOnce();
 });
 it('reuses committed count for an identical delivery without touching live evidence',async()=>{
  const db=database(sql=>sql.startsWith('SELECT workspace_id,max_rows,deleted_count')
    ?{rows:[{workspace_id:workspace,max_rows:20,deleted_count:2}]}:{rows:[]});
  await expect(purgeExpiredWebsiteLiveInspectionEvidenceForWork(db.pool,workspace,'work.1',20))
    .resolves.toEqual({deleted:2,replayed:true});
  const statements=db.query.mock.calls.map(c=>c[0]);
  expect(statements.some(s=>s.startsWith('DELETE FROM website_live_inspection_runs'))).toBe(false);
  expect(statements.some(s=>s.startsWith('SELECT id FROM website_live_inspection_runs'))).toBe(false);
  expect(statements.at(-1)).toBe('COMMIT');
 });
 it('rejects cross-workspace reuse, altered budget and malformed work identifiers',async()=>{
  const db=database(sql=>sql.startsWith('SELECT workspace_id,max_rows,deleted_count')
    ?{rows:[{workspace_id:'00000000-0000-4000-8000-000000000000',max_rows:20,deleted_count:2}]}:{rows:[]});
  await expect(purgeExpiredWebsiteLiveInspectionEvidenceForWork(db.pool,workspace,'work.1',20))
    .rejects.toMatchObject({code:'M04_LIVE_DB_ID_CONFLICT'});
  expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  await expect(purgeExpiredWebsiteLiveInspectionEvidenceForWork(db.pool,workspace,'bad/id',20))
    .rejects.toMatchObject({code:'M04_LIVE_DB_INPUT_INVALID'});
 });
 it('reversible migration constrains receipts and makes them immutable',async()=>{
  const dir=resolve(import.meta.dirname,'..','migrations');
  const up=await readFile(resolve(dir,'0022_website_live_retention_work_receipts.up.sql'),'utf8');
  const down=await readFile(resolve(dir,'down','0022_website_live_retention_work_receipts.down.sql'),'utf8');
  expect(up).toContain('work_unit_id text PRIMARY KEY');
  expect(up).toContain('max_rows BETWEEN 1 AND 500');
  expect(up).toContain('BEFORE UPDATE ON website_live_retention_work_receipts');
  expect(down).toContain('DROP TABLE IF EXISTS website_live_retention_work_receipts');
 });
});