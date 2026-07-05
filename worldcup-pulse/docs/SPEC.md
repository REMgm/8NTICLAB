# WORLDCUP PULSE — Claude Code Build Spec

**Version:** 1.0 | **Date:** 2026-07-02 | **Owner:** RΞMᵍᵐ
**Target:** Zero to Vercel-live in one working session. Tournament is at the knockout stage, so the bracket is the product, not the group tables.

---

## 0. Scope Guardrails (read first, Claude Code)

Build v1 exactly to this spec. Do not add auth, user accounts, or user-submitted predictions in v1. The app is read-only editorial: live knockout bracket, match cards, player form, prediction reveals, odds context.

Three architectural decisions are locked:

1. **Single data provider.** API-Football (api-sports.io) is the only live source. football-data.org is a fallback adapter behind the same interface, disabled by default. Do not call both in production.
2. **Cache-first, never client-polling.** All external API calls happen server-side on a cron schedule into Supabase. The client reads only from Supabase or ISR-cached route handlers. Free/low tiers cannot survive client-side polling; this is a hard constraint, not an optimization.
3. **Photoreal world, caricature players.** Environments, hero imagery, and atmosphere are photorealistic. Players are rendered as exaggerated caricatures in the Spitting Image register: oversized heads, pushed features, unmistakably satirical. The exaggeration threshold is a hard rule: if a render could be mistaken for a photograph of the player, it fails QA and is regenerated. Near-photo AI likenesses of named athletes remain excluded. API-Football's licensed photos serve as source references for the caricature pass and as UI fallback while caricatures are in production.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components default, client components only for animated islands |
| UI | React 19 + TailwindCSS v4 | Design tokens in `globals.css` via `@theme` |
| Motion | Framer Motion 12 + canvas-confetti | Motion variants centralized in `lib/motion.ts` |
| Data | Supabase (Postgres) | Cache + snapshots. RLS on, anon read-only |
| Jobs | Vercel Cron → Next route handlers | Match-window aware schedule (see §4) |
| Deploy | Vercel | Production branch check: verify branch casing before first deploy (known footgun) |
| Assets | Higgsfield (stylized hero/players), Adobe Express/Firefly (polish, type lockups), Figma (component system) | Asset pipeline in §8 |

---

## 2. Environment Variables

```
API_FOOTBALL_KEY=            # api-sports.io dashboard
FOOTBALL_DATA_TOKEN=         # fallback only, football-data.org
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, cron ingest
CRON_SECRET=                 # protects /api/cron/* routes
```

---

## 3. API Layer

### 3.1 Provider interface

Every provider implements one interface so the fallback is a config switch, not a refactor:

```ts
// lib/providers/types.ts
export interface FootballProvider {
  getFixtures(opts: { from?: string; to?: string; live?: boolean }): Promise<Fixture[]>;
  getStandings(): Promise<GroupStanding[]>;          // historical/group context only
  getPlayerStats(playerId: number): Promise<PlayerStats>;
  getTopScorers(): Promise<ScorerRow[]>;
  getOdds(fixtureId: number): Promise<OddsSnapshot | null>;
}
```

### 3.2 Primary: API-Football v3 (`https://v3.football.api-sports.io`)

Header: `x-apisports-key: $API_FOOTBALL_KEY`

**First task at build time:** resolve the World Cup league + season IDs dynamically, do not hardcode. `GET /leagues?search=world cup&type=cup` and pin the 2026 season ID into Supabase `config` table. Historically league id `1`, but verify.

| Purpose | Endpoint | Cadence |
|---|---|---|
| Fixtures (knockout) | `GET /fixtures?league={L}&season=2026&from={d}&to={d}` | Cron, see §4 |
| Live scores | `GET /fixtures?live=all&league={L}` | Every 60s only during match windows |
| Fixture detail + events | `GET /fixtures?id={fixtureId}` | On live tick |
| Head-to-head | `GET /fixtures/headtohead?h2h={t1}-{t2}` | Once per matchup, cached forever |
| Player stats | `GET /players?id={pid}&season=2026` | Daily |
| Top scorers | `GET /players/topscorers?league={L}&season=2026` | Daily |
| Odds (pre-match) | `GET /odds?fixture={fixtureId}` | 2x daily + T-2h before kickoff |
| Team squads + photos | `GET /players/squads?team={tid}` | Once, cached |

Rate budget: assume the 100 req/day free tier until a paid key is confirmed. The cron schedule in §4 fits inside it. If a paid tier is available, tighten live cadence to 15s, change nothing else.

