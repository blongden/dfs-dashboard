# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (proxies /ckan → NESO API to avoid CORS)
npm run build    # type-check then bundle (tsc -b && vite build)
npm run lint     # oxlint
npm run preview  # serve the production build locally
```

There are no tests.

## Architecture

**Stack**: React 19 + TypeScript, Vite, React Router v7 (HashRouter), TanStack Query v5, TanStack Table v8, Leaflet, Tailwind CSS v3, oxlint.

**Routing**: HashRouter is deliberate — the app deploys to GitHub Pages at `/dfs-dashboard/` and hash routing avoids the need for server-side redirect rules.

**Data flow**: All data comes from the NESO public CKAN API. Raw API responses are normalised to a single `NormalisedBid` shape in `utils/normalise.ts` — different field names across seasons are aliased in `normaliseLegacy()`. Events (`DfsEvent`) are then derived from bids in `utils/joinEvents.ts` via `deriveEvents()` → `mergeAnnouncedEvents()` → `applySettlement()`.

**State**: No Redux or Zustand. All server state is TanStack Query; UI state (selected event, filters, history tier) lives in `useState` in `Dashboard` (`App.tsx`). Derived values are `useMemo`.

**History tiers**: Four cumulative levels (`none` / `archive2526` / `season2324` / `season2223`) control which `useArchiveTier` calls are active. Each tier uses TanStack Query's infinite query with auto-page fetching.

**Alerting**: `useEventAlerts` polls the NESO API every 60 s using `setInterval`. It tracks the latest requirement event IDs, utilisation row ID, and settlement row ID across ticks. On change it invalidates the relevant query cache keys and sets alert state. `useTabAlert` reflects the count as a browser tab title badge.

**Zone systems**: Two zone encodings coexist. NESO introduced numbered zones Z1–Z12 in April 2026; earlier data uses named GSP regions. `ZoneMap` and `GspZoneGrid` handle each, selected by the data shape.

**Deployment**: GitHub Actions builds on push to `main`, writing the commit SHA into `public/version.json` and `VITE_APP_VERSION`. `useVersionCheck` polls that file to show a "new version available" banner.

## Key files

| Path | Purpose |
|------|---------|
| `src/types/dfs.ts` | Core domain types (`NormalisedBid`, `DfsEvent`, zone types) |
| `src/api/client.ts` | `ckanSearch()` fetch wrapper |
| `src/utils/normalise.ts` | Raw API → `NormalisedBid` |
| `src/utils/joinEvents.ts` | `deriveEvents`, `mergeAnnouncedEvents`, `applySettlement` |
| `src/hooks/useEventAlerts.ts` | 60 s polling, cache invalidation, alert state |
| `src/App.tsx` | Root component, all top-level state, `Dashboard`, `AlertBanner` |
