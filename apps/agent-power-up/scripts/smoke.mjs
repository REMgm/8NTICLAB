import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const data=await mkdtemp(join(tmpdir(),'apu-http-'));
const origin='http://127.0.0.1:3111';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3111'],{env:{...process.env,AGENT_POWER_UP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',s=>logs+=s);child.stderr.on('data',s=>logs+=s);
let cookie='';
async function call(path,body,options={}){
 const res=await fetch(origin+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{})});
 if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
 return {status:res.status,data:await res.json()};
}
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 const home=await fetch(origin);assert.equal(home.status,200);assert.match(await home.text(),/Start free/);
 const start=await call('/api/free-start',{});assert.equal(start.status,201,JSON.stringify(start.data));const businessId=start.data.data.businessId;
 const ingest=await call('/api/ingest',{details:{name:'Power Up QA Studio',category:'Design studio',services:['Brand design'],description:'Synthetic acceptance fixture; not a real business.'}});assert.equal(ingest.status,200);
 assert.equal((await call('/api/publish',{})).status,200);
 const schema=await call(`/api/nodes/${businessId}/openapi.json`);assert.equal(schema.data.openapi,'3.1.0');
 const key=(await call('/api/caller-key',{})).data.data.key;
 const unauthorized=await call(`/api/nodes/${businessId}/call`,{action:'find'});assert.equal(unauthorized.status,401);
 const found=await call(`/api/nodes/${businessId}/call`,{action:'find',input:{query:'Brand design'}},{headers:{authorization:`Bearer ${key}`}});assert.equal(found.status,200);assert.equal(found.data.data.result.business.name,'Power Up QA Studio');assert.ok(found.data.data.result.confirmation_id);
 const failure=await call('/api/call',{action:'find',input:{query:'a service that does not exist'}});assert.equal(failure.status,404);
 const workspace=(await call('/api/workspace')).data.data;
 const names=new Set(workspace.business.events.map(e=>e.name));for(const expected of ['signup_free','ingest_completed','node_ready','callable_succeeded','callable_failed'])assert.ok(names.has(expected),expected);
 assert.ok(workspace.powerUps.some(p=>p.id==='chatgpt'&&p.status==='queued'));
 assert.equal(workspace.business.ownerHash,undefined);
 const evidence={checkedAt:new Date().toISOString(),environment:'local production build — not deployed staging',result:'PASS',businessId,confirmationId:found.data.data.result.confirmation_id,checks:['home renders','free start','persisted details ingest','published node schema','unauthorized caller rejected','authenticated external FIND','failure reported honestly','five required server events','ChatGPT queued','private owner hash not exposed'],events:workspace.business.events.map(({name,timestamp,business_id,receipt_id,reason})=>({name,timestamp,business_id,receipt_id,reason}))};
 await mkdir('evidence',{recursive:true});await writeFile('evidence/local-acceptance.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}catch(e){console.error(logs);throw e}finally{child.kill('SIGTERM');await rm(data,{recursive:true,force:true});}
