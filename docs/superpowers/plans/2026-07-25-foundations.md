# Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the repo in a state where Supabase work can proceed against tests and CI — fixing every verified audit finding, migrating to uv, and renaming to `web/` + `api/`.

**Architecture:** Nothing structural changes yet. The FastAPI backend keeps serving GPX from disk and the React SPA keeps consuming it. What changes is that the code becomes typed, tested, CI-protected, correctly measured, and correctly named. Sub-project 2 (Supabase) replaces the storage layer on top of this.

**Tech Stack:** Python 3.11 · FastAPI · gpxpy · uv · pytest — React 19 · TypeScript 5.9 · Vite 7 · Tailwind 4 · Vitest — GitHub Actions

## Global Constraints

- **Python 3.11 exactly.** Local is 3.14.2; `Dockerfile` and `runtime.txt` pin 3.11. uv pins the interpreter via `.python-version`.
- **uv replaces pip.** `pyproject.toml` + `uv.lock` replace `requirements.txt`. No unpinned dependencies.
- **Directory names are `web/` and `api/`.** Not `app/` — it collides with Next.js's App Router. Renaming happens in Task 8, so Tasks 1–7 use the current `backend/` and `frontend/` paths.
- **Weighted averages only.** Any average over multiple trips is `sum(distance) / sum(time)`, never the mean of per-trip averages.
- **Metric fields are nullable by design.** A missing metric means "unknowable", not zero. Never coerce a missing metric to `0`.
- **TDD.** Every behavioural change gets a failing test first.
- **Commit after every task.** Never batch.

---

### Task 1: Migrate the backend to uv

**Files:**
- Create: `backend/pyproject.toml`, `backend/.python-version`, `backend/.dockerignore`
- Delete: `backend/requirements.txt`, `backend/Procfile`, `backend/runtime.txt`
- Modify: `backend/Dockerfile`

**Interfaces:**
- Consumes: nothing
- Produces: `uv run` as the command prefix for all backend commands in later tasks; `uv add --dev <pkg>` for test dependencies in Task 2.

- [ ] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "gpxplorer-api"
version = "0.1.0"
description = "GPXplorer API — GPX parsing, metrics, and AI"
requires-python = "==3.11.*"
dependencies = [
    "fastapi>=0.115,<0.116",
    "uvicorn[standard]>=0.32,<0.33",
    "python-multipart>=0.0.12,<0.1",
    "gpxpy>=1.6,<2.0",
]

[dependency-groups]
dev = []

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Pin the interpreter**

```bash
cd backend && echo "3.11" > .python-version
```

- [ ] **Step 3: Resolve and lock**

Run: `cd backend && uv sync`
Expected: creates `uv.lock` and `.venv/`, prints `Resolved N packages`. If uv reports Python 3.11 is unavailable, it downloads it — this is expected and correct.

- [ ] **Step 4: Verify the app still starts**

Run: `cd backend && uv run uvicorn main:app --port 8001 &  sleep 3 && curl -s localhost:8001/api/trips | head -c 80 && kill %1`
Expected: JSON beginning `[{"id":"dan-to-ginosar","name":"Dan to Ginosar"`

- [ ] **Step 5: Create `backend/.dockerignore`**

This is a security fix, not tidiness: `backend/.env` holds a live `OPENAI_API_KEY` and the Supabase password, and `Dockerfile` does `COPY . .`.

```
.venv/
venv/
.env
.env.*
__pycache__/
*.py[cod]
.pytest_cache/
tests/
```

`.python-version` must **not** be listed here — Step 6's Dockerfile copies it into the
build context, and excluding it makes `docker build` fail with
`"/.python-version": not found`.

- [ ] **Step 6: Rewrite `backend/Dockerfile`**

Two fixes beyond uv: the old `CMD` hardcoded `--port 8000` and ignored Railway's injected `$PORT`, and the exec form could not expand it. Shell form fixes that and makes `Procfile` redundant.

The uv image tag is pinned deliberately. `:latest` would leave the tool that resolves
every other pinned dependency floating, so two builds weeks apart could silently use
different resolvers — a Railway deploy could start failing with nothing in this repo's
history to explain why.

