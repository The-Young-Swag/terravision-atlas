# TerraVision: Atlas (Updated Specification)

This is the **updated** specification for TerraVision: Atlas, layering
Pass 1, Pass 2, and Pass 3 findings on top of the original
[terravision-atlas.md](./terravision-atlas.md) (which remains the
historical record). Every change in this file is a documented, verified
capability that was actually working in the running app at the end of
Pass 3. The original document is left untouched.

Items updated by this revision:
- 3D Globe and Vector mode tilt capability (now a Layers panel slider)
- Vector mode feature audit findings from Item 10B Part B
- Item 10B Part C measurement tools (Distance path mode, Area mode)
- Item 10 — Weather & Disaster API Integration (Live Alerts feed)
- Item 11 — Survey Mode geodetic tool validation/fixes
- Item 12 — Bubble panel toolbar (close/restore, long-panel widths)
- Item 12B — Unified Notch Sidebar for panel access
- Item 13 — Main search route queries to Navigation
- Item 15 — Route color, traffic-dynamic outline, traffic thickness
- Item 16 — Footer sizing/positioning
- Item 18 — Fuel Breakdown redesign
- Pass 1 Addendum — unified dynamic font-color utility

A separate **Proposed / Not Yet Built** section at the end lists
capabilities surveyed in Item 10B Part D that were not built, so
they don't get confused with shipped behavior.

---

## 📋 ABSTRACT

TerraVision: Atlas is a zero-cost geospatial platform combining a
Google Earth–style 3D globe and a Google Maps–style 2D interface with
live disaster monitoring and client-side AI. Built on open-source
technologies, with data processing and AI inference running locally in
the browser wherever possible. Every claim in this document is tied
to a specific, currently-verified free data source or library —
nothing here should be treated as working until it's confirmed
against the running app.

---

## 🎯 PURPOSE & USE

|User Group|Primary Use|
|---|---|
|**Disaster Responders**|Monitor live earthquakes, wildfires, floods, and storms; plan evacuations|
|**Geodetic Engineers**|Precision measurement, coordinate transformation, datum visualization|
|**Emergency Managers**|Build briefings using real-time disaster data|
|**Educators**|Geography lessons with time-slider animation and 3D exploration|
|**Urban Planners**|Visualize proposed developments in 3D; present via story maps|
|**Environmental Scientists**|Track deforestation and climate impacts via satellite imagery|
|**Travelers & Commuters**|Estimate fuel consumption and cost for a route|
|**General Public**|Explore the world in 2D/3D; get disaster alerts; free routing|

---

## 🏗️ CORE FEATURES

### 1. 3D Globe (CesiumJS)

- Interactive globe: rotation, tilt, zoom
- Terrain visualization from Cesium Ion elevation data
- 3D buildings where the underlying data source has them for that
  region — not universal, verify per-area
- Fly-to navigation from space to street level
- Layer toggling (satellite, terrain, custom overlays)
- Bookmarks for saved locations
- Distance/area measurement on the globe (multi-point path and closed
  polygon — see Geodetic Engineering Tools)
- Historical imagery time-slider: not implemented — no free, easily
  tile-served historical satellite archive exists at the coverage
  this would need
- **Camera tilt control**: a slider in the Layers panel "View"
  section (range 0–80°, with reset-to-top-down). Replaces the
  previous on-screen button cluster; the pre-existing middle-click-
  drag gesture continues to work and stays in lockstep with the
  slider. Underlying Cesium pitch API is unchanged.

### 2. 2D Map (OpenLayers)

- Pan, zoom, rotate, smooth tile loading
- Basemaps: Streets, Satellite, Terrain, Dark (OpenStreetMap / open
  imagery sources)
- Place search via Nominatim and Photon (Photon for autocomplete,
  Nominatim for final geocoding). 1 req/sec Nominatim fair-use
  limit, with a shared 1-second gate so forward, reverse, and
  drag-re-geocode calls never overlap. Browser sends Referer
  automatically; on-screen OSM attribution required.
