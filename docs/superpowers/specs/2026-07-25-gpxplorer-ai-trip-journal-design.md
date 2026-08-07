# GPXplorer — AI-first trip journal

**Date:** 2026-07-25
**Status:** Design agreed, not yet implemented
**Supersedes:** nothing (first spec in this repo)

This document captures every design decision made while turning GPXplorer from a
single-trip GPX viewer into a real web application. It is the foundation document
for five sub-projects; each of those gets its own implementation plan.

---

## 1. What GPXplorer is

A **trip journal for people who travel under their own steam or in their own vehicle**,
where the primary way to understand a trip is to *ask it questions*.

Positioning, decided explicitly:

- **Not** a route editor. gpx.studio owns that, and ranking against it means competing
  on editing features rather than viewing ones.
- **Not** a social network. There is no follower graph, no feed, no likes.
- **Closest reference point is Polarsteps** — trip-as-narrative, multi-day, map-centric,
  public/private sharing — but with route rigour Polarsteps does not have (elevation,
  moving time, per-day metrics) and without its phone-based auto-tracking.

The differentiator is the **conversational interface over real route data**, with the
agent's tool calls visible in the UI. No competitor currently does this.

### Users

| Who | What they do | Account needed |
|---|---|---|
| **Author** | Uploads trips, writes them up, chooses who can see them | Yes |
| **Reader** | Opens a shared link, looks at the map, asks the trip questions | **No** |

Reading is always free and never gated. Accounts exist only for people keeping trips.
This is a hard product rule, not a growth tactic.

### Real content available today

Nine GPX files in `backend/trips/`, recorded 12–20 March 2021 with Runkeeper: a cycling
tour of Israel, Dan (33.229°N) to Eilat (29.540°N). Verified totals: **669.8 km**,
**7,401 m** ascent, **7,548 m** descent, **45.5 h** moving, **54,131** track points.
Low point −212 m (Jordan Valley), high point 803 m (Negev). This becomes trip #1.

The next trip to be uploaded is a **campervan trip reconstructed from photographs**,
which is why activity types and fidelity tiers (§5, §6) are in the design from the start
rather than retrofitted.

---

## 2. Scope and build order

Five sub-projects plus deferred work. Order matters — each depends on the ones above it.

| # | Sub-project | Why here |
|---|---|---|
| 1 | **Foundations** — repo restructure, uv, code-review fixes, tests, CI | Nothing else should be built on the current base |
| 2 | **Supabase** — auth, database, storage, migrations | Everything downstream needs persisted trips |
| 3 | **Sharing model** — private / unlisted / public, RLS | Defines who can read what before AI reads anything |
| 4 | **AI** — chat, auto-metadata, semantic search | Needs trips in a queryable database |
| 5 | **Landing page** — the annotated-sheet design | Needs real public trips to show |
| — | *Deferred: rendering migration, SEO/GEO* | See §11 |

**The AI-first pivot moved #4 ahead of #5** and promoted semantic search from optional
to required, because conversational Explore (§8.3) does not work without embeddings.

---

## 3. Architecture

**Hybrid: Supabase direct from the browser, FastAPI for computation and AI.**

```
┌─────────────┐   auth, trip metadata CRUD (RLS-enforced)   ┌──────────────┐
│   Browser   │ ──────────────────────────────────────────► │   Supabase   │
│  React SPA  │                                             │  Postgres    │
│             │   GPX parsing · metrics · AI · matching     │  Storage     │
│             │ ──────────────────────────────────────────► │  pgvector    │
└─────────────┘            ┌──────────────┐  service key ──►└──────────────┘
                           │   FastAPI    │
                           │  + LangChain │
                           └──────────────┘
```

### Why hybrid rather than FastAPI-as-gateway

LangChain is Python, so FastAPI stays regardless — a Supabase-only build was never an
option. Given that, the question was only what the browser talks to directly.

Row Level Security gives a **declarative security boundary enforced by the database**,
which is what a three-tier sharing model needs. "Public trips readable by anyone,
private readable only by owner" is a handful of policies rather than repeated checks in
every handler. Unauthenticated readers viewing public trips need no auth code at all.

The gateway alternative was rejected because it requires the `service_role` key, which
**bypasses RLS entirely** — one bug in one handler exposes everything.

### Responsibilities