```dockerfile
FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.22 /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev

COPY . .

ENV PATH="/app/.venv/bin:$PATH"

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

- [ ] **Step 7: Remove the superseded files**

`Procfile` and `runtime.txt` are Heroku-era leftovers; Railway builds from the Dockerfile.

```bash
cd backend && rm requirements.txt Procfile runtime.txt
```

- [ ] **Step 8: Verify the image builds and serves**

Run: `cd backend && docker build -t gpxplorer-api . && docker run --rm -e PORT=8080 -p 8080:8080 -d --name gpxtest gpxplorer-api && sleep 4 && curl -s localhost:8080/api/trips | head -c 40 && docker stop gpxtest`
Expected: build succeeds, curl prints `[{"id":"dan-to-ginosar"…`

- [ ] **Step 9: Confirm no secret entered the image**

Run: `docker run --rm gpxplorer-api sh -c 'ls -a /app | grep -c "^\.env$" || echo ABSENT'`
Expected: `ABSENT`

- [ ] **Step 10: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/.python-version backend/.dockerignore backend/Dockerfile
git add -u backend/
git commit -m "build: migrate backend to uv, pin deps, add .dockerignore

Replaces unpinned requirements.txt with pyproject.toml + uv.lock, pins
Python to 3.11 (local was 3.14.2), and adds .dockerignore so .env and
the virtualenv cannot be baked into image layers. Dockerfile CMD now
honours Railway's \$PORT, which makes Procfile redundant."
```

---

### Task 2: Backend test suite and CI

**Files:**
- Create: `backend/tests/__init__.py`, `backend/tests/test_metrics.py`, `.github/workflows/ci.yml`
- Modify: `backend/pyproject.toml`

**Interfaces:**
- Consumes: `uv` from Task 1
- Produces: `uv run pytest` as the backend test command; a CI workflow that Tasks 3–8 extend.

- [ ] **Step 1: Add test dependencies**

Run: `cd backend && uv add --dev pytest httpx`
Expected: `uv.lock` updated, `[dependency-groups] dev` now lists both.

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/__init__.py` (empty), then `backend/tests/test_metrics.py`:

```python
import os
import pytest
from fastapi.testclient import TestClient

import main
from main import app, calculate_stats

client = TestClient(app)


@pytest.fixture(autouse=True)
def run_from_backend_dir(monkeypatch):
    """main.py resolves GPX paths relative to the working directory."""
    monkeypatch.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_lists_all_nine_trips():
    res = client.get("/api/trips")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 9
    assert body[0]["id"] == "dan-to-ginosar"
    assert body[-1]["id"] == "yahel-to-eilat"
    assert "file" not in body[0]


def test_unknown_trip_is_404():
    assert client.get("/api/trips/nope/metrics").status_code == 404
    assert client.get("/api/trips/nope/download").status_code == 404


def test_metrics_match_known_values():
    """dan-to-ginosar is a fixed recording; these numbers must not drift."""
    res = client.get("/api/trips/dan-to-ginosar/metrics")
    assert res.status_code == 200
    stats = res.json()["stats"]
    assert stats["distance_km"] == pytest.approx(65.0, abs=0.5)
    assert stats["elevation_gain_m"] == pytest.approx(547, abs=5)
    assert stats["elevation_loss_m"] == pytest.approx(892, abs=5)


def test_graph_is_downsampled_and_ordered():
    graph = client.get("/api/trips/dan-to-ginosar/metrics").json()["graph"]
    assert 150 <= len(graph) <= 260
    distances = [p["distance"] for p in graph]
    assert distances == sorted(distances)
    assert distances[0] == 0
    assert all("lat" in p and "lon" in p for p in graph)


def test_download_returns_gpx_not_json():
    res = client.get("/api/trips/dan-to-ginosar/download")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/gpx+xml")
    assert res.text.lstrip().startswith("<?xml")
```

- [ ] **Step 3: Run to verify they pass**

Run: `cd backend && uv run pytest -v`
Expected: 5 passed. These characterise existing correct behaviour — they should pass immediately. If `test_metrics_match_known_values` fails, stop: something has changed in the GPX files or gpxpy version and must be understood before proceeding.

**Amended after review (commit `14e28c5`).** The test file above was strengthened before
Task 3: mutation testing proved that swapping `length_3d()` for `length_2d()` passed this
suite, because the two differ by only ~32 m on this route. Tightening the distance
tolerance did **not** fix it — a dedicated `test_distance_is_3d_not_2d` guard was added
instead, comparing the API's distance against both computed values. If you re-run this
plan from scratch, take the test file from `14e28c5`, not from the block above.

- [ ] **Step 4: Create `.github/workflows/ci.yml`**

Paths here are the pre-rename ones and get updated in Task 8.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
        with:
          enable-cache: true
      - run: uv sync --frozen
      - run: uv run pytest -v

  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

- [ ] **Step 5: Verify the workflow parses**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"`
Expected: `valid`

- [ ] **Step 6: Commit**

```bash
git add backend/tests .github/workflows/ci.yml backend/pyproject.toml backend/uv.lock
git commit -m "test: add backend test suite and CI

Characterisation tests pin the metrics for dan-to-ginosar so future
refactors cannot silently change computed numbers. CI runs pytest for
the API and lint+build for the web app on every PR."
```

---

### Task 3: Expose `moving_distance_m` from the API

**Files:**
- Modify: `backend/main.py:77-91`
- Test: `backend/tests/test_metrics.py`

**Interfaces:**
- Consumes: test suite from Task 2
- Produces: `stats.moving_distance_m` (float, metres) on the `/api/trips/{id}/metrics` response. Task 5 consumes this to compute a weighted average.

**Why:** `calculate_stats` already has `moving_data.moving_distance` and throws it away after computing per-trip average speed (`main.py:90`). Without it on the wire, the frontend cannot compute a correct multi-trip average.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_metrics.py`:

```python
def test_stats_expose_moving_distance():
    """Needed so clients can compute a weighted average across trips."""
    stats = client.get("/api/trips/dan-to-ginosar/metrics").json()["stats"]
    assert "moving_distance_m" in stats
    assert stats["moving_distance_m"] > 0
    # moving distance cannot exceed total 3D distance
    assert stats["moving_distance_m"] <= stats["distance_km"] * 1000 + 1


def test_avg_speed_is_consistent_with_moving_distance():
    stats = client.get("/api/trips/dan-to-ginosar/metrics").json()["stats"]
    derived = stats["moving_distance_m"] / stats["moving_time_s"] * 3.6
    assert derived == pytest.approx(stats["avg_speed_kmh"], abs=0.15)
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_metrics.py::test_stats_expose_moving_distance -v`
Expected: FAIL — `KeyError: 'moving_distance_m'` / `assert 'moving_distance_m' in stats`

- [ ] **Step 3: Add the field**

In `backend/main.py`, replace the `stats` dict at lines 83–91 with:

```python
    stats = {
        "distance_km": round(gpx.length_3d() / 1000, 2),
        "elevation_gain_m": round(uphill),
        "elevation_loss_m": round(downhill),
        "moving_time_s": moving_data.moving_time,
        "stopped_time_s": moving_data.stopped_time,
        "moving_distance_m": round(moving_data.moving_distance, 1),
        "max_speed_kmh": round(moving_data.max_speed * 3.6, 1) if moving_data.max_speed else 0,
        "avg_speed_kmh": round(moving_data.moving_distance / moving_data.moving_time * 3.6, 1) if moving_data.moving_time > 0 else 0
    }
```

- [ ] **Step 4: Run the full suite**

Run: `cd backend && uv run pytest -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_metrics.py
git commit -m "feat(api): expose moving_distance_m in trip metrics

Clients need moving distance to compute a weighted average speed across
multiple trips. It was already computed and discarded."
```

---

### Task 4: Lock down CORS, delete dead code, cache GPX parsing

**Files:**
- Modify: `backend/main.py:1-18`, `:142-213`
- Test: `backend/tests/test_metrics.py`

**Interfaces:**
- Consumes: test suite from Task 2
- Produces: `load_gpx(filename) -> gpxpy.gpx.GPX`, an LRU-cached loader. Endpoints become `def`, not `async def`.

**Why three things in one task:** they all rewrite the same handler bodies, and splitting them would mean three passes over the same lines with no independently reviewable middle state.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_metrics.py`:

```python
def test_cors_rejects_unknown_origin():
    res = client.get("/api/trips", headers={"Origin": "https://evil.example"})
    assert res.headers.get("access-control-allow-origin") != "*"
    assert res.headers.get("access-control-allow-origin") != "https://evil.example"


def test_cors_allows_configured_origin():
    res = client.get("/api/trips", headers={"Origin": "http://localhost:5173"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_gpx_parsing_is_cached():
    """Second read of the same file must not re-parse from disk."""
    main.load_gpx.cache_clear()
    client.get("/api/trips/dan-to-ginosar/metrics")
    client.get("/api/trips/dan-to-ginosar/metrics")
    assert main.load_gpx.cache_info().hits >= 1


def test_no_composite_trips_remain():
    assert all(t["type"] == "single" for t in main.TRIPS.values())
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_metrics.py -k "cors or cached" -v`
Expected: FAIL — CORS tests fail because `allow_origins=["*"]` echoes `*`; the cache test fails with `AttributeError: module 'main' has no attribute 'load_gpx'`.

- [ ] **Step 3: Replace the header block**

Replace `backend/main.py` lines 1–18 with:

```python
import os
from functools import lru_cache

import gpxpy
import gpxpy.gpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="GPXplorer API")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,https://gpxplorer.netlify.app",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

TRIPS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trips")


@lru_cache(maxsize=32)
def load_gpx(filename: str):
    """Parse a GPX file once and keep it. The files are static at runtime."""
    path = os.path.join(TRIPS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="GPX file not found")
    with open(path, "r") as f:
        return gpxpy.parse(f)
```

`JSONResponse` and `math` were imported and never used; both are gone. `TRIPS_DIR` is now absolute, so the server no longer has to be started from `backend/`.

- [ ] **Step 4: Replace both endpoint bodies**

Replace everything from `@app.get("/api/trips/{trip_id}/download")` to the end of the file with:

```python
@app.get("/api/trips/{trip_id}/download")
def download_trip_gpx(trip_id: str):
    """Returns the raw GPX file."""
    if trip_id not in TRIPS:
        raise HTTPException(status_code=404, detail="Trip not found")

    filename = TRIPS[trip_id]["file"]
    path = os.path.join(TRIPS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="GPX file not found")

    return FileResponse(
        path, media_type="application/gpx+xml", filename=f"{trip_id}.gpx"
    )


@app.get("/api/trips/{trip_id}/metrics")
def get_trip_metrics(trip_id: str):
    """Returns statistics and elevation profile data for a trip."""
    if trip_id not in TRIPS:
        raise HTTPException(status_code=404, detail="Trip not found")

    return calculate_stats(load_gpx(TRIPS[trip_id]["file"]))
```

Two changes worth naming. The `type: "composite"` branches are deleted — no trip has ever had that type, and the dead branch returned `combined_gpx.to_xml()` as a bare string, which FastAPI would have JSON-encoded rather than serving as XML. And `async def` becomes `def`: `open()` and `gpxpy.parse()` are blocking, and inside an `async` handler they stall the event loop for every concurrent request. As plain `def`, FastAPI runs them in a threadpool.

- [ ] **Step 5: Also convert the trips listing**

Change line `async def get_trips():` to `def get_trips():`.

- [ ] **Step 6: Correct the test fixture's now-stale docstring**

`backend/tests/test_metrics.py` has an autouse fixture whose docstring reads
*"main.py resolves GPX paths relative to the working directory."* After Step 3 that is
no longer true — `TRIPS_DIR` is absolute. The fixture must **stay**, because
`test_distance_is_3d_not_2d` opens `trips/dan_to_ginosar.gpx` relative to the working
directory itself, but its stated reason is now wrong and would mislead the next reader.

Replace the docstring only, leaving the fixture body unchanged:

```python
@pytest.fixture(autouse=True)
def run_from_backend_dir(monkeypatch):
    """Tests that open GPX fixtures directly use paths relative to backend/.

    The application no longer depends on the working directory -- TRIPS_DIR is
    absolute -- but the tests still read fixture files by relative path.
    """
```

- [ ] **Step 7: Run the full suite**

Run: `cd backend && uv run pytest -v`
Expected: 12 passed

- [ ] **Step 8: Verify the metrics did not change**

Run: `cd backend && uv run pytest tests/test_metrics.py -k "known_values or 3d_not_2d" -v`
Expected: both PASS — these are the guards that the refactor changed no numbers, and that
distance is still measured in three dimensions.

- [ ] **Step 9: Commit**

```bash
git add backend/main.py backend/tests/test_metrics.py
git commit -m "refactor(api): restrict CORS, cache GPX parsing, drop dead code

- CORS moves from allow_origins=['*'] with credentials to an explicit
  allowlist via ALLOWED_ORIGINS
- GPX files are parsed once and cached; handlers become sync def so
  blocking parses run in a threadpool instead of stalling the loop
- deletes the unreachable composite-trip branches, which would have
  returned JSON-encoded XML had they ever run
- paths resolve from the module directory, not the process CWD"
```

---

### Task 5: Fix the weighted-average bug

**Files:**
- Create: `frontend/src/lib/types.ts`, `frontend/src/lib/aggregate.ts`, `frontend/src/lib/aggregate.test.ts`, `frontend/vitest.config.ts`
- Modify: `frontend/src/App.tsx:42-107`, `frontend/package.json`

**Interfaces:**
- Consumes: `stats.moving_distance_m` from Task 3
- Produces: `Trip`, `TripStats`, `ElevationPoint`, `TripMetrics`, `AggregatedStats` from `src/lib/types.ts`; `aggregateTripMetrics(results: TripMetrics[]): { stats: AggregatedStats; graph: ElevationPoint[] } | null` from `src/lib/aggregate.ts`. Tasks 6 and 7 import these types.

**Why this is the headline fix:** `App.tsx:68` sums per-trip average speeds and `:87` divides by trip count — an unweighted mean of ratios. All trips are selected by default, so **every user sees a wrong average speed on first load**.

- [ ] **Step 1: Add Vitest**

Run: `cd frontend && npm install -D vitest@^3`
Expected: added to `devDependencies`.

- [ ] **Step 2: Add the test script**

In `frontend/package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `frontend/src/lib/types.ts`**

These replace three duplicate `Trip` declarations (`Layout.tsx:6-10`, `Sidebar.tsx:4-8`, and an untyped `useState([])` in `App.tsx:9`).

```ts
export interface Trip {
  id: string;
  name: string;
  description: string;
}

export interface TripStats {
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  moving_time_s: number;
  stopped_time_s: number;
  moving_distance_m: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
}

export interface ElevationPoint {
  distance: number;
  elevation: number;
  lat: number;
  lon: number;
}

export interface TripMetrics {
  stats: TripStats;
  graph: ElevationPoint[];
}

export interface AggregatedStats {
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  moving_time_s: number;
  stopped_time_s: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  max_elevation_m: number;
}
```

- [ ] **Step 5: Write the failing test**

Create `frontend/src/lib/aggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aggregateTripMetrics } from './aggregate';
import type { TripMetrics } from './types';

function trip(distanceKm: number, movingSeconds: number, elevations: number[] = [10]): TripMetrics {
  return {
    stats: {
      distance_km: distanceKm,
      elevation_gain_m: 100,
      elevation_loss_m: 80,
      moving_time_s: movingSeconds,
      stopped_time_s: 60,
      moving_distance_m: distanceKm * 1000,
      max_speed_kmh: 50,
      avg_speed_kmh: (distanceKm * 1000) / movingSeconds * 3.6,
    },
    graph: elevations.map((elevation, i) => ({
      distance: i, elevation, lat: 0, lon: 0,
    })),
  };
}

describe('aggregateTripMetrics', () => {
  it('returns null for an empty selection', () => {
    expect(aggregateTripMetrics([])).toBeNull();
  });

  it('weights average speed by distance and time, not by trip count', () => {
    // 5 km at 10 km/h (1800 s) and 500 km at 40 km/h (45000 s).
    // Unweighted mean of the two averages would be 25 km/h — wrong.
    // Correct: 505000 m / 46800 s = 10.79 m/s = 38.8 km/h.
    const result = aggregateTripMetrics([trip(5, 1800), trip(500, 45000)]);
    expect(result!.stats.avg_speed_kmh).toBeCloseTo(38.8, 1);
    expect(result!.stats.avg_speed_kmh).not.toBeCloseTo(25, 0);
  });

  it('matches the single-trip average when only one trip is selected', () => {
    const result = aggregateTripMetrics([trip(100, 18000)]);
    expect(result!.stats.avg_speed_kmh).toBeCloseTo(20, 1);
  });

  it('reports zero average speed when nothing moved', () => {
    const result = aggregateTripMetrics([trip(0, 0)]);
    expect(result!.stats.avg_speed_kmh).toBe(0);
  });

  it('sums distance and elevation, and maxes peak elevation', () => {
    const result = aggregateTripMetrics([trip(10, 3600, [50, 900]), trip(20, 3600, [120])]);
    expect(result!.stats.distance_km).toBeCloseTo(30, 2);
    expect(result!.stats.elevation_gain_m).toBe(200);
    expect(result!.stats.max_elevation_m).toBe(900);
  });

  it('offsets each trip graph so distance runs continuously', () => {
    const a: TripMetrics = { ...trip(10, 3600), graph: [
      { distance: 0, elevation: 1, lat: 0, lon: 0 },
      { distance: 10, elevation: 2, lat: 0, lon: 0 },
    ] };
    const b: TripMetrics = { ...trip(5, 1800), graph: [
      { distance: 0, elevation: 3, lat: 0, lon: 0 },
      { distance: 5, elevation: 4, lat: 0, lon: 0 },
    ] };
    const graph = aggregateTripMetrics([a, b])!.graph;
    expect(graph.map(p => p.distance)).toEqual([0, 10, 10, 15]);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL — `Failed to resolve import "./aggregate"`

- [ ] **Step 7: Create `frontend/src/lib/aggregate.ts`**

```ts
import type { AggregatedStats, ElevationPoint, TripMetrics } from './types';

/**
 * Combines per-trip metrics into one set of figures.
 *
 * Average speed is weighted: total moving distance over total moving time.
 * Averaging the per-trip averages would let a 5 km ride count as much as a
 * 500 km one.
 */
export function aggregateTripMetrics(
  results: TripMetrics[],
): { stats: AggregatedStats; graph: ElevationPoint[] } | null {
  if (results.length === 0) return null;

  let distanceKm = 0;
  let gain = 0;
  let loss = 0;
  let movingTimeS = 0;
  let stoppedTimeS = 0;
  let movingDistanceM = 0;
  let maxSpeedKmh = 0;
  let maxElevationM = -Infinity;

  for (const { stats, graph } of results) {
    distanceKm += stats.distance_km;
    gain += stats.elevation_gain_m;
    loss += stats.elevation_loss_m;
    movingTimeS += stats.moving_time_s;
    stoppedTimeS += stats.stopped_time_s;
    movingDistanceM += stats.moving_distance_m;
    maxSpeedKmh = Math.max(maxSpeedKmh, stats.max_speed_kmh);
    for (const point of graph) {
      maxElevationM = Math.max(maxElevationM, point.elevation);
    }
  }

  const avgSpeedKmh =
    movingTimeS > 0 ? (movingDistanceM / movingTimeS) * 3.6 : 0;

  let offset = 0;
  const graph: ElevationPoint[] = [];
  for (const result of results) {
    for (const point of result.graph) {
      graph.push({ ...point, distance: round(point.distance + offset, 2) });
    }
    const last = result.graph[result.graph.length - 1];
    if (last) offset += last.distance;
  }

  return {
    stats: {
      distance_km: round(distanceKm, 2),
      elevation_gain_m: Math.round(gain),
      elevation_loss_m: Math.round(loss),
      moving_time_s: movingTimeS,
      stopped_time_s: stoppedTimeS,
      max_speed_kmh: round(maxSpeedKmh, 1),
      avg_speed_kmh: round(avgSpeedKmh, 1),
      max_elevation_m: maxElevationM === -Infinity ? 0 : Math.round(maxElevationM),
    },
    graph,
  };
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd frontend && npm test`
Expected: 6 passed

- [ ] **Step 9: Use it in `App.tsx`**

Replace the entire second `useEffect` body (`App.tsx:42-107`) with:

```tsx
  // Fetch metrics for all selected trips and aggregate them
  useEffect(() => {
    if (selectedTrips.length === 0) {
      setTripStats(null);
      setGraphData(null);
      return;
    }

    setIsMetricsLoading(true);
    Promise.all(
      selectedTrips.map(id =>
        fetch(`${API_URL}/api/trips/${id}/metrics`).then(res => {
          if (!res.ok) throw new Error(`Failed to load metrics for ${id}`);
          return res.json() as Promise<TripMetrics>;
        })
      )
    )
      .then(results => {
        const aggregated = aggregateTripMetrics(results);
        setTripStats(aggregated?.stats ?? null);
        setGraphData(aggregated?.graph ?? null);
      })
      .catch(err => console.error('Failed to load metrics', err))
      .finally(() => setIsMetricsLoading(false));
  }, [selectedTrips]);
```

Add to the imports at the top of `App.tsx`:

```tsx
import { aggregateTripMetrics } from './lib/aggregate';
import type { AggregatedStats, ElevationPoint, TripMetrics, Trip } from './lib/types';
```

And replace the state declarations at `App.tsx:9-17`:

```tsx
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [tripStats, setTripStats] = useState<AggregatedStats | null>(null);
  const [graphData, setGraphData] = useState<ElevationPoint[] | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number, lon: number } | null>(null);
```

Also change `data.map((t: any) => t.id)` at `App.tsx:34` to `data.map((t: Trip) => t.id)` and type the fetch as `res.json() as Promise<Trip[]>`.

- [ ] **Step 10: Close the `any` hole in `Layout` and `StatsBar`**

Without this, the new types achieve nothing: `LayoutProps.stats` is `any` (`Layout.tsx:18-19`), which launders `AggregatedStats` into `StatsBar`'s separately-declared local interface. That `any` is exactly why the audit's type errors never surfaced.

In `frontend/src/components/Layout.tsx`, add the import and replace the two `any` props:

```tsx
import type { AggregatedStats, ElevationPoint, Trip } from '../lib/types';
```

```tsx
    stats?: AggregatedStats | null;
    graphData?: ElevationPoint[] | null;
```

Delete the local `Trip` interface at `Layout.tsx:6-10` — it now comes from the import.

In `frontend/src/components/StatsBar.tsx`, delete the local `TripStats` and `ElevationPoint` interfaces (lines 4–20) and import instead:

```tsx
import type { AggregatedStats, ElevationPoint } from '../lib/types';
```

Then change `StatsBarProps.stats` to `AggregatedStats | null`.

In `frontend/src/components/Sidebar.tsx`, delete the local `Trip` interface (lines 4–8) and add:

```tsx
import type { Trip } from '../lib/types';
```

- [ ] **Step 11: Confirm only one `Trip` declaration survives**

Run: `cd frontend && grep -rn "interface Trip\|interface TripStats\|interface ElevationPoint" src/`
Expected: matches only in `src/lib/types.ts`.

- [ ] **Step 12: Typecheck and build**

Run: `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: both succeed with no output from tsc. This is where the `any`-laundering ends: with `LayoutProps.stats` properly typed, any disagreement between `AggregatedStats` and what `StatsBar` renders is now a compile error rather than a runtime surprise.

- [ ] **Step 13: Add the web test job to CI**

In `.github/workflows/ci.yml`, add to the `web` job's steps, after `npm run lint`:

```yaml
      - run: npm test
```

- [ ] **Step 14: Commit**

```bash
git add frontend/src/lib frontend/src/App.tsx frontend/vitest.config.ts frontend/package.json frontend/package-lock.json .github/workflows/ci.yml
git commit -m "fix(web): weight multi-trip average speed by distance and time

Aggregation summed per-trip average speeds and divided by trip count,
an unweighted mean of ratios. With all trips selected by default this
showed a wrong figure on every first load: 5 km at 10 km/h combined
with 500 km at 40 km/h reported 25 km/h instead of 38.8.

Extracts aggregation into src/lib/aggregate.ts so it is unit-testable,
and introduces src/lib/types.ts to replace three duplicate Trip
declarations."
```

---

### Task 6: Single source for the API URL, and remove dead files

**Files:**
- Create: `frontend/src/lib/config.ts`
- Modify: `frontend/src/App.tsx:6`, `frontend/src/components/MapViewer.tsx:10`, `frontend/src/components/Layout.tsx:65-78`, `frontend/.env.example`
- Delete: `frontend/src/App.css`, `frontend/src/assets/react.svg`, `frontend/public/vite.svg`, `frontend/tailwind.config.js`, `frontend/README.md`

**Interfaces:**
- Consumes: nothing
- Produces: `API_URL` exported from `src/lib/config.ts`.

**Why:** the same ternary is copy-pasted in three files, and `Layout.tsx:69` re-declares it *inside* a click handler. Changing the backend URL currently means editing three files.

- [ ] **Step 1: Create `frontend/src/lib/config.ts`**

```ts
/**
 * Base URL for the GPXplorer API.
 * Override with VITE_API_URL; otherwise localhost in dev, Railway in prod.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV
    ? 'http://localhost:8000'
    : 'https://gpxplorer-production.up.railway.app');
```

- [ ] **Step 2: Document the variable**

Append to `frontend/.env.example`:

```
# Optional. Defaults to localhost:8000 in dev and the Railway URL in production.
VITE_API_URL=
```

- [ ] **Step 3: Replace all three definitions**

In `frontend/src/App.tsx`, delete line 6 and add `import { API_URL } from './lib/config';`

In `frontend/src/components/MapViewer.tsx`, delete line 10 and add `import { API_URL } from '../lib/config';`

In `frontend/src/components/Layout.tsx`, add `import { API_URL } from '../lib/config';` at the top, then replace the button's `onClick` (lines 66–72) with:

```tsx
                        onClick={() => {
                            const lastSelected = selectedTrips.length > 0 ? selectedTrips[selectedTrips.length - 1] : null;
                            if (lastSelected) {
                                window.open(`${API_URL}/api/trips/${lastSelected}/download`, '_blank');
                            }
                        }}
```

- [ ] **Step 4: Confirm no definition remains**

Run: `cd frontend && grep -rn "gpxplorer-production.up.railway.app" src/ | grep -v "lib/config.ts"`
Expected: no output.

- [ ] **Step 5: Confirm the dead files really are dead**

Run: `cd frontend && grep -rn "App.css\|react.svg\|vite.svg" src/ index.html`
Expected: no output. `App.css` is leftover Vite template CSS imported by nothing, and both SVGs are template assets referenced nowhere. If any match appears, stop and investigate rather than deleting.

- [ ] **Step 6: Confirm `tailwind.config.js` is inert**

Run: `cd frontend && grep -rn "@config" src/ && cat tailwind.config.js`
Expected: no `@config` match, and the file shows a v3-style config with an empty `theme.extend`. Under Tailwind v4 (`@import "tailwindcss"` in `index.css:1`) this file is not loaded — the theme comes from the CSS custom properties in `index.css:3-12`. Keeping it invites edits that silently do nothing.

- [ ] **Step 7: Delete them**

```bash
cd frontend && git rm src/App.css src/assets/react.svg public/vite.svg tailwind.config.js README.md
```

`frontend/README.md` is the unmodified Vite template readme; the real instructions are in the repo-root `README.md`.

- [ ] **Step 8: Typecheck, test, lint and build**

Run: `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm test && npm run lint && npm run build`
Expected: all pass. The build must still succeed after removing `tailwind.config.js` — if styling breaks, restore it and open an issue instead of forcing it through.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/config.ts frontend/src/App.tsx frontend/src/components/MapViewer.tsx frontend/src/components/Layout.tsx frontend/.env.example
git add -u frontend/
git commit -m "refactor(web): single API URL source, drop dead template files

The API URL ternary was duplicated in three files, once inside a click
handler; adds VITE_API_URL as an override.

Removes leftover Vite scaffolding: App.css (imported by nothing), two
unused template SVGs, the Vite template README, and tailwind.config.js,
which is inert under Tailwind v4 since no @config directive points at
it."
```

---

### Task 7: Error states and accessible names

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx:49-57`, `frontend/src/components/Layout.tsx:46-55`, `:65-78`, `frontend/src/components/MapViewer.tsx:89-91`

**Interfaces:**
- Consumes: `Trip` from `src/lib/types.ts` (Task 5), `API_URL` from `src/lib/config.ts` (Task 6)
- Produces: `error: string | null` passed from `App` through `Layout` into `Sidebar`.

**Why:** every network failure is `console.error` only. If Railway cold-starts or times out, the user sees an empty sidebar and an empty map with no indication anything is wrong — `isLoading` still flips false in `.finally()`.

- [ ] **Step 1: Add error state to `App.tsx`**

Add alongside the other state declarations:

```tsx
  const [error, setError] = useState<string | null>(null);
```

Replace the first `useEffect`'s chain (`App.tsx:27-39`) with:

```tsx
  useEffect(() => {
    fetch(`${API_URL}/api/trips`)
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json() as Promise<Trip[]>;
      })
      .then(data => {
        setTrips(data);
        setError(null);
        if (data.length > 0) {
          setSelectedTrips(data.map((t: Trip) => t.id));
        }
      })
      .catch(err => {
        console.error('Failed to load trips', err);
        setError("Couldn't reach the trip server. Check your connection and try again.");
      })
      .finally(() => setIsLoading(false));
  }, []);
```

In the metrics effect from Task 5, replace the `.catch` with:

```tsx
      .catch(err => {
        console.error('Failed to load metrics', err);
        setError("Couldn't load trip statistics. The map may be incomplete.");
      })
```

Pass it down — in the `<Layout>` element, add `error={error}`.

- [ ] **Step 2: Thread it through `Layout.tsx`**

Add to `LayoutProps`:

```tsx
    error?: string | null;
```

Add `error` to the destructured parameters, and pass `error={error}` to `<Sidebar>`.

- [ ] **Step 3: Render it in `Sidebar.tsx`**

Add `error?: string | null;` to the props interface, destructure it, and replace the loading branch at line 61 with:

```tsx
                    {error ? (
                        <div role="alert" className="text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg p-3 leading-relaxed">
                            {error}
                        </div>
                    ) : isLoading ? (
                        <div className="text-center text-[var(--text-secondary)] text-sm py-8">Loading data...</div>
                    ) : (
```

Close the extra branch with `)}` matching the existing structure.

- [ ] **Step 4: Add accessible names to the three icon-only buttons**

`Layout.tsx` line 46 — the mobile menu button. Add both attributes:

```tsx
                        aria-label={isMobileSidebarOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isMobileSidebarOpen}
```

`Layout.tsx` line 65 — the download button. Its label is `hidden md:inline`, which removes it from the accessibility tree on mobile:

```tsx
                        aria-label="Download active trip"
```

`Sidebar.tsx` line 49 — the mobile close button:

```tsx
                        aria-label="Close menu"
```

Also add `aria-hidden="true"` to each of the two inline `<svg>` elements (`Layout.tsx:50`, `Sidebar.tsx:53`) so screen readers do not announce them separately.

- [ ] **Step 5: Add a map error state**

In `frontend/src/components/MapViewer.tsx`, add state near the existing declarations:

```tsx
    const [loadError, setLoadError] = useState<string | null>(null);
```

Replace the `.catch` at lines 89–91 with:

```tsx
            .catch(err => {
                console.error('Failed to load GPX', err);
                setLoadError("Couldn't load the route for this trip.");
            })
```

And add an early return alongside the existing two, before the `<Map>` render:

```tsx
    if (loadError) {
        return (
            <div role="alert" className="w-full h-full flex items-center justify-center text-red-300 text-sm p-6 text-center">
                {loadError}
            </div>
        );
    }
```

- [ ] **Step 6: Verify every icon-only button now has a name**

Run: `cd frontend && grep -n "aria-label" src/components/Layout.tsx src/components/Sidebar.tsx src/components/MapViewer.tsx`
Expected: at least 5 matches — open/close menu, download, and the two existing zoom controls in `MapViewer.tsx:129,138`.

- [ ] **Step 7: Typecheck, test, lint and build**

Run: `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(web): surface network errors, name icon-only buttons

Failures were console.error only, so an unreachable backend rendered as
an empty sidebar and empty map with no explanation. Adds a visible
error state in the sidebar and on the map.

Adds aria-labels to the mobile menu, sidebar close, and download
buttons (WCAG 4.1.2) -- the download button's text label is hidden
below md, removing it from the accessibility tree on mobile."
```

---

### Task 8: Rename to `web/` and `api/`

**Files:**
- Rename: `frontend/` → `web/`, `backend/` → `api/`
- Create: `netlify.toml` (repo root), `railway.toml` (repo root)
- Delete: `frontend/netlify.toml`
- Modify: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–7
- Produces: final directory layout for all later sub-projects.

**Do this last and alone.** It touches deployment on two platforms and is the one task that can break production. Both prior tasks' tests must be green before starting.

> **Manual steps required — this cannot be fully automated.** `netlify.toml` currently lives *inside* `frontend/` with no `base` setting, which means the base directory is configured in the Netlify dashboard rather than in the repo. This is the most likely reason the earlier `services/web` restructure had to be reverted. Moving the config to the repo root with an explicit `base` puts it under version control.

- [ ] **Step 1: Rename both directories with git**

```bash
cd "$(git rev-parse --show-toplevel)"
git mv frontend web
git mv backend api
```

- [ ] **Step 2: Move Netlify config to the root with an explicit base**

```bash
git rm web/netlify.toml
```

Create `netlify.toml` at the repo root:

```toml
[build]
  base = "web"
  command = "npm run build"
  publish = "web/dist"

[dev]
  command = "npm run dev"
  framework = "#custom"

# SPA fallback. Not needed today (single route) but required the moment
# client-side routing arrives in sub-project 3.
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Note `publish` is relative to the repo root, not to `base`.

- [ ] **Step 3: Pin the Railway build in the repo**

Create `railway.toml` at the repo root:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "api/Dockerfile"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 4: Update CI paths**

In `.github/workflows/ci.yml`, change `working-directory: backend` to `working-directory: api`, `working-directory: frontend` to `working-directory: web`, and `cache-dependency-path: frontend/package-lock.json` to `cache-dependency-path: web/package-lock.json`.

- [ ] **Step 5: Update the README**

In `README.md`, replace `cd frontend` with `cd web` and `cd backend` with `cd api`. Also replace the backend setup block, which still describes pip:

```bash
cd api
uv sync
uv run uvicorn main:app --reload
```

- [ ] **Step 6: Verify nothing still references the old names**

Run: `cd "$(git rev-parse --show-toplevel)" && grep -rn "frontend/\|backend/" --include="*.toml" --include="*.yml" --include="*.md" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.py" . | grep -v node_modules | grep -v "docs/superpowers" | grep -v "\.venv"`
Expected: no output. Matches inside `docs/superpowers/` are historical references in the spec and are correct — the spec documents the pre-rename state.

- [ ] **Step 7: Verify both halves still build and test**

Run: `cd api && uv run pytest -v && cd ../web && npm ci && npm run lint && npm test && npm run build`
Expected: 11 backend tests pass, 6 frontend tests pass, lint clean, build succeeds.

- [ ] **Step 8: Verify the Docker image still builds from the new path**

Run: `cd "$(git rev-parse --show-toplevel)" && docker build -f api/Dockerfile -t gpxplorer-api api/`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: rename frontend/ to web/ and backend/ to api/

Names both halves by role. web/ rather than app/, which collides with
Next.js's App Router directory and would produce app/app/page.tsx if
the rendering migration happens; web/ also leaves room for a mobile/
sibling later.

Moves netlify.toml to the repo root with an explicit base so the build
config lives in version control rather than the Netlify dashboard, and
adds railway.toml pinning the Dockerfile path."
```

- [ ] **Step 10: Clear the Netlify dashboard base directory**

**Manual.** In Netlify → Site configuration → Build & deploy → Build settings, clear the "Base directory" field so the root `netlify.toml` takes effect. Leaving it set to `frontend` will break the build, since that directory no longer exists.

- [ ] **Step 11: Clear the Railway root directory**

**Manual.** In Railway → Service → Settings, clear any "Root Directory" set to `backend` so `railway.toml` at the repo root is used.

- [ ] **Step 12: Verify both deploys**

Push the branch and confirm a Netlify preview deploy succeeds and the Railway service redeploys and answers `/api/trips`. **If either fails, revert this commit rather than debugging forward** — Tasks 1–7 are independently valuable and should not be held hostage to the rename.

---

## Verification

After all eight tasks:

```bash
cd api && uv run pytest -v          # 12 passed
cd ../web && npm run lint && npm test && npm run build
```

And confirm the bug that started this is actually gone: load the app with all trips selected and check that the Avg Spd figure is the total distance over total moving time — roughly **14.7 km/h** for all nine cross-Israel days (669.8 km over 45.5 h), not the ~15.5 km/h the unweighted mean produced.

## Not in this plan

Deliberately deferred to sub-project 2, because they only make sense once trips live in a database: Pydantic response models on the API, replacing the hardcoded `TRIPS` dict, moving GPX files to Storage, and precomputing metrics at upload instead of on request.
