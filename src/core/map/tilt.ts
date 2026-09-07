// Camera tilt control surface for the Layers panel "View" section (Item 17).
// Reusable hooks that read the current pitch from whichever map instance is
// active and write it back via the same flyTo/lookAt path the existing
// middle-click-drag gesture already exercises, so the slider stays in
// sync with the gesture in both directions.

import * as Cesium from 'cesium';
import type { Map as MapLibreMap } from 'maplibre-gl';

export const TILT_MAX_DEGREES = 80;
export const TILT_MIN_DEGREES = 0;

/** Cesium: 0° tilt = top-down (camera.pitch = -90°), 80° = nearly horizon. */
export function cesiumTiltDegrees(viewer: Cesium.Viewer | null): number {
  if (!viewer || viewer.isDestroyed()) return 0;
  const radians = viewer.camera.pitch;
  return Math.max(0, Math.min(TILT_MAX_DEGREES, -Cesium.Math.toDegrees(radians) - 10));
}

export function setCesiumTiltDegrees(viewer: Cesium.Viewer | null, degrees: number): void {
  if (!viewer || viewer.isDestroyed()) return;
  const clamped = Math.max(0, Math.min(TILT_MAX_DEGREES, degrees));
  const radians = Cesium.Math.toRadians(-(clamped + 10));
  const pos = viewer.camera.positionCartographic;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
    orientation: { heading: viewer.camera.heading, pitch: radians, roll: 0 },
    duration: 0.3,
  });
}

export function resetCesiumTiltToTopDown(viewer: Cesium.Viewer | null): void {
  if (!viewer || viewer.isDestroyed()) return;
  const pos = viewer.camera.positionCartographic;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
    orientation: { heading: viewer.camera.heading, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
    duration: 0.6,
  });
}

/** MapLibre: 0 pitch = top-down, 85° = the documented max-pitch cap. */
export function maplibreTiltDegrees(map: MapLibreMap | null): number {
  if (!map) return 0;
  return Math.max(0, Math.min(TILT_MAX_DEGREES, map.getPitch()));
}

export function setMapLibreTiltDegrees(map: MapLibreMap | null, degrees: number): void {
  if (!map) return;
  const clamped = Math.max(0, Math.min(TILT_MAX_DEGREES, degrees));
  map.easeTo({ pitch: clamped, duration: 250 });
}

export function resetMapLibreTiltToTopDown(map: MapLibreMap | null): void {
  if (!map) return;
  map.easeTo({ pitch: 0, duration: 350 });
}
