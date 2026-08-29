# theBarathon — frontend

Next.js (App Router) mobile-first client for the bar rating app.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000` by default. Point it at the backend with:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

(this is already the default in `src/lib/api.ts`, so it works out of the box
if you run the backend on `localhost:8000`).

**Important**: use `localhost` (not `127.0.0.1`) for both the frontend and
backend dev servers. Auth cookies are issued for the request host, and
`localhost`/`127.0.0.1` are treated as different hosts by the browser, so a
mismatch means the cookie never gets sent back.

## Stack

- Next.js App Router, TypeScript, Tailwind v4 (design tokens in `src/app/globals.css`)
- `maplibre-gl` + a self-hosted [Protomaps](https://protomaps.com) PMTiles
  archive for the map (see below) — free forever, no API key, no usage quota
- Auth state via `src/lib/auth-context.tsx`, talking to the Django API with
  httpOnly cookies (`credentials: "include"`); `src/proxy.ts` does an
  optimistic redirect to `/login` when there's no session cookie at all, the
  real 401 handling + silent refresh lives in `src/lib/api.ts`
- `src/proxy.ts` is Next 16's renamed `middleware.ts` — same thing

## Map tiles (Protomaps, self-hosted)

The map data lives in `public/tiles/france.pmtiles` — a single ~10GB file
covering mainland France + Corsica up to zoom 15 (full detail: POI labels,
individual buildings), extracted from the daily Protomaps planet build. It's
gitignored (too big for git) and **not included** — you need to generate it
once per machine.

The current file was generated on 2026-08-29 with:

```bash
# pmtiles CLI (single binary, no deps): https://github.com/protomaps/go-pmtiles/releases
# planet source used: https://build.protomaps.com/20260828.pmtiles (that day's daily build)

pmtiles extract https://build.protomaps.com/20260828.pmtiles frontend/public/tiles/france.pmtiles \
  --bbox=-5.5,41.0,9.8,51.5 \
  --maxzoom=15
```

Daily builds are only kept for about a week, so that exact URL will 404 by
the time you read this — check https://maps.protomaps.com/builds for a
currently-available date and substitute it in:

```bash
pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles frontend/public/tiles/france.pmtiles \
  --bbox=-5.5,41.0,9.8,51.5 \
  --maxzoom=15
```

Either way this only downloads the bytes for the requested region/zoom via
HTTP range requests (not the whole ~140GB planet file) — takes a few minutes
for ~10GB, regardless of which day's build you point at.

- **Zoom/size trade-off** for this bbox: z13 ≈ 2.5GB (streets, no POI labels
  or buildings), z14 ≈ 5GB (partial POI/building coverage), z15 ≈ 10GB (full
  detail — z16 extracts to the same size, so 15 is the practical ceiling for
  this basemap). Lower `--maxzoom` if disk space is tighter than detail needs.
- **Need a different region** (e.g. a city outside mainland France)? Re-run
  with a bigger `--bbox` covering it, or add a second extract and
  `pmtiles merge` them — see the [pmtiles CLI docs](https://docs.protomaps.com/pmtiles/cli).
- **Serving requirement**: PMTiles is read via HTTP range requests, so
  whatever serves this file in production must support `Range`/`Accept-Ranges`
  (Next's own static file serving does this out of the box in both dev and
  `next start`; a plain S3/R2/CDN bucket works too if you'd rather not ship a
  multi-GB file with your app).
- Font glyphs and the marker sprite are loaded from Protomaps' public
  `basemaps-assets` GitHub Pages — free, static, no key needed.
- `src/proxy.ts` explicitly excludes `/tiles` from the auth-redirect check —
  it's plain OSM map data, not sensitive, and needs to be reachable without
  the SPA routing logic in the way.
- **Turbopack + maplibre-gl worker quirk**: Turbopack doesn't correctly emit
  maplibre-gl's worker chunk, so without a workaround the map silently never
  loads any tiles (it tries to load the current page as its own worker
  script). `public/maplibre-gl-worker.mjs` and `public/maplibre-gl-shared.mjs`
  are copies of the real files from `node_modules/maplibre-gl/dist`,
  re-synced automatically by `scripts/copy-maplibre-worker.mjs` on every
  `npm install` (`postinstall`), and `MapView.tsx` points maplibre-gl at
  them via `setWorkerUrl`. If the map ever silently stops loading tiles
  after upgrading `maplibre-gl`, run `npm install` again (or the script
  directly) to re-sync them.

## Notes for production

The auth cookies are `SameSite=Lax`, which only survive cross-origin fetches
when frontend and backend are **same-site** (e.g. `app.example.com` +
`api.example.com` sharing `example.com`, or reverse-proxied under one origin).
If you deploy frontend/backend on unrelated domains, either put a reverse
proxy in front of both under one origin, or switch the backend cookies to
`SameSite=None; Secure`.
