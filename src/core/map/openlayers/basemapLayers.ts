import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import StadiaMaps from 'ol/source/StadiaMaps';
import type { BasemapId, StreetsSourceId } from '../../../stores/mapStore';
import { darkTileSource, stadiaApiKey } from '../stadia';
import { streetsSourceMeta } from '../streets';
import {
  GIBS_MAX_ZOOM,
  gibsBestDate,
  gibsLayerMeta,
  gibsTileUrlTemplate,
  satelliteAttribution,
  type SatelliteSourceId,
} from '../gibs';

// Factory for the four TerraVision basemaps. Sources are cached per
// basemap/satelliteSource/streetsSource so switching back to an
// already-loaded basemap reuses its tile cache instead of refetching
// (network-bound fix).
const basemapCache = new Map<string, TileLayer<XYZ | OSM>>();

function basemapCacheKey(
  basemap: BasemapId,
  satelliteSource: SatelliteSourceId,
  streetsSource: StreetsSourceId,
  crossOrigin?: string,
): string {
  return `${basemap}:${satelliteSource}:${streetsSource}:${crossOrigin ?? ''}`;
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
  streetsSource: StreetsSourceId = 'osm',
): TileLayer<XYZ | OSM> {
  const cacheKey = basemapCacheKey(basemap, satelliteSource, streetsSource, crossOrigin);
  const cached = basemapCache.get(cacheKey);
  if (cached) return cached;
  switch (basemap) {
    case 'streets': {
      // Default OpenStreetMap standard style (keyless); Esri World Street
      // Map alternate — see core/map/streets.ts.
      const meta = streetsSourceMeta(streetsSource);
      const layer =
        streetsSource === 'osm'
          ? new TileLayer({
              source: new OSM({ attributions: meta.attribution, crossOrigin }),
              properties: { basemap },
            })
          : new TileLayer({
              source: new XYZ({
                url: meta.url,
                maxZoom: meta.maxZoom,
                attributions: meta.attribution,
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
      // Stadia alidade_smooth_dark via ol's StadiaMaps source, which bakes
      // the @2x retina suffix and ?api_key= into the URL at construction —
      // a hand-rolled {r} placeholder is NOT substituted by XYZ and 404s.
      // Keyless Esri fallback when VITE_STADIA_API_KEY is unconfigured.
      const key = stadiaApiKey();
      const layer =
        key !== null
          ? new TileLayer({
              source: new StadiaMaps({
                layer: 'alidade_smooth_dark',
                apiKey: key,
                // StadiaMaps hardcodes crossOrigin 'anonymous', which also
                // satisfies the export compositor's pixel-access need.
                retina: window.devicePixelRatio > 1,
              }),
              properties: { basemap },
            })
          : new TileLayer({
              source: new XYZ({
                url: darkTileSource().url,
                maxZoom: darkTileSource().maxZoom,
                attributions: darkTileSource().attribution,
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