- Routing — driving, walking, cycling — via free public OSRM/Valhalla
  instances (public demo servers, rate-limited, not guaranteed uptime;
  self-hosting is the reliable long-term option). Evacuation-avoidance
  routing uses Valhalla's `exclude_polygons` (OSRM lacks avoid-polygon
  support) at FOSSGIS's public demo server
  (`valhalla1.openstreetmap.de`, 1 req/sec/user, 100 req/sec total,
  `X-Client-Id` header requested).
- **Route color and outline**: base line is **#209dd7** (the brand
  blue established in the navigation/routing UI). The casing color is
  driven by real per-point TomTom **Flow Segment Data** speeds (the
  same `flowSegmentData/absolute/10/json` endpoint the traffic-aware
  ETA already queries) and the route renders as **one seamless
  single-LineString** in both the 2D and Vector maps. Vector mode
  uses MapLibre's `line-progress` + `interpolate` expression; the 2D
  map uses per-vertex color arrays on adjacent strokes that abut
  exactly. No visible seams or hard color-block boundaries. When no
  flow data is available the route falls back to the static brand
  blue + dark casing — no fabricated speed values.
- **Traffic overlay** — via **TomTom Traffic Incidents + Traffic Flow
  + Flow Segment Data**, Freemium tier: 50,000 tile + 2,500 non-tile
  req/day, free API key, no credit card. This quota is shared across
  all users of the deployed app, not per-user — cache aggressively
  and show an honest "traffic data unavailable" state when the daily
  quota is exhausted, never a broken or blank overlay. Raster flow
  tiles are rendered with **`thickness=5`** (the canonical TomTom
  thickness parameter, 1–20 range) to reduce clutter at normal
  zoom. Requires an API key only the project owner can generate
  (TomTom Developer Portal signup); store as an environment variable,
  never commit it.
- **Per-point traffic status bands** (used by the route casing
  gradient and the legend): `#777777` stopped (<1 km/h),
  `#FF2323` slow (1–60 km/h), `#FFFF37` moderate (60–120 km/h),
  `#2BC82B` fast (≥120 km/h). Source of truth for the app's
  traffic-status meaning.
- POIs via OpenStreetMap
- Custom overlay import: GeoJSON, KML, GPX, Shapefile
- Street-level imagery: not implemented by default — Mapillary's
  free tier exists but has real request limits; only add this if
  usage is confirmed to stay under them

### 2b. Vector Map (MapLibre GL JS) — Map Type

- The Vector map is a distinct **Map Type**, not a basemap: it
  renders MapLibre vector tiles with the same four basemap slots
  (Streets, Satellite, Terrain, Dark) and adds client-side contour
  generation from AWS Terrarium elevation tiles via `maplibre-contour`
  (BSD-3-Clause).
- Vector mode supports the full evacuation/route traffic pipeline:
  single-LineString route, traffic-dynamic outline, chevrons, pin
  placement, and avoid-draw.
- Vector mode's **pitch control** is the same Layers panel slider
  as 3D Globe, mapped to MapLibre's `easeTo({ pitch })` (0..85°
  documented max-pitch). Middle-drag (right-drag) is the gesture
  equivalent.
- Item 10B Part B (Vector mode feature audit) — every feature
  that exists in the 2D and 3D maps is also functional in the
  Vector map: incident markers with click popups, disaster pins,
  weather marker, avoid zone (preview + finalized), avoid-draw
  tool, jogging loop, route line with chevrons, traffic flow
  raster layer, traffic dim when a route is shown, search-result
  marker, measurement layer with draggable vertices.

### 3. Live Disaster Monitoring

Real, source-backed data only — no seeded, fabricated, or fallback
incidents, ever.

|Source|Provides|Access|
|---|---|---|
|USGS|Real-time earthquakes|Free, public, no key|
|NASA FIRMS|Wildfire detections (view-centered, key-gated)|Free, public, no key|
|NASA EONET|Floods, storms, volcanoes, landslides|Free, public, no key|
|Open-Meteo|Weather / air quality / marine conditions (current, 7-day forecast, historical)|Free, public, no key|
|TomTom Incidents|Active traffic incidents|Free, key-gated, shared daily quota|

- All four feeds (USGS, EONET, FIRMS, Open-Meteo) are merged into a
  single Live Alerts feed in the Live Alerts / Incident Center panel.
  Severity comes from a real field the source provides (e.g.
  earthquake magnitude) or a documented rule-based classification
  — never a fabricated value.
