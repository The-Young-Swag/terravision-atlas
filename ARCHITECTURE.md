# TerraVision: Atlas — Architecture (feature-first target)

Structural migration from layered-by-technical-type
(`src/ui`, `src/stores`, `src/hooks`, `src/features`, `src/core`, `src/config`)
to feature-first: each domain capability owns its components, hooks,
state, and per-engine map-rendering code together.

## Target shape

```
src/
  app/                    Composition only — mode state, top-level layout
                           (TopBar, LayersPanel, NotchSidebar,
                           MobileToolFab, StatusBar)
  features/
    map/                  The 3 view components + tri-engine bootstrap
                           (createCesiumViewer, createMap, style.ts),
                           basemap/imagery sources (gibs, stadia,
                           streets), mapStore (minus measure fields)
    weather/
    disasters/              Live Alerts panel + USGS/EONET/FIRMS
    traffic/
    shelters/
    search/                 Photon/Nominatim, forward + reverse geocode
                           (incl. reverseGeocode.ts), shared rate-limit
                           gate, route-query parser
    navigation/             EvacuationPanel (one component serving both
                           Explore Navigation and Monitor Evacuation),
                           routeStore, avoidZone.ts, extracted avoid-area
                           interaction code
    survey/                 Geodetic panel, datum-viz, survey toolbar,
                           geodetic math, surveyStore, full Measure
                           Geodesic (state + extracted interaction +
                           rendering + math + panel UI)
    fuel/
    storytelling/
    export-minecraft/
    export-print/
  shared/
    components/             Only items with 2+ confirmed consumers
    hooks/                  (e.g. useBrightBasemap)
    lib/                    Generic idb wrapper only
    stores/                 Only genuinely app-wide state (uiPanelStore)
    constants/              src/config contents
    types/                  Single source for AppMode and shared types
```

Per feature: `components/`, `hooks/`, `map/` (only if it has per-engine
rendering code), `store.ts` (if it owns state), `types.ts`, `index.ts`
(deliberate public exports only).

## Dependency rules

1. `app` may import from `features` and `shared`.
2. A feature may import from `shared`.
3. A feature may consume another feature only through that feature's
   `index.ts` — never its internals.
4. `shared` may consume a feature only through that feature's `index.ts`
   (same as rule 3) — never its internals, and never `app`.
5. Feature internals must never be imported from outside their feature.
6. Nothing moves into `shared/` until grep confirms 2+ features consume
   it as it exists today.
7. No circular dependencies between features.

Rules 1–5 and 7 are enforced by `.dependency-cruiser.cjs`
(`npm run lint:boundaries`); rule 6 is a process check. Severity is
`warn` during migration, `error` once complete.

## Known, deliberate state: Cesium coverage gap

The 3D globe (`CesiumGlobe.tsx`) renders disaster markers and the
route line/pins only. It does NOT render Weather, Shelters, Traffic
overlay, Search pins, or the Measure tool. This gap predates the
migration and is preserved exactly as-is. Building the missing Cesium
adapters is separate future feature work, not part of this refactor.

## Path aliases

`@/*` → `src/*` (tsconfig `paths` + vite `resolve.alias`), so
`@/features/*`, `@/shared/*`, `@/app/*` resolve in both typecheck and
build with no extra configuration.
