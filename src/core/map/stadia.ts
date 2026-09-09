// Stadia Maps dark basemap wiring (zero-cost free-tier key).
// - The key lives in .env as VITE_STADIA_API_KEY (see .env.example) and is
//   baked in at build time via Vite's import.meta.env mechanism — the same
//   pattern as VITE_TOMTOM_API_KEY / VITE_CESIUM_ION_TOKEN. Never hardcode.
// - Stadia returns HTTP 401 for any non-localhost referer without
//   ?api_key=, so the key is appended to every Dark tile URL.
// - No key configured (fresh checkout without .env)? Fall back to the
//   keyless Esri Dark Gray canvas so Dark still renders instead of
//   blanking — same fallback in all three renderers.

export function stadiaApiKey(): string | null {
  const key = import.meta.env.VITE_STADIA_API_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}

const STADIA_ATTRIBUTION = '© Stadia Maps, © OpenMapTiles, © OpenStreetMap contributors';
const ESRI_FALLBACK_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community';
const ESRI_FALLBACK_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

export interface DarkSource {
  /** Plain tile URL template ({z}/{x}/{y}, no retina placeholder). */
  url: string;
  attribution: string;
  /** Esri fallback serves uniform placeholder tiles deeper than 16. */
  maxZoom: number;
  /** True when rendering genuine Stadia tiles (key configured). */
  isStadia: boolean;
}

/** Plain-URL Dark source for MapLibre / Cesium (no retina placeholder). */
export function darkTileSource(): DarkSource {
  const key = stadiaApiKey();
  if (key) {
    return {
      url: `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${key}`,
      attribution: STADIA_ATTRIBUTION,
      maxZoom: 20,
      isStadia: true,
    };
  }
  return { url: ESRI_FALLBACK_URL, attribution: ESRI_FALLBACK_ATTRIBUTION, maxZoom: 16, isStadia: false };
}