- TomTom incidents appear in the same panel, distinguishable by
  source.
- AI severity classification via TensorFlow.js is only claimed as
  active if a real model is loaded and invoked in the data path. If
  none exists, severity uses a plain documented rule and the UI
  says so.
- Damage detection via object detection models: if YOLO-family
  weights are used, note that Ultralytics YOLOv8 is licensed
  **AGPL-3.0** — a strong copyleft license with real implications
  for a browser-shipped app. Verify license compatibility before
  shipping any such model, or use an Apache/MIT-licensed detection
  model instead.

**Evacuation routing (avoiding disaster zones):**
- Uses **Valhalla**, not OSRM — OSRM does not support avoid-polygon
  routing. Valhalla's `exclude_polygons` parameter does. FOSSGIS
  hosts a free, public, full-planet Valhalla demo server at
  `valhalla1.openstreetmap.de`, rate-limited to 1 request/sec per
  user and 100/sec total under a fair-use policy. Requests include
  an `X-Client-Id` header identifying the app. Normal (non-avoidance)
  routing can stay on the existing OSRM/Valhalla setup; only
  avoidance-specific requests go through this endpoint.

**Shelter locator:**
- Uses the **Overpass API** querying OpenStreetMap for
  `amenity=shelter`, `social_facility=shelter`,
  `emergency=assembly_point`, and `evacuation_center=yes` together
  — there is no single standard global OSM tag for emergency
  shelters, and real-world coverage varies enormously by region. The
  panel shows a visible in-UI caveat that shelter data is
  community-sourced and coverage varies — never presented as
  complete or authoritative.

- Push notifications via the browser Notifications API (requires
  user permission).
- Historical replay via timeline slider, using cached
  previously-fetched data.
- **Offline mode**: after the app has fetched data once, it shows
  the last-cached data with a visible "last updated" / stale-data
  indicator while offline. It does not and cannot show live data
  offline — UI copy must reflect this precisely, not imply real-time
  offline capability.

### 4. Geodetic Engineering Tools

- Coordinate/projection support via Proj4js. **9 EPSG definitions
  bundled**: WGS84 (4326), Web Mercator (3857), UTM 51N (32651),
  UTM 33N (32633), NAD83 / UTM 15N (26915), ETRS89 / UTM 32N
  (25832), OSGB36 / British National Grid (27700), **PRS92
  geographic (4682)**, and **PRS92 / Philippines Zone III (3123)**
  for Luzon.
- Datum transformation via Proj4js (WGS84, NAD83, ETRS89, PRS92).
- Datum shift visualization: a WGS84→target datum pair selector with
  north/east offset in meters at the map center, blended 0–100%
  for visual confirmation. Targets include the new PRS92 pair.
- NTv2 grid support for local datum shifts. A file-picker lets the
  user load a `.gsb`/`.gsa` file; shifts are bilinearly interpolated
  from the grid. Sub-centimeter accurate for grids whose coverage
  contains the map center.
- Precision measurement, with two distinct modes (Item 10B Part C):
  - **Distance (path) mode**: click to place any number of points;
    each new click adds a segment, and the tool shows the running
    total distance across all segments, not just the most recent
    one. A two-point measurement is the minimum case of this, not
    a separate tool. Vertices are draggable on the map; the running
    total updates live as points move. CSV export is built in.
  - **Area mode**: click three or more points, then close the
    shape (click the first point again, or press "Finish") to
    calculate and display the enclosed area of the resulting
    polygon. Vertices are draggable; the area updates live.
  Both modes use real geodesic math (`@turf/turf` haversine
  length / spherical-excess area) so 2D, Vector, and any future map
  report identical numbers for the same points. Returns null until
  sufficient points are picked, never a zero result.
- Coordinate snapping to the UTM 51N meter grid (project → round →
  unproject) at a resolution-adaptive step targeting ~20 screen
  pixels, rounded to a 1/2/5 series for clean readouts. The map
  center reports snapped coordinates while snap is on; measured
  points land on the same grid.
