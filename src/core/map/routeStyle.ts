// Shared route-rendering treatment for General Navigation, Evacuation
// Routing, and the Jogging Loop — one style, not per-feature styling.
// The TomTom Traffic Flow legend uses gray/red/yellow/green for absolute
// speed, so the route line uses brand blue (#209dd7, from the app palette),
// a hue outside that legend that can never be misread as a traffic segment.
// Verdict semantics (avoids vs enters an area) live in the panel chip and
// result card — never in the line color.

export const ROUTE_LINE_COLOR = '#209dd7';
export const ROUTE_CASING_COLOR = '#ffffff';
export const ROUTE_CASING_WIDTH = 7;
export const ROUTE_LINE_WIDTH = 4;

/** Traffic flow opacity while a route is displayed (dimmed, never hidden). */
export const TRAFFIC_FLOW_DIM_OPACITY = 0.45;
/** Normal traffic flow opacity (must match the layer defaults). */
export const TRAFFIC_FLOW_FULL_OPACITY = 1;
export const TRAFFIC_FLOW_FULL_OPACITY_ML = 0.85;
