// Volume measurement — estimates cut/fill volume from a polygon and elevation
// Uses a simple prism model: volume = area * average height
// For more accurate results, integrate with a DEM source (e.g., Mapbox Terrain-RGB, Terrarium)

import * as turf from '@turf/turf';

export interface VolumeResult {
  areaSqMeters: number;
  averageHeightMeters: number;
  volumeCubicMeters: number;
  volumeText: string;
}

// Calculate area of a GeoJSON polygon and estimate volume
export function calculateVolume(
  polygon: GeoJSON.Feature<GeoJSON.Polygon>,
  averageHeightMeters: number,
): VolumeResult {
  const area = turf.area(polygon);
  const volume = area * averageHeightMeters;

  return {
    areaSqMeters: area,
    averageHeightMeters,
    volumeCubicMeters: volume,
    volumeText: formatVolume(volume),
  };
}

function formatVolume(cubicMeters: number): string {
  if (cubicMeters < 1000) return `${cubicMeters.toFixed(1)} m³`;
  if (cubicMeters < 1_000_000) return `${(cubicMeters / 1000).toFixed(1)} K m³`;
  return `${(cubicMeters / 1_000_000).toFixed(2)} M m³`;
}

// Estimate volume from an array of elevation samples within a polygon
// Each sample is a point with elevation in meters
export function estimateVolumeFromSamples(
  polygon: GeoJSON.Feature<GeoJSON.Polygon>,
  samples: Array<{ elevation: number }>,
): VolumeResult {
  if (samples.length === 0) {
    return calculateVolume(polygon, 0);
  }
  const avgHeight = samples.reduce((sum, s) => sum + s.elevation, 0) / samples.length;
  return calculateVolume(polygon, avgHeight);
}