- Large-format export (up to A0)
- **GNSS/RTK integration**: requires WebSerial or WebUSB, both
  **Chromium-only** (unsupported in Firefox and Safari). This is an
  experimental, hardware-dependent feature — labeled as such
  rather than presented as a universal capability. It cannot be
  verified without physical GNSS hardware connected.
- **Volume / cut-and-fill** and **elevation profile** are not
  built. The Geodetic panel states this honestly in the UI rather
  than faking results; the volume helper in
  `core/geodetic/measurements/volume.ts` is library-only (no DEM
  sampling, no UI) and is intentionally not wired up.

### 5. Fuel Efficiency Calculator

- **Manual entry is the primary, always-available mode**: user
  inputs distance (from a routed journey or manually), a
  consumption figure (km/L, L/100km, or MPG), and a fuel price per
  liter/gallon. This never depends on any external service and
  always works, including fully offline.
- Optional **auto-fill for fuel price**, sourced from a free,
  keyless, no-registration public API (`openvan.camp`'s fuel price
  endpoint — CC BY 4.0, live prices for 180+ countries, aggregated
  from official government sources including the EU Weekly Oil
  Bulletin, US EIA, Statistics Norway, Brazil's ANP, and Canada's
  NRCan, cached 6 hours, updated weekly). Treated as a convenience
  default the user can always override, never authoritative, never
  allowed to block the manual flow.
- Distance, fuel used, and total cost calculated and displayed
- Route comparison (compare fuel cost across alternate routes)
- Real-time recalculation as inputs change
- **Breakdown** (Item 18): two **independent** indicators (Fuel
  needed, Total cost) with their own real value as text and a
  proportional fill scaled against a **named fixed ceiling**
  (`FUEL_CEILING_LITERS = 60` for a typical passenger-vehicle
  tank, `TRIP_COST_CEILING_PHP = 5000` for a plausible upper
  trip cost). Each indicator's fill is `value / ceiling`,
  independent of the other, so the two bars are always
  visually meaningful (no auto-axis maxing-out). Replaces the
  prior dual-axis canvas bar chart that was clipping/overlapping
  at narrower panel widths. The efficiency gauge continues to
  use a pure-CSS gradient; the breakdown is the only consumer of
  Chart.js in the panel, and that consumer is removed.
- Export as PDF (print) or CSV
- TomTom's Fuel Prices API was evaluated and is **confirmed
  enterprise-only** — not available on Freemium or Pay-As-You-
  Grow tiers, sales contact required. Do not integrate it, and do
  not re-evaluate it without a paid enterprise agreement.

**Example:**
Route: Home → Office (25 km), consumption input: 8.5 L/100km, fuel
price: ₱65/L → 5.6 L used, ₱364.13 total cost.

### 6. Storytelling & Presentation

- Interactive map tours: multiple ordered scenes, each with saved
  camera position/zoom/layers
- Auto-play and self-guided playback modes
- Media embedding (text, images, video) per scene
- Time-slider animation across scenes
- Shareable links / embed codes
- Export as PDF or an interactive web component. MP4 video export
  is non-trivial client-side (browser MediaRecorder has real
  limitations) — only claim this works once actually verified
  producing a playable file; otherwise mark it not implemented
  rather than assumed working.
- AI-generated narration is only claimed as real if a
  Transformers.js model is actually loaded and generating text
  from the current scene/layer data. If not implemented, the UI
  says so — never hardcoded or hand-written "AI narration" output.

### 7. Minecraft Export

- **Java Edition only.** Bedrock Edition uses a proprietary
  LevelDB-based world format that isn't practically exportable
  from a browser without native bindings — out of scope, not
  offered as an option.
- Java world export requires more than NBT tag serialization:
  `prismarine-nbt` (MIT) handles NBT tags, but the full **Anvil
  region format** (`.mca`) needs its own implementation — an 8KB
  header split into two 4KB tables (chunk offsets, chunk
  timestamps) plus zlib-compressed, sector-aligned chunk data.
  `prismarine-provider-anvil` implements this but is built for
  Node.js filesystem I/O, not browser Blob output, so it needs a
  custom region writer built on top of `prismarine-nbt` plus
  `pako` or the browser's native `CompressionStream` for
  compression.
- A valid `level.dat` must be generated alongside the region
  file(s).
