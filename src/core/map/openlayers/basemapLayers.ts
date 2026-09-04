import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import type { BasemapId } from '../../../stores/mapStore';

// Factory for the four TerraVision basemaps.
// All sources are zero-cost, public OSM/Esri/Carto tiles — no API keys.
// Pass crossOrigin 'anonymous' when callers need pixel access (e.g. the A0
// export compositor): XYZ defaults to opaque tiles, which taint canvases.
// The live map keeps the default so a server without CORS headers can never
// blank the visible map.
export function createBasemapLayer(basemap: BasemapId, crossOrigin?: 'anonymous'): TileLayer<XYZ | OSM> {
  switch (basemap) {
    case 'streets':
      return new TileLayer({
        source: new OSM(),
        properties: { basemap },
      });

    case 'satellite':
      // Esri World Imagery — satellite + low-zoom ocean
      return new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
          crossOrigin,
        }),
        properties: { basemap },
      });

    case 'terrain':
      // OpenTopoMap — terrain with contours
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
      // Grayscale OSM — dark-friendly, zero-cost, no API key (Carto now requires key)
      return new TileLayer({
        source: new XYZ({
          url: 'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
          maxZoom: 18,
          attributions: '© OpenStreetMap contributors, Tiles © Wikimedia',
          crossOrigin,
        }),
        properties: { basemap },
      });

    default:
      return new TileLayer({ source: new OSM(), properties: { basemap } });
  }
}
