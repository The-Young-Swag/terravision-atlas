import type { FlowSample } from './flowEta';

// TomTom Traffic Flow absolute-speed bands, verbatim from the Raster Flow
// Tiles documentation (see TrafficLegend): color reflects measured absolute
// speed, not a relative slowdown. Single source of truth for the app's
// traffic-status meaning — the legend and the route traffic visualization
// both consume these, so the route reuses the existing visual language
// instead of inventing a new one.
export const STOPPED_MAX_KMH = 1;
export const SLOW_MAX_KMH = 60;
export const MODERATE_MAX_KMH = 120;

export interface FlowBand {
  color: string;
  label: string;
}

export const FLOW_BANDS: FlowBand[] = [
  { color: '#777777', label: 'Stopped · <1 km/h' },
  { color: '#FF2323', label: 'Slow · 1–60 km/h' },
  { color: '#FFFF37', label: 'Moderate · 60–120 km/h' },
  { color: '#2BC82B', label: 'Fast · ≥120 km/h' },
];

/** Map a measured absolute speed to its legend-band color. */
export function flowStatusColor(currentSpeedKmh: number): string {
  if (currentSpeedKmh < STOPPED_MAX_KMH) return FLOW_BANDS[0].color;
  if (currentSpeedKmh < SLOW_MAX_KMH) return FLOW_BANDS[1].color;
  if (currentSpeedKmh < MODERATE_MAX_KMH) return FLOW_BANDS[2].color;
  return FLOW_BANDS[3].color;
}

export interface RouteStatusSegment {
  /** Inclusive path indices delimiting the segment. */
  fromIndex: number;
  toIndex: number;
  color: string;
}

/**
 * Split a route path into status-colored segments from evenly spaced flow
 * samples. Each segment runs from one sample to the next (the last reaches
 * the path end) and takes the leading sample's band color — the same real
 * samples that drive the traffic-aware ETA, so no extra requests are made.
 * Returns [] when no usable samples exist; callers then keep the plain
 * blue route fallback.
 */
export function routeStatusSegments(pathLength: number, samples: FlowSample[]): RouteStatusSegment[] {
  if (pathLength < 2 || samples.length === 0) return [];
  const ordered = [...samples]
    .filter((s) => Number.isInteger(s.pathIndex) && s.pathIndex >= 0 && s.pathIndex < pathLength)
    .sort((a, b) => a.pathIndex - b.pathIndex);
  if (ordered.length === 0) return [];
  return ordered.map((sample, i) => ({
    fromIndex: sample.pathIndex,
    toIndex: i + 1 < ordered.length ? ordered[i + 1].pathIndex : pathLength - 1,
    color: flowStatusColor(sample.currentSpeed),
  }));
}
