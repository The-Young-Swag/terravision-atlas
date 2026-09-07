import * as turf from '@turf/turf';

// Geodesic area of the polygon through the picked vertices (closed
// implicitly — the first point need not be repeated). Uses turf.area so
// both map views report identical numbers. Returns null until a polygon
// exists (fewer than three vertices).
export function geodesicAreaSqMeters(points: [number, number][]): number | null {
  if (points.length < 3) return null;
  const ring = [...points.map(([lon, lat]) => [lon, lat]), points[0]];
  return turf.area(turf.polygon([ring]));
}

const SQ_METERS_PER_SQ_KM = 1_000_000;

export function formatAreaSqMeters(sqMeters: number | null): string {
  if (sqMeters === null) return 'Click three or more points, then close the shape';
  if (sqMeters < SQ_METERS_PER_SQ_KM) return `${Math.round(sqMeters).toLocaleString('en-US')} m²`;
  return `${(sqMeters / SQ_METERS_PER_SQ_KM).toFixed(2)} km²`;
}
