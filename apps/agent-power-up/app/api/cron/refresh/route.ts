import {handle} from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>handle(req,'cron');
