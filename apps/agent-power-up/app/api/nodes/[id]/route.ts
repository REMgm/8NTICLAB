import {handle} from '@/lib/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request,context:{params:Promise<{id:string}>}){return handle(req,'node',(await context.params).id)}