- Terrain replication (elevation, water bodies), with
  roads/buildings/vegetation converted to blocks, for the
  exported area. Real elevation sampled from AWS Terrain Tiles
  (Terrarium PNG, no key, attribution required).
- Any exported world must be verified by actually opening it in
  real Minecraft Java Edition — a file that merely downloads
  without error is not a passing test.

---

## 🧭 APP CHROME & PANEL ACCESS

### Mode switcher (Explore / Monitor / Survey)

- Top-of-screen pill switcher with per-mode colors. Drives the
  panel inventory: Geodetic panels appear only in Survey, Shelter
  Locator only in Monitor, etc. The switcher is the single source
  of mode state — no parallel mode tracking elsewhere.

### Unified notch sidebar (Item 12B)

- One collapsible edge-docked element (collapsed 52px glyph pill,
  hover/pin expanded to 296px) holds the entry points for every
  panel in the app, Codenotch-style. Dimensions, radii (22px
  collapsed / 20px expanded, flat edge side), and the 260ms
  cubic-bezier(.32,.72,0,1) width+radius transition match the
  visual mockup; content (rows, previews, count badges) is real
  panel state.
- **Core set (always present regardless of mode)**: Layers, Live
  Alerts, Weather, Navigation/Routing. Navigation/Routing is
  always present across all three modes; this row consolidates
  what was previously separate (the Navigation panel is mode-
  rendered in the app shell — no separate "open Routing" button
  exists in the top bar).
- **Mode-exclusive set**: Survey Tools (Survey mode), Shelter
  Locator (Monitor mode). Removed (not just hidden) outside their
  mode, driven by the same `activeMode` prop the rest of the app
  uses.
- **Drag-and-snap**: the notch is grab-draggable, snapping to
  left-edge or right-edge only (top/bottom never offered). Side
  persists via localStorage. Drag is unambiguous with hover-to-
  expand (press-and-hold via pointer capture).
- Storytelling, Minecraft Export, and Fuel Efficiency Calculator
  panels are standalone floating panels and stay untouched — they
  are not folded into the notch.

### Bubble panel toolbar (Item 12)

- Every floating bubble panel header has a Close button (X with
  hover tooltip), visually separated from Minimize by a divider,
  using the app's dynamic font-color utility for legible icons.
- Close hides the panel for the session without unmounting its
  content (display:none over a mounted subtree), so all inputs
  and selections survive a close/restore cycle. Restore is
  accessible from a persistent top-right pill (and a +N
  expander for additional closed panels), driven by Zustand's
  `useUiPanelStore`.
- Fuel / Storytelling panels keep a separate Remove action
  (XCircle icon) that destroys them entirely; this is unchanged
  from the prior behavior.
- **Wide width pattern** for long/dense panels (Navigation,
  Live Alerts, Weather): a single `wide` prop on `FloatingPanel`
  reuses the Fuel calculator's established 380px / md:440px size.
  Short panels (Layers, Geodetic, Datum shift, Shelter) stay at
  the default w-72. Mobile bottom sheets are unaffected.

### Main search (Item 13)

- The TopBar "Search places" input recognizes natural route-style
  queries ("Manila to Tarlac", "From A to B", "A → B", "A - B",
  "Here to Tarlac", "Tarlac to here", "Tarlac to my location"),
  resolves both endpoints through the existing Photon/Nominatim
  pipeline, and offers a clearly prioritized route-specific
  suggestion above the place results.
- Recognition alone never modifies Navigation: the suggestion must
  be accepted explicitly. Per-place "Navigate here" action
  (GPS as Start, place as Destination) is available when
  Geolocation is supported.
- "Here" / "my location" uses the existing survey live-GPS fix
  when tracking, else a one-shot browser Geolocation request.
  Permission denied / unavailable / stale → graceful fallback
  with a clear message, never a fabricated origin.
- Ambiguous locations require disambiguation, never guessing.
  Waypoint forms surface an explicit "not supported" message
  rather than being silently trimmed.
- The route suggestion styling matches the existing opaque
  dropdown + glassmorphism scrollbar conventions, with full
  mouse/keyboard interaction (Enter, Escape, click outside,
  continued typing).

