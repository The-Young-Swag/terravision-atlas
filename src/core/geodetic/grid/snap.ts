// Snap-to-grid: rounds map coordinates to a resolution-adaptive graticule
// step so positions visibly land on grid lines at any zoom. Step targets
// ~20 screen pixels, rounded to a 1/2/5 series value for clean readouts.

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
