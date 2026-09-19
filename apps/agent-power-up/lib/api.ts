import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createBusiness, getBusiness, listBusinesses, updateBusiness, storageMode } from './store';
import type { Business, Surface, ActionName } from './types';
import { ApiError, body, cookie, csrf, failure, hash, matches, ok, owner, requestOrigin, token } from './security';
import { fetchWebsite, parseWebsite } from './ingest';
import { event, execute, schema, workspace } from './node';
const surfaceSchema = z.object({ name: z.string().max(120), description: z.string().max(2000), category: z.string().max(100), website: z.string().max(2048).refine(value => { if (!value) return true; try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }, 'Website must be a public HTTP or HTTPS URL.'), phone: z.string().max(100), email: z.string().max(254), address: z.string().max(500), timezone: z.string().max(100), hours: z.string().max(1000), services: z.array(z.string().max(200)).max(50) }).partial();
function callInput(data: unknown) { const parsed = z.object({ action: z.enum(['get_business', 'find', 'request_quote', 'search_availability', 'create_booking']), input: z.record(z.string(), z.unknown()).optional().default({}) }).safeParse(data); if (!parsed.success)
    throw new ApiError('INVALID_CALL', 'Provide a supported action and an input object.'); return parsed.data; }
const empty: Surface = { name: '', description: '', category: '', website: '', phone: '', email: '', address: '', timezone: 'UTC', hours: '', services: [], source: 'none', confidence: 'low', importedAt: null };
const counts = new Map<string, {
    count: number;
    until: number;
}>();
function limit(key: string, max: number) { const now = Date.now(); if (counts.size > 10000)
    for (const [k, v] of counts)
        if (v.until < now)
            counts.delete(k); const record = counts.get(key); if (!record || record.until < now) {
    counts.set(key, { count: 1, until: now + 60000 });
    return;
} if (++record.count > max)
    throw new ApiError('RATE_LIMITED', 'Too many requests. Try again in one minute.', 429); }