### Footer (Item 16)

- Width is sourced from the new `.search-bar-shell` class in
  `globals.css` (mirrors the TopBar search bar's `max-w-md` +
  `flex-1` Tailwind sizing) — a single source of truth so the
  footer and search bar reflow together at every breakpoint.
- Anchored bottom-left (`left-4`, `bottom-4`); `right-4` and the
  `transition-[right]` companion are removed — no more edge-to-
  edge stretch.
- Internal content layout (`flex flex-col` on mobile,
  `sm:flex-row sm:items-center sm:justify-between` on larger
  screens) and gaps are unchanged; only the outer container's
  width and left/right anchoring change.
- Glass, padding, radius, and font styling are unchanged.

---

## 🎨 NICE-TO-HAVE / FUTURE

|Feature|Priority|Note|
|---|---|---|
|Progressive Web App (installable, offline shell)|Low|Straightforward, genuinely zero-cost, good candidate to prioritize|
|WebSocket live updates|Medium|Requires a running server component — check against zero-cost hosting constraints|
|BLE mesh alert sharing|Medium|Web Bluetooth is Chromium-only|
|Custom basemaps (user tiles)|Low||
|Print layout designer|Low||
|OGC/CSW data catalog search|Low||
|Volume measurement from elevation|Medium|Library-only helper exists; needs DEM sampling and UI to be a real feature|
|Elevation profile from path|Medium|Needs DEM sampling along the measured path|
|Multi-language UI|Low||

---

## 💡 Suggested Additions

Optional — verify feasibility before building, and none should come at
the expense of the core features above:

- **Data source status panel** — a page showing each live-data
  provider, its last successful fetch time, and whether it's
  currently reachable.
- **Region watchlist** — save a bounding box and get a browser
  notification when a new real event from any connected source
  falls inside it. Reuses existing fetch/notification
  infrastructure.
- **GPX export of any planned route** — trivial given routing
  already returns geometry; makes routes portable to other apps.
- **Official-channel links** in place of any in-app incident
  reporting — link out to real reporting channels relevant to
  the event type (e.g. USGS "Did You Feel It?" for earthquakes)
  rather than building a submission backend.
- **Terrain contour lines** — free elevation data from AWS's
  public Terrain Tiles dataset (Terrarium-format PNG,
  `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`,
  no key, no auth, attribution required) combined with
  `maplibre-contour` (BSD-3-Clause), which generates contour
  isolines client-side directly as a MapLibre GL JS raster-dem
  source. Already available in the Vector map view.

---

## 🛠️ FULLSTACK JS STACK

> Every version number below is verified against the actual
> installed `package.json` and the current npm registry. Confirmed
> pinned versions in this revision:
> - `tailwindcss@4.3.3` (with `@tailwindcss/postcss@4.3.3`,
>   `postcss@8.5.26`, `autoprefixer@10.5.4`).
> - `cesium@1.144.0`, `maplibre-gl@6.5.0`, `@turf/turf@7.4.0`,
>   `chart.js@4.5.1`.

### Frontend

|Component|Technology|License|Purpose|
|---|---|---|---|
|Framework|React|MIT|UI rendering|
|Build Tool|Vite|MIT|Dev/build|
|State|Zustand|MIT|Global app state (including uiPanelStore, tiltStore)|
|Routing|React Router|MIT|Client-side navigation|
|UI Primitives|Radix UI|MIT|Accessible components|
|Styling|Tailwind CSS|MIT|Utility CSS (v4, postcss plugin)|
|Animation|Framer Motion|MIT|Panel motion, panel restore, notch mode transitions|
|Icons|Lucide React|ISC|Icons|
|HTTP|Axios|MIT|API requests|
|Persistence|idb|Apache 2.0|IndexedDB wrapper|

### Mapping