**Browser → Supabase directly:** sign-in/out, session, reading trip metadata and lists,
CRUD on the author's own trips, signed URLs for photos.

**Browser → FastAPI:** GPX upload and parsing, metric computation, EXIF extraction, map
matching, all AI endpoints. FastAPI validates the Supabase JWT on every authenticated
call and derives `user_id` from it — never from the request body.

### Consequences for existing code

- **GPX files move to Supabase Storage.** The current `os.path.join("trips", …)`
  (`backend/main.py:158`) resolves relative to the process working directory and cannot
  accept uploads.
- **Metrics are computed once on upload and stored in Postgres**, not recomputed per
  request. This eliminates the parse-per-request problem outright rather than caching
  around it.
- The hardcoded `TRIPS` dict (`backend/main.py:20-75`) is deleted; trips come from the
  database. The dead `type: "composite"` branches go with it.

---

## 4. Data model

Postgres, via Supabase migrations. `auth.users` is Supabase-managed.

### Enums

```sql
create type activity_type as enum ('cycling','hiking','running','campervan','motorcycle','other');
create type visibility    as enum ('private','unlisted','public');
create type fidelity      as enum ('recorded','reconstructed','hybrid');
```

### Tables

**`profiles`** — one row per user, created by trigger on `auth.users` insert.
`id` (FK → auth.users), `handle` (unique, URL-safe), `display_name`, `avatar_url`, `created_at`.

**`trips`** — a journey, not a single track.
`id`, `owner_id` → profiles, `slug` (unique per owner), `title`, `description`,
`activity_type`, `visibility` (default `private`), `share_token` (random 128-bit, unique,
nullable), `fidelity`, `start_date`, `end_date`, `cover_photo_id`, `created_at`,
`updated_at`, `published_at`.

**`trip_days`** — one ordered leg per day. This is the core structural decision: the
cross-Israel ride is **one trip with nine days**, not nine trips.
`id`, `trip_id`, `day_index` (1-based, unique per trip), `date`, `title`, `notes`,
`gpx_path` (Storage key, nullable for photo-only), plus the metric columns:
`distance_m`, `elevation_gain_m`, `elevation_loss_m`, `moving_time_s`, `stopped_time_s`,
`max_speed_mps`, `avg_speed_mps`, `min_elevation_m`, `max_elevation_m`,
`start_lat`, `start_lon`, `end_lat`, `end_lon`, `bbox`, `geom_simplified` (~200-point
polyline for map and profile rendering).

Metric columns are **nullable by design** — a reconstructed campervan day has no
`moving_time_s`, and that absence is meaningful (§6).

**`trip_photos`** — `id`, `trip_id`, `day_id` (nullable until placed), `storage_path`,
`taken_at`, `lat`, `lon`, `has_exif_gps` (bool), `placement_method`
(`exif` | `timestamp_match` | `manual`), `caption`, `sort_index`, `width`, `height`.

**`trip_places`** — reverse-geocoded settlements and features crossed, feeding both the
UI and the AI's place vocabulary. `id`, `trip_id`, `day_id`, `name`, `kind`, `lat`, `lon`,
`sort_index`.

**`trip_embeddings`** — `trip_id` (PK), `embedding vector(1536)`, `content_hash`,
`updated_at`. Regenerated only when `content_hash` changes, to avoid re-embedding on
every save.

**`chat_sessions`** / **`chat_messages`** — conversation history *for the UI*. Sessions
carry a nullable `user_id` (anonymous readers get a session too) and a nullable `trip_id`
(Explore conversations are trip-less). Messages store `role`, `content`, and
`tool_calls` (jsonb) so the trace survives a page reload.

These are **not** the agent's own state. LangGraph's checkpointer (§8.0) persists graph
state in its own tables against the same Postgres. Do not duplicate: the checkpointer owns
resumable agent state, these tables own what the interface renders and what answer caching
(§8.4) keys on. Confirm the boundary once the checkpointer schema is in place.

### Derived, never stored

Trip-level totals (total distance, total ascent, day count) are computed by aggregating
`trip_days`. Storing them invites drift.

**Weighted averages only.** Trip-level average speed is
`sum(distance) / sum(moving_time)`, never the mean of per-day averages. The current code
gets this wrong (`frontend/src/App.tsx:68,87`) and shows a wrong headline figure on first
load — see §10.

