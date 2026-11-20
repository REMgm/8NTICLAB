import {get,put,list,BlobPreconditionFailedError} from '@vercel/blob';
import {mkdir,readFile,writeFile,rename,readdir,open,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Business} from './types';

const prefix='agent-power-up/v1/businesses/';
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function storageMode():'local'|'vercel-blob' {return process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID?'vercel-blob':'local'}
function check(){if(process.env.VERCEL&&storageMode()==='local')throw new Error('A private Vercel Blob store must be connected before starting a workspace.');}
function dataDir(){return process.env.AGENT_POWER_UP_DATA_DIR||join(process.cwd(),'.data')}
function filename(id:string){if(!idPattern.test(id))throw new Error('Invalid business identifier');return `${prefix}${id}.json`}
async function load(id:string):Promise<{business:Business;etag:string}|null>{
 check(); if(!idPattern.test(id))return null;
 if(storageMode()==='vercel-blob'){
  const result=await get(filename(id),{access:'private',useCache:false});
  if(!result)return null;
  if(!result.stream)throw new Error('Storage returned an empty stream');
  return {business:JSON.parse(await new Response(result.stream).text()) as Business,etag:result.blob.etag};
 }
 try{return {business:JSON.parse(await readFile(join(dataDir(),`${id}.json`),'utf8')),etag:''}}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}
}
export async function getBusiness(id:string):Promise<Business|null>{return (await load(id))?.business??null}
export async function createBusiness(b:Business):Promise<void>{
 check();filename(b.id);
 if(storageMode()==='vercel-blob'){await put(filename(b.id),JSON.stringify(b),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});return;}
 await mkdir(dataDir(),{recursive:true,mode:0o700});await writeFile(join(dataDir(),`${b.id}.json`),JSON.stringify(b),{flag:'wx',mode:0o600});
}
async function localLock<T>(id:string,fn:()=>Promise<T>):Promise<T>{
 await mkdir(dataDir(),{recursive:true,mode:0o700});const lock=join(dataDir(),`${id}.lock`);let acquired=false;
 for(let i=0;i<100;i++){try{const f=await open(lock,'wx',0o600);await f.close();acquired=true;break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,20));}}
 if(!acquired)throw new Error('Storage is busy. Please retry.');
 try{return await fn()}finally{await unlink(lock)}
}
export async function updateBusiness(id:string,mutate:(b:Business)=>Business):Promise<Business>{
 check();filename(id);
 if(storageMode()==='local')return localLock(id,async()=>{const current=await load(id);if(!current)throw new Error('Business not found');const next=mutate(current.business);if(next.id!==id)throw new Error('Business identity cannot change');const temporary=join(dataDir(),`${id}.${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(next),{mode:0o600});await rename(temporary,join(dataDir(),`${id}.json`));return next;});
 for(let attempt=0;attempt<6;attempt++){
  const current=await load(id);if(!current)throw new Error('Business not found');const next=mutate(current.business);if(next.id!==id)throw new Error('Business identity cannot change');
  try{await put(filename(id),JSON.stringify(next),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:current.etag,contentType:'application/json'});return next;}catch(e){if(!(e instanceof BlobPreconditionFailedError)||attempt===5)throw e;}
 }
 throw new Error('Storage conflict. Please retry.');
}
export async function listBusinesses():Promise<Business[]>{
 check();const records:Business[]=[];
 if(storageMode()==='local'){await mkdir(dataDir(),{recursive:true,mode:0o700});for(const file of await readdir(/* turbopackIgnore: true */ dataDir())){if(file.endsWith('.json')){const b=await getBusiness(file.slice(0,-5));if(b)records.push(b)}}return records;}
 let cursor:string|undefined;
 do{const page=await list({prefix,cursor,limit:1000});for(const blob of page.blobs){const id=blob.pathname.slice(prefix.length,-5);const b=await getBusiness(id);if(b)records.push(b)}cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 return records;
}