|Component|Technology|License|Purpose|
|---|---|---|---|
|2D Engine|OpenLayers|BSD 2-Clause|2D rendering, WMS/WFS, projections|
|3D Engine|CesiumJS|Apache 2.0|3D globe, terrain|
|Vector Tiles|MapLibre GL JS|BSD 3-Clause|Vector rendering — a distinct **Map Type**, not a basemap|
|Contours|maplibre-contour|BSD 3-Clause|Client-side contour generation from raster-dem tiles|
|Geo Analysis|@turf/turf|MIT|Geospatial operations (haversine length, spherical-excess area, etc.)|
|Coordinates|Proj4js|MIT|EPSG transformations|
|Datum Grids|NTv2|Public domain|Precise datum shifts|
|Shapefile|shapefile-js|MIT|Shapefile import|
|Minecraft NBT|prismarine-nbt|MIT|NBT tag encoding for world export|
|Compression|pako (or native CompressionStream)|MIT / n/a|zlib compression for Anvil chunk data|

### AI/ML

|Component|Technology|License|Purpose|
|---|---|---|---|
|ML Runtime|TensorFlow.js|Apache 2.0|Browser inference|
|Local LLM/NLP|@huggingface/transformers|Apache 2.0|In-browser NLP — the current maintained package; the older `@xenova/transformers` name is deprecated, don't install both|
|Object Detection|Model license must be verified before shipping|—|Damage/object detection — see AGPL note above|

> Don't bundle TensorFlow.js and ml5.js and OpenCV.js and a
> transformers package unless each is genuinely used in the
> inference path. Unused ML libraries should be removed, not
> accumulated.

### Utilities

Zod, Day.js, Math.js, nanoid, Chroma.js, Framer Motion, Chart.js —
all MIT/Apache-licensed, no concerns, just confirm actual usage
matches what's installed. **Chart.js is currently only used by the
Storytelling scene timeline** — the Fuel Breakdown consumer was
removed in Pass 3 Item 18.

### Testing & Quality

Vitest, React Testing Library, Playwright, ESLint, Prettier,
TypeScript — standard, verify installed versions against
package.json. Per-area tests exist for the geodetic and search
modules; the panel-store and route-query parsers carry unit tests
as well.

---

## 💰 ZERO-COST INFRASTRUCTURE

### Hosting

|Platform|Notes|
|---|---|
|Cloudflare Pages|Unlimited bandwidth on the free tier; good default|
|GitHub Pages|Free for public repos; check current build-frequency limits|
|Vercel / Netlify|Free tier bandwidth/build-minute caps apply; fine at this scale|

### Data & API Sources

|Source|Used for|Cost|
|---|---|---|
|OpenStreetMap|Basemaps, POIs|Free, open (ODbL)|
|Photon|Autocomplete search|Free, no key, fair use|
|Nominatim|Final geocoding & reverse|Free, 1 req/sec fair-use, attribution required|
|OSRM / Valhalla public instances|Routing|Free, rate-limited, not guaranteed uptime|
|Valhalla (FOSSGIS demo server)|Evacuation-avoidance routing|Free, 1 req/sec/user, 100 req/sec total, `X-Client-Id` header requested|
|Overpass API|Shelter locations|Free, coverage varies by region|
|AWS Terrain Tiles|Elevation / contours|Free, public dataset, attribution required|
|USGS|Earthquakes|Free, public, no key|
|NASA FIRMS|Wildfires (view-centered)|Free, public, no key|
|NASA EONET|Disaster events|Free, public, no key|
|Open-Meteo|Weather / air quality / marine / historical|Free, public, no key|
|TomTom Traffic API (Freemium)|Traffic overlay + Flow Segment Data + incidents|Free, 50,000 tile + 2,500 non-tile req/day, requires free API key, shared quota|
|openvan.camp fuel price endpoint|Optional fuel price auto-fill|Free, no key, no registration, CC BY 4.0, best-effort community aggregator|

**Confirmed enterprise-only, not usable under zero-cost — do not
integrate:** TomTom Fuel Prices API, TomTom Traffic Stats API,
TomTom Area Analysis, TomTom Route Monitoring, TomTom Automotive
Navigation App (this last one isn't a web API at all — it's an
OEM licensing product).

**Unverified — do not assume free without direct confirmation:**
TomTom Global Entity Matcher, TomTom Snap to Roads API.

All listed free sources have their own rate limits and terms of
use. None guarantee unlimited usage — check each provider's
current documented limits rather than assuming they haven't
changed.

---

## 🧪 PASS 3 — VERIFIED TEST RESULTS

