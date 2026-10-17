import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const migration=name=>read('packages/db/migrations/'+name+'.up.sql');

test('M04 canonical 0018 retains bounded fixture budgets required by persistence',()=>{
 const up=migration('0018_website_inspection_evidence');
 const down=read('packages/db/migrations/down/0018_website_inspection_evidence.down.sql');
 const db=read('packages/db/src/website-inspection-persistence.ts');
 for(const [name,type] of [['max_pages','smallint'],['max_response_bytes','integer'],['timeout_ms','integer']]){
  assert.match(up,new RegExp('\\b'+name+'\\s+'+type+'\\s+NOT NULL\\b'),'Missing 0018 '+name);
 }
 assert.match(up,/CONSTRAINT website_runs_budget_check CHECK\s*\(/);
 assert.match(db,/INSERT INTO website_inspection_runs \([^)]*max_pages,max_response_bytes,timeout_ms/s);
 assert.match(db,/r\.limits\.maxPages,\s*r\.limits\.maxResponseBytes,\s*r\.limits\.timeoutMs/);
 assert.match(down,/DROP TABLE IF EXISTS website_inspection_runs/);
});

test('v2 live evidence stays independent from test-only migration 0018',()=>{
 const fixture=migration('0018_website_inspection_evidence');
 const live=migration('0019_website_live_inspection_evidence');
 const grant=migration('0020_website_live_authorization_grants');
 const commit=migration('0021_website_live_commit_authorization_guard');
 const registry=migration('0024_website_live_registry_revocation_guard');
 const domain=migration('0025_website_live_current_domain_decision_guard');
 const connector=migration('0026_website_live_current_connector_revision_guard');
 const connectorDown=read('packages/db/migrations/down/0026_website_live_current_connector_revision_guard.down.sql');
 const domainDown=read('packages/db/migrations/down/0025_website_live_current_domain_decision_guard.down.sql');
 assert.match(fixture,/network_requested boolean NOT NULL DEFAULT false/);
 assert.match(live,/CREATE TABLE website_live_inspection_runs/);
 assert.match(live,/network_requested boolean NOT NULL DEFAULT true/);
 assert.match(grant,/REFERENCES source_admission_snapshots\(id,workspace_id\)/);
 assert.match(commit,/CREATE CONSTRAINT TRIGGER website_live_evidence_active_grant_guard/);
 assert.match(registry,/CREATE CONSTRAINT TRIGGER website_live_grant_registry_guard/);
 assert.match(domain,/CREATE TRIGGER website_live_domain_decision_insert_lock/);
 assert.match(domain,/CREATE CONSTRAINT TRIGGER website_live_grant_current_domain_guard/);
 assert.match(domain,/CREATE CONSTRAINT TRIGGER website_live_evidence_current_domain_guard/);
 assert.match(domain,/pg_advisory_xact_lock/);
 assert.match(domain,/ORDER BY d.evaluated_at DESC, d.created_at DESC, d.id DESC/);
 assert.match(domainDown,/DROP TRIGGER IF EXISTS website_live_domain_decision_insert_lock/);
 assert.match(connector,/CREATE TRIGGER website_live_connector_revision_insert_lock/);
 assert.match(connector,/CREATE CONSTRAINT TRIGGER website_live_grant_current_connector_revision_guard/);
 assert.match(connector,/CREATE CONSTRAINT TRIGGER website_live_evidence_current_connector_revision_guard/);
 assert.match(connector,/pg_advisory_xact_lock/);
 assert.match(connector,/ORDER BY cd.created_at DESC,cd.version DESC,cd.id DESC/);
 assert.match(connectorDown,/DROP TRIGGER IF EXISTS website_live_connector_revision_insert_lock/);
});

test('M04 migration ownership is serialized with unique 0018-0026 reservations',()=>{
 const names=readdirSync(resolve(root,'packages/db/migrations'))
  .filter(f=>/^\d{4}_.+\.up\.sql$/.test(f));
 for(const n of [18,19,20,21,22,23,24,25,26]){
  const prefix=String(n).padStart(4,'0')+'_';
  assert.equal(names.filter(f=>f.startsWith(prefix)).length,1,'Expected exactly one migration '+prefix);
 }
 const ledger=read('.agent/migrations.yaml');
 assert.match(ledger,/next_unreserved_number: "0027"/);
 for(let n=18;n<=26;n++){
  const id=String(n).padStart(4,'0');
  assert.equal((ledger.match(new RegExp('^  - number: "'+id+'"\\s*$','gm'))??[]).length,1,
   'Expected exactly one reserved migration '+id);
 }
});
