// Snap-to-grid: rounds map coordinates to a resolution-adaptive graticule
// step so positions visibly land on grid lines at any zoom. Step targets
// ~20 screen pixels, rounded to a 1/2/5 series value for clean readouts.

import { transformCoordinate } from '../projections/epsg';

// Survey grid projection: UTM 51N covers the Philippines operating area
// (including the Malcampa/Camiling validation site) and matches the bundled
// default target projection. Outside zone 51N proj4 still resolves, with
// growing distortion — reported honestly rather than clamped.
export const UTM_GRID_EPSG = 'EPSG:32651';

export function niceGridStepDegrees(resolutionMetersPerPixel: number, centerLat: number): number {
  if (!Number.isFinite(resolutionMetersPerPixel) || resolutionMetersPerPixel <= 0) {
    return 0.001;
  }
  const targetMeters = resolutionMetersPerPixel * 20;
  const targetDegrees = targetMeters / (111320 * Math.cos((centerLat * Math.PI) / 180));
  const power = 10 ** Math.floor(Math.log10(targetDegrees));
  for (const multiple of [1, 2, 5, 10]) {
    if (multiple * power >= targetDegrees) return multiple * power;
  }
  return 10 * power;
}

export function snapLonLat(lon: number, lat: number, stepDegrees: number): { lon: number; lat: number } {
  if (!Number.isFinite(stepDegrees) || stepDegrees <= 0) return { lon, lat };
  return {
    lon: Math.round(lon / stepDegrees) * stepDegrees,
    lat: Math.round(lat / stepDegrees) * stepDegrees,
  };
}

/** 1/2/5-series meter step targeting ~20 screen pixels. */
export function niceMeterStep(metersPerPixel: number): number {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return 10;
  const target = metersPerPixel * 20;
  const power = 10 ** Math.floor(Math.log10(target));
  for (const multiple of [1, 2, 5, 10]) {
    if (multiple * power >= target) return multiple * power;
  }
  return 10 * power;
}

/** Round a lon/lat to the UTM 51N meter grid (project → round → unproject). */
export function snapToUtmGrid(lon: number, lat: number, stepMeters: number): { lon: number; lat: number } {
  if (!Number.isFinite(stepMeters) || stepMeters <= 0) return { lon, lat };
  try {
    const [x, y] = transformCoordinate('EPSG:4326', UTM_GRID_EPSG, [lon, lat]);
    const [slon, slat] = transformCoordinate(UTM_GRID_EPSG, 'EPSG:4326', [
      Math.round(x / stepMeters) * stepMeters,
      Math.round(y / stepMeters) * stepMeters,
    ]);
    if (!Number.isFinite(slon) || !Number.isFinite(slat)) return { lon, lat };
    return { lon: slon, lat: slat };
  } catch {
    return { lon, lat };
  }
}