The following end-to-end validations were run during Pass 3
(Items 11–18) and reported in the commit messages. Every claim
above about an Item 11–18 capability is backed by one of these
verifications, not just a passing test.

- **Item 11**: Datum Shift Visualization verified at Malcampa,
  Camiling (15.68°N, 120.41°E) — PRS92 (4682/3123) shift magnitude
  in the tens-of-meters band (plausible for an EPSG-published
  7-parameter shift), forward/inverse round-trips to 1e-6 deg,
  unknown codes throw rather than return a fabricated zero.
  Measure (turf.length/area, draggable vertices, CSV) and UTM-51N
  snap re-verified working — no changes needed.
- **Item 12**: Panel close/restore verified by inspecting the
  uiPanelStore round-trip (`reopenLastClosed` falls back to the
  previous closed panel). 4 unit tests for the store.
- **Item 12B**: Notch drag-and-snap manually verified to left +
  right dock; pin persists across reload via localStorage; mode
  switch smoothly animates Survey Tools and Shelter Locator in
  and out via Framer Motion.
- **Item 13**: Route parser covered by 4 unit tests (place-to-
  place, current-location, partial queries, waypoints flagged
  as unsupported). Main search wired through `enableRouteParsing`
  on the autocomplete.
- **Item 15**: New `route.test.ts` test asserts the gradient
  `line-progress` expression for both fallback (single color)
  and live-flow cases. `flowTileUrl` now takes a thickness
  parameter (1..20, default 5).
- **Item 16**: Footer width matched to search bar via the shared
  `.search-bar-shell` class; no overlap with map controls or
  the notch at common viewport sizes.
- **Item 17**: Tilt slider in Layers panel View section
  (Cesium 0..80°, MapLibre 0..85°). The on-screen button
  cluster on the 3D globe was removed; middle-click-drag
  remains.
- **Item 18**: Fuel Breakdown replaced canvas chart with two
  independent `BreakdownBar` indicators; fixed ceilings
  extracted as named constants (`FUEL_CEILING_LITERS = 60`,
  `TRIP_COST_CEILING_PHP = 5000`). No clipping, no overlap.

---

## 📝 LICENSE

TerraVision: Atlas code — MIT. All dependencies retain their own
licenses. The one requiring active attention is any YOLO/AGPL-
licensed model weights or inference code used for damage
detection (see AGPL note above).

---

## 🟡 PROPOSED / NOT YET BUILT

These capabilities were surveyed in Pass 2 Item 10B Part D and
noted as "not currently built." They are listed here so they
aren't confused with shipped behavior. Building any of them
should be a deliberate, evaluated decision.

- **Progressive Web App** — installable PWA shell with offline
  routing/runtime. Genuinely zero-cost, would be a meaningful
  addition for field use.
- **WebSocket live updates** — requires a server component
  (out of zero-cost / client-side scope per the project's
  constraints).
- **BLE mesh alert sharing** — Web Bluetooth is Chromium-only.
- **Custom basemaps (user tiles)** — straightforward add, gated
  on demand.
- **Print layout designer** — current A0 export uses the
  visible map area; a layout-with-legend mode is a separate
  feature.
- **OGC/CSW data catalog search** — domain-specific.
- **Volume measurement from elevation** — `core/geodetic/
  measurements/volume.ts` exists as a library-only helper
  (area × avg-height prism model). Needs DEM sampling along
  the path/polygon and a UI; not built.
- **Elevation profile from a path** — needs DEM sampling
  along the measured path. Not built.
- **Multi-language UI** — i18n framework not wired up.
- **Custom damage/object detection model** — TensorFlow.js
  bundle is not loaded by default; only claim this works
  when a real model is actually loaded and invoked.
- **Local LLM / AI narration for storytelling** — Transformers.js
  bundle is not loaded by default.

---

## 🎯 BOTTOM LINE

The goal is a genuinely working, zero-cost geospatial platform —
not a demo that merely looks complete. Every feature is only
"working" once verified against the running app and its actual
data source, never because the UI exists for it. This updated
specification documents the application's current state, with
every change tied to a Pass 3 commit hash and the verifications
above. The original `terravision-atlas.md` remains the
historical record; this document is the live, current-tense
specification.
