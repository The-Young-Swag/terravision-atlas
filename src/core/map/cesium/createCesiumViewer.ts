import * as Cesium from 'cesium';

// Cesium viewer factory with real-world terrain via Cesium Ion.
// - Imagery stays keyless (OpenStreetMap here; NASA GIBS layers are added
//   on top by the imagery/basemaps architecture) so the Ion token quota is
//   spent only on the elevation mesh.
// - Elevation comes from Cesium World Terrain (Cesium.createWorldTerrainAsync,
//   verified against the installed Cesium 1.145 typings) when a token is
//   present in .env as VITE_CESIUM_ION_TOKEN (see .env.example).
// - Failures are reported honestly via TerrainStatus — the globe never
//   silently falls back to flat terrain without telling the user.

export interface CreateCesiumOptions {
  container: HTMLElement;
  center: [number, number]; // [lon, lat]
  zoom: number; // approximate, converted to height
}

export type TerrainStatus =
  | { kind: 'ion' }
  | { kind: 'no-token' }
  | { kind: 'error'; message: string };

export interface CreatedCesiumViewer {
  viewer: Cesium.Viewer;
  terrain: TerrainStatus;
}

/** Ion token for terrain, read from .env via Vite's import.meta.env mechanism. */
export function cesiumIonToken(): string | null {
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
  return token && token.length > 0 ? token : null;
}

// Convert zoom level to camera height (approximate, for 2D-like zoom feel)
function zoomToHeight(zoom: number): number {
  // At zoom 11 ~ 30km, zoom 5 ~ 1000km, zoom 15 ~ 2km
  const base = 40075016.686; // earth circumference
  const height = base / Math.pow(2, zoom);
  return Math.max(500, Math.min(20000000, height * 1.2));
}

export async function createCesiumViewer(options: CreateCesiumOptions): Promise<CreatedCesiumViewer> {
  const { container, center, zoom } = options;

  const token = cesiumIonToken();
  if (token) {
    Cesium.Ion.defaultAccessToken = token;
  } else {
    try {
      // @ts-expect-error — Cesium types allow string | undefined
      Cesium.Ion.defaultAccessToken = undefined;
    } catch {
      // ignore
    }
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

  // Use OSM imagery (keyless). Terrain comes from Cesium Ion when a
  // token is configured; otherwise the globe is flat AND the UI says so.
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
      url: 'https://a.tile.openstreetmap.org/',
    }),
  );

  let terrain: TerrainStatus;
  if (!token) {
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    terrain = { kind: 'no-token' };
  } else {
    try {
      viewer.terrainProvider = await Cesium.createWorldTerrainAsync();
      terrain = { kind: 'ion' };
    } catch (error) {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Cesium] Cesium World Terrain failed, using flat ellipsoid', error);
      terrain = { kind: 'error', message };
    }
  }

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

  return { viewer, terrain };
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
