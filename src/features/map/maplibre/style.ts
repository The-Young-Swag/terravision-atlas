// MapLibre styles — zero-cost, no API key
// Raster mirrors of the four 2D basemaps (same tile endpoints as
// core/map/openlayers/basemapLayers.ts) so Base Map selection visibly
// changes the Vector view too. Map Type and Base Map are independent axes.
// The 'satellite' slot renders the selected satellite source (Esri default
// or a NASA GIBS layer); GIBS serves levels 0-9 so maxzoom 9 overzooms.

import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapId, StreetsSourceId } from '../store';
import { darkTileSource } from '../stadia';
import { streetsSourceMeta } from '../streets';
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

/** Streets style follows the selected streets source (OSM default). */
function streetsStyle(source: StreetsSourceId): StyleSpecification {
  const meta = streetsSourceMeta(source);
  return rasterStyle([meta.url], meta.attribution, meta.maxZoom);
}

/** Dark style resolves the Stadia key at build time (see core/map/stadia.ts). */
function darkStyle(): StyleSpecification {
  const dark = darkTileSource();
  return rasterStyle([dark.url], dark.attribution, dark.maxZoom);
}

export const MAPLIBRE_STYLES: Record<BasemapId, StyleSpecification> = {
  streets: streetsStyle('osm'),
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
  get dark() {
    return darkStyle();
  },
};

/** Style for a basemap + source combination. */
export function maplibreStyleFor(
  basemap: BasemapId,
  satelliteSource: SatelliteSourceId,
  streetsSource: StreetsSourceId = 'osm',
): StyleSpecification {
  if (basemap === 'satellite') return satelliteStyle(satelliteSource);
  if (basemap === 'dark') return darkStyle();
  if (basemap === 'streets') return streetsStyle(streetsSource);
  return MAPLIBRE_STYLES[basemap];
}

// Back-compat alias for the initial Vector style (streets).
export const MAPLIBRE_DEMO_STYLE: StyleSpecification = MAPLIBRE_STYLES.streets;

export type MapLibreStyleId = keyof typeof MAPLIBRE_STYLES;