### 3.3 Fallback: football-data.org v4 (`https://api.football-data.org/v4`)

Header: `X-Auth-Token`. Competition code `WC`. Implements `getFixtures` and `getStandings` only; player stats and odds return empty and the UI degrades gracefully (hide odds chip, show form-only cards). Enable via `PROVIDER=football-data`.

### 3.4 Odds compliance note

Odds are displayed as editorial context ("market says 68%"), never as betting CTAs. No affiliate links, no bookmaker logos, no "bet now" verbs in copy. Predictions are framed as takes, not tips.

---

## 4. Ingest & Caching Strategy

Flip the default: this is not a real-time app, it is a burst-time app. Data only changes during match windows and once daily otherwise. Architecture follows that shape.

**Vercel cron (vercel.json):**

```json
{
  "crons": [
    { "path": "/api/cron/daily",  "schedule": "0 6 * * *" },
    { "path": "/api/cron/odds",   "schedule": "0 8,16 * * *" },
    { "path": "/api/cron/live",   "schedule": "* 15-23 * * *" }
  ]
}
```

- `/api/cron/daily`: fixtures next 7 days, top scorers, player form snapshots → upsert Supabase.
- `/api/cron/odds`: odds snapshots for fixtures inside next 48h. Store every snapshot (append-only) so odds movement can be charted.
- `/api/cron/live`: runs every minute during the 15:00–23:59 UTC window but exits immediately (no API call) unless a fixture in Supabase has status `LIVE` or kickoff within ±10 min. This is the guard that keeps the free tier alive.

All cron routes require `Authorization: Bearer $CRON_SECRET`.

**Client reads:** server components query Supabase directly; the live scoreboard island polls `/api/live` (a route handler with `revalidate: 30` reading Supabase, never the provider).

---

## 5. Supabase Schema

```sql
create table config (
  key text primary key,
  value jsonb not null
);

create table teams (
  id int primary key,              -- provider team id
  name text not null,
  code text,                       -- FIFA trigram
  flag_url text,
  primary_color text,              -- for momentum color shifts
  secondary_color text
);

create table fixtures (
  id bigint primary key,           -- provider fixture id
  kickoff timestamptz not null,
  stage text not null,             -- 'R32','R16','QF','SF','3P','F'
  status text not null,            -- 'NS','LIVE','HT','FT','PEN'
  home_team int references teams(id),
  away_team int references teams(id),
  home_score int, away_score int,
  penalties jsonb,
  venue text,
  events jsonb,                    -- goals/cards timeline from provider
  updated_at timestamptz default now()
);
create index on fixtures (kickoff);
create index on fixtures (status);

create table players (
  id bigint primary key,
  team_id int references teams(id),
  name text not null,
  position text,
  photo_url text,                  -- provider-licensed photo
  stylized_url text                -- Higgsfield treatment, nullable
);

create table player_form (
  id bigserial primary key,
  player_id bigint references players(id),
  snapshot_date date not null,
  goals int, assists int, xg numeric, minutes int,
  rating numeric,
  form_delta numeric,              -- computed vs previous snapshot
  unique (player_id, snapshot_date)
);

create table odds_snapshots (
  id bigserial primary key,
  fixture_id bigint references fixtures(id),
  captured_at timestamptz default now(),
  bookmaker text,
  market text,                     -- 'match_winner','total_goals','btts'
  values jsonb                     -- raw odds payload, normalized
);
create index on odds_snapshots (fixture_id, captured_at);

create table hot_takes (
  id bigserial primary key,
  fixture_id bigint references fixtures(id),
  headline text not null,          -- the reveal
  body text not null,
  confidence text not null,        -- 'certain','likely','spicy'
  revealed_stat jsonb,             -- the stat that justifies the take
  created_at timestamptz default now()
);
```

RLS: enable on all tables; policy `select` for `anon`, writes only via service role.

Hot takes v1: generated at build/cron time by a deterministic rules engine over `player_form` + `odds_snapshots` deltas (e.g., "odds moved >8% against the favorite in 24h", "striker's xG overperformance >0.4/game"). No LLM dependency in the hot path; an LLM polish pass can be layered later.

---

## 6. Component Inventory

