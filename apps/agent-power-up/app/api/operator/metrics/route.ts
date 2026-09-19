import {listBusinesses} from '@/lib/store';
import {hash,matches,ok,failure,ApiError} from '@/lib/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const expected=process.env.OPERATOR_API_KEY;
 const supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(!expected||!matches(supplied,hash(expected)))throw new ApiError('UNAUTHORIZED','Operator authorization required.',401);
 const businesses=await listBusinesses();
 const date=(timestamp:string,zone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
 const reasons:Record<string,number>={};const actions:Record<string,number>={};const environments:Record<string,number>={};const times:number[]=[];
 let converted=0,ingested=0;
 for(const b of businesses){
  const events=b.events;
  if(events.some(e=>e.name==='ingest_completed'))ingested++;
  const successes=events.filter(e=>e.name==='callable_succeeded').sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  if(successes.some(e=>date(e.timestamp,b.activationTimezone)===date(b.createdAt,b.activationTimezone)))converted++;
  if(successes.length)times.push(Date.parse(successes[0].timestamp)-Date.parse(b.createdAt));
  for(const action of new Set(successes.map(e=>e.action||'unknown')))actions[action]=(actions[action]||0)+1;
  for(const env of new Set(successes.map(e=>e.environment)))environments[env]=(environments[env]||0)+1;
  for(const e of events.filter(e=>e.name==='callable_failed'))reasons[e.reason||'UNKNOWN']=(reasons[e.reason||'UNKNOWN']||0)+1;
 }
 times.sort((a,b)=>a-b);
 return ok({free_starts:businesses.length,same_day_callable_activations:converted,same_day_callable_rate:businesses.length?converted/businesses.length:null,ingest_completion_rate:businesses.length?ingested/businesses.length:null,median_time_to_callable_ms:times.length?(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2:null,successful_activations_by_action:actions,successful_activations_by_environment:environments,failure_reasons:reasons,definition:'One persisted free workspace = one activation; same calendar date in frozen activation timezone (UTC by default). Action/environment breakdowns can overlap. No customer data in this response.'});
 }catch(error){return failure(error)}}
