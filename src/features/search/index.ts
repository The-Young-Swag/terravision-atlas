// Public API of the search feature: forward/reverse geocoding (one
// shared Nominatim throttle behind all of it), Photon autocomplete,
// the route-query parser, and the location types. Import search
// behavior through this index only — never the modules directly.
export {
  searchPhoton,
  geocodeNominatim,
  reverseNominatim,
  respectNominatimRateLimit,
  type GeocodedPlace,
  type PlaceSuggestion,
} from './geocode';
export {
  reverseGeocode,
  batchReverseGeocode,
  getCachedHierarchy,
  deriveHierarchyFromTitle,
  type LocationHierarchy,
} from './reverseGeocode';
export {
  parseRouteQuery,
  endpointLabel,
  getCurrentPositionOnce,
  type RouteEndpoint,
} from './routeQuery';