```
app/
  layout.tsx                 // fonts, theme, nav shell
  page.tsx                   // Home: hero + today's matches + bracket teaser
  bracket/page.tsx           // Full knockout bracket
  match/[id]/page.tsx        // Match detail
  players/page.tsx           // Form leaderboard
components/
  Hero.tsx                   // Higgsfield hero, parallax, tournament pulse line
  BracketTree.tsx            // SVG knockout tree, animated path draw on scroll
  MatchCard.tsx              // score, status pulse, momentum color edge
  LiveTicker.tsx             // client island, polls /api/live
  PlayerCard.tsx             // flip card: photo front / stat sheet back
  FormSparkline.tsx          // 5-snapshot sparkline, draws on viewport entry
  OddsShift.tsx              // odds movement chart, editorial framing
  HotTakeCard.tsx            // tap-to-reveal, confetti on 'spicy'
  PredictionMeter.tsx        // animated gauge, spring physics
  StagePill.tsx / StatChip.tsx / Flag.tsx
  ConfettiLayer.tsx          // portal, fired via event bus
lib/
  providers/apiFootball.ts
  providers/footballData.ts
  providers/index.ts         // PROVIDER switch
  supabase.ts
  motion.ts                  // all variants + springs
  takesEngine.ts             // hot-take rules
  haptics.ts                 // navigator.vibrate wrapper
app/api/
  cron/daily/route.ts
  cron/odds/route.ts
  cron/live/route.ts
  live/route.ts              // client-facing, Supabase read, revalidate 30
```

---

## 7. Animation Spec

Central principle: one orchestrated moment per view, quiet everywhere else. The signature interaction is the **Hot Take reveal**; everything else supports it.

**Springs (lib/motion.ts):**

```ts
export const snap =   { type: "spring", stiffness: 500, damping: 30 };   // chips, pills
export const bounce = { type: "spring", stiffness: 300, damping: 14 };   // stat slide-ins
export const settle = { type: "spring", stiffness: 120, damping: 20 };   // cards, page elements
```

**Catalog:**

| Element | Behavior |
|---|---|
| Stat slide-in | `whileInView`, x: -24→0, opacity 0→1, `bounce`, stagger 0.06s per stat |
| Hot Take card | Collapsed shows only category + blurred headline (CSS blur). Tap: blur dissolves 0.25s, card expands with `settle`, revealed stat counts up (animated number). If `confidence === 'spicy'`: confetti burst from card origin, team-colored particles, 350 count, 0.8s |
| Confetti | canvas-confetti in `ConfettiLayer` portal. Fired on: spicy reveals, live goal events (LiveTicker diff detection), bracket-pick correct (v2) |
| Momentum color | `MatchCard` left border + subtle radial glow interpolate between `team.primary_color`s weighted by a momentum score (last-15-min events + odds delta). Framer `animate` on CSS var, 1.2s ease |
| Bracket draw | SVG connector paths, `pathLength` 0→1 scroll-linked, winners' paths in team color |
| Player card flip | 3D rotateY 180°, `settle`; back face staggers stat chips |
| Live pulse | Status dot: scale 1→1.35→1, opacity loop, 2s, only when `LIVE` |
| Number count-up | Custom hook `useCountUp`, 0.8s, easeOut, respects reduced motion (jump-to-final) |

**Hard rules:** `prefers-reduced-motion` disables confetti, loops, and count-ups globally (single check in `motion.ts`). No animation longer than 1.2s. Nothing animates on both scroll and hover.

---

## 8. Design System & Asset Pipeline

