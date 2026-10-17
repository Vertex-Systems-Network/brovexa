import {createHash} from 'node:crypto';

export const M04_WEBSITE_MIGRATION_ID='0018_website_inspection_evidence';
const requiredColumns=Object.freeze([
  'max_pages','max_response_bytes','timeout_ms',
  'retention_ttl_seconds','deletion_required',
]);
const requiredConstraints=Object.freeze(['website_runs_budget_check','website_runs_retention_check']);

export function migrationSqlChecksum(sql){
  if(typeof sql!=='string'||!sql.trim()) throw new TypeError('Migration SQL must be nonempty.');
  return createHash('sha256').update(sql).digest('hex');
}

/**
 * Read-only migration provenance classification. No journal rewriting, DDL,
 * backfilling, mutation, network access or implicit alternate-history adoption.
 * The applied SQL SHA256 is the immutable key recorded by migrations.ts.
 */
export function classifyM040018History({
  localSql,journalPresent,journalRows=[],tablePresent=false,
  columns=[],constraints=[],alternateSql=null,
}){
  const canonical=migrationSqlChecksum(localSql);
  const peer=alternateSql===null?null:migrationSqlChecksum(alternateSql);
  const rows=journalRows.filter(row=>row?.id===M04_WEBSITE_MIGRATION_ID);
  const other0018=journalRows.filter(row=>typeof row?.id==='string' &&
    row.id.startsWith('0018_') && row.id!==M04_WEBSITE_MIGRATION_ID);
  const later=journalRows.some(row=>typeof row?.id==='string' &&
    /^00(?:1[9]|2[0-9])_/.test(row.id));
  const missingColumns=requiredColumns.filter(name=>!columns.includes(name));
  const missingConstraints=requiredConstraints.filter(name=>!constraints.includes(name));
  const schemaComplete=tablePresent && missingColumns.length===0 && missingConstraints.length===0;
  const fail=(status,reason,appliedChecksum=null)=>({
    status,canUseCheckpointHistory:false,canonicalChecksum:canonical,
    appliedChecksum,reason,missingColumns,missingConstraints,
  });

  if(!journalPresent)
    return fail('NO_JOURNAL','Migration journal does not exist. No migration may be inferred from tables.');
  if(rows.length>1||other0018.length)
    return fail('AMBIGUOUS_0018','Migration 0018 history has duplicate or unexpected identifiers.');

  if(!rows.length){
    if(tablePresent) return fail('UNJOURNALED_0018_SCHEMA','0018 table exists without its journal entry.');
    if(later) return fail('NONCONTIGUOUS_HISTORY','Later migrations were applied without 0018.');
    return {status:'CLEAN_UNAPPLIED',canUseCheckpointHistory:true,
      canonicalChecksum:canonical,appliedChecksum:null,
      reason:'No 0018 journal/table exists; bounded canonical migration is eligible only through approved migration workflow.',
      missingColumns:[],missingConstraints:[]};
  }
  const appliedChecksum=rows[0].checksum;
  if(typeof appliedChecksum!=='string'||!(/^[a-f0-9]{64}$/).test(appliedChecksum))
    return fail('INVALID_0018_JOURNAL','Stored migration checksum is not a SHA256 hex digest.',appliedChecksum);
  if(appliedChecksum!==canonical){
    if(peer!==null && appliedChecksum===peer)
      return fail('KNOWN_DIVERGENT_APPLIED','Alternative 0018 SQL was applied. Preserve that checksum and plan an authorized forward-only repair in its own reconciled tree.',appliedChecksum);
    return fail('UNKNOWN_0018_APPLIED','Applied 0018 checksum differs from the local migration. Stop; obtain exact applied migration bytes and a reviewed reconciliation.',appliedChecksum);
  }
  if(!schemaComplete)
    return fail('CANONICAL_SCHEMA_DRIFT','Canonical 0018 journal is present but bounded live schema columns/constraints are missing.',appliedChecksum);
  return {status:'CANONICAL_APPLIED',canUseCheckpointHistory:true,
    canonicalChecksum:canonical,appliedChecksum,
    reason:'Applied 0018 checksum and bounded website_inspection_runs schema match this exact checkout.',
    missingColumns:[],missingConstraints:[]};
}
