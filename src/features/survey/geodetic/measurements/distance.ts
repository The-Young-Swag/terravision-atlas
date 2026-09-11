// Geodesic distance between picked map points. Uses turf's haversine
// length so the 2D and Vector maps report identical numbers for the same
// two points (OpenLayers' own ellipsoidal length differs in the 4th digit,
// which would look like a bug).

import * as turf from '@turf/turf';

export function geodesicKilometers(points: [number, number][]): number | null {
  if (points.length < 2) return null;
  return turf.length(turf.lineString(points.map(([lon, lat]) => [lon, lat])), { units: 'kilometers' });
}

export function formatDistanceKilometers(km: number | null): string {
  if (km === null) return 'Click two points on the map';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

/** Initial bearing from the first point to the second, 0–360° clockwise from north. */
export function bearingDegrees(from: [number, number], to: [number, number]): number {
  const raw = turf.bearing(turf.point(from), turf.point(to));
  return (raw + 360) % 360;
}

export function formatBearing(degrees: number): string {
  return `${String(Math.round(degrees)).padStart(3, '0')}°`;
}
