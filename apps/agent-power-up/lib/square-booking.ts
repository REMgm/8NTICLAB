import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { updateBusiness } from './store';
import { ApiError, hash } from './security';
import type { Business, Receipt } from './types';
const segment = z.object({ service_variation_id: z.string().min(1).max(128), team_member_id: z.string().min(1).max(128), duration_minutes: z.number().int().positive().max(1440), service_variation_version: z.number().int().nonnegative() });
const bookingInput = z.object({ idempotency_key: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/), customer_id: z.string().min(1).max(128), start_at: z.string().datetime({ offset: true }), appointment_segments: z.array(segment).min(1).max(10) });
async function provider(path: string, payload?: unknown) {
    if (!process.env.SQUARE_ACCESS_TOKEN)
        throw new ApiError('SQUARE_NOT_CONFIGURED', 'Square sandbox credentials are not configured.', 503);
    const response = await fetch(`https://connect.squareupsandbox.com/v2${path}`, { method: payload ? 'POST' : 'GET', headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Square-Version': '2025-04-16' }, ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
        if (response.status >= 500)
            throw new Error('Provider temporarily unavailable');
        throw new ApiError('SQUARE_API_ERROR', 'Square rejected this request. Check sandbox customer, seller and booking settings.', 502);
    }
    return response.json();
}
export async function createSquareBooking(b: Business, raw: Record<string, unknown>): Promise<Receipt> {
    if (process.env.SQUARE_BUSINESS_ID !== b.id)
        throw new ApiError('SQUARE_TENANT_UNAUTHORIZED', 'This seller is not assigned to this business.', 403);
    if (!b.square || !process.env.SQUARE_ACCESS_TOKEN)
        throw new ApiError('SQUARE_NOT_CONFIGURED', 'Connect the assigned Square sandbox seller first.', 503);
    const parsed = bookingInput.safeParse(raw);
    if (!parsed.success)
        throw new ApiError('INVALID_BOOKING', 'Provide valid customer_id, ISO start_at, appointment segments (duration and version), and an idempotency_key.');
    const input = parsed.data;
    const config = b.square;
    if (input.appointment_segments.some(s => s.service_variation_id !== config.serviceVariationId || s.team_member_id !== config.teamMemberId))
        throw new ApiError('INVALID_BOOKING', 'Use this node’s connected service and team member.');
    const key = input.idempotency_key;
    const payload = { location_id: config.locationId, customer_id: input.customer_id, start_at: input.start_at, appointment_segments: input.appointment_segments };
    const payloadHash = hash(JSON.stringify(payload));
    const now = Date.now();
    const acquired = await updateBusiness(b.id, current => {
        const prior = current.bookingIntents?.[key];
        if (prior && prior.payloadHash !== payloadHash)
            throw new ApiError('IDEMPOTENCY_CONFLICT', 'This idempotency key belongs to a different booking payload.', 409);
        if (prior?.status === 'succeeded')
            return current;
        if (prior?.status === 'failed')
            throw new ApiError('BOOKING_PREVIOUSLY_REJECTED', 'This booking attempt was rejected. Correct the request and use a new idempotency key.', 409);
        if (prior && prior.leaseUntil > now)
            throw new ApiError('BOOKING_IN_PROGRESS', 'This booking attempt is still running. Retry with the same key and payload.', 409);
        return { ...current, bookingIntents: { ...current.bookingIntents, [key]: { ...prior, idempotencyKey: key, payloadHash, status: 'pending', leaseUntil: now + 45000 } } };
    });
    const intent = acquired.bookingIntents![key];
    if (intent.status === 'succeeded' && intent.response)
        return intent.response;
    let attempted = false;
    try {
        let result;
        if (intent.bookingId) {
            attempted = true;
            result = await provider(`/bookings/${encodeURIComponent(intent.bookingId)}`);
        }
        else {
            // A retry must replay exactly the original create request; never choose another slot.
            if (!intent.providerAttempted) {
                const startTime = Date.parse(input.start_at);
                if (startTime <= Date.now())
                    throw new ApiError('INVALID_BOOKING', 'Choose a future appointment.');
                const available = await provider('/bookings/availability/search', { query: { filter: { location_id: config.locationId, start_at_range: { start_at: input.start_at, end_at: new Date(startTime + 86400000).toISOString() }, segment_filters: [{ service_variation_id: config.serviceVariationId, team_member_id_filter: { any: [config.teamMemberId] } }] } } });
                const found = available.availabilities?.some((slot: {
                    start_at: string;
                    appointment_segments: unknown[];
                }) => Date.parse(slot.start_at) === startTime && JSON.stringify(slot.appointment_segments.map(s => segment.parse(s))) === JSON.stringify(input.appointment_segments));
                if (!found)
                    throw new ApiError('AVAILABILITY_CHANGED', 'No matching Square slot remains. Search availability again.', 409);
            }
            await updateBusiness(b.id, current => ({ ...current, bookingIntents: { ...current.bookingIntents, [key]: { ...current.bookingIntents![key], providerAttempted: true } } }));
            attempted = true;
            result = await provider('/bookings', { idempotency_key: key, booking: payload });
        }
        const booking = result.booking;
        if (!booking?.id)
            throw new Error('No provider booking identifier');
        const accepted = booking.status === 'ACCEPTED';
        const pending = booking.status === 'PENDING';
        const receipt: Receipt = { id: intent.response?.id ?? randomUUID(), action: 'create_booking', createdAt: new Date().toISOString(), environment: 'sandbox', status: accepted ? 'succeeded' : pending ? 'pending' : 'rejected', result: { booking_id: booking.id, ...(accepted ? { confirmation_id: booking.id } : {}), status: booking.status, booking, message: accepted ? 'Square sandbox booking confirmed.' : pending ? 'Awaiting seller acceptance. Retry the same request to check; this is not a confirmed booking.' : 'Square did not accept this booking.' } };
        await updateBusiness(b.id, current => ({ ...current, bookingIntents: { ...current.bookingIntents, [key]: { ...current.bookingIntents![key], status: accepted ? 'succeeded' : pending ? 'pending' : 'failed', bookingId: booking.id, leaseUntil: 0, response: receipt } }, receipts: [receipt, ...current.receipts.filter(r => r.id !== receipt.id)], square: accepted && current.square ? { ...current.square, verified: true } : current.square, events: accepted ? [...current.events, { id: randomUUID(), name: 'callable_succeeded', timestamp: new Date().toISOString(), business_id: b.id, activation_id: b.activationId, session_id: b.sessionId, environment: 'sandbox', action: 'create_booking', receipt_id: receipt.id, duration_ms: Date.now() - now }] : current.events }));
        return receipt;
    }
    catch (error) {
        const unknown = attempted && !(error instanceof ApiError);
        await updateBusiness(b.id, current => ({ ...current, bookingIntents: { ...current.bookingIntents, [key]: { ...current.bookingIntents![key], status: unknown ? 'unknown' : 'failed', leaseUntil: 0, error: unknown ? 'OUTCOME_UNKNOWN' : error instanceof ApiError ? error.code : 'PROVIDER_UNAVAILABLE' } } }));
        if (unknown)
            throw new ApiError('BOOKING_OUTCOME_UNKNOWN', 'Square’s outcome is not yet known. Retry with exactly the same idempotency key and payload; do not start a new booking.', 503);
        throw error;
    }
}
