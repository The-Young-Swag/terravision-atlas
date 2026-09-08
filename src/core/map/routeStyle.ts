// Shared route-rendering treatment for General Navigation, Evacuation
// Routing, and the Jogging Loop — one style, not per-feature styling.
//
// The route is a SOLID BRAND-BLUE CORE LINE (#209dd7) at all times.
// When live TomTom flow samples exist, the CASING (outline) is colored
// by the shared flow-status bands so the route communicates traffic
// conditions via its OUTLINE, not its core. The traffic flow raster stays
// at FULL OPACITY underneath so both layers are visible simultaneously.
// With no traffic data the route is brand-blue with a white casing.
export const ROUTE_LINE_COLOR = '#209dd7';
export const ROUTE_CASING_COLOR = '#ffffff';
export const ROUTE_CASING_WIDTH = 7;
export const ROUTE_LINE_WIDTH = 4;

/** Traffic flow opacity — always full, never dimmed. */
export const TRAFFIC_FLOW_OPACITY = 0.8;
export const TRAFFIC_FLOW_OPACITY_ML = 0.7;
