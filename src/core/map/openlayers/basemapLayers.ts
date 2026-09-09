import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import type { BasemapId } from '../../../stores/mapStore';
import {
  GIBS_MAX_ZOOM,
  gibsBestDate,
  gibsLayerMeta,
  gibsTileUrlTemplate,
  satelliteAttribution,
  type SatelliteSourceId,
} from '../gibs';

// Factory for the four TerraVision basemaps. Sources are cached per
// basemap/satelliteSource so switching back to an already-loaded basemap
// reuses its tile cache instead of refetching (network-bound fix).
const basemapCache = new Map<string, TileLayer<XYZ | OSM>>();

function basemapCacheKey(basemap: BasemapId, satelliteSource: SatelliteSourceId, crossOrigin?: string): string {
  return `${basemap}:${satelliteSource}:${crossOrigin ?? ''}`;
}

// Factory for the four TerraVision basemaps.
// The 'satellite' slot renders the selected satellite source: Esri World
// Imagery (default) or one of the NASA GIBS layers (see core/map/gibs.ts).
// All sources are zero-cost and keyless — no API keys.
// Pass crossOrigin 'anonymous' when callers need pixel access (e.g. the A0
// export compositor): XYZ defaults to opaque tiles, which taint canvases.
// The live map keeps the default so a server without CORS headers can never
// blank the visible map.
export function createBasemapLayer(
  basemap: BasemapId,
  crossOrigin?: 'anonymous',
  satelliteSource: SatelliteSourceId = 'esri',
): TileLayer<XYZ | OSM> {
  const cacheKey = basemapCacheKey(basemap, satelliteSource, crossOrigin);
  const cached = basemapCache.get(cacheKey);
  if (cached) return cached;
  switch (basemap) {
    case 'streets': {
      // Esri World Street Map (keyless, CORS-enabled). Previously OSM
      // standard tiles, which are unreachable from some networks and
      // throttle heavy app use per the OSM tile usage policy.
      const layer = new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attributions:
            'Tiles © Esri — Source: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community',
          crossOrigin,
        }),
        properties: { basemap },
      });
      basemapCache.set(cacheKey, layer);
      return layer;
    }

    case 'satellite': {
      const isGibs = satelliteSource !== 'esri';
      const url = isGibs
        ? gibsTileUrlTemplate(gibsLayerMeta(satelliteSource).product, gibsBestDate())
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      const layer = new TileLayer({
        source: new XYZ({
          url,
          maxZoom: isGibs ? GIBS_MAX_ZOOM : 19,
          attributions: satelliteAttribution(satelliteSource),
          crossOrigin,
        }),
        properties: { basemap },
      });
      basemapCache.set(cacheKey, layer);
      return layer;
    }

    case 'terrain': {
      // Esri World Topographic Map (keyless, CORS-enabled). Previously
      // OpenTopoMap, whose single community render server is too slow for
      // interactive use (multi-second TTFB, throttled concurrency).
      const layer = new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attributions:
            'Tiles © Esri — Source: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community',
          crossOrigin,
        }),
        properties: { basemap },
      });
      basemapCache.set(cacheKey, layer);
      return layer;
    }

    case 'dark': {
      // Esri Dark Gray Canvas (keyless, CORS-enabled). Previously Stadia
      // alidade_smooth_dark, which returns HTTP 401 without an API key for
      // any non-localhost referer — Dark never loaded in production builds.
      // Detail ends around z16 (deeper levels serve uniform tiles), so cap
      // maxZoom at 16 and let the renderers overzoom beyond that.
      const layer = new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 16,
          attributions:
            'Tiles © Esri — Source: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community',
          crossOrigin,
        }),
        properties: { basemap },
      });
      basemapCache.set(cacheKey, layer);
      return layer;
    }

    default: {
      const layer = new TileLayer({ source: new OSM(), properties: { basemap } });
      basemapCache.set(cacheKey, layer);
      return layer;
    }
  }
}
