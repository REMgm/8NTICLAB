# WorldCup Pulse

Read-only editorial app for the 2026 World Cup knockout stage: live bracket,
match cards, player form, prediction reveals, odds context. Built to the
v1.0 build spec (2026-07-02).

## Architecture (locked decisions)

1. **Single data provider.** API-Football (api-sports.io) is the only live
   source. football-data.org is a fallback adapter behind the same
   `FootballProvider` interface (`lib/providers/`), enabled via
   `PROVIDER=football-data`. Never both in production.
2. **Cache-first, never client-polling.** All provider calls happen
   server-side in `/api/cron/*` on a Vercel Cron schedule and land in
   Supabase. Clients read only Supabase (server components) or the
   ISR-cached `/api/live` route (LiveTicker island, 30s revalidate).
3. **Photoreal world, caricature players.** UI ships with licensed-photo /
   monogram fallbacks; Higgsfield caricatures drop into
   `players.stylized_url` as the queue drains (QA gate: recognizable as the
   player, impossible to mistake for a photo, style-consistent).

## Demo mode

With no Supabase env vars set, the app serves a built-in demo dataset
(`lib/demo/seed.ts`) so every view — bracket, live ticker, hot-take
reveals — works end-to-end locally and in preview deploys. Production
reads Supabase exclusively.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

1. Create a Supabase project, run `supabase/migrations/0001_init.sql`.
2. Set env vars (see `.env.example`) locally and on Vercel.
3. Deploy to Vercel. **Verify the production branch mapping (and its
   casing) before first deploy** — known footgun.
4. `vercel.json` registers the three cron routes; set `CRON_SECRET` so
   Vercel signs the invocations:
   - `/api/cron/daily` 06:00 UTC — fixtures next 7 days, scorers, form
     snapshots, hot-take regeneration
   - `/api/cron/odds` 08:00/16:00 UTC — append-only odds snapshots (48h
     horizon)
   - `/api/cron/live` every minute 15:00–23:59 UTC — exits without an API
     call unless a fixture is LIVE or kicks off within ±10 min

Rate budget fits API-Football's 100 req/day free tier; on a paid key,
tighten the live cadence only.

## Odds compliance

Odds render as editorial context ("market says 68%"), never betting CTAs.
No affiliate links, bookmaker logos, or "bet now" verbs. Takes, not tips.
