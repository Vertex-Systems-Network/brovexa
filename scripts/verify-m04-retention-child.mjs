#!/usr/bin/env node
/**
 * WEB-055: intentionally separate Node process for the native PostgreSQL
 * retention crash-after-COMMIT fixture. May run only against guarded,
 * disposable localhost *_test databases; never runs acquisition/network.
 */
import {createPgPool,purgeExpiredWebsiteLiveInspectionEvidenceForWork} from '../packages/db/dist/index.js';
import {validateM04QaEnvironment} from './verify-m04-qa-guard.mjs';

const guard=validateM04QaEnvironment({
  nodeVersion:process.version,
  pnpmVersion:process.env.BROVEXA_M04_QA_PNPM_VERSION,
  databaseUrl:process.env.DATABASE_URL,
  isolated:process.env.BROVEXA_M04_QA_ISOLATED,
  resetOptIn:process.env.BROVEXA_DB_TEST_ALLOW_RESET,
});
if(!guard.allowed) throw new Error('M04 child QA preflight denied: '+guard.errors.join('; '));
const [workspace,workId,budgetText,mode='return-ack']=process.argv.slice(2);
const budget=Number(budgetText);
if(!/^[0-9a-f-]{36}$/i.test(workspace??'') ||
   !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(workId??'') ||
   !Number.isInteger(budget) || budget<1 || budget>500 ||
   !['return-ack','drop-ack'].includes(mode)) {
  throw new Error('M04 retention child accepts scoped test work only.');
}
const pool=createPgPool({connectionString:process.env.DATABASE_URL,max:1});
try {
  const result=await purgeExpiredWebsiteLiveInspectionEvidenceForWork(pool,workspace,workId,budget);
  // This process intentionally dies after the atomic PostgreSQL COMMIT but
  // before returning its acknowledgement. The parent verifies the persisted
  // delete count, then delivers the same work-ID in an entirely new process.
  if(mode==='drop-ack') process.exit(37);
  process.stdout.write(JSON.stringify(result)+'\n');
} finally {
  await pool.end();
}
