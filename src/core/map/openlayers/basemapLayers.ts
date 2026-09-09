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
  switch (basemap) {
    case 'streets':
      return new TileLayer({
        source: new OSM(),
        properties: { basemap },
      });

    case 'satellite': {
      const isGibs = satelliteSource !== 'esri';
      const url = isGibs
        ? gibsTileUrlTemplate(gibsLayerMeta(satelliteSource).product, gibsBestDate())
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      return new TileLayer({
        source: new XYZ({
          url,
          maxZoom: isGibs ? GIBS_MAX_ZOOM : 19,
          attributions: satelliteAttribution(satelliteSource),
          crossOrigin,
        }),
        properties: { basemap },
      });
    }

    case 'terrain':
      return new TileLayer({
        source: new XYZ({
          url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
          maxZoom: 17,
          attributions: '© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors',
          crossOrigin,
        }),
        properties: { basemap },
      });

    case 'dark':
      return new TileLayer({
        source: new XYZ({
          url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
          maxZoom: 20,
          attributions: '© Stadia Maps, © OpenMapTiles, © OpenStreetMap contributors',
          crossOrigin,
        }),
        properties: { basemap },
      });

    default:
      return new TileLayer({ source: new OSM(), properties: { basemap } });
  }
}
