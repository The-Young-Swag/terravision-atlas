// MapLibre styles — zero-cost, no API key
// Raster mirrors of the four 2D basemaps (same tile endpoints as
// core/map/openlayers/basemapLayers.ts) so Base Map selection visibly
// changes the Vector view too. Map Type and Base Map are independent axes.

import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapId } from '../../../stores/mapStore';

function rasterStyle(tiles: string[], attribution: string, maxzoom = 19): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom,
        attribution,
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      },
    ],
  };
}

export const MAPLIBRE_STYLES: Record<BasemapId, StyleSpecification> = {
  streets: rasterStyle(
    ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
    '© OpenStreetMap contributors',
  ),
  satellite: rasterStyle(
    ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
  ),
  terrain: rasterStyle(
    [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
    '© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors',
    17,
  ),
  dark: rasterStyle(
    ['https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png'],
    '© OpenStreetMap contributors, Tiles © Wikimedia',
    18,
  ),
};

// Back-compat alias for the initial Vector style (streets).
export const MAPLIBRE_DEMO_STYLE: StyleSpecification = MAPLIBRE_STYLES.streets;

export type MapLibreStyleId = keyof typeof MAPLIBRE_STYLES;
