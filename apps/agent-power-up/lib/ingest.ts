import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import type { Surface } from './types';
import { ApiError } from './security';
export function publicIp(address: string) { try {
    const ip = ipaddr.process(address);
    return ip.range() === 'unicast';
}
catch {
    return false;
} }
export async function fetchWebsite(raw: string, redirects = 0): Promise<{
    html: string;
    url: string;
}> { let url: URL; try {
    url = new URL(raw);
}
catch {
    throw new ApiError('INVALID_URL', 'Enter a full https:// website URL.');
} if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port)))
    throw new ApiError('UNSAFE_URL', 'Use a public HTTP or HTTPS website.'); const host = url.hostname.replace(/^\[|\]$/g, ''); const addresses = await lookup(host, { all: true }); if (!addresses.length || addresses.some(a => !publicIp(a.address)))
    throw new ApiError('UNSAFE_URL', 'Private and reserved networks cannot be imported.'); const selected = addresses[0]; return new Promise((resolve, reject) => { const transport = url.protocol === 'https:' ? https : http; const request = transport.get(url, { family: selected.family, headers: { 'User-Agent': 'AgentPowerUp/1.0 (business profile import)', 'Accept': 'text/html,application/xhtml+xml' }, lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family) }, response => { if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    response.resume();
    if (redirects >= 3)
        return reject(new ApiError('REDIRECT_LIMIT', 'This website redirects too many times.'));
    fetchWebsite(new URL(response.headers.location, url).href, redirects + 1).then(resolve, reject);
    return;
} if (response.statusCode !== 200) {
    response.resume();
    return reject(new ApiError('IMPORT_FAILED', `Website returned HTTP ${response.statusCode}. Paste business details instead.`));
} const chunks: Buffer[] = []; let size = 0; response.on('data', chunk => { size += chunk.length; if (size > 1000000) {
    request.destroy();
    reject(new ApiError('TOO_LARGE', 'Website exceeds import size limit. Paste business details instead.'));
}
else
    chunks.push(chunk); }); response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), url: url.href })); response.on('error', reject); }); const deadline = setTimeout(() => request.destroy(new ApiError('IMPORT_TIMEOUT', 'Website took too long. Paste business details instead.')), 8000); request.on('close', () => clearTimeout(deadline)); request.on('error', reject); }); }
export function parseWebsite(html: string, url: string, base: Surface): Surface { const $ = load(html); let structured: Record<string, unknown> = {}; $('script[type="application/ld+json"]').each((_i, el) => { try {
    const raw = JSON.parse($(el).text());
    const items = Array.isArray(raw) ? raw : raw['@graph'] ?? [raw];
    for (const item of items)
        if (item.name && (/Business|Salon|Store|Clinic|Service|Organization|Restaurant|Studio/.test(String(item['@type']))))
            structured = item;
}
catch { } }); const str = (v: unknown) => typeof v === 'string' ? v.slice(0, 2000) : ''; const address = structured.address; const name = str(structured.name) || $('meta[property="og:site_name"]').attr('content') || $('h1').first().text().trim() || $('title').text().split(/[|—]/)[0].trim(); return { ...base, name: name.slice(0, 120), description: (str(structured.description) || $('meta[name="description"]').attr('content') || '').slice(0, 2000), website: url, phone: str(structured.telephone), email: str(structured.email), address: typeof address === 'string' ? address : address && typeof address === 'object' ? Object.values(address).filter(v => typeof v === 'string' && v !== 'PostalAddress').join(', ') : '', source: 'website', confidence: structured.name ? 'medium' : 'low', importedAt: new Date().toISOString() }; }