---

## 5. Sharing model

Three tiers, Google-Docs-shaped.

| Tier | Who can read | URL |
|---|---|---|
| `private` | Owner only | — |
| `unlisted` | Anyone holding the link | `/t/{share_token}` |
| `public` | Anyone; listed in Explore and searchable | `/trip/{handle}/{slug}` |

### How unlisted works with RLS

RLS policies cannot read a URL path. The token is therefore exchanged through a
`SECURITY DEFINER` Postgres function that takes the token, looks up exactly one trip, and
returns it — bypassing RLS only for that single lookup. Everything else stays under
ordinary policies.

```sql
create function get_trip_by_share_token(token text)
returns setof trips
language sql security definer stable
as $$
  select * from trips
  where share_token = token and visibility = 'unlisted'
  limit 1;
$$;
```

**Revocation is regenerating `share_token`.** Old links 404 immediately.

### Policy sketch

- `trips`: select where `visibility = 'public'` OR `owner_id = auth.uid()`.
  Insert/update/delete where `owner_id = auth.uid()`.
- `trip_days`, `trip_photos`, `trip_places`: inherit via `exists (select 1 from trips …)`.
- Unlisted access never goes through these policies — only through the function above.

### Storage

Two private buckets, `trip-gpx` and `trip-photos`. Access is via signed URLs minted by
FastAPI after it has checked visibility. Public trips get long-TTL signatures.

*Open question:* private buckets plus signed URLs defeat CDN caching for public trips.
Moving public assets to a public bucket on publish would fix it at the cost of a
migration step whenever visibility changes. Deferred until there is enough traffic to
matter.

---

## 6. Activity types and metric profiles

**A van is not a bike, and the numbers should not pretend otherwise.** This is the
sharpest product differentiator against every other GPX viewer, all of which compute the
same six statistics for everything.

Each `activity_type` declares which metrics are computed and displayed:

| Metric | cycling / running | hiking | campervan / motorcycle |
|---|---|---|---|
| Distance | ✓ | ✓ | ✓ |
| Elevation gain / loss | ✓ | ✓ | ✗ meaningless |
| Moving time | ✓ | ✓ | ✓ *(as driving time)* |
| Average speed | ✓ | — | ✓ |
| Max speed | ✓ | ✗ | ✗ misleading |
| Pace (min/km) | ✓ *(running)* | ✓ | ✗ |
| High / low point | ✓ | ✓ | — |
| Nights away | — | — | ✓ |
| Places stayed | — | — | ✓ |
| Typical day distance | — | — | ✓ |

### Activity type and fidelity are orthogonal

A metric is shown only when **both** dimensions permit it:

```
displayed = activity_profile(activity_type) ∩ fidelity_allows(fidelity)
```

A recorded campervan trip shows average driving speed; a *reconstructed* one does not,
because speed is unknowable from photographs (§7). The two filters compose — neither
overrides the other, and the table above describes only the activity dimension.

Implemented as a **profile registry** — a single declarative map from `activity_type` to
an ordered list of metric keys, and a second from `fidelity` to the set of metrics it can
support — consumed by both the backend (what to compute) and the frontend (what to
render). Adding an activity type must not require touching component code.

`StatsBar` is rewritten to render from this registry rather than its current fixed
six-metric grid (`frontend/src/components/StatsBar.tsx`).

---

## 7. Trip creation — three paths

| Path | Input | Fidelity | Notes |
|---|---|---|---|
| **A** | GPX only | `recorded` | Today's behaviour. Full metrics. |
| **B** | GPX + photos | `hybrid` | **Best case.** Photos placed on the track by timestamp — they need no EXIF GPS, only a roughly correct clock. |
| **C** | Photos only | `reconstructed` | Route inferred from EXIF coordinates, map-matched to real roads. Reduced metrics. |

### Path C in detail

Photos are sparse — perhaps one point every few kilometres against a recorded track's
point every 1–8 seconds. Straight lines between them are not a route: they cut across
terrain and understate distance. The points are therefore **map-matched** (Mapbox Map
Matching API, chunked to respect its 100-coordinate limit) onto real roads and trails.

The result is *inferred*, and the UI says so. For `reconstructed` trips:

- Distance is labelled an estimate.
- Elevation is sampled from terrain along the matched path, or omitted.
- Total elapsed time comes from first and last photo timestamps.
- **Moving time, average speed and max speed are withheld entirely** — not estimated,
  not shown as zero. They are unknowable from photographs.

Note that path C's limitations and campervan's metric profile largely cancel out: a
campervan trip does not want speed or climbing anyway.

### Failure modes that must be handled, not crashed on

- **EXIF GPS stripped.** WhatsApp removes it, as does most social download. The upload
  must report "61 of 68 photographs carried coordinates" and continue.
- **Zero photos with GPS.** Offer path B (pair with a GPX) or manual placement. Do not
  produce an empty trip.
- **Clock skew** between camera and GPS in path B. Offer a time-offset correction.
- **HEIC.** iPhone default. Must be decoded server-side for both EXIF and thumbnails.

---

## 8. AI features

Built in Python inside FastAPI. This project is explicitly also a vehicle for learning
the LangChain ecosystem, so the feature order below doubles as a learning path.

### 8.0 LangGraph for the agent, plain LCEL for the chains

**The chat agent is built with LangGraph; §8.2 and §8.3 are not.**

The reason is *not* that trip chat is complex — it is a single agent with a handful of
read-only tools. The reasons are:

1. **`AgentExecutor` is the legacy path.** LangChain steers agentic workloads to
   LangGraph, and `create_react_agent` is the idiomatic way to build a tool-calling agent.
   Learning `AgentExecutor` in 2026 means learning a deprecated API.
2. **Checkpointing gives conversation persistence for free**, against the Postgres
   instance Supabase already provides.
3. **Streaming of intermediate steps** is what the visible tool trace (§9) needs — the UI
   wants to show `find_short_days(…)` as it runs, not after the answer lands.
4. **Interrupts / human-in-the-loop** map directly onto §8.2, where the model drafts
   metadata and a human approves it before publish.

§8.2 (auto-metadata) is prompt → model → Pydantic parser, and §8.3 (search) is a
retrieval chain. Both are straight LCEL. Reaching for a graph there would be ceremony.

*Verify against current LangGraph docs at implementation time — this ecosystem moves
faster than this document will.*

### 8.1 Chat with a trip — tool calling, *not* RAG

**This is deliberately not a RAG problem.** Trip data is structured numbers and
coordinates. Embedding GPX chunks and retrieving them by similarity answers
"how much climbing on day 3?" badly, because the answer requires arithmetic over a table,
not nearest-neighbour search.

The agent is given tools and calls them:

```
get_trip_summary()                     get_day(day_index)
get_daily_distances()                  compare_days(a, b)
get_elevation_profile(day_index)       find_days(where=…)      # e.g. under_km, over_gain
get_stop_durations()                   photo_density_by_day()
get_places_crossed(day_index?)         highlight_segment(day_index)   # UI side-effect
```

`highlight_segment` is a tool with a **UI side-effect**: calling it draws the segment on
the map, which is how the answer and the annotation stay in sync (§9).

Tools are typed with Pydantic schemas so arguments are validated and the model retries on
mismatch.

**Concepts learned:** tool definition and binding, graph state, `create_react_agent`,
checkpointers and thread persistence, streaming intermediate steps, and interrupts.

### 8.2 Auto-metadata and route enrichment

On upload, generate a suggested `title`, `description`, tags and difficulty, and
reverse-geocode the route into `trip_places`. All of it is **presented as a draft the
author edits**; nothing is auto-published in the author's name.

**Concepts learned:** LCEL chains, prompt templates, structured output with Pydantic
parsers.

### 8.3 Semantic search over public trips

Explore is conversational: a plain-language query becomes structured filters plus a
pgvector similarity search, and **the derived filters are shown back to the user** so
they can see what was understood and correct it.

This exists because *"mostly coastal"* is not a database column. A dropdown cannot
express it; similarity over route geometry and descriptions can.

**Concepts learned:** embeddings, vector stores, retrievers, hybrid search
(SQL filter + vector rank), and the difference between that and §8.1.

### 8.4 Cost and abuse control — required, not optional

Anonymous readers can chat on shared trips, which means **unauthenticated users can spend
tokens**. Before any AI endpoint ships:

- Per-session and per-IP rate limits on chat.
- A hard monthly spend ceiling with a graceful "ask again later" degradation.
- Answer caching keyed on `(trip_id, normalised_question)` — the suggested questions in
  particular will repeat constantly across readers of the same link.
- Tool results capped in size before entering the prompt.

---

## 9. Design language

**The annotated survey sheet.** Established across two iterations and settled.

- **Structure:** no cards, no panels, no bordered containers. Content sits on the map.
  Answers connect to the route with dashed **leader lines** pointing at the segment they
  describe — an answer about day 12 physically points at day 12.
- **Type, two faces only:** Didot (display — titles, questions, figures, place names)
  against Menlo at 9–11px, letterspaced, for every label, unit and tool call. The
  contrast between them is the personality.
- **Colour, two:** bone `#e6e0d2` on ink `#090d0c`, amber `#d4a04a` as the single UI
  accent, survey red `#c94f32` for routes.
- **Border radius 0** everywhere except pins and radio marks, which are true circles.
- **Committed to dark.** This is one visual world, not a theme with a light variant.
- Place names in italic serif, following map labelling convention.

### §9.1 — v1 revision: light, Polarsteps-inspired (2026-08-07)

Owner's verdict after using the live product, and it overrides this section's
dark commitment: **the app moves to a light theme**, warmer and closer to
Polarsteps' register — generous whitespace, photographic warmth, rounded
softness where the survey sheet was all hairlines, and **scroll-driven
storytelling** on the landing and trip pages. What survives the pivot: the
honesty rules (nulls render as absence, activity-appropriate metrics), the
annotated relationship between narrative and map, amber/red as accents
recoloured for a light ground, and chat's reserved slot. What changes:
ink ground -> light paper, Didot/Menlo pairing revisited for warmth,
radius-0 austerity relaxed.

v1 also adds two product pieces the live app exposed as missing:
- **Profile / "My trips"** — one place where an owner sees and controls
  everything of theirs (visibility, links, deletion).
- **Ownership attribution** — Explore and trip pages name the author
  (profiles.handle/display_name; profiles are already publicly readable
  under RLS, and the FK enables an embedded join).

Quality bar: **per-viewport QA gates** (mobile 390px and desktop) run by
dedicated QA agents before any visual milestone ships; the trip page must
fit and scroll correctly on both.

The **tool trace is part of the design, not debug output**. Every answer carries a
collapsible list of the tools that produced it, set as marginalia. It proves the numbers
were computed rather than invented — the trust problem every AI feature has — and it
keeps the agent loop legible while it is being learned.

Reference mockups, produced 2026-07-25 (private artifacts, not committed):

- Four early hero directions — https://claude.ai/code/artifact/1159733a-d57b-4250-b7d0-02e16e2651c8
- Landing page, survey-sheet direction — https://claude.ai/code/artifact/892ccf31-03c5-42ea-b6b5-d48ff3fcf7a7
- App screens, annotated sheet — https://claude.ai/code/artifact/90df9471-4650-459a-bf2c-7fcfac01cdc0

Vehicle and UI iconography comes from **Lucide**, already a dependency
(`lucide-react`, ISC licence): `caravan`, `bike`, `footprints`, `compass`, `sparkles`.

---

## 10. Foundations — findings to fix

From a full-repo audit. Each was verified against the code.

**Verified real:**

| Severity | Issue | Where |
|---|---|---|
| High | Average speed aggregates as an unweighted mean of per-trip averages; wrong figure shown on first load, since all trips are selected by default | `frontend/src/App.tsx:68,87` |
| High | No tests and no CI anywhere in the repo | — |
| High | GPX re-parsed from disk on every request; blocking I/O inside `async def` handlers, serialising the event loop | `backend/main.py:142-212` |
| High | No `.dockerignore`; `COPY . .` would bake `backend/.env` and `venv/` into image layers | `backend/Dockerfile:8` |
| Medium | CORS `allow_origins=["*"]` combined with `allow_credentials=True` | `backend/main.py:12-18` |
| Medium | API base URL hardcoded and duplicated in three files | `App.tsx:6`, `MapViewer.tsx:10`, `Layout.tsx:69` |
| Medium | Python dependencies completely unpinned | `backend/requirements.txt` |
| Medium | Pervasive `any`; three separate `Trip` interface declarations | `App.tsx`, `Layout.tsx:6-10`, `Sidebar.tsx:4-8` |
| Medium | No user-facing error state — all failures are `console.error` only | `App.tsx:37,105`, `MapViewer.tsx:89-91` |
| Medium | Icon-only buttons missing accessible names (WCAG 4.1.2) | `Layout.tsx:46-55,65-78`, `Sidebar.tsx:49-57` |
| Low | Dead code: composite-trip branches, `App.css`, template assets, inert `tailwind.config.js` under Tailwind v4 | various |

