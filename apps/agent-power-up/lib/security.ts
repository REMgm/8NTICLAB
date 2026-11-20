import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getBusiness } from './store';
export class ApiError extends Error {
    constructor(public code: string, message: string, public status = 400) { super(message); }
}
export const token = () => randomBytes(32).toString('hex');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function matches(value: string, expected: string) { const actual = hash(value); return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
export async function owner(req: Request) { const raw = req.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('apu_owner='))?.slice(10); const [id, key] = raw?.split('.') ?? []; if (!id || !key)
    throw new ApiError('UNAUTHORIZED', 'Start free or restore your workspace.', 401); const business = await getBusiness(id); if (!business || !matches(key, business.ownerHash))
    throw new ApiError('UNAUTHORIZED', 'Your workspace session has expired.', 401); return business; }
export function requestOrigin(req: Request): string {
    const parsed = new URL(req.url);
    const host = req.headers.get('host') || parsed.host;
    const protocol = process.env.VERCEL ? 'https:' : parsed.protocol;
    const result = new URL(`${protocol}//${host}`);
    if (result.host.toLowerCase() !== host.toLowerCase() || result.username || result.password) throw new ApiError('INVALID_HOST', 'Invalid request host.', 400);
    return result.origin;
}
export function csrf(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin || origin !== requestOrigin(req)) throw new ApiError('ORIGIN_REJECTED', 'Use this workspace to make changes.', 403);
}
export async function body(req: Request) { if (Number(req.headers.get('content-length') ?? 0) > 20000)
    throw new ApiError('TOO_LARGE', 'Request exceeds 20 KB.', 413); const reader = req.body?.getReader(); if (!reader)
    return {}; let text = ''; let size = 0; const decoder = new TextDecoder(); while (true) {
    const { done, value } = await reader.read();
    if (done)
        break;
    size += value.byteLength;
    if (size > 20000) {
        await reader.cancel();
        throw new ApiError('TOO_LARGE', 'Request exceeds 20 KB.', 413);
    }
    text += decoder.decode(value, { stream: true });
} try {
    const parsed = JSON.parse(text || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('object required');
    return parsed;
}
catch {
    throw new ApiError('INVALID_JSON', 'Use a valid JSON request.');
} }
export const ok = (data: unknown, status = 200, headers?: HeadersInit) => Response.json({ ok: true, data }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export function failure(error: unknown) { if (error instanceof ApiError)
    return Response.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status, headers: { 'Cache-Control': 'no-store' } }); console.error('API failure', error); return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'The service could not complete this request. Please retry.' } }, { status: 500 }); }
export const cookie = (id: string, key: string, req: Request) => `apu_owner=${id}.${key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${requestOrigin(req).startsWith('https:') ? '; Secure' : ''}`;