export async function handle(req: Request, route: string, id?: string): Promise<Response> {
    try {
        const origin = requestOrigin(req);
        if (req.method !== 'GET' && !['external-call'].includes(route))
            csrf(req);
        limit(`${route}:${req.headers.get('x-forwarded-for') ?? 'local'}`, route === 'free-start' ? 10 : 120);
        if (route === 'health')
            return ok({ service: 'Agent Power Up', status: 'ready', storage: storageMode(), authentication: 'provisional owner session + bearer caller keys' });
        if (route === 'free-start') {
            try { const existing = await owner(req); return ok({businessId:existing.id,resumed:true}); } catch(error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }

            const key = token();
            const now = new Date().toISOString();
            const b: Business = { id: randomUUID(), createdAt: now, activationId: randomUUID(), sessionId: randomUUID(), activationTimezone: 'UTC', ownerHash: hash(key), callerHash: null, surface: { ...empty }, published: false, events: [], receipts: [], quotes: [], refresh: { nextDueAt: new Date(Date.now() + 365 * 86400000).toISOString(), lastCheckedAt: null, status: 'scheduled_stub' } };
            b.events = [event(b, 'signup_free')];
            await createBusiness(b);
            return ok({ businessId: b.id, recoveryKey: `${b.id}.${key}` }, 201, { 'Set-Cookie': cookie(b.id, key, req) });
        }
        if (route === 'restore') {
            limit(`restore:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10);
            const data = await body(req);
            const [businessId, key] = String(data.recoveryKey ?? '').split('.');
            if (!businessId || !key)
                throw new ApiError('INVALID_RECOVERY', 'The recovery key is invalid.', 401);
            const b = await getBusiness(businessId);
            if (!b || !key || !matches(key, b.ownerHash))
                throw new ApiError('INVALID_RECOVERY', 'The recovery key is invalid.', 401);
            return ok({ businessId: b.id }, 200, { 'Set-Cookie': cookie(b.id, key, req) });
        }
        if (route === 'cron') {
            const key = process.env.CRON_SECRET;
            if (!key || req.headers.get('authorization') !== `Bearer ${key}`)
                throw new ApiError('UNAUTHORIZED', 'Scheduler credentials required.', 401);
            const businesses = await listBusinesses();
            let due = 0;
            for (const b of businesses) {
                if (Date.parse(b.refresh.nextDueAt) <= Date.now()) {
                    due++;
                    await updateBusiness(b.id, current => ({ ...current, refresh: { ...current.refresh, status: 'due', lastCheckedAt: new Date().toISOString() } }));
                }
            }
            return ok({ checked: businesses.length, due, note: 'Placeholder marks due refreshes; no automatic claims that hours or services were refreshed.' });
        }
        if (['node', 'schema', 'external-call'].includes(route)) {
            const b = await getBusiness(id ?? '');
            if (!b?.published)
                throw new ApiError('NOT_FOUND', 'No published node exists at this address.', 404);
            if (route === 'node')
                return ok({ business_id: b.id, surface: b.surface, schema_url: `${origin}/api/nodes/${b.id}/openapi.json`, api_url: `${origin}/api/nodes/${b.id}/call` });
            if (route === 'schema')
                return Response.json(schema(b, origin), { headers: { 'Cache-Control': 'public, max-age=60' } });
            const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '');
            if (!bearer || !b.callerHash || !matches(bearer, b.callerHash))
                throw new ApiError('UNAUTHORIZED', 'A valid caller bearer key is required.', 401);
            limit(`call:${b.id}`, 30);
            const data = callInput(await body(req));
            return ok(await execute(b, data.action, data.input));
        }
        let b = await owner(req);
        if (route === 'workspace')
            return ok(workspace(b, origin));
        if (route === 'ingest') {
            const data = await body(req);
            let surface: Surface;
            if (data.url) {
                const fetched = await fetchWebsite(String(data.url));
                surface = parseWebsite(fetched.html, fetched.url, b.surface);
            }
            else if (data.details) {
                const parsed = surfaceSchema.safeParse(data.details);
                if (!parsed.success)
                    throw new ApiError('INVALID_SURFACE', 'Business fields exceed allowed limits.');
                surface = { ...b.surface, ...parsed.data, source: 'owner_paste', confidence: 'high', importedAt: new Date().toISOString() };
            }
            else
                throw new ApiError('INVALID_INGEST', 'Provide a website URL or business details.');
            if (!surface.name.trim())
                throw new ApiError('NAME_REQUIRED', 'Could not find a business name. Paste business details instead.');
            b = await updateBusiness(b.id, current => ({ ...current, surface, events: [...current.events, event(current, 'ingest_completed')] }));
            return ok(workspace(b, origin));
        }
        if (route === 'surface') {
            const data = await body(req);
            const parsed = surfaceSchema.safeParse(data.surface ?? data);
            if (!parsed.success)
                throw new ApiError('INVALID_SURFACE', 'Business fields exceed allowed limits.');
            if (parsed.data.name !== undefined && !parsed.data.name.trim())
                throw new ApiError('NAME_REQUIRED', 'Business name cannot be empty.');
            if (parsed.data.website && !/^https?:\/\//.test(parsed.data.website))
                throw new ApiError('INVALID_URL', 'Website must start with http:// or https://.');
            b = await updateBusiness(b.id, current => ({ ...current, surface: { ...current.surface, ...parsed.data } }));
            return ok(workspace(b, origin));
        }
        if (route === 'publish') {
            if (!b.surface.importedAt || !b.surface.name.trim())
                throw new ApiError('INGEST_REQUIRED', 'Connect a website or paste business details first.', 409);
            const contract = schema({ ...b, published: true }, origin);
            if (contract.openapi !== '3.1.0' || !Object.keys(contract.paths).length)
                throw new ApiError('SCHEMA_NOT_READY', 'The node contract could not be enabled.', 503);
            b = await updateBusiness(b.id, current => ({ ...current, published: true, events: current.published ? current.events : [...current.events, event(current, 'node_ready')] }));
            return ok(workspace(b, origin));
        }
        if (route === 'caller-key') {
            const key = token();
            await updateBusiness(b.id, current => ({ ...current, callerHash: hash(key) }));
            return ok({ key });
        }
        if (route === 'call') {
            const data = callInput(await body(req));
            limit(`call:${b.id}`, 30);
            return ok(await execute(b, data.action, data.input));
        }
        if (route === 'square-connect') {
            if (process.env.SQUARE_BUSINESS_ID !== b.id)
                throw new ApiError('SQUARE_TENANT_UNAUTHORIZED', 'The sandbox seller must be assigned to this business by the operator.', 403);
            if (!process.env.SQUARE_ACCESS_TOKEN)
                throw new ApiError('SQUARE_NOT_CONFIGURED', 'Square sandbox credentials are not configured.', 503);
            const data = await body(req);
            const parsed = z.object({ locationId: z.string().min(1).max(128), serviceVariationId: z.string().min(1).max(128), teamMemberId: z.string().min(1).max(128) }).safeParse(data);
            if (!parsed.success)
                throw new ApiError('INVALID_SQUARE', 'Provide sandbox location, service variation and team member IDs.');
            await updateBusiness(b.id, current => ({ ...current, square: { ...parsed.data, verified: false } }));
            return ok({ configured: true, environment: 'sandbox', verified: false });
        }
        throw new ApiError('NOT_FOUND', 'Endpoint not found.', 404);
    }
    catch (error) {
        return failure(error);
    }
}
