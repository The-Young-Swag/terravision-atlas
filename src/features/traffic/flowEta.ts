import axios from 'axios';

// Traffic-aware ETA: deterministic arithmetic on real TomTom Flow Segment
// Data — explicitly NOT AI/ML. For a computed route we sample current vs.
// free-flow speed at evenly spaced points, average the slowdown, and scale
// the Valhalla base duration. When Traffic data is unavailable (no key,
// quota exhausted, fetch failed) callers fall back to the base duration —
// routing is never blocked on Traffic availability.
//
// Endpoint (same TomTom Traffic product + key as the flow tiles/incidents,
// no new vendor): flowSegmentData/absolute returns currentSpeed and
// freeFlowSpeed for the segment containing the given point.
// Quota discipline: at most MAX_SAMPLES requests per route, responses
// cached by rounded coordinate with a TTL, only called on explicit route
// requests while the traffic status is ok.

const FLOW_SEGMENT_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const SEGMENT_TTL_MS = 120000;
export const MAX_FLOW_SAMPLES = 8;

export interface FlowSegment {
  currentSpeed: number;
  freeFlowSpeed: number;
}

interface CachedSegment {
  fetchedAt: number;
  segment: FlowSegment | null;
}

const segmentCache = new Map<string, CachedSegment>();

function segmentCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

interface FlowSegmentResponse {
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
  };
}

/** Pure response transform, exported for unit tests. */
export function parseFlowSegment(data: FlowSegmentResponse): FlowSegment | null {
  const currentSpeed = data.flowSegmentData?.currentSpeed;
  const freeFlowSpeed = data.flowSegmentData?.freeFlowSpeed;
  if (typeof currentSpeed !== 'number' || typeof freeFlowSpeed !== 'number') return null;
  if (!Number.isFinite(currentSpeed) || !Number.isFinite(freeFlowSpeed) || freeFlowSpeed <= 0) return null;
  return { currentSpeed: Math.max(0, currentSpeed), freeFlowSpeed };
}

/**
 * Pure slowdown combination, exported for unit tests. Each ratio is
 * current/free-flow speed clamped to [0.2, 1] (a segment never speeds the
 * trip up, and a single near-stopped segment cannot dominate); the factor
 * is the mean slowdown clamped to [1, 3].
 */
export function combineSpeedRatios(ratios: number[]): number {
  if (ratios.length === 0) return 1;
  const clamped = ratios.map((r) => Math.min(1, Math.max(0.2, r)));
  const mean = clamped.reduce((sum, r) => sum + r, 0) / clamped.length;
  return Math.min(3, Math.max(1, 1 / mean));
}

async function fetchFlowSegment(lat: number, lon: number, key: string): Promise<FlowSegment | null> {
  const cacheKey = segmentCacheKey(lat, lon);
  const cached = segmentCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SEGMENT_TTL_MS) {
    return cached.segment;
  }
  try {
    const params = new URLSearchParams({ key, point: `${lat},${lon}` });
    const { data } = await axios.get<FlowSegmentResponse>(`${FLOW_SEGMENT_URL}?${params}`, { timeout: 10000 });
    const segment = parseFlowSegment(data);
    segmentCache.set(cacheKey, { fetchedAt: Date.now(), segment });
    return segment;
  } catch {
    return null;
  }
}

export interface TrafficEta {
  adjustedMinutes: number;
  factor: number;
  samples: number;
}

/**
 * Sample flow speeds along a route path and scale the base duration.
 * Returns null when no usable samples exist — callers then show the base
 * duration unchanged.
 */
export async function trafficAdjustedMinutes(
  path: { lon: number; lat: number }[],
  baseMinutes: number,
  key: string,
): Promise<TrafficEta | null> {
  if (path.length < 2 || !Number.isFinite(baseMinutes) || baseMinutes <= 0) return null;
  const count = Math.min(MAX_FLOW_SAMPLES, path.length);
  const step = (path.length - 1) / Math.max(1, count - 1);
  const samples: FlowSegment[] = [];
  for (let i = 0; i < count; i++) {
    const point = path[Math.round(i * step)];
    if (!point) continue;
    const segment = await fetchFlowSegment(point.lat, point.lon, key);
    if (segment) samples.push(segment);
  }
  if (samples.length === 0) return null;
  const factor = combineSpeedRatios(samples.map((s) => s.currentSpeed / s.freeFlowSpeed));
  return { adjustedMinutes: baseMinutes * factor, factor, samples: samples.length };
}
