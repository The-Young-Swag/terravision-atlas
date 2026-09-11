// Streets tile providers for the 'streets' basemap slot (mirrors the
// SatelliteSource pattern in core/map/gibs.ts). Both endpoints are
// genuinely zero-cost and keyless: no API key, account, or paid tier.
// - 'osm' (default): OpenStreetMap standard style. Browsers send a real
//   User-Agent + Referer, the app requests viewport tiles only with no
//   prefetch — compliant with the OSM tile usage policy.
// - 'esri': Esri World Street Map alternate on Esri's CDN.

import type { StreetsSourceId } from '../../stores/mapStore';

export interface StreetsSourceMeta {
  id: StreetsSourceId;
  label: string;
  desc: string;
  /** Tile URL template ({z}/{x}/{y}); OL OSM source uses the canonical host. */
  url: string;
  attribution: string;
  maxZoom: number;
}

export const STREETS_SOURCES: StreetsSourceMeta[] = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    desc: 'Community standard · default',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
  {
    id: 'esri',
    label: 'Esri World Street Map',
    desc: 'Esri-hosted streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles © Esri — Source: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community',
    maxZoom: 19,
  },
];

export function streetsSourceMeta(id: StreetsSourceId): StreetsSourceMeta {
  return STREETS_SOURCES.find((s) => s.id === id) ?? STREETS_SOURCES[0];
}
