# DFS Dashboard

A dashboard for viewing [Demand Flexibility Service](https://www.neso.energy/industry-information/balancing-services/demand-flexibility-service-dfs) events published by the National Energy System Operator (NESO).

**Live: [blongden.github.io/dfs-dashboard](https://blongden.github.io/dfs-dashboard/)**

## What it shows

- DFS events grouped by day, with expandable half-hour slots
- Target MW and accepted MW per event, sourced from the NESO requirements dataset
- Successful and rejected bids with provider, volume, and price (£/MWh)
- Average and range of accepted and rejected bid prices
- Provider capacity breakdown as a pie chart
- Zone heatmap showing which of NESO's 12 DFS zones had accepted bids, using the [official NESO zone boundaries](https://www.neso.energy/document/376656/download)
- Historical data back to the 2022/23 season
- Alerts (in-app banner + tab title badge) when a new event is published

## Data source

All data comes from the [NESO open data portal](https://www.neso.energy/data-portal/demand-flexibility) via the public CKAN API. No API key required. The dashboard polls for new events every 60 seconds.

Four dataset schemas are supported, covering changes NESO made across seasons:

| Period | Schema |
|--------|--------|
| April 2026 – present | Numbered zones (Z1–Z12), current schema |
| April 2025 – March 2026 | Named GSP regions, archive schema |
| Season 2023/24 | Named GSP regions, comma-separated North Wales key |
| Season 2022/23 | Named GSP regions, underscore-separated North Wales key |

## Running locally

```bash
npm install
npm run dev
```

The dev server proxies `/ckan` to `https://api.neso.energy` to avoid CORS issues in development.

## Tech

React, TypeScript, Vite, TanStack Query, TanStack Table, Tailwind CSS, Leaflet
