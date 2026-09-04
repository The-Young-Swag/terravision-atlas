// MapLibre styles — zero-cost, no API key
// Raster mirrors of the four 2D basemaps (same tile endpoints as
// core/map/openlayers/basemapLayers.ts) so Base Map selection visibly
// changes the Vector view too. Map Type and Base Map are independent axes.
// The 'satellite' slot renders the selected satellite source (Esri default
// or a NASA GIBS layer); GIBS serves levels 0-9 so maxzoom 9 overzooms.

import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapId } from '../../../stores/mapStore';
import {
  GIBS_MAX_ZOOM,
  gibsBestDate,
  gibsLayerMeta,
  gibsTileUrlTemplate,
  satelliteAttribution,
  type SatelliteSourceId,
} from '../gibs';

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

function satelliteStyle(source: SatelliteSourceId): StyleSpecification {
  if (source === 'esri') {
    return rasterStyle(
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      satelliteAttribution(source),
    );
  }
  const meta = gibsLayerMeta(source);
  return rasterStyle([gibsTileUrlTemplate(meta.product, gibsBestDate())], meta.attribution, GIBS_MAX_ZOOM);
}

export const MAPLIBRE_STYLES: Record<BasemapId, StyleSpecification> = {
  streets: rasterStyle(
    ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
    '© OpenStreetMap contributors',
  ),
  satellite: satelliteStyle('esri'),
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

/** Style for a basemap + satellite-source combination. */
export function maplibreStyleFor(basemap: BasemapId, satelliteSource: SatelliteSourceId): StyleSpecification {
  if (basemap === 'satellite') return satelliteStyle(satelliteSource);
  return MAPLIBRE_STYLES[basemap];
}

// Back-compat alias for the initial Vector style (streets).
export const MAPLIBRE_DEMO_STYLE: StyleSpecification = MAPLIBRE_STYLES.streets;

export type MapLibreStyleId = keyof typeof MAPLIBRE_STYLES;
