// MapLibre styles — zero-cost, no API key
// Use OSM raster for reliability — vector styles from OpenFreeMap can be flaky on slow networks
// This raster style is guaranteed to work without API keys

export const MAPLIBRE_DEMO_STYLE: string | object = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

export const MAPLIBRE_STYLES = {
  streets: MAPLIBRE_DEMO_STYLE,
  satellite: MAPLIBRE_DEMO_STYLE,
  terrain: MAPLIBRE_DEMO_STYLE,
  dark: MAPLIBRE_DEMO_STYLE,
} as const;

export type MapLibreStyleId = keyof typeof MAPLIBRE_STYLES;
