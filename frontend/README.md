# theBarathon frontend

Mobile-first Next.js (App Router) client.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000`. By default the API is expected on the same
host as the page, port 8000 (see `src/lib/api.ts`). To point it elsewhere:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Use `localhost` (not `127.0.0.1`) for both dev servers. The browser treats
them as different hosts, so the auth cookies would not be sent back.

## Stack

- Next.js App Router, TypeScript, Tailwind v4 (design tokens in `src/app/globals.css`)
- `maplibre-gl` with a self-hosted [Protomaps](https://protomaps.com) PMTiles
  file for the map: no API key and no usage limits
- Auth state in `src/lib/auth-context.tsx`. Requests use httpOnly cookies
  (`credentials: "include"`), and `src/lib/api.ts` refreshes the token once
  on a 401.
- `src/proxy.ts` (the Next 16 name for `middleware.ts`) redirects to `/login`
  when there is no session cookie.

## Map tiles

The map reads `public/tiles/france.pmtiles`, a ~10 GB extract of mainland
France and Corsica up to zoom 15 (streets, buildings and POI labels). It is
gitignored, so generate it once per machine with the
[pmtiles CLI](https://github.com/protomaps/go-pmtiles/releases):

```bash
pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles frontend/public/tiles/france.pmtiles \
  --bbox=-5.5,41.0,9.8,51.5 \
  --maxzoom=15
```

Daily builds are only kept for about a week. Pick a current date on
https://maps.protomaps.com/builds. The CLI downloads only the requested
region with range requests, which takes a few minutes.

- **Size by max zoom** for this area: z13 is about 2.5 GB (streets only),
  z14 about 5 GB, z15 about 10 GB (full detail). z16 is the same size as z15.
- **Another region:** use a bigger `--bbox`, or extract a second file and
  combine them with `pmtiles merge`
  ([CLI docs](https://docs.protomaps.com/pmtiles/cli)).
- **Serving:** PMTiles needs HTTP range requests. `next start` supports them,
  and so does an S3/R2 bucket or a CDN.
- Fonts and the sprite come from Protomaps' public `basemaps-assets` on
  GitHub Pages.
- `src/proxy.ts` skips `/tiles` so the file is reachable without auth.
- **maplibre-gl worker:** Turbopack doesn't build maplibre-gl's worker
  correctly, so `public/maplibre-gl-worker.mjs` and
  `public/maplibre-gl-shared.mjs` are copies from
  `node_modules/maplibre-gl/dist`. `scripts/copy-maplibre-worker.mjs` re-copies
  them on every `npm install`, and `MapView.tsx` loads them with
  `setWorkerUrl`. If tiles stop loading after a maplibre-gl upgrade, run
  `npm install` again.

## Production

The auth cookies are `SameSite=Lax`, so the frontend and the API must be on
the same site (for example both behind one domain with a reverse proxy). If
they end up on unrelated domains, the cookies need `SameSite=None; Secure`.