**Direction:** "Photoreal broadcast world, satirical cast." The environment is a cinematic match-day production: photoreal stadium atmospheres, floodlight haze, wet-pitch reflections, crowd bokeh. Into that world drop caricature players, and the collision between the two registers is the visual signature of the product. Dark pitch-green-black base (#0A1410), electric lime signal (#C8F542), warm floodlight white (#F5F2E8), team colors injected as CSS vars per card. Glassmorphism only on overlay layers (ticker, modals), never on content cards, to keep contrast and scan speed. The caricatures carry the humor; the UI stays disciplined so the contrast lands.

**Type:** Display: a condensed grotesque with real width variation for scores and headlines (e.g., Archivo Expanded/Condensed pairing). Body: Inter or Geist. Data/captions: tabular-nums mono (e.g., JetBrains Mono) for scores, odds, timers. Scores set huge, tabular, tight tracking; that's the typographic signature.

**Figma:** component library mirrors §6 one-to-one (MatchCard, PlayerCard, HotTakeCard, BracketNode + states: NS/LIVE/FT/PEN). Tokens exported as Tailwind `@theme` variables. Adobe Express/Firefly for the hero type lockup and social share cards (1:1 and 9:16 exports).

**Higgsfield pipeline:**
- Hero: one cinematic photoreal stadium-atmosphere key visual (marketing model or nano_banana_pro), no identifiable faces in the crowd, 16:9 + 9:16 crops.
- **Caricature style lock (do this first):** generate 3–5 caricature samples of fictional archetype players until the style is right (head-to-body ratio, feature exaggeration, paint/render finish), then save the winning look as a Higgsfield reference element. Every subsequent player caricature is generated with player photo as image reference + the style element in the prompt. One style element is what keeps 50+ players reading as one cast instead of 50 one-offs.
- Batch production: knockout squads only (16 teams max at R16), starters first, bench on demand. Store to `players.stylized_url`; licensed photo remains the fallback while the queue drains.
- QA gate per render: (a) instantly recognizable as the player, (b) impossible to mistake for a photo, (c) style-consistent with the element. Fail any one, regenerate.
- Backgrounds: caricatures cut out (remove_background) and composited over photoreal card environments so the register collision happens inside every PlayerCard, not just the hero.
- Motion loop (v1.1): 6s ambient photoreal hero loop, kling3_0_turbo, muted, `poster` fallback, lazy-loaded. Caricature micro-animations (v1.2): subtle head-bob idle loops on featured players only.

---

## 9. Mobile-First & Touch

- Breakpoints: design at 390px first; `sm 640 / md 768 / lg 1024`. Bracket becomes horizontal snap-scroll (`scroll-snap-type: x mandatory`) with stage tabs on mobile.
- Gestures: Framer `drag="x"` on PlayerCard carousel with `dragConstraints` + elastic; swipe between match days on Home; pull-down on LiveTicker triggers refetch (visual only, data is already cached).
- Haptics: `navigator.vibrate(10)` on hot-take reveal and goal event via `haptics.ts`; capability-checked, silent no-op on iOS Safari (no API support), never a permission prompt.
- Touch targets ≥44px; ticker is thumb-reachable bottom-anchored on mobile.

---

## 10. Build Order (Claude Code execution plan)

1. **Scaffold** (15 min): `create-next-app` (TS, Tailwind, App Router), install `framer-motion canvas-confetti @supabase/supabase-js`, tokens into `@theme`, deploy skeleton to Vercel immediately, confirm production branch mapping.
2. **Data spine** (45 min): Supabase schema (§5) via migration, provider interface + API-Football adapter, `/api/cron/daily` end-to-end, verify league/season resolution, seed teams + fixtures.
3. **Read UI** (45 min): Home with MatchCard grid + Hero (placeholder art), BracketTree from fixtures, match detail page. Server components, no animation yet.
4. **Motion layer** (30 min): `motion.ts`, stat slide-ins, bracket path draw, live pulse, count-ups, reduced-motion guard.
5. **Signature** (30 min): takesEngine + HotTakeCard reveal + ConfettiLayer + haptics.
6. **Live path** (20 min): `/api/cron/live` guard logic, LiveTicker island, goal-diff confetti.
7. **Assets** (parallel): drop in Higgsfield hero + stylized treatments, Adobe share cards, OG images.
8. **Ship check:** Lighthouse mobile ≥90 perf, reduced-motion verified, cron secret set, API quota math re-checked against schedule.

**Acceptance criteria:** live on Vercel; today's knockout fixtures render from Supabase with zero client-side provider calls; a spicy hot take reveals with confetti on tap; bracket draws on scroll on a 390px viewport; site fully functional with animations disabled.

---

## 11. Risks

| Risk | Level | Mitigation |
|---|---|---|
| API quota blowout on match days | High if unguarded | §4 window guard; alert at 80% via daily cron log |
| League/season ID mismatch (2026 tri-host edition) | Medium | Dynamic resolution at setup, pinned in `config` |
| Player likeness rights | Medium (reduced from High) | §0.3 lock: caricature only, exaggeration QA gate, no odds CTAs attached to player imagery. Residual risk accepted for v1; see note below |
| Odds framing read as gambling promo | Medium | §3.4 editorial framing, no CTAs/affiliates |
| Vercel branch misconfig blocks prod deploy | Known pattern | Step 1 verifies branch mapping before feature work |
| Odds gaps on fallback provider | Low | UI degrades: odds chips hidden, form-only cards |

**Likeness residual-risk note:** caricature enjoys stronger parody/expression protection than photoreal renders, but it is not a blanket clearance. Spitting Image operates under satire norms; a commercial product displaying betting odds sits in a different category, and several top players hold aggressive image-rights arrangements. Mitigations baked in: satirical register, no player imagery adjacent to odds CTAs (there are none), editorial framing throughout. If this moves beyond a portfolio/demo property toward monetization, get a rights read before scaling the cast.
