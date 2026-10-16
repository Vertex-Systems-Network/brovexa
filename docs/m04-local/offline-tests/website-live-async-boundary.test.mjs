// WEB-029 offline regression candidates: stage cancellation and no late resume.
import assert from 'node:assert/strict';
import test from 'node:test';
import { awaitM04LiveStage } from '../apps/worker/src/website-live-async-boundary.ts';

test('cancelled work never invokes an external stage', async()=>{
  const c=new AbortController();c.abort();let called=0;
  await assert.rejects(awaitM04LiveStage(()=>{called++;return 'bad';},{timeoutMs:200,signal:c.signal}),{code:'M04_LIVE_CANCELLED'});
  assert.equal(called,0);
});
test('external cancellation interrupts an uncooperative adapter', async()=>{
  const c=new AbortController();let done;
  const external=new Promise(resolve=>{done=resolve;});
  const work=awaitM04LiveStage(()=>external,{timeoutMs:200,signal:c.signal});
  c.abort();
  await assert.rejects(work,{code:'M04_LIVE_CANCELLED'});
  done('late');
});
test('uncooperative adapter cannot exceed stage timeout',async()=>{
  await assert.rejects(awaitM04LiveStage(()=>new Promise(()=>{}),{timeoutMs:10}),{code:'M04_LIVE_TIMEOUT'});
});
test('rejects excessive stage timeout',()=>{
  assert.throws(()=>awaitM04LiveStage(()=>false,{timeoutMs:30001}),RangeError);
});