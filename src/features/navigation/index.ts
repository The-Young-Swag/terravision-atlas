// Public API of the navigation feature: the shared Navigation /
// Evacuation panel, the route store, Valhalla + jogging-loop routing,
// the avoid-zone vocabulary, and the per-engine route/avoid adapters.
// Import through this index only — never the modules directly.
export { EvacuationPanel } from './components/EvacuationPanel';
export { useRouteStore, type EvacRoute, type EvacRoutePoint, type EvacPin, type EvacCircle } from './store';
export { TRAVEL_COSTINGS, routeWithOptions, type TravelCosting } from './valhalla';
export { buildJogLoop, jogLoopAsEvacRoute, type Hilliness } from './joggingLoop';
export {
  circleToRing,
  circlePolygon,
  previewCircle,
  evacStep,
  EVAC_STEP_INSTRUCTIONS,
  MIN_AVOID_RADIUS_KM,
} from './avoidZone';
export {
  createRouteLayer,
  createAvoidLayer,
  attachAvoidDraw as attachAvoidDrawOpenLayers,
  renderAvoidCircle as renderAvoidCircleOpenLayers,
  applyAvoidCursor as applyAvoidCursorOpenLayers,
} from './map/openlayers';
export { createEvacPinLayer } from './map/pins';
export { createHikingTrailsLayer } from './map/trails-openlayers';
export { setTrailsVisible } from './map/trails-maplibre';
export {
  setRouteVisible,
  removeRouteLayers,
  ROUTE_SOURCE_ID,
  ROUTE_CASING_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  setAvoidVisible,
  setAvoidPreview,
  attachAvoidDraw as attachAvoidDrawMapLibre,
  applyAvoidCursor as applyAvoidCursorMapLibre,
} from './map/maplibre';
