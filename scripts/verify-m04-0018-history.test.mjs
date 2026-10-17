import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyM040018History,migrationSqlChecksum,
  M04_WEBSITE_MIGRATION_ID} from './m04-0018-provenance.mjs';

const localSql='CREATE TABLE website_inspection_runs (max_pages smallint NOT NULL);\n';
const alternateSql='CREATE TABLE website_inspection_runs (id text PRIMARY KEY);\n';
const applied=checksum=>[{id:M04_WEBSITE_MIGRATION_ID,checksum}];
const canonicalColumns=[
  ['max_pages','smallint'],['max_response_bytes','integer'],['timeout_ms','integer'],
  ['retention_ttl_seconds','bigint'],['deletion_required','boolean'],
].map(([column_name,data_type])=>({column_name,data_type,is_nullable:'NO'}));
const canonicalChecks=[
  {name:'website_runs_budget_check',type:'c',validated:true,
   definition:'CHECK (max_pages BETWEEN 1 AND 5 AND max_response_bytes BETWEEN 1 AND 1000000 AND timeout_ms BETWEEN 100 AND 30000)'},
  {name:'website_runs_retention_check',type:'c',validated:true,
   definition:'CHECK (retention_ttl_seconds BETWEEN 1 AND 31536000 AND deletion_required)'},
];
const completeSchema={
  tablePresent:true,
  columns:canonicalColumns,
  constraints:canonicalChecks,
};
const audit=(args={})=>classifyM040018History({
  localSql,journalPresent:true,journalRows:applied(migrationSqlChecksum(localSql)),
  ...completeSchema,...args,
});

test('QA-09 clean unapplied schema can use canonical 0018 only through approved workflow',()=>{
  const result=audit({tablePresent:false,columns:[],constraints:[],journalRows:[]});
  assert.equal(result.status,'CLEAN_UNAPPLIED');
  assert.equal(result.canUseCheckpointHistory,true);
  assert.equal(result.appliedChecksum,null);
});

test('QA-09 exact journal SHA256 plus bounded schema is canonical',()=>{
  const result=audit();
  assert.equal(result.status,'CANONICAL_APPLIED');
  assert.equal(result.canUseCheckpointHistory,true);
  assert.equal(result.appliedChecksum,migrationSqlChecksum(localSql));
});

test('QA-09 draft applied 0018 is divergent, never implicitly adopted',()=>{
  const result=audit({alternateSql,journalRows:applied(migrationSqlChecksum(alternateSql))});
  assert.equal(result.status,'KNOWN_DIVERGENT_APPLIED');
  assert.equal(result.canUseCheckpointHistory,false);
  assert.match(result.reason,/forward-only repair/);
});

test('QA-09 foreign or unknown 0018 SHA256 fails closed',()=>{
  const result=audit({journalRows:applied('f'.repeat(64))});
  assert.equal(result.status,'UNKNOWN_0018_APPLIED');
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 malformed applied journal hash is never mistaken for clean DB',()=>{
  const result=audit({journalRows:applied('invalid hash')});
  assert.equal(result.status,'INVALID_0018_JOURNAL');
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 canonical journal with missing budget/retention constraints blocks',()=>{
  const result=audit({constraints:[canonicalChecks[1]]});
  assert.equal(result.status,'CANONICAL_SCHEMA_DRIFT');
  assert.deepEqual(result.missingConstraints,['website_runs_budget_check']);
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 canonical journal with missing timeout column blocks',()=>{
  const result=audit({columns:canonicalColumns.filter(c=>c.column_name!=='timeout_ms')});
  assert.equal(result.status,'CANONICAL_SCHEMA_DRIFT');
  assert.deepEqual(result.missingColumns,['timeout_ms']);
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 unjournaled website runs table blocks',()=>{
  const result=audit({journalRows:[]});
  assert.equal(result.status,'UNJOURNALED_0018_SCHEMA');
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 missing journal blocks, even if bounded table seems valid',()=>{
  const result=audit({journalPresent:false});
  assert.equal(result.status,'NO_JOURNAL');
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 gap after applied 0019 blocks replay of 0018',()=>{
  const result=audit({journalRows:[{id:'0019_website_live_inspection_evidence',checksum:'a'.repeat(64)}],
    tablePresent:false,columns:[],constraints:[]});
  assert.equal(result.status,'NONCONTIGUOUS_HISTORY');
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 noncanonical duplicate prefix ID blocks, even with canonical 0018 applied',()=>{
  const result=audit({journalRows:[
    ...applied(migrationSqlChecksum(localSql)),
    {id:'0018_unexpected_other_name',checksum:'a'.repeat(64)},
  ]});
  assert.equal(result.status,'AMBIGUOUS_0018');
  assert.equal(result.canUseCheckpointHistory,false);
});

test('QA-09 SHA256 preserves exact SQL text and fails for empty migration',()=>{
  assert.notEqual(migrationSqlChecksum(localSql),migrationSqlChecksum(localSql.trimEnd()));
  assert.throws(()=>migrationSqlChecksum('  '),TypeError);
});

test('QA-09 wrong website max-pages SQL type fails closed',()=>{
  const columns=canonicalColumns.map(c=>c.column_name==='max_pages'?{...c,data_type:'text'}:c);
  const result=audit({columns});
  assert.equal(result.status,'CANONICAL_SCHEMA_DRIFT');
  assert.deepEqual(result.invalidColumns,['max_pages']);
});

test('QA-09 nullable retention TTL fails closed even with matching journal',()=>{
  const columns=canonicalColumns.map(c=>c.column_name==='retention_ttl_seconds'?
    {...c,is_nullable:'YES'}:c);
  const result=audit({columns});
  assert.equal(result.status,'CANONICAL_SCHEMA_DRIFT');
  assert.deepEqual(result.invalidColumns,['retention_ttl_seconds']);
});

test('QA-09 unvalidated or wrong CHECK expression is schema drift',()=>{
  const constraints=canonicalChecks.map(c=>c.name==='website_runs_budget_check'?
    {...c,validated:false,definition:'CHECK (max_pages > 0)'}:c);
  const result=audit({constraints});
  assert.equal(result.status,'CANONICAL_SCHEMA_DRIFT');
  assert.deepEqual(result.invalidConstraints,['website_runs_budget_check']);
});

test('QA-09 missing 0018 alongside later 0030 journal history is blocked',()=>{
  const result=audit({journalRows:[{id:'0030_future_migration',checksum:'b'.repeat(64)}],
    tablePresent:false,columns:[],constraints:[]});
  assert.equal(result.status,'NONCONTIGUOUS_HISTORY');
});
