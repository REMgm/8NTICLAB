# Agent Power Up

Free, web-first hosted commerce nodes for local businesses. Next.js App Router, React, TypeScript and Tailwind. No checkout or paid gate.

## Implemented

- One-tap protected workspace, with an owner recovery key. Email magic links/OAuth are not yet connected.
- Website metadata/structured-data import with SSRF protection, and business-details paste fallback.
- Editable surface, public node discovery, OpenAPI 3.1 schemas, revocable tenant-scoped caller keys.
- Real FIND requests and persisted receipts; quote requests saved in the owner's inbox.
- Server-side activation, ingest, node, success and failure events.
- Honest queued partner cards and annual refresh job placeholder.
- Private Vercel Blob production persistence with conditional writes; local filesystem storage for development only.

Square is an optional sandbox proof surface. It is not a requirement to remain on Square. Its card stays queued until a configured seller has a verified successful booking. No Square execution has been verified in this delivery. No ChatGPT, Muse or Google listing is claimed. MCP is not implemented: the live-callable contract in this version is authenticated REST.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Development stores data in `.data/` (ignored by git). Set `AGENT_POWER_UP_DATA_DIR` to use a separate test directory. A workspace's recovery key is an owner credential: keep it private. Caller keys are separately scoped and rotatable.

## Verify

```sh
npm run typecheck
npm test
npm run build
node scripts/smoke.mjs
```

The smoke runner starts the built app in an isolated local process, performs real HTTP calls, checks a saved FIND receipt and all five event types, and writes redacted synthetic evidence to `evidence/local-acceptance.json`. It does not claim a deployed or Square proof.

## Deploy to Vercel

Import the GitHub branch with **Root Directory `apps/agent-power-up`** and framework Next.js. Use the default `npm run build`; commit the lockfile. Set Node.js 24.x or 22.x. The source may be staged in a feature branch; Remco retains merge authority.

Connect a **private** Vercel Blob store to the project. Vercel supplies `BLOB_STORE_ID` and OIDC credentials automatically, or use `BLOB_READ_WRITE_TOKEN` securely. Never use a public Blob store for tenant state. Production refuses to write to an ephemeral filesystem if the store is missing.

Set a random `CRON_SECRET` in the deployment environment. `vercel.json` schedules `/api/cron/refresh` annually. This job marks due surfaces; it does not claim to refresh business data automatically. A partner OAuth-token renewal schedule would be separate.

For optional Square configuration, set `SQUARE_ACCESS_TOKEN` to a sandbox-only token and `SQUARE_BUSINESS_ID` to the exact owner tenant for that seller. The connection route accepts the seller's location, service variation and staff IDs. Never associate an unrelated shared demo salon with a real business's activation.

Run the six acceptance steps on the deployed URL before calling staging verified: free start, useful import, responding hosted schema, authenticated FIND/quote or booking receipt, honest queued partner, and correlated funnel events. Local acceptance evidence alone is insufficient.

## REST calling

Discover the node schema at `/api/nodes/{business_id}/openapi.json`. Generate a caller key in the Developer tab. POST to `/api/nodes/{business_id}/call` with `Authorization: Bearer <caller-key>` and JSON:

```json
{"action":"find","input":{"query":"a service or business name"}}
```

`request_quote` expects `name`, `email` and `request`. A returned receipt means the request exists in the owner's inbox; it is not a quoted price, an external message, or a confirmed booking.

## Current operational limits

The MVP's request throttling is per runtime instance. Configure deployment-level rate limits before exposing it to significant traffic. Blob documents use optimistic concurrency; this is an MVP store, not an unbounded analytics warehouse. The public surface contains only information approved by the business owner. There is no claim of domain ownership verification. Import confidence is advisory and manual corrections remain important.

The app exposes the owner session's funnel. For the aggregate operator readout, configure `OPERATOR_API_KEY` and GET `/api/operator/metrics` with that key as a bearer credential. It reports same-day activation rate, ingest completion, median time-to-callable, action/environment breakdowns and failure reasons without returning customer data. Same day uses each activation's frozen timezone (UTC by default); action/environment breakdowns can overlap. No fabricated commercial results are included.
