import * as Cesium from 'cesium';

// Minimal Cesium viewer factory — zero-cost, no Ion token required for OSM.
// Uses OpenStreetMap imagery and WGS84 ellipsoid terrain (no external terrain server).

export interface CreateCesiumOptions {
  container: HTMLElement;
  center: [number, number]; // [lon, lat]
  zoom: number; // approximate, converted to height
}

// Convert zoom level to camera height (approximate, for 2D-like zoom feel)
function zoomToHeight(zoom: number): number {
  // At zoom 11 ~ 30km, zoom 5 ~ 1000km, zoom 15 ~ 2km
  const base = 40075016.686; // earth circumference
  const height = base / Math.pow(2, zoom);
  return Math.max(500, Math.min(20000000, height * 1.2));
}

export async function createCesiumViewer(options: CreateCesiumOptions): Promise<Cesium.Viewer> {
  const { container, center, zoom } = options;

  // Don't require Ion for base functionality
  // If a token is provided via env, it will be used; otherwise OSM is used.
  try {
    // @ts-expect-error — Cesium types allow string | undefined
    Cesium.Ion.defaultAccessToken = undefined;
  } catch {
    // ignore
  }

  const viewer = new Cesium.Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: false,
    shouldAnimate: true,
  });

  // Use OSM imagery and ellipsoid terrain — no Ion token, zero-cost
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
      url: 'https://a.tile.openstreetmap.org/',
    }),
  );
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

  // Clean up Cesium's default UI — we use our own glass panels
  const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
  if (creditContainer) creditContainer.style.display = 'none';

  viewer.scene.globe.enableLighting = false;
  viewer.scene.fog.enabled = true;
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = true;
  }

  // Fly to initial center
  const [lon, lat] = center;
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, zoomToHeight(zoom)),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });

  return viewer;
}

export function flyToCesium(
  viewer: Cesium.Viewer,
  center: [number, number],
  zoom: number,
): void {
  const [lon, lat] = center;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, zoomToHeight(zoom)),
    orientation: {
      heading: viewer.camera.heading,
      pitch: viewer.camera.pitch,
      roll: viewer.camera.roll,
    },
    duration: 1.2,
    easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
  });
}
