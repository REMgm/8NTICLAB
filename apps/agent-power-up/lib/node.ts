import { createSquareBooking } from './square-booking';
import { randomUUID } from 'node:crypto';
import type { ActionName, Business, EventName, MetricEvent, PowerUp, Receipt, Workspace } from './types';
import { updateBusiness, storageMode } from './store';
import { ApiError } from './security';
export function event(b: Business, name: EventName, extra: Partial<MetricEvent> = {}): MetricEvent { return { id: randomUUID(), name, timestamp: new Date().toISOString(), business_id: b.id, activation_id: b.activationId, session_id: b.sessionId, environment: 'production', ...extra }; }
export function powerUps(b: Business): PowerUp[] { return [{ id: 'find', name: 'Open FIND', action: 'find', status: b.events.some(e => e.name === 'callable_succeeded' && e.action === 'find') ? 'live' : 'queued', description: 'Your public business surface, callable by any client with a key.' }, { id: 'quote', name: 'Get Quote', action: 'request_quote', status: b.events.some(e => e.name === 'callable_succeeded' && e.action === 'request_quote') ? 'live' : 'queued', description: 'A real request delivered to your workspace inbox. No automatic price promise.' }, { id: 'square', name: 'Square BOOK', action: 'create_booking', status: b.square?.verified ? 'live' : 'queued', environment: 'sandbox', description: 'Optional booking proof surface. Square is not a permanent requirement.', reason: 'Requires assigned sandbox credentials and an accepted booking proof.' }, { id: 'chatgpt', name: 'ChatGPT', action: 'discovery', status: 'queued', description: 'No listing or discovery partnership is active.' }, { id: 'gbp', name: 'Google Business Profile', action: 'place_actions', status: 'queued', description: 'Business fields can be pasted today. Place Actions connection is queued.' }]; }
export function workspace(b: Business, origin: string): Workspace { const { ownerHash: _o, callerHash: _c, ...business } = b; const success = b.events.find(e => e.name === 'callable_succeeded'); return { business, powerUps: powerUps(b), nodeUrl: `${origin}/api/nodes/${b.id}`, schemaUrl: `${origin}/api/nodes/${b.id}/openapi.json`, apiUrl: `${origin}/api/nodes/${b.id}/call`, storage: storageMode(), hasCallerKey: !!b.callerHash, funnel: { started: true, ingested: b.events.some(e => e.name === 'ingest_completed'), nodeReady: b.published, callableSucceeded: !!success, timeToCallableMs: success ? Date.parse(success.timestamp) - Date.parse(b.createdAt) : null } }; }
async function square(path: string, payload: unknown) {
    if (!process.env.SQUARE_ACCESS_TOKEN)
        throw new ApiError('SQUARE_NOT_CONFIGURED', 'Square sandbox credentials are not configured.', 503);
    const response = await fetch(`https://connect.squareupsandbox.com/v2${path}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Square-Version': '2025-04-16' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (!response.ok)
        throw new ApiError('SQUARE_API_ERROR', data.errors?.[0]?.detail ?? 'Square could not complete this call.', 502);
    return data;
}
export async function execute(b: Business, action: ActionName, input: Record<string, unknown> = {}): Promise<Receipt> {
    const started = Date.now();
    try {
        if (!b.published)
            throw new ApiError('NODE_NOT_READY', 'Import and publish your business surface first.', 409);
        let result: Record<string, unknown>;
        let environment: 'production' | 'sandbox' = 'production';
        let quote: Business['quotes'][number] | undefined;
        if (action === 'find' || action === 'get_business') {
            result = { business_id: b.id, matched: true, business: b.surface };
            if (action === 'find' && typeof input.query === 'string' && input.query.trim()) {
                const query = input.query.toLowerCase().trim();
                const haystack = [b.surface.name, b.surface.category, b.surface.address, ...b.surface.services].join(' ').toLowerCase();
                if (!haystack.includes(query))
                    throw new ApiError('NO_MATCH', 'No matching service or business was found.', 404);
            }
        }
        else if (action === 'request_quote') {
            const name = String(input.name ?? '').trim();
            const email = String(input.email ?? '').trim();
            const request = String(input.request ?? '').trim();
            if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || request.length < 5 || request.length > 3000)
                throw new ApiError('INVALID_QUOTE', 'Provide a name, valid email, and request of 5–3000 characters.');
            quote = { id: randomUUID(), name, email, request, createdAt: new Date().toISOString(), status: 'received' };
            result = { confirmation_id: quote.id, status: 'received', delivery: 'owner_workspace_inbox', message: 'Quote request saved. No price or booking is confirmed.' };
        }
        else if (action === 'create_booking') {
            return await createSquareBooking(b, input);
        }
        else if (action === 'search_availability') {
            environment = 'sandbox';
            const config = b.square;
            if (process.env.SQUARE_BUSINESS_ID !== b.id)
                throw new ApiError('SQUARE_TENANT_UNAUTHORIZED', 'This seller is not assigned to this business.', 403);
            if (!config)
                throw new ApiError('SQUARE_NOT_CONNECTED', 'Connect an eligible Square sandbox seller first.', 503);
            const start = String(input.start_at ?? new Date(Date.now() + 3600000).toISOString());
            const end = String(input.end_at ?? new Date(Date.now() + 7 * 86400000).toISOString());
            result = await square('/bookings/availability/search', { query: { filter: { start_at_range: { start_at: start, end_at: end }, location_id: config.locationId, segment_filters: [{ service_variation_id: config.serviceVariationId, team_member_id_filter: { any: [config.teamMemberId] } }] } } });
        }
        else
            throw new ApiError('UNKNOWN_ACTION', 'This action is not supported.');
        const receiptId = randomUUID();
        if (action === 'find')
            result.confirmation_id = receiptId;
        const receipt: Receipt = { id: receiptId, action, createdAt: new Date().toISOString(), environment, status: 'succeeded', result };
        await updateBusiness(b.id, current => ({ ...current, quotes: quote ? [quote, ...current.quotes].slice(0, 1000) : current.quotes, receipts: [receipt, ...current.receipts].slice(0, 1000), events: ['find', 'request_quote'].includes(action) ? [...current.events, event(current, 'callable_succeeded', { action, receipt_id: receipt.id, duration_ms: Date.now() - started, environment })] : current.events }));
        return receipt;
    }
    catch (error) {
        if (error instanceof ApiError && ['BOOKING_OUTCOME_UNKNOWN', 'BOOKING_IN_PROGRESS'].includes(error.code))
            throw error;
        await updateBusiness(b.id, current => ({ ...current, events: [...current.events, event(current, 'callable_failed', { action, reason: error instanceof ApiError ? error.code : 'INTERNAL_ERROR', duration_ms: Date.now() - started })] }));
        throw error;
    }
}
export function schema(b: Business, origin: string) {
    const string = { type: 'string' };
    const actions: Record<string, unknown> = {
        get_business: { type: 'object', additionalProperties: false },
        find: { type: 'object', properties: { query: string } },
        request_quote: { type: 'object', required: ['name', 'email', 'request'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, email: { type: 'string', format: 'email' }, request: { type: 'string', minLength: 5, maxLength: 3000 } } },
        search_availability: { type: 'object', properties: { start_at: { type: 'string', format: 'date-time' }, end_at: { type: 'string', format: 'date-time' } } },
        create_booking: { description: 'Requires an assigned Square sandbox seller. ACCEPTED alone returns a confirmation; PENDING is not success. Retry unknown outcomes with the exact same idempotency key and payload.', type: 'object', required: ['customer_id', 'start_at', 'appointment_segments', 'idempotency_key'], properties: { customer_id: string, start_at: { type: 'string', format: 'date-time' }, idempotency_key: { type: 'string', description: 'Stable unique key for retry-safe Square booking creation.' }, appointment_segments: { type: 'array', minItems: 1, items: { type: 'object', required: ['service_variation_id', 'team_member_id', 'duration_minutes', 'service_variation_version'], properties: { service_variation_id: string, team_member_id: string, duration_minutes: { type: 'integer' }, service_variation_version: { type: 'integer' } } } } } }
    };
    return { openapi: '3.1.0', info: { title: `${b.surface.name || 'Agent Power Up'} node`, version: '1.0.0', description: 'Authenticated REST commerce node. Square is an optional sandbox proof surface.' }, servers: [{ url: origin }], paths: { [`/api/nodes/${b.id}/call`]: { post: { operationId: 'callBusinessNode', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { oneOf: Object.entries(actions).map(([action, input]) => ({ type: 'object', required: ['action', ...(['request_quote', 'create_booking'].includes(action) ? ['input'] : [])], properties: { action: { const: action }, input } })) } } } }, responses: { '200': { description: 'Durable callable receipt, envelope {ok:true,data:{id,action,createdAt,environment,status,result}}' }, '400': { description: 'Invalid action input' }, '401': { description: 'Invalid caller key' }, '503': { description: 'Partner unavailable' } } } } }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } }, 'x-power-ups': powerUps(b) };
}
