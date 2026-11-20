import {handle} from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>handle(req,'ingest');
