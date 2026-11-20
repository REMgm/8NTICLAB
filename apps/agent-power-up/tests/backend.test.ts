import test from 'node:test';
import assert from 'node:assert/strict';
import { publicIp, fetchWebsite } from '../lib/ingest';
import { handle } from '../lib/api';
const origin = 'http://localhost:3000';
function request(path: string, method = 'GET', data?: unknown, cookie?: string, authorization?: string) { return new Request(origin + path, { method, headers: { origin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(authorization ? { authorization } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) }); }
test('SSRF blocks reserved, loopback, mapped and private addresses', async () => { for (const ip of ['127.0.0.1', '10.2.3.4', '169.254.169.254', '::1', '::ffff:127.0.0.1', '192.168.1.1', '0.0.0.0'])
    assert.equal(publicIp(ip), false, ip); assert.equal(publicIp('1.1.1.1'), true); await assert.rejects(fetchWebsite('http://127.0.0.1/')); await assert.rejects(fetchWebsite('file:///etc/passwd')); });
test('complete authenticated ingest → publish → external FIND → real quote receipt, isolation and metrics', async () => {
    const start = await handle(request('/api/free-start', 'POST', {}), 'free-start');
    assert.equal(start.status, 201);
    const payload = await start.json();
    const id = payload.data.businessId;
    const cookie = start.headers.get('set-cookie')!.split(';')[0];
    const repeated = await handle(request('/api/free-start', 'POST', {}, cookie), 'free-start');
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).data.businessId, id);

    const foreign = await handle(new Request(origin + '/api/free-start', { method: 'POST', headers: { origin: 'https://evil.example' } }), 'free-start');
    assert.equal(foreign.status, 403);
    assert.equal((await handle(request('/api/workspace'), 'workspace')).status, 401);
    let res = await handle(request('/api/publish', 'POST', {}, cookie), 'publish');
    assert.equal(res.status, 409);
    res = await handle(request('/api/ingest', 'POST', { details: { name: 'Acceptance Plumbing', category: 'Plumber', services: ['Pipe repair'], address: 'Test Street' } }, cookie), 'ingest');
    assert.equal(res.status, 200);
    res = await handle(request('/api/publish', 'POST', {}, cookie), 'publish');
    assert.equal(res.status, 200);
    const published = (await res.json()).data;
    assert.equal(published.powerUps.find((p: {
        id: string;
    }) => p.id === 'find').status, 'queued');
    assert.equal(published.powerUps.find((p: {
        id: string;
    }) => p.id === 'square').status, 'queued');
    assert.equal((await handle(request('/api/surface', 'PATCH', { name: ' ' }, cookie), 'surface')).status, 400);
    res = await handle(request(`/api/nodes/${id}/openapi.json`), 'schema', id);
    assert.equal((await res.json()).openapi, '3.1.0');
    res = await handle(request('/api/caller-key', 'POST', {}, cookie), 'caller-key');
    const key = (await res.json()).data.key;
    assert.equal((await handle(request('/call', 'POST', { action: 'find' }, undefined, 'Bearer wrong'), 'external-call', id)).status, 401);
    res = await handle(request('/call', 'POST', { action: 'find', input: { query: 'plumber' } }, undefined, `Bearer ${key}`), 'external-call', id);
    assert.equal(res.status, 200);
    const receipt = (await res.json()).data;
    assert.ok(receipt.id);
    assert.equal(receipt.result.business.name, 'Acceptance Plumbing');
    res = await handle(request('/call', 'POST', { action: 'request_quote', input: { name: 'Test Customer', email: 'test@example.org', request: 'Please quote a pipe repair.' } }, undefined, `Bearer ${key}`), 'external-call', id);
    assert.equal(res.status, 200);
    const quoteId = (await res.json()).data.result.confirmation_id;
    assert.ok(quoteId);
    res = await handle(request('/api/workspace', 'GET', undefined, cookie), 'workspace');
    const workspace = (await res.json()).data;
    assert.equal(workspace.business.quotes[0].id, quoteId);
    assert.equal(workspace.business.ownerHash, undefined);
    assert.equal(workspace.business.callerHash, undefined);
    assert.equal(workspace.funnel.callableSucceeded, true);
    assert.equal(workspace.powerUps.find((p: {
        id: string;
    }) => p.id === 'find').status, 'live');
    assert.equal(workspace.powerUps.find((p: {
        id: string;
    }) => p.id === 'quote').status, 'live');
    assert.deepEqual([...new Set(workspace.business.events.map((e: {
            name: string;
        }) => e.name))], ['signup_free', 'ingest_completed', 'node_ready', 'callable_succeeded']);
    res = await handle(request('/api/call', 'POST', { action: 'create_booking', input: {} }, cookie), 'call');
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'SQUARE_TENANT_UNAUTHORIZED');
    res = await handle(request('/api/restore', 'POST', { recoveryKey: payload.data.recoveryKey }), 'restore');
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('set-cookie'));
    res = await handle(request('/api/caller-key', 'POST', {}, cookie), 'caller-key');
    assert.equal(res.status, 200);
    assert.equal((await handle(request('/call', 'POST', { action: 'find' }, undefined, `Bearer ${key}`), 'external-call', id)).status, 401);
});
