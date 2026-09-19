import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSquareBooking } from '../lib/square-booking';
import { createBusiness, getBusiness, updateBusiness } from '../lib/store';
import { hash } from '../lib/security';
import type { Business } from '../lib/types';
test('Square contract: accepted only, persisted dedupe, conflict, pending reconciliation and unknown retry', async () => {
    const id = randomUUID();
    const b: Business = { id, createdAt: new Date().toISOString(), activationId: id, sessionId: id, activationTimezone: 'UTC', ownerHash: hash('test'), callerHash: null, published: true, surface: { name: 'Square contract fixture', description: '', category: '', website: '', phone: '', email: '', address: '', timezone: 'UTC', hours: '', services: [], source: 'test', confidence: 'high', importedAt: new Date().toISOString() }, events: [], receipts: [], quotes: [], refresh: { status: 'scheduled_stub', nextDueAt: new Date().toISOString(), lastCheckedAt: null }, square: { locationId: 'L', serviceVariationId: 'S', teamMemberId: 'T', verified: false } };
    await createBusiness(b);
    const segment = { service_variation_id: 'S', team_member_id: 'T', duration_minutes: 30, service_variation_version: 1 };
    const input = { idempotency_key: 'accepted-key', customer_id: 'C', start_at: new Date(Date.now() + 86400000).toISOString(), appointment_segments: [segment] };
    const originalFetch = global.fetch;
    const oldToken = process.env.SQUARE_ACCESS_TOKEN;
    const oldBusiness = process.env.SQUARE_BUSINESS_ID;
    process.env.SQUARE_ACCESS_TOKEN = 'test-only';
    process.env.SQUARE_BUSINESS_ID = id;
    let mode = 'ACCEPTED';
    let creates = 0;
    let lookups = 0;
    global.fetch = async (url, options) => { const path = String(url); if (path.endsWith('/availability/search'))
        return Response.json({ availabilities: [{ start_at: input.start_at, appointment_segments: [segment] }] }); if (options?.method === 'GET') {
        lookups++;
        return Response.json({ booking: { id: 'square-booking', status: 'ACCEPTED' } });
    } creates++; if (mode === 'timeout')
        throw new DOMException('Timed out', 'TimeoutError'); return Response.json({ booking: { id: 'square-booking', status: mode } }); };
    try {
        const accepted = await createSquareBooking(b, input);
        assert.equal(accepted.status, 'succeeded');
        assert.equal(accepted.result.confirmation_id, 'square-booking');
        assert.equal(creates, 1);
        let current = (await getBusiness(id))!;
        const retry = await createSquareBooking(current, input);
        assert.equal(retry.id, accepted.id);
        assert.equal(creates, 1);
        assert.equal(current.events.length, 1);
        await assert.rejects(createSquareBooking(current, { ...input, customer_id: 'OTHER' }), (e: unknown) => (e as {
            code: string;
        }).code === 'IDEMPOTENCY_CONFLICT');
        mode = 'PENDING';
        const pendingInput = { ...input, idempotency_key: 'pending-key' };
        const pending = await createSquareBooking(current, pendingInput);
        assert.equal(pending.status, 'pending');
        assert.equal(pending.result.confirmation_id, undefined);
        current = (await getBusiness(id))!;
        assert.equal(current.events.length, 1);
        const confirmed = await createSquareBooking(current, pendingInput);
        assert.equal(confirmed.status, 'succeeded');
        assert.equal(lookups, 1);
        mode = 'timeout';
        current = (await getBusiness(id))!;
        const unknownInput = { ...input, idempotency_key: 'unknown-key' };
        await assert.rejects(createSquareBooking(current, unknownInput), (e: unknown) => (e as {
            code: string;
        }).code === 'BOOKING_OUTCOME_UNKNOWN');
        current = (await getBusiness(id))!;
        assert.equal(current.bookingIntents!['unknown-key'].status, 'unknown');
        const before = creates;
        mode = 'ACCEPTED';
        await createSquareBooking(current, unknownInput);
        assert.equal(creates, before + 1);
        await updateBusiness(id, current => ({ ...current, bookingIntents: { ...current.bookingIntents, 'lease-key': { idempotencyKey: 'lease-key', payloadHash: hash(JSON.stringify({ location_id: 'L', customer_id: 'C', start_at: input.start_at, appointment_segments: [segment] })), status: 'pending', leaseUntil: Date.now() + 30000 } } }));
        current = (await getBusiness(id))!;
        await assert.rejects(createSquareBooking(current, { ...input, idempotency_key: 'lease-key' }), (e: unknown) => (e as {
            code: string;
        }).code === 'BOOKING_IN_PROGRESS');
    }
    finally {
        global.fetch = originalFetch;
        if (oldToken === undefined)
            delete process.env.SQUARE_ACCESS_TOKEN;
        else
            process.env.SQUARE_ACCESS_TOKEN = oldToken;
        if (oldBusiness === undefined)
            delete process.env.SQUARE_BUSINESS_ID;
        else
            process.env.SQUARE_BUSINESS_ID = oldBusiness;
    }
});