**Investigated and dismissed:** an audit finding claimed the production build was broken
by type errors at `App.tsx:14` and `:79`. It is not — `tsc -p tsconfig.app.json --noEmit`
exits 0 and `npm run build` succeeds. `res.json()` returns `Promise<any>`, so `results` is
`any[]` and `Array<any>.reduce` yields `any`, which legalises both the `delete` and the
`setTripStats` call. The errors are real *in principle* and will surface the moment those
values are typed properly — which is an argument for fixing the `any` usage, not evidence
of a broken build.

**Also noted:** `backend/.env` contains a live `OPENAI_API_KEY` that nothing in the
codebase reads. It is retained because §8 will use it. Local Python is 3.14.2 while
`Dockerfile` and `runtime.txt` pin 3.11 — uv resolves this by pinning the interpreter.

### Tooling decisions

- **uv** replaces pip. `pyproject.toml` + `uv.lock` replace `requirements.txt`; one
  Dockerfile line changes. Fixes both unpinned dependencies and the Python version drift.
- **`frontend/` → `web/`**, paired with **`backend/` → `api/`**. The rename only buys
  clarity if both halves are named by role.

  `app/` was considered and rejected: it collides with Next.js's App Router directory and
  with the Rails/Laravel source convention, so a future Next migration (§11) would produce
  `app/app/page.tsx`.

  `web/` draws the useful distinction — *web application* rather than *native
  application* — leaving room for a `mobile/` sibling later. That is not hypothetical for
  this product: camera-roll access for bulk photo import and background GPS tracking are
  exactly what would make trip creation better than uploading files from a laptop.
  `web/` covers desktop and mobile browsers alike; the app is already responsive
  (commit `9a05f5e`, `md:` breakpoint drawer).

  ```
  web/      browsers, desktop and mobile
  api/      FastAPI + LangGraph
  mobile/   native, if it ever happens
  ```

  Requires updating `netlify.toml`'s base directory and Railway's root path in the same
  commit. *(A previous attempt at a `services/web` restructure was reverted on
  2026-07-25; this deploy-config coupling is the likely cause and must be verified
  against a real deploy before anything is built on top.)*
- **Tests:** pytest for the backend (metric computation is pure and highly testable),
  Vitest for the frontend. **The weighted-average bug gets a regression test first.**
- **CI:** GitHub Actions running lint, typecheck, build and tests on every PR.

---

## 11. Out of scope

Deferred by explicit decision, with consequences stated:

- **Rendering migration** (Next.js / Astro). The app is a client-rendered SPA; crawlers
  see an empty `<div id="root">`.
- **SEO and GEO.** Follows directly from the above: **these pages cannot rank on Google
  while the app is a client-rendered SPA**, regardless of content quality. The
  gpx.studio-tier ranking goal resumes only when rendering is revisited.
- Trip comparison across multiple trips.
- Any social graph.

Photo captions and manual reordering are **not** deferred — they are undecided, and
blocking on §12.2.

---

## 12. Open questions

1. **Activity types at launch** — cycling and campervan only, or the full enum from §4?
2. **Photo content** — do photos carry captions and manual ordering, or only location
   and timestamp? Affects the editor's complexity considerably.
3. **Auth providers** — email magic link only, or OAuth (Google/Apple) as well?
4. **Map Matching cost** — Mapbox charges per request and path C chunks long routes into
   many. Needs a cost estimate before path C ships.
5. **Public-asset caching** — see §5.
6. **Landing page** — the survey-sheet direction is agreed, but it was designed before
   the AI-first pivot and should be revisited to lead with the conversational interface.

---

## 13. Next step

Each sub-project in §2 gets its own implementation plan. **Sub-project 1 (Foundations)**
is first and is unblocked: it depends on nothing, fixes the issues in §10, and puts the
repo in a state where the Supabase work can proceed against tests and CI.
