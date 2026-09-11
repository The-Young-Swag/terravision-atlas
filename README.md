# TerraVision: Atlas — Explore. Monitor. Plan. Visualize.

A zero-cost, client-side geospatial platform: 2D/3D maps, live disaster
monitoring, weather, routing and evacuation planning, shelters, traffic,
fuel estimates, storytelling, survey tools, and Minecraft/A0 export.
No backend, no accounts — data comes from free public APIs and persists
in the browser (IndexedDB). API keys live in gitignored `.env`
(see `.env.example`).

## Run it

```sh
npm install
npm run dev
```

Open the printed URL (port 4900). `npm run build` typechecks and builds;
`npx vitest run` runs the unit suite; `npm run lint:boundaries` checks
the dependency rules below.

## Architecture (feature-first)

Each domain capability owns its components, hooks, state, and map
rendering together. See **ARCHITECTURE.md** for the full target shape,
the dependency rules (enforced by `npm run lint:boundaries`, error
mode), and path aliases.

```
src/
  app/            Composition + shell chrome (TopBar, LayersPanel,
                  NotchSidebar, MobileToolFab, StatusBar)
  features/       map, weather, disasters, traffic, shelters, search,
                  navigation, survey, fuel, storytelling,
                  export-minecraft, export-print — each with components/,
                  hooks/, map/ (per-engine adapters, where applicable),
                  store.ts, and a public index.ts
  shared/         components/, hooks/, lib/, stores/, constants/, types/
```

## Known limitation (deliberate, not a bug)

The 3D globe renders disaster markers and the route line only. Weather,
shelters, traffic overlay, search pins, and the measure tool exist on
the 2D and Vector maps but have no Cesium adapters yet — that is
separate future feature work.
