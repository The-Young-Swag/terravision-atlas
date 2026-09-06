// Shared route-rendering treatment for General Navigation, Evacuation
// Routing, and the Jogging Loop — one style, not per-feature styling.
//
// When live TomTom flow samples exist for a route, the line is split into
// segments colored by the shared flow-status bands (see flowStatus.ts) so
// the route itself communicates traffic conditions. This intentionally
// supersedes the earlier all-blue rule for the data-available case: the
// route's identity then comes from the continuous ribbon, the dark casing,
// the direction chevrons, the waypoint markers, and topmost z-order — never
// from verdict semantics, which stay in the panel chip. With no traffic
// data the route falls back to the brand-blue line below (#209dd7, a hue
// outside the traffic-speed palette) with a white casing.

export const ROUTE_LINE_COLOR = '#209dd7';
export const ROUTE_CASING_COLOR = '#ffffff';
export const ROUTE_CASING_WIDTH = 7;
export const ROUTE_LINE_WIDTH = 4;

/** Dark casing under traffic-status route segments (keeps bright cores legible). */
export const ROUTE_STATUS_CASING_COLOR = '#0b3d55';

/** Traffic flow opacity while a route is displayed (dimmed, never hidden). */
export const TRAFFIC_FLOW_DIM_OPACITY = 0.35;
/** Normal traffic flow opacity (must match the layer defaults). */
export const TRAFFIC_FLOW_FULL_OPACITY = 0.8;
export const TRAFFIC_FLOW_FULL_OPACITY_ML = 0.7;
